import OpenAI from 'openai';
import { LLMResponse, LLMResponseSchema, safeParseLLMResponse } from '../schemas/llm-response';
import { getSystemPromptForState } from '../workflow/engine';
import { ConversationState } from '../types';

// Lazy initialization of OpenAI client - only create when needed
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export interface LLMContext {
  state: ConversationState;
  childName?: string | null;
  childAge?: number | null;
  symptoms: string[];
  symptomSeverity?: string | null;
  location?: string | null;
  selectedClinic?: {
    name: string;
    address: string;
    phone: string;
  } | null;
  toolResults?: Array<{
    toolName: string;
    result: unknown;
  }>;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// JSON schema for structured output
const responseSchema = {
  type: 'object' as const,
  properties: {
    message: {
      type: 'string',
      description: 'The response message to display to the user',
    },
    toolCall: {
      type: 'object',
      properties: {
        tool: {
          type: 'string',
          enum: ['clinic_search', 'schedule_call', 'escalate'],
        },
        params: {
          type: 'object',
          additionalProperties: true,
        },
      },
      required: ['tool', 'params'],
    },
    stateTransition: {
      type: 'object',
      properties: {
        nextState: {
          type: 'string',
          enum: [
            'GREETING',
            'COLLECTING_CHILD_INFO',
            'COLLECTING_SYMPTOMS',
            'ASSESSING_SEVERITY',
            'SEARCHING_CLINICS',
            'PRESENTING_OPTIONS',
            'SCHEDULING_CALL',
            'CONFIRMING_APPOINTMENT',
            'COMPLETED',
            'ESCALATED',
          ],
        },
        reason: { type: 'string' },
      },
      required: ['nextState'],
    },
    extractedInfo: {
      type: 'object',
      properties: {
        childName: { type: 'string' },
        childAge: { type: 'number' },
        symptoms: { type: 'array', items: { type: 'string' } },
        symptomSeverity: { type: 'string', enum: ['mild', 'moderate', 'severe'] },
        duration: { type: 'string' },
        location: { type: 'string' },
        selectedClinicId: { type: 'string' },
        appointmentTime: { type: 'string' },
      },
    },
    reasoning: { type: 'string' },
  },
  required: ['message'],
  additionalProperties: false,
};

export async function generateLLMResponse(
  messages: Message[],
  context: LLMContext
): Promise<LLMResponse> {
  const systemPrompt = buildSystemPrompt(context);
  
  const openai = getOpenAIClient();
  
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'chat_response',
        strict: true,
        schema: responseSchema,
      },
    },
    temperature: 0.7,
    max_tokens: 1000,
  });
  
  const responseText = completion.choices[0]?.message?.content;
  
  if (!responseText) {
    throw new Error('No response from LLM');
  }
  
  // Parse and validate the response
  const parsed = JSON.parse(responseText);
  const validated = safeParseLLMResponse(parsed);
  
  if (!validated.success) {
    console.error('LLM response validation failed:', validated.error);
    // Return a safe fallback response
    return {
      message: "I apologize, but I'm having trouble processing that. Could you please rephrase your question?",
      reasoning: `Validation error: ${validated.error.message}`,
    };
  }
  
  return validated.data;
}

