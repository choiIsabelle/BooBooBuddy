import { isValidTransition } from '@/lib/workflow/engine';

// Test without database dependency
describe('Workflow Engine', () => {
  describe('isValidTransition', () => {
    it('should allow valid transition from GREETING to COLLECTING_CHILD_INFO', () => {
      expect(isValidTransition('GREETING', 'COLLECTING_CHILD_INFO')).toBe(true);
    });

    it('should allow transition to ESCALATED from any state', () => {
      expect(isValidTransition('GREETING', 'ESCALATED')).toBe(true);
      expect(isValidTransition('COLLECTING_SYMPTOMS', 'ESCALATED')).toBe(true);
      expect(isValidTransition('ASSESSING_SEVERITY', 'ESCALATED')).toBe(true);
    });

    it('should not allow invalid transitions', () => {
      // Can't skip from GREETING to SEARCHING_CLINICS
      expect(isValidTransition('GREETING', 'SEARCHING_CLINICS')).toBe(false);
      
      // Can't go backwards
      expect(isValidTransition('COLLECTING_SYMPTOMS', 'GREETING')).toBe(false);
    });

    it('should allow staying in COLLECTING_SYMPTOMS (for follow-up questions)', () => {
      expect(isValidTransition('COLLECTING_SYMPTOMS', 'COLLECTING_SYMPTOMS')).toBe(true);
    });

    it('should allow COMPLETED to go back to GREETING (new conversation)', () => {
      expect(isValidTransition('COMPLETED', 'GREETING')).toBe(true);
    });
  });

  describe('State Machine Flow', () => {
    it('should support the happy path flow', () => {
      const happyPath = [
        { from: 'GREETING', to: 'COLLECTING_CHILD_INFO' },
        { from: 'COLLECTING_CHILD_INFO', to: 'COLLECTING_SYMPTOMS' },
        { from: 'COLLECTING_SYMPTOMS', to: 'ASSESSING_SEVERITY' },
        { from: 'ASSESSING_SEVERITY', to: 'SEARCHING_CLINICS' },
        { from: 'SEARCHING_CLINICS', to: 'PRESENTING_OPTIONS' },
        { from: 'PRESENTING_OPTIONS', to: 'SCHEDULING_CALL' },
        { from: 'SCHEDULING_CALL', to: 'CONFIRMING_APPOINTMENT' },
        { from: 'CONFIRMING_APPOINTMENT', to: 'COMPLETED' },
      ] as const;

      happyPath.forEach(({ from, to }) => {
        expect(isValidTransition(from, to)).toBe(true);
      });
    });

    it('should support going back from PRESENTING_OPTIONS to search again', () => {
      expect(isValidTransition('PRESENTING_OPTIONS', 'SEARCHING_CLINICS')).toBe(true);
    });

    it('should support going back from SCHEDULING_CALL to pick different clinic', () => {
      expect(isValidTransition('SCHEDULING_CALL', 'PRESENTING_OPTIONS')).toBe(true);
    });
  });
});
