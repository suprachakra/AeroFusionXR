/**
 * Jest Setup Configuration
 * ========================
 * 
 * Global test setup and configuration for AeroFusionXR test suite.
 * This file is executed before running any tests.
 */

// Import testing utilities
import '@testing-library/jest-dom';
import 'jest-extended';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/aerofusion_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.AWS_REGION = 'us-east-1';
process.env.LOG_LEVEL = 'error';

// Extend Jest matchers
expect.extend({
  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },
  
  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email`,
        pass: false,
      };
    }
  },
  
  toBeValidCoordinates(received) {
    const { lat, lng } = received || {};
    const pass = typeof lat === 'number' && typeof lng === 'number' &&
                 lat >= -90 && lat <= 90 &&
                 lng >= -180 && lng <= 180;
    
    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be valid coordinates`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be valid coordinates`,
        pass: false,
      };
    }
  }
});

// Mock console methods in test environment
const originalConsole = { ...console };

beforeEach(() => {
  // Suppress console logs in tests unless DEBUG is set
  if (!process.env.DEBUG) {
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  }
});

afterEach(() => {
  // Restore console methods
  if (!process.env.DEBUG) {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  }
  
  // Clear all mocks
  jest.clearAllMocks();
});

// Global test timeout
jest.setTimeout(30000);

// Mock timers
jest.useFakeTimers('legacy');

// Mock fetch globally
global.fetch = jest.fn();

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  close: jest.fn(),
  send: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}));

// Mock geolocation
global.navigator = {
  ...global.navigator,
  geolocation: {
    getCurrentPosition: jest.fn().mockImplementation((success) =>
      success({
        coords: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
        },
      })
    ),
    watchPosition: jest.fn(),
    clearWatch: jest.fn(),
  },
};

// Mock intersection observer
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock local storage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock session storage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock crypto
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: arr => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    randomUUID: () => '123e4567-e89b-12d3-a456-426614174000',
  },
});

// Mock canvas
HTMLCanvasElement.prototype.getContext = jest.fn();

// Mock file reader
global.FileReader = jest.fn().mockImplementation(() => ({
  readAsDataURL: jest.fn(),
  readAsText: jest.fn(),
  readAsArrayBuffer: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn();
global.URL.revokeObjectURL = jest.fn();

// Mock performance
global.performance = {
  ...global.performance,
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(),
  getEntriesByType: jest.fn(),
};

// Test utilities
global.testUtils = {
  // Create mock user
  createMockUser: (overrides = {}) => ({
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'passenger',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),
  
  // Create mock flight
  createMockFlight: (overrides = {}) => ({
    id: '123e4567-e89b-12d3-a456-426614174001',
    flightNumber: 'AA123',
    airline: 'American Airlines',
    departure: {
      airport: 'JFK',
      gate: 'A15',
      terminal: '1',
      time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    },
    arrival: {
      airport: 'LAX',
      gate: 'B20',
      terminal: '2',
      time: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    },
    status: 'on-time',
    ...overrides,
  }),
  
  // Create mock baggage
  createMockBaggage: (overrides = {}) => ({
    id: '123e4567-e89b-12d3-a456-426614174002',
    tagId: 'BAG123456',
    flightNumber: 'AA123',
    passengerId: '123e4567-e89b-12d3-a456-426614174000',
    status: 'checked-in',
    location: {
      lat: 40.7128,
      lng: -74.0060,
      description: 'Check-in Counter A',
    },
    lastUpdate: new Date().toISOString(),
    ...overrides,
  }),
  
  // Create mock coordinates
  createMockCoordinates: (overrides = {}) => ({
    lat: 40.7128,
    lng: -74.0060,
    ...overrides,
  }),
  
  // Wait for async operations
  waitFor: async (fn, timeout = 5000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const result = await fn();
        if (result) return result;
      } catch (error) {
        // Continue waiting
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
  },
  
  // Create mock API response
  createMockApiResponse: (data, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
    headers: new Map(),
  }),
  
  // Mock async function with delay
  mockAsyncFunction: (returnValue, delay = 100) => 
    jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(returnValue), delay))
    ),
};

// Global error handler for unhandled promises
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// Clean up after all tests
afterAll(() => {
  jest.restoreAllMocks();
  jest.clearAllTimers();
  jest.useRealTimers();
}); 