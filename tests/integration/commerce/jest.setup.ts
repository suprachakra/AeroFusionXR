/**
 * @file Jest setup configuration
 * @description Global test setup and configuration for Jest
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { config } from 'dotenv';

// Load environment variables
config();

// Extend Jest timeout for slower operations
jest.setTimeout(30000);

// Configure MongoDB
beforeAll(async () => {
  // Disable colors in tests
  process.env.NO_COLOR = 'true';
  
  // Set test environment
  process.env.NODE_ENV = 'test';
});

// Cleanup after all tests
afterAll(async () => {
  await mongoose.disconnect();
});

// Reset mocks between tests
afterEach(() => {
  jest.clearAllMocks();
}); 