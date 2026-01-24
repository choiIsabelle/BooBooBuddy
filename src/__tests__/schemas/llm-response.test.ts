import {
  LLMResponseSchema,
  validateLLMResponse,
  safeParseLLMResponse,
  ToolCallSchema,
} from '@/lib/schemas/llm-response';

describe('LLM Response Schema', () => {
  describe('validateLLMResponse', () => {
    it('should validate a minimal valid response', () => {
      const response = {
        message: 'Hello! How can I help you today?',
      };

      const result = validateLLMResponse(response);
      expect(result.message).toBe('Hello! How can I help you today?');
    });

    it('should validate a full response with all fields', () => {
      const response = {
        message: 'I understand your child has a fever.',
        toolCall: {
          tool: 'clinic_search',
          params: {
            location: 'Boston, MA',
            specialty: 'Pediatrics',
          },
        },
        stateTransition: {
          nextState: 'SEARCHING_CLINICS',
          reason: 'User provided location',
        },
        extractedInfo: {
          childName: 'Emma',
          childAge: 5,
          symptoms: ['fever', 'cough'],
          symptomSeverity: 'moderate',
        },
        reasoning: 'User mentioned child with fever, need to find clinic',
      };

      const result = validateLLMResponse(response);
      expect(result.message).toBe('I understand your child has a fever.');
      expect(result.toolCall?.tool).toBe('clinic_search');
      expect(result.extractedInfo?.childName).toBe('Emma');
    });

    it('should throw on invalid response (missing message)', () => {
      const response = {
        toolCall: {
          tool: 'clinic_search',
          params: { location: 'Boston' },
        },
      };

      expect(() => validateLLMResponse(response)).toThrow();
    });

    it('should throw on invalid state transition', () => {
      const response = {
        message: 'Hello',
        stateTransition: {
          nextState: 'INVALID_STATE',
        },
      };

      expect(() => validateLLMResponse(response)).toThrow();
    });
  });

  describe('safeParseLLMResponse', () => {
    it('should return success for valid response', () => {
      const response = { message: 'Hello!' };
      const result = safeParseLLMResponse(response);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toBe('Hello!');
      }
    });

    it('should return error for invalid response', () => {
      const response = { invalid: 'data' };
      const result = safeParseLLMResponse(response);

      expect(result.success).toBe(false);
    });
  });

  describe('ToolCallSchema', () => {
    it('should validate clinic_search tool', () => {
      const toolCall = {
        tool: 'clinic_search',
        params: {
          location: 'New York, NY',
          urgency: 'high',
        },
      };

      const result = ToolCallSchema.parse(toolCall);
      expect(result.tool).toBe('clinic_search');
    });

    it('should validate schedule_call tool', () => {
      const toolCall = {
        tool: 'schedule_call',
        params: {
          clinicId: 'clinic-123',
          reason: 'Child has fever',
        },
      };

      const result = ToolCallSchema.parse(toolCall);
      expect(result.tool).toBe('schedule_call');
    });

    it('should validate escalate tool', () => {
      const toolCall = {
        tool: 'escalate',
        params: {
          reason: 'Emergency symptoms detected',
          urgency: 'immediate',
        },
      };

      const result = ToolCallSchema.parse(toolCall);
      expect(result.tool).toBe('escalate');
    });

    it('should reject invalid tool name', () => {
      const toolCall = {
        tool: 'invalid_tool',
        params: {},
      };

      expect(() => ToolCallSchema.parse(toolCall)).toThrow();
    });
  });
});
