import { z } from "zod";

// The LLM must respond with validated JSON matching these schemas

// Tool call schemas
export const ClinicSearchToolSchema = z.object({
  tool: z.literal("clinic_search"),
  params: z.object({
    location: z.string().describe("City or address to search near"),
    specialty: z.string().optional().describe("Type of care needed"),
    urgency: z.enum(["low", "medium", "high"]).optional(),
  }),
});

export const ScheduleCallToolSchema = z.object({
  tool: z.literal("schedule_call"),
  params: z.object({
    clinicId: z.string(),
    preferredTime: z
      .string()
      .optional()
      .describe('ISO datetime or relative like "tomorrow morning"'),
    reason: z.string().describe("Brief reason for the call"),
  }),
});

export const EscalateToolSchema = z.object({
  tool: z.literal("escalate"),
  params: z.object({
    reason: z.string().describe("Why this needs human intervention"),
    urgency: z.enum(["immediate", "soon", "routine"]),
  }),
});

// Union of all tool calls
export const ToolCallSchema = z.discriminatedUnion("tool", [
  ClinicSearchToolSchema,
  ScheduleCallToolSchema,
  EscalateToolSchema,
]);

// State transition schema
export const StateTransitionSchema = z.object({
  nextState: z.enum([
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
  ]),
  reason: z.string().optional(),
});

// Extracted information from user message
export const ExtractedInfoSchema = z.object({
  userName: z.string().optional(),
  symptoms: z.array(z.string()).optional(),
  symptomSeverity: z.enum(["mild", "moderate", "severe"]).optional(),
  duration: z.string().optional(),
  location: z.string().optional(),
  healthConcern: z.string().optional(),
  selectedClinicId: z.string().optional(),
  appointmentTime: z.string().optional(), // ISO datetime
});

// Complete LLM response schema
export const LLMResponseSchema = z.object({
  // The message to show the user
  message: z.string().describe("The response message to display to the user"),

  // Optional tool to execute
  toolCall: ToolCallSchema.optional(),

  // State transition
  stateTransition: StateTransitionSchema.optional(),

  // Extracted information from user's message
  extractedInfo: ExtractedInfoSchema.optional(),

  // Internal reasoning (for debugging/logging)
  reasoning: z.string().optional(),
});

export type LLMResponse = z.infer<typeof LLMResponseSchema>;
export type ToolCall = z.infer<typeof ToolCallSchema>;
export type ExtractedInfo = z.infer<typeof ExtractedInfoSchema>;
export type StateTransition = z.infer<typeof StateTransitionSchema>;

// Validation helper
export function validateLLMResponse(response: unknown): LLMResponse {
  return LLMResponseSchema.parse(response);
}

// Safe validation that returns errors
export function safeParseLLMResponse(response: unknown) {
  return LLMResponseSchema.safeParse(response);
}
