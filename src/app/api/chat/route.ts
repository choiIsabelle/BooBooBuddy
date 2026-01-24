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

  // Check for common location phrases
  const locationPatterns = [
    /(?:in|near|around|at)\s+([A-Z][a-zA-Z\s]+(?:,\s*[A-Z]{2})?)/i,
    /([A-Z][a-zA-Z]+(?:,\s*[A-Z]{2})?)(?:\s+area|\s+zip|\s+city)?/i,
  ];

  for (const pattern of locationPatterns) {
    const match = message.match(pattern);
    if (match && match[1] && match[1].length > 2) {
      // Exclude common words that aren't locations
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
      ];
      if (!excluded.includes(match[1].toLowerCase().trim())) {
        return match[1].trim();
      }
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const parsed = SendMessageRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { conversationId, message } = parsed.data;

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
    const effectiveLocation = locationFromMessage || context.location;

    // Check if user is asking for clinic search (regardless of current state)
    const isClinicSearchRequest =
      /clinic|doctor|nearby|find.*care|urgent\s*care/i.test(message);

    // Save location to conversation if newly detected
    if (locationFromMessage && !context.location) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { location: locationFromMessage },
      });
    }

    // Execute tool if needed
    let toolResults;

    // PROACTIVE CLINIC SEARCH: Auto-trigger when:
    // 1. Entering SEARCHING_CLINICS state with location, OR
    // 2. User explicitly asks for clinic with location (bypass state machine)
    const shouldAutoSearch =
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
