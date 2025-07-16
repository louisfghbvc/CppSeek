/** @type {import('jest').Config} */
const config = {
  // Use ts-jest for TypeScript preprocessing
  preset: 'ts-jest',

  // Test environment
  testEnvironment: 'node',

  // Root directories for tests and source code
  roots: ['<rootDir>/src'],

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],

  // File extensions to consider
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Transform files with ts-jest
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },

  // Coverage configuration
  collectCoverage: false, // Enable when running coverage command
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/test/**/*',
    '!src/**/__tests__/**/*'
  ],
  
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/out/',
    '/dist/',
    '/.vscode-test/'
  ],

  // Clear mocks between tests
  clearMocks: true,

  // Verbose output
  verbose: true,

  // Timeout for tests
  testTimeout: 10000
};

module.exports = config; 