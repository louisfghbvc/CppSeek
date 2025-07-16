/**
 * Jest Test Setup
 * Global configuration and setup for Jest tests
 */

// Mock VSCode API for testing
const mockVscode = {
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn()
  },
  commands: {
    registerCommand: jest.fn()
  },
  workspace: {
    findFiles: jest.fn(),
    getConfiguration: jest.fn()
  },
  ExtensionContext: jest.fn()
};

// Mock the vscode module
jest.mock('vscode', () => mockVscode, { virtual: true });

// Global test timeout
jest.setTimeout(10000);

// Console log control
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Clean up after each test
  jest.clearAllTimers();
});

// Export mock for use in tests
export { mockVscode }; 