// Shared types for the application

// Conversation states (matching the database)
export type ConversationState =
  | "GREETING"
  | "COLLECTING_INFO"
  | "COLLECTING_SYMPTOMS"
  | "ASSESSING_SEVERITY"
  | "PROVIDING_ADVICE"
  | "SEARCHING_CLINICS"
  | "PRESENTING_OPTIONS"
  | "SCHEDULING_CALL"
  | "CONFIRMING_APPOINTMENT"
  | "COMPLETED"
  | "ESCALATED";

// Message roles
export type MessageRole = "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";

// Tool call status
export type ToolCallStatus = "PENDING" | "SUCCESS" | "FAILED";

// Valid state transitions
export const VALID_TRANSITIONS: Record<ConversationState, ConversationState[]> =
  {
    GREETING: [
      "COLLECTING_INFO",
      "COLLECTING_SYMPTOMS",
      "SEARCHING_CLINICS",
      "ESCALATED",
    ],
    COLLECTING_INFO: [
      "COLLECTING_SYMPTOMS",
      "PROVIDING_ADVICE",
      "SEARCHING_CLINICS",
      "ESCALATED",
    ],
    COLLECTING_SYMPTOMS: [
      "ASSESSING_SEVERITY",
      "COLLECTING_SYMPTOMS",
      "PROVIDING_ADVICE",
      "SEARCHING_CLINICS",
      "ESCALATED",
    ],
    ASSESSING_SEVERITY: ["PROVIDING_ADVICE", "SEARCHING_CLINICS", "ESCALATED"],
    PROVIDING_ADVICE: [
      "SEARCHING_CLINICS",
      "COMPLETED",
      "GREETING",
      "ESCALATED",
    ],
    SEARCHING_CLINICS: ["PRESENTING_OPTIONS", "SEARCHING_CLINICS", "ESCALATED"],
    PRESENTING_OPTIONS: ["SCHEDULING_CALL", "SEARCHING_CLINICS", "ESCALATED"],
    SCHEDULING_CALL: [
      "CONFIRMING_APPOINTMENT",
      "PRESENTING_OPTIONS",
      "ESCALATED",
    ],
    CONFIRMING_APPOINTMENT: ["COMPLETED", "SCHEDULING_CALL", "ESCALATED"],
    COMPLETED: ["GREETING"],
    ESCALATED: ["GREETING", "SEARCHING_CLINICS"],
  };

// Helper to parse JSON arrays stored as strings in SQLite
export function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    return JSON.parse(value) as T[];
  } catch {
    return [];
  }
}

// Helper to stringify arrays for SQLite storage
export function stringifyJsonArray<T>(arr: T[]): string {
  return JSON.stringify(arr);
}
