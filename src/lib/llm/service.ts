import OpenAI from "openai";
import {
  LLMResponse,
  LLMResponseSchema,
  safeParseLLMResponse,
} from "../schemas/llm-response";
import { getSystemPromptForState } from "../workflow/engine";
import { ConversationState } from "../types";

// Lazy initialization of OpenAI client - only create when needed
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    // Check for OpenRouter API key first, then fall back to OpenAI
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY or OPENAI_API_KEY is not set");
    }

    // If using OpenRouter, set the base URL
    const isOpenRouter = !!process.env.OPENROUTER_API_KEY;

    console.log("🔑 Initializing LLM client...");
    console.log("   Using OpenRouter:", isOpenRouter);
    console.log("   API Key prefix:", apiKey.substring(0, 15) + "...");

    openaiClient = new OpenAI({
      apiKey: apiKey,
      baseURL: isOpenRouter ? "https://openrouter.ai/api/v1" : undefined,
    });

    console.log("✅ LLM client initialized");
  }
  return openaiClient;
}

export interface LLMContext {
  state: ConversationState;
  userName?: string | null;
  symptoms: string[];
  symptomSeverity?: string | null;
  location?: string | null;
  healthConcern?: string | null;
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
  role: "user" | "assistant" | "system";
  content: string;
}

export async function generateLLMResponse(
  messages: Message[],
  context: LLMContext,
): Promise<LLMResponse> {
  console.log("🤖 generateLLMResponse called");
  console.log("   Messages count:", messages.length);
  console.log("   Context state:", context.state);

  const systemPrompt = buildSystemPrompt(context);

  const openai = getOpenAIClient();

  const model = process.env.OPENAI_MODEL || "openai/gpt-4o-mini";
  const isOpenRouter = !!process.env.OPENROUTER_API_KEY;
  console.log("   Model:", model);
  console.log("   Using OpenRouter:", isOpenRouter);
  console.log("🚀 Making API call to LLM...");

  // Add JSON instruction to system prompt for OpenRouter compatibility
  const jsonInstruction = `

IMPORTANT: You must respond with valid JSON in this exact format:
{
  "message": "your response message to the user",
  "reasoning": "brief explanation of your reasoning (optional)"
}

Only respond with the JSON object, no other text.`;

  try {
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemPrompt + jsonInstruction },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        })),
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    console.log("✅ API response received!");
    console.log("   Finish reason:", completion.choices[0]?.finish_reason);

    const responseText = completion.choices[0]?.message?.content;
    console.log("   Raw response:", responseText);

    if (!responseText) {
      throw new Error("No response from LLM");
    }

    // Try to extract JSON from the response (in case LLM includes extra text)
    let jsonText = responseText.trim();

    // If response starts with ```json or ```, extract the JSON content
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    // Try to find JSON object in the response
    const jsonObjectMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      jsonText = jsonObjectMatch[0];
    }

    // Parse and validate the response
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.error("❌ Failed to parse JSON:", parseError);
      console.error("   Response text:", responseText);
      // Return the raw response as the message with inferred state
      // Check if the response mentions clinics or seeking care
      const mentionsClinics =
        /clinic|doctor|medical attention|seek care|urgent care|find.*care/i.test(
          responseText,
        );
      const asksQuestion = /\?/.test(responseText);

      let inferredState = context.state; // Default: stay in current state
      if (mentionsClinics) {
        inferredState = "SEARCHING_CLINICS" as ConversationState;
      } else if (asksQuestion && context.state === "GREETING") {
        inferredState = "COLLECTING_SYMPTOMS" as ConversationState;
      }

      return {
        message: responseText,
        reasoning: "Could not parse structured response, returning raw text",
        stateTransition:
          inferredState !== context.state
            ? { nextState: inferredState }
            : undefined,
      };
    }

    console.log("   Parsed response:", JSON.stringify(parsed, null, 2));

    // Fix common LLM response issues before validation
    // 1. Fix stateTransition if it's a string instead of object
    if (typeof parsed.stateTransition === "string") {
      parsed.stateTransition = { nextState: parsed.stateTransition };
    }

    // 2. Remove invalid or empty toolCall objects
    if (parsed.toolCall) {
      const validTools = ["clinic_search", "schedule_call", "escalate"];
      // Remove if empty, missing tool property, or invalid tool name
      if (
        !parsed.toolCall.tool ||
        Object.keys(parsed.toolCall).length === 0 ||
        !validTools.includes(parsed.toolCall.tool)
      ) {
        console.log("   Removing invalid toolCall:", parsed.toolCall);
        delete parsed.toolCall;
      }
    }

    // 3. Remove empty extractedInfo objects
    if (
      parsed.extractedInfo &&
      Object.keys(parsed.extractedInfo).length === 0
    ) {
      delete parsed.extractedInfo;
    }

    // 4. Validate stateTransition.nextState if present
    if (parsed.stateTransition) {
      const validStates = [
        "GREETING",
        "COLLECTING_INFO",
        "COLLECTING_SYMPTOMS",
        "ASSESSING_SEVERITY",
        "PROVIDING_ADVICE",
        "SEARCHING_CLINICS",
        "PRESENTING_OPTIONS",
        "SCHEDULING_CALL",
        "CONFIRMING_APPOINTMENT",
        "COMPLETED",
        "ESCALATED",
      ];
      if (!validStates.includes(parsed.stateTransition.nextState)) {
        console.log(
          "   Removing invalid stateTransition:",
          parsed.stateTransition,
        );
        delete parsed.stateTransition;
      }
    }

    const validated = safeParseLLMResponse(parsed);

    if (!validated.success) {
      console.error("❌ LLM response validation failed:", validated.error);
      // If we at least have a message field, use it
      if (parsed.message && typeof parsed.message === "string") {
        return {
          message: parsed.message,
          reasoning: parsed.reasoning || "Partial validation",
        };
      }
      // Return a safe fallback response
      return {
        message:
          "I apologize, but I'm having trouble processing that. Could you please rephrase your question?",
        reasoning: `Validation error: ${validated.error.message}`,
      };
    }

    console.log("✅ Response validated successfully");
    return validated.data;
  } catch (error) {
    console.error("❌ LLM API call failed:", error);
    throw error;
  }
}

