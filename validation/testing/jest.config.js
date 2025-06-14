/**
 * AeroFusionXR AI Governance - Jest Test Configuration
 * Comprehensive testing framework for world-class quality assurance
 */

module.exports = {
    // Test environment
    testEnvironment: 'node',
    
    // Coverage configuration
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html', 'json'],
    
    // Coverage thresholds - enforce > 90% coverage
    coverageThreshold: {
        global: {
            branches: 90,
            functions: 90,
            lines: 90,
            statements: 90
        },
        // Critical governance modules require 95% coverage
        'governance/pillars/**/': {
            branches: 95,
            functions: 95,
            lines: 95,
            statements: 95
        }
    },
    
    // Files to collect coverage from
    collectCoverageFrom: [
        'governance/**/*.js',
        'infrastructure/**/*.js',
        'monitoring/**/*.js',
        'validation/**/*.js',
        '!**/*.test.js',
        '!**/*.spec.js',
        '!**/node_modules/**',
        '!**/coverage/**',
        '!**/dist/**'
    ],
    
    // Test file patterns
    testMatch: [
        '**/__tests__/**/*.js',
        '**/?(*.)+(spec|test).js'
    ],
    
    // Setup files
    setupFilesAfterEnv: ['<rootDir>/validation/testing/setup.js'],
    
    // Module paths
    moduleDirectories: ['node_modules', '<rootDir>'],
    
    // Transform configuration
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    
    // Test timeout
    testTimeout: 30000,
    
    // Verbose output
    verbose: true,
    
    // Fail fast on first test failure in CI
    bail: process.env.CI ? 1 : 0,
    
    // Clear mocks between tests
    clearMocks: true,
    
    // Restore mocks after each test
    restoreMocks: true,
    
    // Error on deprecated features
    errorOnDeprecated: true,
    
    // Detect open handles
    detectOpenHandles: true,
    
    // Force exit after tests complete
    forceExit: true,
    
    // Test suites configuration
    projects: [
        {
            displayName: 'Unit Tests',
            testMatch: ['<rootDir>/**/*.test.js'],
            testPathIgnorePatterns: [
                '/node_modules/',
                '/integration/',
                '/e2e/'
            ]
        },
        {
            displayName: 'Integration Tests',
            testMatch: ['<rootDir>/validation/testing/integration/**/*.test.js'],
            setupFilesAfterEnv: ['<rootDir>/validation/testing/integration-setup.js']
        }
    ],
    
    // Global variables
    globals: {
        'process.env.NODE_ENV': 'test'
    },
    
    // Module name mapping
    moduleNameMapping: {
        '^@governance/(.*)$': '<rootDir>/governance/$1',
        '^@infrastructure/(.*)$': '<rootDir>/infrastructure/$1',
        '^@monitoring/(.*)$': '<rootDir>/monitoring/$1',
        '^@validation/(.*)$': '<rootDir>/validation/$1'
    },
    
    // Reporter configuration
    reporters: [
        'default',
        ['jest-junit', {
            outputDirectory: 'test-results',
            outputName: 'junit.xml',
            classNameTemplate: '{classname}',
            titleTemplate: '{title}',
            ancestorSeparator: ' › ',
            usePathForSuiteName: true
        }],
        ['jest-html-reporters', {
            publicPath: 'test-results',
            filename: 'test-report.html',
            expand: true
        }]
    ],
    
    // Watch plugins
    watchPlugins: [
        'jest-watch-typeahead/filename',
        'jest-watch-typeahead/testname'
    ]
}; 