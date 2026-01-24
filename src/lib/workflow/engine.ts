import { LLMResponse, ExtractedInfo } from "../schemas/llm-response";
import prisma from "../db";
import {
  ConversationState,
  VALID_TRANSITIONS,
  parseJsonArray,
  stringifyJsonArray,
} from "../types";

export interface WorkflowContext {
  conversationId: string;
  currentState: ConversationState;
  userName?: string | null;
  symptoms: string[];
  symptomSeverity?: string | null;
  location?: string | null;
  healthConcern?: string | null;
}

export interface WorkflowResult {
  newState: ConversationState;
  shouldExecuteTool: boolean;
  toolToExecute?: LLMResponse["toolCall"];
  responseMessage: string;
}

// Check if a state transition is valid
export function isValidTransition(
  from: ConversationState,
  to: ConversationState,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// Process LLM response and determine next actions
export async function processWorkflow(
  context: WorkflowContext,
  llmResponse: LLMResponse,
): Promise<WorkflowResult> {
  const { currentState, conversationId } = context;

  // Determine new state
  let newState = currentState;
  if (llmResponse.stateTransition) {
    const proposedState = llmResponse.stateTransition
      .nextState as ConversationState;
    if (isValidTransition(currentState, proposedState)) {
      newState = proposedState;
    } else {
      console.warn(
        `Invalid state transition attempted: ${currentState} -> ${proposedState}`,
      );
    }
  }

  // Update conversation with extracted info
  if (llmResponse.extractedInfo) {
    await updateConversationInfo(
      conversationId,
      llmResponse.extractedInfo,
      context.symptoms,
    );
  }

  // Update state in database
  if (newState !== currentState) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { state: newState },
    });
  }

  return {
    newState,
    shouldExecuteTool: !!llmResponse.toolCall,
    toolToExecute: llmResponse.toolCall,
    responseMessage: llmResponse.message,
  };
}

// Update conversation with extracted information
async function updateConversationInfo(
  conversationId: string,
  info: ExtractedInfo,
  existingSymptoms: string[],
): Promise<void> {
  const updateData: Record<string, unknown> = {};

  if (info.userName) updateData.userName = info.userName;
  if (info.healthConcern) updateData.healthConcern = info.healthConcern;
  if (info.symptoms && info.symptoms.length > 0) {
    // Append to existing symptoms, stored as JSON string for SQLite
    const allSymptoms = [...new Set([...existingSymptoms, ...info.symptoms])];
    updateData.symptoms = stringifyJsonArray(allSymptoms);
  }
  if (info.symptomSeverity) updateData.symptomSeverity = info.symptomSeverity;
  if (info.duration) updateData.duration = info.duration;
  if (info.location) updateData.location = info.location;
  if (info.selectedClinicId)
    updateData.selectedClinicId = info.selectedClinicId;
  if (info.appointmentTime)
    updateData.appointmentTime = new Date(info.appointmentTime);

  if (Object.keys(updateData).length > 0) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
    });
  }
}

// Get system prompt based on current state
export function getSystemPromptForState(
  state: ConversationState | string,
): string {
  const basePrompt = `You are BooBoo Buddy, a concise health triage assistant. Keep responses SHORT (1-3 sentences max). Ask ONE focused question at a time.

IMPORTANT: If user asks to find a clinic, doctor, or nearby care - GO DIRECTLY to SEARCHING_CLINICS state. Do not ask more questions about symptoms.

TRIAGE FRAMEWORK (only if user describes symptoms, not if they ask for clinics):
1. SYMPTOMS: What, when, severity?
2. CONTEXT: Any relevant history?

DECISION:
- User asks for clinic/doctor → SEARCHING_CLINICS immediately
- Concerning symptoms → SEARCHING_CLINICS
- Mild/monitorable → PROVIDING_ADVICE

RULES:
- Be direct and action-oriented
- One question per message
- If user wants a clinic, help them find one immediately
- Always respond with valid JSON

RESPONSE FORMAT:
{
  "message": "your short response",
  "stateTransition": { "nextState": "STATE_NAME" },
  "toolCall": { "tool": "clinic_search", "params": { "location": "..." } }
}
Note: stateTransition must be an object with nextState, NOT a string.
Note: omit toolCall entirely if not using a tool (don't use empty object {}).`;

  const statePrompts: Record<string, string> = {
    GREETING: `${basePrompt}

Task: Brief greeting, ask what's wrong. One sentence. If they ask for a clinic, go to SEARCHING_CLINICS.
Next: COLLECTING_SYMPTOMS or SEARCHING_CLINICS`,

    COLLECTING_INFO: `${basePrompt}

Task: Get essential context (who's affected, location for clinics). One question.
Next: COLLECTING_SYMPTOMS`,

    COLLECTING_SYMPTOMS: `${basePrompt}

Task: Gather key symptom info. Ask about ONE of these per message:
- Primary complaint & location
- Onset (when did it start?)
- Severity (1-10 or mild/moderate/severe)
- Progression (better/worse/same?)

Next: ASSESSING_SEVERITY (once you have enough to assess)`,

    ASSESSING_SEVERITY: `${basePrompt}

Task: Assess the symptoms. Consider:
- Duration and progression
- Impact on daily life
- Any risk factors

Set symptomSeverity. Make a decision:
- MODERATE or SEVERE → SEARCHING_CLINICS (help find care)
- MILD/monitorable → PROVIDING_ADVICE

Response: State your assessment briefly and next step.`,

    PROVIDING_ADVICE: `${basePrompt}

Task: Give 2-3 bullet points max:
- What to do now
- Warning signs to watch for
- When to seek care

Next: COMPLETED or SEARCHING_CLINICS if they want a clinic`,

    SEARCHING_CLINICS: `${basePrompt}

Task: Get location if needed, then use clinic_search tool.
Response: "What's your zip code or city?" OR execute tool.
Next: PRESENTING_OPTIONS`,

    PRESENTING_OPTIONS: `${basePrompt}

Task: List clinic options briefly (name, distance, hours). Ask which one.
Next: SCHEDULING_CALL`,

    SCHEDULING_CALL: `${basePrompt}

Task: Confirm clinic selection, use schedule_call tool.
Next: CONFIRMING_APPOINTMENT`,

    CONFIRMING_APPOINTMENT: `${basePrompt}

Task: Confirm details in 2-3 lines: clinic, time, what to bring.
Next: COMPLETED`,

    COMPLETED: `${basePrompt}

Task: Brief wrap-up. One sentence. Offer to help with anything else.`,

    ESCALATED: `${basePrompt}

Task: This needs urgent care. Be direct:
- "Let me find the nearest clinic or urgent care for you"
- Use clinic_search tool immediately
- Emphasize they should be seen quickly`,
  };

  return statePrompts[state] || statePrompts.GREETING;
}

// Build conversation context for LLM
export async function buildConversationContext(
  conversationId: string,
): Promise<{
  conversation: unknown;
  context: WorkflowContext;
}> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 20,
      },
      selectedClinic: true,
    },
  });

  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  return {
    conversation,
    context: {
      conversationId: conversation.id,
      currentState: conversation.state as ConversationState,
      userName: conversation.userName,
      symptoms: parseJsonArray<string>(conversation.symptoms),
      symptomSeverity: conversation.symptomSeverity,
      location: conversation.location,
      healthConcern: conversation.healthConcern,
    },
  };
}
