import { z } from 'zod';

// API Request/Response schemas

export const SendMessageRequestSchema = z.object({
  conversationId: z.string().optional(), // If not provided, creates new conversation
  message: z.string().min(1).max(5000),
});

export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(['USER', 'ASSISTANT', 'SYSTEM', 'TOOL']),
  content: z.string(),
  createdAt: z.string(), // ISO datetime
});

export const ConversationSchema = z.object({
  id: z.string(),
  state: z.string(),
  childName: z.string().nullable(),
  childAge: z.number().nullable(),
  symptoms: z.array(z.string()),
  messages: z.array(MessageSchema),
});

export const SendMessageResponseSchema = z.object({
  conversationId: z.string(),
  message: MessageSchema,
  state: z.string(),
  toolResults: z.array(z.object({
    toolName: z.string(),
    result: z.unknown(),
  })).optional(),
});

export type SendMessageResponse = z.infer<typeof SendMessageResponseSchema>;

export const ClinicSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  phone: z.string(),
  distance: z.number().optional(), // in miles
  rating: z.number().nullable(),
  availableSlots: z.array(z.string()), // ISO datetimes
  specialties: z.array(z.string()),
});

export type Clinic = z.infer<typeof ClinicSchema>;
