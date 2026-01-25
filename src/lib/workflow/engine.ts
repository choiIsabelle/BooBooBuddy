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
  const basePrompt = `You are BooBoo Buddy, a thoughtful health triage assistant. Your goal is to understand the user's situation before making recommendations.

CORE PRINCIPLES:
1. Take your time - gather enough information before recommending a clinic
2. Ask ONE focused question at a time
3. Only recommend a clinic when you have a clear picture of the situation
4. Keep responses SHORT (2-3 sentences max)

INFORMATION TO GATHER (in order):
1. PRIMARY COMPLAINT: What is the main symptom?
2. DURATION: How long has this been happening?
3. SEVERITY: How bad is it (1-10 or mild/moderate/severe)?
4. PROGRESSION: Is it getting better, worse, or staying the same?
5. ASSOCIATED SYMPTOMS: Any other symptoms?
6. IMPACT: How is this affecting daily activities?

WHEN TO RECOMMEND CLINIC:
- ONLY after gathering at least 3-4 pieces of information above
- OR if the user explicitly asks for a clinic
- OR if symptoms are clearly urgent (chest pain, difficulty breathing, severe bleeding, etc.)

RESPONSE FORMAT (always valid JSON):
{
  "message": "your response here",
  "stateTransition": { "nextState": "STATE_NAME" },
  "extractedInfo": { "symptoms": ["symptom1"], "symptomSeverity": "mild|moderate|severe" }
}
Note: stateTransition must be an object with nextState, NOT a string.
Note: omit toolCall entirely if not using a tool.`;

  const statePrompts: Record<string, string> = {
    GREETING: `${basePrompt}

CURRENT TASK: Greet the user warmly and ask what's bothering them today.
NEXT STATE: COLLECTING_SYMPTOMS (if they describe a health issue) or SEARCHING_CLINICS (only if they explicitly ask for a clinic)`,

    COLLECTING_INFO: `${basePrompt}

CURRENT TASK: Get basic context about who is affected and gather initial details.
NEXT STATE: COLLECTING_SYMPTOMS`,

    COLLECTING_SYMPTOMS: `${basePrompt}

CURRENT TASK: You are gathering symptom information. Ask about ONE of these that you don't know yet:
1. Duration - "How long have you been experiencing this?"
2. Severity - "On a scale of 1-10, how would you rate the pain/discomfort?"
3. Progression - "Has it been getting better, worse, or staying about the same?"
4. Location/Character - "Where exactly do you feel it? What does it feel like?"
5. Triggers - "Does anything make it better or worse?"
6. Associated symptoms - "Are you experiencing any other symptoms along with this?"

IMPORTANT: Stay in COLLECTING_SYMPTOMS until you have gathered at least 3-4 pieces of information.
NEXT STATE: ASSESSING_SEVERITY (only after you have enough information to make an assessment)`,

    ASSESSING_SEVERITY: `${basePrompt}

CURRENT TASK: Based on the information gathered, assess the severity:
- Consider: duration, intensity, progression, impact on daily life
- Look for red flags: sudden onset, severe pain, neurological symptoms, difficulty breathing

ASSESSMENT CATEGORIES:
- MILD: Minor discomfort, not affecting daily activities, improving or stable
- MODERATE: Noticeable impact on daily activities, persisting or worsening slowly  
- SEVERE: Significant pain/distress, rapid worsening, red flag symptoms

After assessment:
- MILD → PROVIDING_ADVICE with self-care tips
- MODERATE/SEVERE → SEARCHING_CLINICS to help find care

Explain your reasoning briefly to the user.`,

    PROVIDING_ADVICE: `${basePrompt}

CURRENT TASK: Provide helpful self-care advice:
- 2-3 specific actionable recommendations
- Warning signs that should prompt seeking care
- Timeline for when to reassess

NEXT STATE: COMPLETED (or SEARCHING_CLINICS if they want professional care)`,

    SEARCHING_CLINICS: `${basePrompt}

CURRENT TASK: Help the user find a nearby clinic.
- If you don't have their location, ask for their zip code or city
- If you have location, use the clinic_search tool

NEXT STATE: PRESENTING_OPTIONS`,

    PRESENTING_OPTIONS: `${basePrompt}

CURRENT TASK: Present the clinic options found. Mention name and key details.
NEXT STATE: SCHEDULING_CALL`,

    SCHEDULING_CALL: `${basePrompt}

CURRENT TASK: Confirm which clinic the user wants and help them connect.
NEXT STATE: CONFIRMING_APPOINTMENT`,

    CONFIRMING_APPOINTMENT: `${basePrompt}

CURRENT TASK: Confirm details: clinic name, time, what to bring if applicable.
NEXT STATE: COMPLETED`,

    COMPLETED: `${basePrompt}

CURRENT TASK: Brief wrap-up. Offer to help with anything else.`,

    ESCALATED: `${basePrompt}

CURRENT TASK: This needs urgent care. Be direct:
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
