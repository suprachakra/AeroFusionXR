module.exports = {
  // 🎯 Test Environment Setup
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // 📁 Root and Test Directories
  rootDir: './',
  testMatch: [
    '<rootDir>/services/**/__tests__/**/*.(test|spec).(ts|js)',
    '<rootDir>/clients/**/__tests__/**/*.(test|spec).(ts|tsx|js|jsx)',
    '<rootDir>/tests/**/*.(test|spec).(ts|js)',
  ],
  
  // 🔧 Module Configuration
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  
  // 📂 Module Path Mapping
  moduleNameMapping: {
    '^@services/(.*)$': '<rootDir>/services/$1',
    '^@clients/(.*)$': '<rootDir>/clients/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/tests/mocks/fileMock.js'
  },
  
  // 🚫 Ignore Patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/build/',
    '<rootDir>/coverage/',
  ],
  
  // ⚙️ Setup Files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/jest.setup.js',
    '<rootDir>/tests/setup/database.setup.js',
    '<rootDir>/tests/setup/redis.setup.js',
  ],
  
  // 📊 Coverage Configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'clover',
    'json',
  ],
  collectCoverageFrom: [
    'services/**/*.{ts,js}',
    'clients/**/*.{ts,tsx,js,jsx}',
    'shared/**/*.{ts,js}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/coverage/**',
    '!**/*.config.{js,ts}',
    '!**/migrations/**',
    '!**/seeds/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './services/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './clients/': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },
  
  // ⏱️ Test Timeout
  testTimeout: 30000,
  
  // 🔄 Test Projects for Different Types
  projects: [
    {
      displayName: 'Unit Tests',
      testMatch: ['<rootDir>/**/*.unit.(test|spec).(ts|tsx|js|jsx)'],
      testEnvironment: 'node',
    },
    {
      displayName: 'Integration Tests',
      testMatch: ['<rootDir>/**/*.integration.(test|spec).(ts|tsx|js|jsx)'],
      testEnvironment: 'node',
      setupFilesAfterEnv: [
        '<rootDir>/tests/setup/integration.setup.js',
      ],
    },
    {
      displayName: 'Component Tests',
      testMatch: ['<rootDir>/clients/**/*.component.(test|spec).(ts|tsx|js|jsx)'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: [
        '<rootDir>/tests/setup/component.setup.js',
      ],
    },
    {
      displayName: 'API Tests',
      testMatch: ['<rootDir>/tests/api/**/*.(test|spec).(ts|js)'],
      testEnvironment: 'node',
      setupFilesAfterEnv: [
        '<rootDir>/tests/setup/api.setup.js',
      ],
    },
  ],
  
  // 🎨 Reporters
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: './coverage',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true,
      },
    ],
    [
      'jest-html-reporters',
      {
        publicPath: './coverage',
        filename: 'report.html',
        expand: false,
      },
    ],
  ],
  
  // 🔍 Verbose Output
  verbose: true,
  
  // 🏷️ Global Variables
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },
  
  // 🧹 Clear Mocks
  clearMocks: true,
  restoreMocks: true,
  
  // 📝 Error Handling
  errorOnDeprecated: true,
  
  // 🔄 Watch Mode Configuration
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/build/',
    '<rootDir>/coverage/',
  ],
  
  // 🎭 Mock Configuration
  mockPathIgnorePatterns: [
    '<rootDir>/node_modules/',
  ],
  
  // 📄 Transform Ignore Patterns
  transformIgnorePatterns: [
    'node_modules/(?!(@testing-library|@babel|babel-runtime|react-native|@react-native|react-navigation|@react-navigation)/)',
  ],
}; 