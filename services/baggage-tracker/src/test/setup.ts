import { Redis } from 'ioredis';
import { connect as mqttConnect } from 'mqtt';
import { metrics } from '../utils/metrics';

// Mock Redis
jest.mock('ioredis', () => {
  const RedisMock = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    zadd: jest.fn(),
    zrange: jest.fn(),
    expire: jest.fn(),
    quit: jest.fn().mockResolvedValue(undefined)
  }));
  return RedisMock;
});

// Mock MQTT
jest.mock('mqtt', () => ({
  connect: jest.fn().mockReturnValue({
    on: jest.fn(),
    subscribe: jest.fn(),
    end: jest.fn().mockImplementation((force, cb) => cb())
  })
}));

// Mock metrics
jest.mock('../utils/metrics', () => ({
  metrics: {
    createHistogram: jest.fn().mockReturnValue({
      observe: jest.fn()
    }),
    createCounter: jest.fn().mockReturnValue({
      inc: jest.fn()
    }),
    createGauge: jest.fn().mockReturnValue({
      set: jest.fn()
    }),
    increment: jest.fn(),
    gauge: jest.fn()
  }
}));

// Environment variables
process.env.NODE_ENV = 'test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.MQTT_URL = 'mqtt://localhost:1883';

// Global test setup
beforeEach(() => {
  jest.clearAllMocks();
  metrics.clearMetrics?.();
});

// Global test teardown
afterAll(() => {
  jest.restoreAllMocks();
}); 