function buildSystemPrompt(context: LLMContext): string {
  const statePrompt = getSystemPromptForState(context.state);

  // Add current context information
  const contextInfo = `
Current conversation context:
- State: ${context.state}
${context.userName ? `- User's name: ${context.userName}` : ""}
${context.healthConcern ? `- Health concern: ${context.healthConcern}` : ""}
${context.symptoms.length > 0 ? `- Reported symptoms: ${context.symptoms.join(", ")}` : ""}
${context.symptomSeverity ? `- Assessed severity: ${context.symptomSeverity}` : ""}
${context.location ? `- Location: ${context.location}` : ""}
${context.selectedClinic ? `- Selected clinic: ${context.selectedClinic.name}` : ""}

${context.toolResults ? `Tool results from previous action:\n${JSON.stringify(context.toolResults, null, 2)}` : ""}
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
  context: LLMContext,
): Promise<LLMResponse> {
  const lastMessage = messages[messages.length - 1]?.content || "";

  // Check if user is directly asking for clinics - skip triage, go straight to search
  const wantsClinic =
    /clinic|doctor|nearby|find.*clinic|need.*doctor|see.*doctor|urgent care|walk.?in/i.test(
      lastMessage,
    );

  if (
    wantsClinic &&
    context.state !== "PRESENTING_OPTIONS" &&
    context.state !== "SCHEDULING_CALL"
  ) {
    // If we already have location, search immediately
    if (context.location) {
      return {
        message: "Let me find nearby clinics for you...",
        stateTransition: { nextState: "SEARCHING_CLINICS" },
        toolCall: {
          tool: "clinic_search",
          params: { location: context.location },
        },
      };
    }
    // Otherwise ask for location
    return {
      message: "I'll help you find a clinic. What's your zip code or city?",
      stateTransition: { nextState: "SEARCHING_CLINICS" },
    };
  }

  // Handle tool results
  if (context.toolResults && context.toolResults.length > 0) {
    const clinicResult = context.toolResults.find(
      (t) => t.toolName === "clinic_search",
    );
    if (clinicResult) {
      return {
        message: "Found nearby clinics for you. Which one works for you?",
        stateTransition: { nextState: "PRESENTING_OPTIONS" },
      };
    }
  }

  // Concise mock responses based on state
  switch (context.state) {
    case "GREETING":
      // Check if greeting message contains clinic request
      if (wantsClinic) {
        return {
          message: "I'll help you find a clinic. What's your zip code or city?",
          stateTransition: { nextState: "SEARCHING_CLINICS" },
        };
      }
      return {
        message: "Hi, I'm BooBoo Buddy. What's going on?",
        stateTransition: { nextState: "COLLECTING_SYMPTOMS" },
      };

    case "COLLECTING_INFO":
      return {
        message: "What symptoms are you experiencing?",
        stateTransition: { nextState: "COLLECTING_SYMPTOMS" },
      };

    case "COLLECTING_SYMPTOMS":
      return {
        message: "How long has this been going on?",
        stateTransition: { nextState: "ASSESSING_SEVERITY" },
        extractedInfo: {
          symptoms: [lastMessage],
        },
      };

    case "ASSESSING_SEVERITY":
      // Check for red flag keywords
      const redFlags =
        /chest pain|can't breathe|unconscious|severe bleeding|stroke|seizure/i;
      if (redFlags.test(lastMessage)) {
        return {
          message:
            "This needs urgent attention. Let me find the nearest clinic or urgent care for you right away. What's your location?",
          stateTransition: { nextState: "SEARCHING_CLINICS" },
          extractedInfo: { symptomSeverity: "severe" },
        };
      }

      return {
        message:
          "This should be seen by a doctor. Want me to find nearby clinics?",
        stateTransition: { nextState: "SEARCHING_CLINICS" },
        extractedInfo: { symptomSeverity: "moderate" },
      };

    case "PROVIDING_ADVICE":
      return {
        message:
          "• Rest and stay hydrated\n• Watch for fever >101°F or worsening symptoms\n• See a doctor if no improvement in 2-3 days",
        stateTransition: { nextState: "COMPLETED" },
      };

    case "SEARCHING_CLINICS":
      // If user provided a location (zip, city, etc.), trigger search
      const hasLocation = /\d{5}|[a-zA-Z]+\s*(,\s*[a-zA-Z]{2})?/.test(
        lastMessage,
      );
      if (hasLocation || lastMessage.toLowerCase().includes("yes")) {
        return {
          message: "Searching for nearby clinics...",
          stateTransition: { nextState: "PRESENTING_OPTIONS" },
          toolCall: {
            tool: "clinic_search",
            params: { location: lastMessage || context.location || "nearby" },
          },
          extractedInfo: { location: lastMessage },
        };
      }
      return {
        message: "What's your zip code or city so I can find clinics near you?",
      };

    case "PRESENTING_OPTIONS":
      return {
        message: "Which clinic do you prefer?",
        stateTransition: { nextState: "SCHEDULING_CALL" },
      };

    case "SCHEDULING_CALL":
      return {
        message: "Scheduling your appointment...",
        stateTransition: { nextState: "CONFIRMING_APPOINTMENT" },
        toolCall: {
          tool: "schedule_call",
          params: {
            clinicId: "clinic-1",
            reason: context.symptoms.join(", ") || "Consultation",
          },
        },
      };

    case "CONFIRMING_APPOINTMENT":
      return {
        message: "✓ Confirmed. Bring ID and insurance. Anything else?",
        stateTransition: { nextState: "COMPLETED" },
      };

    case "COMPLETED":
      return {
        message: "Take care! Come back if you need help.",
      };

    case "ESCALATED":
      return {
        message:
          "This needs urgent care. Let me find the nearest clinic for you.",
        stateTransition: { nextState: "SEARCHING_CLINICS" },
        toolCall: {
          tool: "clinic_search",
          params: { location: context.location || "nearby" },
        },
      };

    default:
      return {
        message: "What's going on?",
      };
  }
}
