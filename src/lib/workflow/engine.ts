import { LLMResponse, ExtractedInfo } from '../schemas/llm-response';
import prisma from '../db';
import { ConversationState, VALID_TRANSITIONS, parseJsonArray, stringifyJsonArray } from '../types';

export interface WorkflowContext {
  conversationId: string;
  currentState: ConversationState;
  childName?: string | null;
  childAge?: number | null;
  symptoms: string[];
  symptomSeverity?: string | null;
  location?: string | null;
}

export interface WorkflowResult {
  newState: ConversationState;
  shouldExecuteTool: boolean;
  toolToExecute?: LLMResponse['toolCall'];
  responseMessage: string;
}

// Check if a state transition is valid
export function isValidTransition(
  from: ConversationState,
  to: ConversationState
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// Process LLM response and determine next actions
export async function processWorkflow(
  context: WorkflowContext,
  llmResponse: LLMResponse
): Promise<WorkflowResult> {
  const { currentState, conversationId } = context;
  
  // Determine new state
  let newState = currentState;
  if (llmResponse.stateTransition) {
    const proposedState = llmResponse.stateTransition.nextState as ConversationState;
    if (isValidTransition(currentState, proposedState)) {
      newState = proposedState;
    } else {
      console.warn(
        `Invalid state transition attempted: ${currentState} -> ${proposedState}`
      );
    }
  }
  
  // Update conversation with extracted info
  if (llmResponse.extractedInfo) {
    await updateConversationInfo(conversationId, llmResponse.extractedInfo, context.symptoms);
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
  existingSymptoms: string[]
): Promise<void> {
  const updateData: Record<string, unknown> = {};
  
  if (info.childName) updateData.childName = info.childName;
  if (info.childAge) updateData.childAge = info.childAge;
  if (info.symptoms && info.symptoms.length > 0) {
    // Append to existing symptoms, stored as JSON string for SQLite
    const allSymptoms = [...new Set([...existingSymptoms, ...info.symptoms])];
    updateData.symptoms = stringifyJsonArray(allSymptoms);
  }
  if (info.symptomSeverity) updateData.symptomSeverity = info.symptomSeverity;
  if (info.duration) updateData.duration = info.duration;
  if (info.location) updateData.location = info.location;
  if (info.selectedClinicId) updateData.selectedClinicId = info.selectedClinicId;
  if (info.appointmentTime) updateData.appointmentTime = new Date(info.appointmentTime);
  
  if (Object.keys(updateData).length > 0) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
    });
  }
}

// Get system prompt based on current state
export function getSystemPromptForState(state: ConversationState | string): string {
  const basePrompt = `You are BooBoo Buddy, a friendly and empathetic medical assistant helping parents with their children's minor health concerns. You must ALWAYS respond with valid JSON matching the required schema.

Your personality:
- Warm, caring, and reassuring
- Use simple, clear language
- Show empathy for worried parents
- Be concise but thorough

IMPORTANT: You are NOT a doctor. You help triage and connect families with appropriate care.`;

  const statePrompts: Record<string, string> = {
    GREETING: `${basePrompt}

Current task: Greet the user warmly and ask how you can help today. If they describe a concern, acknowledge it and prepare to collect child information.

Next state should be: COLLECTING_CHILD_INFO`,

    COLLECTING_CHILD_INFO: `${basePrompt}

Current task: Collect basic information about the child (name, age). Be conversational, not interrogative.

Required info: childName, childAge
Next state should be: COLLECTING_SYMPTOMS (once you have the child's info)`,

    COLLECTING_SYMPTOMS: `${basePrompt}

Current task: Understand the symptoms. Ask follow-up questions about:
- What symptoms are they experiencing?
- How long have they had these symptoms?
- Are symptoms getting better or worse?

Extract symptoms to the symptoms array.
Next state should be: ASSESSING_SEVERITY (once you understand the symptoms)`,

    ASSESSING_SEVERITY: `${basePrompt}

Current task: Assess the severity based on collected symptoms. Consider:
- Duration and progression
- Impact on daily activities
- Warning signs requiring immediate care

Set symptomSeverity to: mild, moderate, or severe
If SEVERE or emergency signs, use the escalate tool immediately.
Next state should be: SEARCHING_CLINICS`,

    SEARCHING_CLINICS: `${basePrompt}

Current task: Get the user's location and search for nearby clinics. Use the clinic_search tool.

Ask for their location if not already provided.
Next state should be: PRESENTING_OPTIONS`,

    PRESENTING_OPTIONS: `${basePrompt}

Current task: Present clinic options to the user. Help them choose based on:
- Distance
- Availability
- Specialties

Next state should be: SCHEDULING_CALL (once they select a clinic)`,

    SCHEDULING_CALL: `${basePrompt}

Current task: Help schedule a call or appointment with the selected clinic. Use the schedule_call tool.

Next state should be: CONFIRMING_APPOINTMENT`,

    CONFIRMING_APPOINTMENT: `${basePrompt}

Current task: Confirm the appointment details with the user. Provide:
- Clinic name and address
- Appointment time
- What to bring/prepare

Next state should be: COMPLETED`,

    COMPLETED: `${basePrompt}

Current task: Wrap up the conversation. Provide:
- Summary of what was arranged
- Reminder of appointment
- Offer to help with anything else

If they have a new concern, transition to GREETING.`,

    ESCALATED: `${basePrompt}

Current task: This case has been escalated. Reassure the user that:
- Their concern is being handled with priority
- A human team member will reach out shortly
- If emergency, advise calling 911

Provide clear next steps.`,
  };

  return statePrompts[state] || statePrompts.GREETING;
}

// Build conversation context for LLM
export async function buildConversationContext(conversationId: string): Promise<{
  conversation: unknown;
  context: WorkflowContext;
}> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
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
      childName: conversation.childName,
      childAge: conversation.childAge,
      symptoms: parseJsonArray<string>(conversation.symptoms),
      symptomSeverity: conversation.symptomSeverity,
      location: conversation.location,
    },
  };
}