function buildSystemPrompt(context: LLMContext): string {
  const statePrompt = getSystemPromptForState(context.state);
  
  // Add current context information
  const contextInfo = `
Current conversation context:
- State: ${context.state}
${context.childName ? `- Child's name: ${context.childName}` : ''}
${context.childAge ? `- Child's age: ${context.childAge}` : ''}
${context.symptoms.length > 0 ? `- Reported symptoms: ${context.symptoms.join(', ')}` : ''}
${context.symptomSeverity ? `- Assessed severity: ${context.symptomSeverity}` : ''}
${context.location ? `- Location: ${context.location}` : ''}
${context.selectedClinic ? `- Selected clinic: ${context.selectedClinic.name}` : ''}

${context.toolResults ? `Tool results from previous action:\n${JSON.stringify(context.toolResults, null, 2)}` : ''}
`;

  const schemaInfo = `
You MUST respond with valid JSON matching this schema:
${JSON.stringify(LLMResponseSchema.shape, null, 2)}

Always include:
- "message": Your response to the user
- "stateTransition": If moving to a new conversation state
- "extractedInfo": Any new information learned from the user's message
- "toolCall": If you need to execute a tool (clinic_search, schedule_call, or escalate)
`;

  return `${statePrompt}\n\n${contextInfo}\n\n${schemaInfo}`;
}

// For testing without OpenAI
export async function generateMockLLMResponse(
  messages: Message[],
  context: LLMContext
): Promise<LLMResponse> {
  const lastMessage = messages[messages.length - 1]?.content || '';
  
  // Handle tool results
  if (context.toolResults && context.toolResults.length > 0) {
    const clinicResult = context.toolResults.find(t => t.toolName === 'clinic_search');
    if (clinicResult) {
      return {
        message: "I found some nearby clinics that can help! Here are your options. Which one would you like to schedule with?",
        stateTransition: { nextState: 'PRESENTING_OPTIONS' },
      };
    }
  }
  
  // Simple mock responses based on state
  switch (context.state) {
    case 'GREETING':
      return {
        message: "Hi there! 👋 I'm BooBoo Buddy, here to help with your little one's health concerns. What's going on today?",
        stateTransition: { nextState: 'COLLECTING_CHILD_INFO' },
      };
    
    case 'COLLECTING_CHILD_INFO':
      // Try to extract name and age from message
      const nameMatch = lastMessage.match(/(?:name is |called |I'm |my (?:son|daughter|child) )(\w+)/i);
      const ageMatch = lastMessage.match(/(\d+)\s*(?:years? old|yo|months?)/i);
      
      if (nameMatch && ageMatch) {
        return {
          message: `Thanks! So ${nameMatch[1]} is ${ageMatch[1]} years old. What symptoms are they experiencing?`,
          stateTransition: { nextState: 'COLLECTING_SYMPTOMS' },
          extractedInfo: {
            childName: nameMatch[1],
            childAge: parseInt(ageMatch[1]),
          },
        };
      }
      
      return {
        message: "Could you tell me your child's name and age so I can better help you?",
      };
    
    case 'COLLECTING_SYMPTOMS':
      return {
        message: "I understand. How long have these symptoms been going on? Are they getting better or worse?",
        stateTransition: { nextState: 'ASSESSING_SEVERITY' },
        extractedInfo: {
          symptoms: [lastMessage],
        },
      };
    
    case 'ASSESSING_SEVERITY':
      return {
        message: "Based on what you've described, this sounds like it could use a professional look. Let me find some nearby clinics. What's your zip code or city?",
        stateTransition: { nextState: 'SEARCHING_CLINICS' },
        extractedInfo: {
          symptomSeverity: 'moderate',
        },
      };
    
    case 'SEARCHING_CLINICS':
      return {
        message: "Let me search for clinics near you...",
        stateTransition: { nextState: 'PRESENTING_OPTIONS' },
        toolCall: {
          tool: 'clinic_search',
          params: {
            location: lastMessage || 'nearby',
          },
        },
        extractedInfo: {
          location: lastMessage,
        },
      };
    
    case 'PRESENTING_OPTIONS':
      return {
        message: "Great choice! Would you like me to schedule an appointment for you?",
        stateTransition: { nextState: 'SCHEDULING_CALL' },
      };
    
    case 'SCHEDULING_CALL':
      return {
        message: "I've scheduled your appointment. You'll receive a confirmation shortly.",
        stateTransition: { nextState: 'CONFIRMING_APPOINTMENT' },
        toolCall: {
          tool: 'schedule_call',
          params: {
            clinicId: 'clinic-1',
            reason: context.symptoms.join(', ') || 'General consultation',
          },
        },
      };
    
    case 'CONFIRMING_APPOINTMENT':
      return {
        message: "Your appointment is confirmed! Is there anything else I can help you with?",
        stateTransition: { nextState: 'COMPLETED' },
      };
    
    case 'COMPLETED':
      return {
        message: "Take care! Feel free to come back anytime you need help. 💚",
      };
    
    default:
      return {
        message: "How can I help you today?",
      };
  }
}
