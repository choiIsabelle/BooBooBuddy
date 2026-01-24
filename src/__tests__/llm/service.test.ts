import { generateMockLLMResponse, LLMContext } from '@/lib/llm/service';

describe('LLM Service', () => {
  describe('generateMockLLMResponse', () => {
    it('should generate greeting response for GREETING state', async () => {
      const context: LLMContext = {
        state: 'GREETING',
        symptoms: [],
      };

      const response = await generateMockLLMResponse([], context);

      expect(response.message).toContain('BooBoo Buddy');
      expect(response.stateTransition?.nextState).toBe('COLLECTING_CHILD_INFO');
    });

    it('should extract child info from message', async () => {
      const context: LLMContext = {
        state: 'COLLECTING_CHILD_INFO',
        symptoms: [],
      };

      const messages = [
        { role: 'user' as const, content: 'My daughter Emma is 5 years old' },
      ];

      const response = await generateMockLLMResponse(messages, context);

      expect(response.extractedInfo?.childName).toBe('Emma');
      expect(response.extractedInfo?.childAge).toBe(5);
      expect(response.stateTransition?.nextState).toBe('COLLECTING_SYMPTOMS');
    });

    it('should ask for child info if not provided', async () => {
      const context: LLMContext = {
        state: 'COLLECTING_CHILD_INFO',
        symptoms: [],
      };

      const messages = [
        { role: 'user' as const, content: 'She has a fever' },
      ];

      const response = await generateMockLLMResponse(messages, context);

      expect(response.message).toContain('name');
      expect(response.message).toContain('age');
    });

    it('should trigger clinic search in SEARCHING_CLINICS state', async () => {
      const context: LLMContext = {
        state: 'SEARCHING_CLINICS',
        symptoms: ['fever', 'cough'],
        childName: 'Emma',
        childAge: 5,
      };

      const messages = [
        { role: 'user' as const, content: 'Boston, MA' },
      ];

      const response = await generateMockLLMResponse(messages, context);

      expect(response.toolCall).toBeDefined();
      expect(response.toolCall?.tool).toBe('clinic_search');
      expect(response.extractedInfo?.location).toBe('Boston, MA');
    });
  });
});
