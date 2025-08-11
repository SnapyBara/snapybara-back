import { config } from 'dotenv';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Load test environment variables
config({ path: '.env.test' });

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// MongoDB Memory Server setup
let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  // Start in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  process.env.MONGODB_URI = mongoUri;
});

afterAll(async () => {
  // Stop in-memory MongoDB instance
  if (mongoServer) {
    await mongoServer.stop();
  }
});

// Clear all mocks between tests
afterEach(() => {
  jest.clearAllMocks();
});

// Add custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  toHaveValidId(received: any) {
    const pass =
      received && typeof received.id === 'string' && received.id.length > 0;
    if (pass) {
      return {
        message: () => `expected ${received} not to have a valid id`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to have a valid id`,
        pass: false,
      };
    }
  },

  toBeValidJWT(received: string) {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    const pass = jwtRegex.test(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid JWT`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid JWT`,
        pass: false,
      };
    }
  },
});

// Extend Jest matchers TypeScript definitions
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toHaveValidId(): R;
      toBeValidJWT(): R;
    }
  }
}

// Mock external services
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
      getSession: jest.fn(),
    },
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        download: jest.fn(),
        remove: jest.fn(),
        getPublicUrl: jest.fn(),
      })),
    },
  })),
}));

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn(),
    },
    places: jest.fn(() => ({
      findPlaceFromText: jest.fn(),
      placeDetails: jest.fn(),
      placesNearby: jest.fn(),
    })),
  },
}));

jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    expire: jest.fn(),
    on: jest.fn(),
  })),
}));

// Helper functions for tests
export const createMockRequest = (options: any = {}) => ({
  headers: {},
  query: {},
  params: {},
  body: {},
  user: null,
  ...options,
});

export const createMockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.header = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  return res;
};

export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  username: 'testuser',
  role: 'user',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockPoint = (overrides = {}) => ({
  id: 'test-point-id',
  name: 'Test Point',
  description: 'A test point of interest',
  category: 'restaurant',
  location: {
    type: 'Point',
    coordinates: [2.3522, 48.8566],
  },
  address: '123 Test Street, Paris',
  tags: ['test'],
  status: 'pending',
  createdBy: 'test-user-id',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Database cleanup helper
export const cleanDatabase = async () => {
  // This will be implemented based on your database setup
  // For now, it's a placeholder
};

// Wait helper for async operations
export const waitFor = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
