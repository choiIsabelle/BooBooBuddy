import '@testing-library/jest-dom';

// Mock environment variables for testing
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.OPENAI_API_KEY = 'test-key';
