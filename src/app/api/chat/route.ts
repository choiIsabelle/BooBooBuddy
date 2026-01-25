import { NextRequest, NextResponse } from "next/server";
import { SendMessageRequestSchema } from "@/lib/schemas/api";
import prisma from "@/lib/db";
import {
  processWorkflow,
  buildConversationContext,
  getSystemPromptForState,
} from "@/lib/workflow";
import {
  generateLLMResponse,
  generateMockLLMResponse,
  LLMContext,
} from "@/lib/llm";
import { executeTool } from "@/lib/tools";
import { ConversationState } from "@/lib/types";

// Use mock LLM only if USE_MOCK_LLM is explicitly set to true, or if no API keys are available
const useMockLLM =
  process.env.USE_MOCK_LLM === "true" ||
  (!process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY);

console.log("🔧 Chat API Configuration:");
console.log("   USE_MOCK_LLM env:", process.env.USE_MOCK_LLM);
console.log("   OPENROUTER_API_KEY exists:", !!process.env.OPENROUTER_API_KEY);
console.log("   OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);
console.log("   Using mock LLM:", useMockLLM);

// Helper to parse JSON array stored as string
function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    return JSON.parse(value) as T[];
  } catch {
    return [];
  }
}

// Helper to extract location from user message (zip code, city names)
function extractLocationFromMessage(message: string): string | null {
  // Check for 5-digit US zip code
  const zipMatch = message.match(/\b\d{5}\b/);
  if (zipMatch) {
    return zipMatch[0];
  }

  // Check for Canadian postal code (e.g., H2X 1Y4)
  const canadianPostalMatch = message.match(/\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i);
  if (canadianPostalMatch) {
    return canadianPostalMatch[0].toUpperCase();
  }

  // Check for explicit location phrases like "in Montreal" or "near Seattle, WA"
  const locationPatterns = [
    /(?:in|near|around|at|from)\s+([A-Z][a-zA-Z\s]+(?:,\s*[A-Z]{2})?)/i,
  ];

  // Excluded common words that aren't locations
  const excluded = [
    "find",
    "search",
    "clinic",
    "doctor",
    "help",
    "need",
    "want",
    "nearby",
    "the",
    "hello",
    "hi",
    "hey",
    "thanks",
    "thank",
    "you",
    "please",
    "yes",
    "no",
    "okay",
    "ok",
    "sure",
    "great",
    "good",
    "bad",
    "pain",
    "hurt",
    "ache",
    "sick",
    "ill",
    "fever",
    "cold",
    "headache",
    "stomach",
    "back",
    "chest",
    "throat",
    "ear",
    "eye",
    "today",
    "yesterday",
    "tomorrow",
    "now",
    "soon",
    "later",
    "morning",
    "afternoon",
    "evening",
    "night",
    "week",
    "month",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  for (const pattern of locationPatterns) {
    const match = message.match(pattern);
    if (match && match[1] && match[1].length > 2) {
      const potentialLocation = match[1].toLowerCase().trim();
      if (!excluded.includes(potentialLocation)) {
        return match[1].trim();
      }
    }
  }

  return null;
}

// Calculate triage level from conversation state
// Returns a number 0-4 indicating progression toward clinic recommendation
// 0 = info gathering, 4 = clinic recommended
function getTriageLevel(state: string): {
  level: number;
  label: string;
  description: string;
} {
  switch (state) {
    case "GREETING":
      return {
        level: 0,
        label: "Listening",
        description: "Tell me what's going on",
      };
    case "COLLECTING_INFO":
    case "COLLECTING_SYMPTOMS":
      return {
        level: 1,
        label: "Understanding",
        description: "Gathering symptom details",
      };
    case "ASSESSING_SEVERITY":
      return {
        level: 2,
        label: "Assessing",
        description: "Evaluating your symptoms",
      };
    case "PROVIDING_ADVICE":
      return {
        level: 3,
        label: "Advising",
        description: "Considering care options",
      };
    case "SEARCHING_CLINICS":
    case "PRESENTING_OPTIONS":
    case "SCHEDULING_CALL":
    case "CONFIRMING_APPOINTMENT":
      return {
        level: 4,
        label: "Clinic Recommended",
        description: "Professional care advised",
      };
    case "ESCALATED":
      return { level: 4, label: "Urgent", description: "Seek immediate care" };
    case "COMPLETED":
      return { level: 0, label: "Complete", description: "Take care!" };
    default:
      return {
        level: 0,
        label: "Listening",
        description: "Tell me what's going on",
      };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log("📥 Received request body:");
    console.log("   geolocation:", body.geolocation || "(not provided)");

    // Validate request
    const parsed = SendMessageRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { conversationId, userId, message, geolocation } = parsed.data;

    // Browser geolocation as coordinates string (highest priority)
    const browserLocation = geolocation
      ? `${geolocation.lat},${geolocation.lng}`
      : null;
    if (browserLocation) {
      console.log(`🌐 Browser geolocation: ${browserLocation}`);
    }

    // Fetch user's profile location if userId is provided
    let userProfileLocation: string | null = null;
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { location: true },
      });
      userProfileLocation = user?.location || null;
      console.log(
        `👤 User profile location: ${userProfileLocation || "not set"}`,
      );
    }

    // Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
      });

      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 },
        );
      }
    } else {
      // Create new conversation
      conversation = await prisma.conversation.create({
        data: {
          state: "GREETING",
          symptoms: "[]",
          messages: {
            create: {
              role: "SYSTEM",
              content: getSystemPromptForState("GREETING"),
            },
          },
        },
        include: { messages: true },
      });
    }

    // Save user message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: message,
      },
    });

    // Build context for LLM
    const { context } = await buildConversationContext(conversation.id);

    // Early location detection from message
    const earlyLocationFromMessage = extractLocationFromMessage(message);

    // Priority: browser geolocation > message > conversation > user profile
    const earlyEffectiveLocation =
      browserLocation ||
      earlyLocationFromMessage ||
      context.location ||
      userProfileLocation;

    // Check if user is asking for clinic search
    const earlyClinicSearchRequest =
      /clinic|doctor|nearby|find.*care|urgent\s*care|appointment|see\s*(a\s*)?doctor/i.test(
        message,
      );

    console.log("🔍 Early detection:");
    console.log("   Current state:", context.currentState);
    console.log("   User asking for clinic:", earlyClinicSearchRequest);
    console.log("   Browser geolocation:", browserLocation || "(none)");
    console.log(
      "   Location from message:",
      earlyLocationFromMessage || "(none)",
    );
    console.log("   Effective location:", earlyEffectiveLocation || "(none)");

    // EARLY INTERCEPT: If user asks for clinic AND we have geolocation, search immediately!
    if (earlyClinicSearchRequest && browserLocation) {
      console.log(
        "🚀 Early intercept: Using browser geolocation for clinic search",
      );

      // Execute clinic search with browser coordinates
      const toolResult = await executeTool(
        { tool: "clinic_search", params: { location: browserLocation } },
        conversation.id,
      );

      // Update state
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { state: "PRESENTING_OPTIONS" },
      });

      const responseMsg = toolResult.success
        ? "I found some clinics near your location. Here are your options:"
        : "I had trouble finding clinics. Please try again.";

      const assistantMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "ASSISTANT",
          content: responseMsg,
        },
      });

      return NextResponse.json({
        conversationId: conversation.id,
        message: {
          id: assistantMessage.id,
          role: assistantMessage.role,
          content: assistantMessage.content,
          createdAt: assistantMessage.createdAt.toISOString(),
        },
        state: "PRESENTING_OPTIONS",
        triage: getTriageLevel("PRESENTING_OPTIONS"),
        toolResults: toolResult.success
          ? [{ toolName: "clinic_search", result: toolResult.data }]
          : undefined,
      });
    }

    // EARLY INTERCEPT: If we're in SEARCHING_CLINICS and user just gave location, search immediately
    if (
      context.currentState === "SEARCHING_CLINICS" &&
      earlyLocationFromMessage
    ) {
      console.log(
        "🚀 Early intercept: User provided location while in SEARCHING_CLINICS state",
      );

      // Save location
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { location: earlyLocationFromMessage },
      });

      // Execute clinic search
      const toolResult = await executeTool(
        {
          tool: "clinic_search",
          params: { location: earlyLocationFromMessage },
        },
        conversation.id,
      );

      // Save assistant message
      const responseMsg = toolResult.success
        ? `I found some clinics near ${earlyLocationFromMessage} for you. Here are your options:`
        : "I had trouble finding clinics. Please try again.";

      const assistantMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "ASSISTANT",
          content: responseMsg,
        },
      });

      // Update state to PRESENTING_OPTIONS
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { state: "PRESENTING_OPTIONS" },
      });

      return NextResponse.json({
        conversationId: conversation.id,
        message: {
          id: assistantMessage.id,
          role: assistantMessage.role,
          content: assistantMessage.content,
          createdAt: assistantMessage.createdAt.toISOString(),
        },
        state: "PRESENTING_OPTIONS",
        triage: getTriageLevel("PRESENTING_OPTIONS"),
        toolResults: toolResult.success
          ? [{ toolName: "clinic_search", result: toolResult.data }]
          : undefined,
      });
    }

    // EARLY INTERCEPT: If user asks for clinic but no location, ask for it
    if (earlyClinicSearchRequest && !earlyEffectiveLocation) {
      console.log(
        "📍 Early intercept: User wants clinic but no location - prompting",
      );

      // Update state to SEARCHING_CLINICS
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { state: "SEARCHING_CLINICS" },
      });

      const responseMsg =
        "I'd be happy to help you find a nearby clinic! What's your zip code or city so I can search for clinics in your area?";

      const assistantMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "ASSISTANT",
          content: responseMsg,
        },
      });

      return NextResponse.json({
        conversationId: conversation.id,
        message: {
          id: assistantMessage.id,
          role: assistantMessage.role,
          content: assistantMessage.content,
          createdAt: assistantMessage.createdAt.toISOString(),
        },
        state: "SEARCHING_CLINICS",
        triage: getTriageLevel("SEARCHING_CLINICS"),
      });
    }

    // Prepare messages for LLM
    const llmMessages = [
      ...conversation.messages
        .filter((m: { role: string }) => m.role !== "SYSTEM")
        .map((m: { role: string; content: string }) => ({
          role: m.role.toLowerCase() as "user" | "assistant",
          content: m.content,
        })),
      { role: "user" as const, content: message },
    ];

    // Get LLM response
    const llmContext: LLMContext = {
      state: context.currentState as ConversationState,
      userName: context.userName,
      symptoms: context.symptoms,
      symptomSeverity: context.symptomSeverity,
      location: context.location,
      healthConcern: context.healthConcern,
    };

    const llmResponse = useMockLLM
      ? await generateMockLLMResponse(llmMessages, llmContext)
      : await generateLLMResponse(llmMessages, llmContext);

    // Process workflow (state transitions, extracted info)
    const workflowResult = await processWorkflow(context, llmResponse);

    // Check for location in the user message (zip code, city name)
    const locationFromMessage = extractLocationFromMessage(message);

    // Priority for location: message > conversation > user profile
    const effectiveLocation =
      locationFromMessage || context.location || userProfileLocation;

    console.log("📍 Location resolution:");
    console.log("   From message:", locationFromMessage || "(none)");
    console.log("   From conversation:", context.location || "(none)");
    console.log("   From user profile:", userProfileLocation || "(none)");
    console.log("   Effective location:", effectiveLocation || "(none)");

    // Check if user is asking for clinic search (regardless of current state)
    const isClinicSearchRequest =
      /clinic|doctor|nearby|find.*care|urgent\s*care|appointment|see\s*(a\s*)?doctor/i.test(
        message,
      );

    // Check if LLM response indicates clinic search intent
    const llmWantsClinicSearch =
      /clinic|find.*care|search.*nearby|location|zip\s*code/i.test(
        workflowResult.responseMessage,
      );

    // Save location to conversation if newly detected
    if (locationFromMessage && !context.location) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { location: locationFromMessage },
      });
    }

    // Execute tool if needed
    let toolResults;
    let needsLocationPrompt = false;

    // Check if we need to ask for location
    const wantsToSearchClinics =
      workflowResult.newState === "SEARCHING_CLINICS" ||
      isClinicSearchRequest ||
      llmWantsClinicSearch ||
      (workflowResult.shouldExecuteTool &&
        workflowResult.toolToExecute?.tool === "clinic_search");

    console.log("🔍 Clinic search detection:");
    console.log(
      "   State is SEARCHING_CLINICS:",
      workflowResult.newState === "SEARCHING_CLINICS",
    );
    console.log(
      "   User message matches clinic pattern:",
      isClinicSearchRequest,
    );
    console.log(
      "   LLM response mentions clinic/location:",
      llmWantsClinicSearch,
    );
    console.log(
      "   LLM called clinic_search tool:",
      workflowResult.shouldExecuteTool &&
        workflowResult.toolToExecute?.tool === "clinic_search",
    );
    console.log("   wantsToSearchClinics:", wantsToSearchClinics);
    console.log("   effectiveLocation:", effectiveLocation || "(none)");

    if (wantsToSearchClinics && !effectiveLocation) {
      // No location available - ask the user
      needsLocationPrompt = true;
      console.log("📍 No location available, will prompt user");

      // Update state to SEARCHING_CLINICS so we continue the flow
      workflowResult.newState = "SEARCHING_CLINICS" as ConversationState;
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { state: "SEARCHING_CLINICS" },
      });

      // Override response to ask for location
      workflowResult.responseMessage =
        "I'd be happy to help you find a nearby clinic! What's your zip code or city so I can search for clinics in your area?";
    }

    // PROACTIVE CLINIC SEARCH: Auto-trigger when:
    // 1. Entering SEARCHING_CLINICS state with location, OR
    // 2. User explicitly asks for clinic with location (bypass state machine)
    const shouldAutoSearch =
      !needsLocationPrompt &&
      (workflowResult.newState === "SEARCHING_CLINICS" ||
        (isClinicSearchRequest && effectiveLocation)) &&
      effectiveLocation &&
      !workflowResult.shouldExecuteTool;

    if (shouldAutoSearch) {
      console.log(
        "🔄 Auto-triggering clinic search for location:",
        effectiveLocation,
      );

      // Force state to SEARCHING_CLINICS if not already
      if (workflowResult.newState !== "SEARCHING_CLINICS") {
        workflowResult.newState = "SEARCHING_CLINICS" as ConversationState;
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { state: "SEARCHING_CLINICS" },
        });
      }

      const autoToolCall = {
        tool: "clinic_search" as const,
        params: { location: effectiveLocation },
      };
      const toolResult = await executeTool(autoToolCall, conversation.id);

      if (toolResult.success) {
        toolResults = [{ toolName: "clinic_search", result: toolResult.data }];

        // Update the response message with clinic context
        workflowResult.responseMessage = `I found some clinics near ${effectiveLocation} for you. Here are your options:`;
      }
    } else if (
      workflowResult.shouldExecuteTool &&
      workflowResult.toolToExecute
    ) {
      const toolResult = await executeTool(
        workflowResult.toolToExecute,
        conversation.id,
      );
      toolResults = [
        {
          toolName: workflowResult.toolToExecute.tool,
          result: toolResult.data,
        },
      ];

      // If tool was executed, get a follow-up response with tool results
      if (toolResult.success) {
        const followUpContext: LLMContext = {
          ...llmContext,
          toolResults,
        };

        const followUpResponse = useMockLLM
          ? await generateMockLLMResponse(llmMessages, followUpContext)
          : await generateLLMResponse(llmMessages, followUpContext);

        // Update the message with tool results incorporated
        workflowResult.responseMessage = followUpResponse.message;
      }
    }

    // Save assistant message
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: workflowResult.responseMessage,
        rawLlmResponse: JSON.stringify(llmResponse),
      },
    });

    // Calculate triage level for the new state
    const triageInfo = getTriageLevel(workflowResult.newState);

    // Return response
    return NextResponse.json({
      conversationId: conversation.id,
      message: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt.toISOString(),
      },
      state: workflowResult.newState,
      triage: triageInfo,
      toolResults,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// GET: Retrieve conversation history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId is required" },
        { status: 400 },
      );
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          where: { role: { not: "SYSTEM" } },
        },
        selectedClinic: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: conversation.id,
      state: conversation.state,
      childName: conversation.childName,
      childAge: conversation.childAge,
      symptoms: parseJsonArray<string>(conversation.symptoms),
      messages: conversation.messages.map(
        (m: {
          id: string;
          role: string;
          content: string;
          createdAt: Date;
        }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        }),
      ),
      selectedClinic: conversation.selectedClinic,
      appointmentTime: conversation.appointmentTime?.toISOString(),
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
