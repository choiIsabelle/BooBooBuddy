// Mock Prisma for tool tests
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    toolCall: {
      create: jest.fn().mockResolvedValue({ id: 'tool-call-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    clinic: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    conversation: {
      update: jest.fn().mockResolvedValue({}),
    },
  },
}));

import { executeTool, ToolResult } from '@/lib/tools/executor';

describe('Tool Executor', () => {
  const mockConversationId = 'conv-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('clinic_search tool', () => {
    it('should return mock clinics when database is empty', async () => {
      const toolCall = {
        tool: 'clinic_search' as const,
        params: {
          location: 'Boston, MA',
        },
      };

      const result = await executeTool(toolCall, mockConversationId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('clinics');
      expect(result.data).toHaveProperty('searchLocation', 'Boston, MA');
      
      const clinics = (result.data as { clinics: unknown[] }).clinics;
      expect(clinics.length).toBeGreaterThan(0);
    });

    it('should include urgency in search', async () => {
      const toolCall = {
        tool: 'clinic_search' as const,
        params: {
          location: 'New York, NY',
          urgency: 'high' as const,
        },
      };

      const result = await executeTool(toolCall, mockConversationId);

      expect(result.success).toBe(true);
    });
  });

  describe('schedule_call tool', () => {
    it('should schedule a call and return confirmation', async () => {
      const toolCall = {
        tool: 'schedule_call' as const,
        params: {
          clinicId: 'clinic-1',
          reason: 'Child has fever',
        },
      };

      const result = await executeTool(toolCall, mockConversationId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('confirmed', true);
      expect(result.data).toHaveProperty('confirmationCode');
      expect(result.data).toHaveProperty('appointmentTime');
    });

    it('should use preferred time if provided', async () => {
      const preferredTime = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
      
      const toolCall = {
        tool: 'schedule_call' as const,
        params: {
          clinicId: 'clinic-1',
          preferredTime,
          reason: 'Follow-up appointment',
        },
      };

      const result = await executeTool(toolCall, mockConversationId);

      expect(result.success).toBe(true);
      const data = result.data as { appointmentTime: string };
      expect(new Date(data.appointmentTime).toISOString()).toBe(preferredTime);
    });
  });

  describe('escalate tool', () => {
    it('should escalate with immediate urgency', async () => {
      const toolCall = {
        tool: 'escalate' as const,
        params: {
          reason: 'Child showing signs of difficulty breathing',
          urgency: 'immediate' as const,
        },
      };

      const result = await executeTool(toolCall, mockConversationId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('escalated', true);
      expect(result.data).toHaveProperty('ticketId');
      
      const data = result.data as { message: string };
      expect(data.message).toContain('5 minutes');
    });

    it('should escalate with routine urgency', async () => {
      const toolCall = {
        tool: 'escalate' as const,
        params: {
          reason: 'Parent requested human callback',
          urgency: 'routine' as const,
        },
      };

      const result = await executeTool(toolCall, mockConversationId);

      expect(result.success).toBe(true);
      const data = result.data as { message: string };
      expect(data.message).toContain('shortly');
    });
  });
});
