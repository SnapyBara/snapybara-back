// Setup for e2e tests
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Set test timeout
jest.setTimeout(30000);

// Mock external services if needed
process.env.NODE_ENV = 'test';
