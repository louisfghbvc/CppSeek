/**
 * Global test setup for Jest testing
 * This file is run before all tests to configure the testing environment
 */

// Create mock objects
const mockOutputChannel = {
  appendLine: jest.fn(),
  show: jest.fn(),
  hide: jest.fn(),
  clear: jest.fn(),
  dispose: jest.fn(),
  name: 'CppSeek'
};

const mockStatusBarItem = {
  text: '',
  tooltip: '',
  command: '',
  show: jest.fn(),
  hide: jest.fn(),
  dispose: jest.fn()
};

const mockWorkspaceConfiguration = {
  get: jest.fn((key: string, defaultValue?: any) => {
    // Return sensible defaults for configuration values
    const configMap: { [key: string]: any } = {
      'files.include': ['**/*.cpp', '**/*.c', '**/*.h'],
      'files.exclude': ['**/node_modules/**'],
      'searchBehavior.maxResults': 50,
      'searchBehavior.chunkSize': 500,
      'searchBehavior.chunkOverlap': 50,
      'performance.enableCache': true,
      'performance.maxMemoryUsage': 200
    };
    return configMap[key] ?? defaultValue;
  }),
  update: jest.fn(),
  inspect: jest.fn(),
  has: jest.fn()
};

// Create comprehensive vscode mock
const mockVscode = {
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn()
  },
  window: {
    showInformationMessage: jest.fn().mockResolvedValue(undefined),
    showWarningMessage: jest.fn().mockResolvedValue(undefined),
    showErrorMessage: jest.fn().mockResolvedValue(undefined),
    showInputBox: jest.fn().mockResolvedValue(undefined),
    showQuickPick: jest.fn().mockResolvedValue(undefined),
    createOutputChannel: jest.fn(() => mockOutputChannel),
    createStatusBarItem: jest.fn(() => mockStatusBarItem),
    withProgress: jest.fn(async (_options, task) => {
      // Mock progress reporting
      const progress = {
        report: jest.fn()
      };
      const token = {
        isCancellationRequested: false,
        onCancellationRequested: jest.fn()
      };
      return await task(progress, token);
    })
  },
  workspace: {
    workspaceFolders: [],
    getConfiguration: jest.fn(() => mockWorkspaceConfiguration),
    findFiles: jest.fn().mockResolvedValue([])
  },
  StatusBarAlignment: {
    Left: 1,
    Right: 2
  },
  ProgressLocation: {
    SourceControl: 1,
    Window: 10,
    Notification: 15
  },
  ExtensionContext: jest.fn(),
  Uri: {
    file: jest.fn(),
    parse: jest.fn()
  }
};

// Mock the vscode module
jest.mock('vscode', () => mockVscode, { virtual: true });

// Global test timeout
jest.setTimeout(10000);

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  
  // Reset mock object state
  mockStatusBarItem.text = '';
  mockStatusBarItem.tooltip = '';
  mockStatusBarItem.command = '';
  
  // Reset workspace folders
  mockVscode.workspace.workspaceFolders = [];
});

afterEach(() => {
  // Clean up after each test
  jest.clearAllTimers();
});

// Export the mock for use in tests
export { mockVscode }; 