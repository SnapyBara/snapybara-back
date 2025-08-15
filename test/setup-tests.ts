// Set up test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.SUPABASE_JWT_SECRET = 'test-secret';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock console.warn for Redis warnings
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = jest.fn((message) => {
    if (message && message.includes('Redis is not configured')) {
      return;
    }
    originalWarn(message);
  });
});

afterAll(() => {
  console.warn = originalWarn;
});
