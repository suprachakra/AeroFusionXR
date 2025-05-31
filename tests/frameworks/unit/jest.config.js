/**
 * AeroFusionXR Unit Testing Framework Configuration
 * ================================================
 * 
 * Enterprise-grade Jest configuration for comprehensive unit testing
 * across all services in the AeroFusionXR Aviation Platform.
 * 
 * Features:
 * - Multi-service test discovery and execution
 * - TypeScript and Python support
 * - Code coverage reporting with detailed metrics
 * - Parallel test execution for performance
 * - Custom matchers for aviation-specific testing
 * - Mocking capabilities for external dependencies
 * - Integration with CI/CD pipelines
 * - Performance profiling and analysis
 */

module.exports = {
  displayName: 'AeroFusionXR Unit Tests',
  
  // Test environment configuration
  testEnvironment: 'node',
  
  // Root directories for test discovery
  roots: [
    '<rootDir>/../../services',
    '<rootDir>/../../clients',
    '<rootDir>/../unit'
  ],
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.(test|spec).(ts|js)',
    '**/*.(test|spec).(ts|js)',
    '**/tests/unit/**/*.(test|spec).(ts|js)'
  ],
  
  // File extensions to consider
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Transform configuration for TypeScript
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  
  // Module name mapping for cleaner imports
  moduleNameMapping: {
    '^@services/(.*)$': '<rootDir>/../../services/$1',
    '^@clients/(.*)$': '<rootDir>/../../clients/$1',
    '^@shared/(.*)$': '<rootDir>/../../shared/$1',
    '^@utils/(.*)$': '<rootDir>/../../utils/$1',
    '^@config/(.*)$': '<rootDir>/../../config/$1',
    '^@tests/(.*)$': '<rootDir>/../$1'
  },
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/setup/jest.setup.js',
    '<rootDir>/setup/custom-matchers.js'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/../../reports/coverage/unit',
  collectCoverageFrom: [
    'services/**/*.{ts,js}',
    'clients/**/*.{ts,tsx,js,jsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/__tests__/**',
    '!**/tests/**',
    '!**/coverage/**',
    '!**/docs/**',
    '!**/*.config.js',
    '!**/*.setup.js'
  ],
  
  // Coverage thresholds (enforcing 90%+ coverage)
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    // Service-specific thresholds
    'services/api-gateway/**/*.{ts,js}': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    'services/flight-info/**/*.{ts,js}': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    'services/ai-concierge/**/*.{ts,js}': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  
  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json',
    'clover',
    'cobertura'
  ],
  
  // Test execution configuration
  maxWorkers: '50%', // Use 50% of available CPU cores
  testTimeout: 30000, // 30 second timeout for unit tests
  
  // Verbose output for debugging
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // Global test configuration
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }
  },
  
  // Module paths to ignore
  modulePathIgnorePatterns: [
    '<rootDir>/../../dist/',
    '<rootDir>/../../build/',
    '<rootDir>/../../node_modules/'
  ],
  
  // Test result processors
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: '<rootDir>/../../reports/unit-tests',
      filename: 'unit-test-report.html',
      expand: true,
      hideIcon: false,
      pageTitle: 'AeroFusionXR Unit Test Report',
      logoImgPath: './assets/logo.png'
    }],
    ['jest-junit', {
      outputDirectory: '<rootDir>/../../reports/junit',
      outputName: 'unit-tests.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }],
    ['jest-sonar-reporter', {
      outputDirectory: '<rootDir>/../../reports/sonar',
      outputName: 'unit-test-sonar.xml'
    }]
  ],
  
  // Notification configuration
  notify: true,
  notifyMode: 'failure-change',
  
  // Watch configuration for development
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  
  // Performance optimization
  cache: true,
  cacheDirectory: '<rootDir>/../../.jest-cache',
  
  // Error handling
  errorOnDeprecated: true,
  
  // Custom test environment for aviation-specific testing
  testEnvironmentOptions: {
    url: 'http://localhost',
    userAgent: 'AeroFusionXR-TestRunner/1.0.0'
  }
}; 