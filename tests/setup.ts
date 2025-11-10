import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

/**
 * Global test setup and teardown
 */

// Store original process env
const originalEnv = { ...process.env };

beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = process.env.DEBUG ? 'debug' : 'error';

  // Suppress console output during tests unless DEBUG is set
  if (!process.env.DEBUG) {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  }

  // Set up any global test utilities
  global.testTimeout = 30000;
});

afterAll(async () => {
  // Restore original environment
  process.env = originalEnv;

  // Restore console methods
  vi.restoreAllMocks();
});

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
  vi.clearAllTimers();
});

// Configure test globals
declare global {
  var testTimeout: number;
}

// Export setup utilities for tests to use
export const createTestTimeout = (ms: number) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const resetMocks = () => {
  vi.clearAllMocks();
  vi.clearAllTimers();
};
