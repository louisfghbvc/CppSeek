import { mockVscode } from '../setup';

// Import the extension module
import * as extension from '../../extension';

describe('Extension Test Suite', () => {
  it('should activate successfully', async () => {
    // Create a mock extension context
    const mockContext = {
      subscriptions: [],
      workspaceState: {
        get: jest.fn(),
        update: jest.fn()
      },
      globalState: {
        get: jest.fn(),
        update: jest.fn()
      },
      extensionPath: '/test/path',
      storagePath: '/test/storage'
    };

    // Test that activate function doesn't throw
    expect(() => {
      extension.activate(mockContext as any);
    }).not.toThrow();

    // Verify that command was registered
    expect(mockVscode.commands.registerCommand).toHaveBeenCalled();
    expect(mockContext.subscriptions.length).toBeGreaterThan(0);
  });

  it('should deactivate cleanly', () => {
    // Test that deactivate function doesn't throw
    expect(() => {
      extension.deactivate();
    }).not.toThrow();
  });

  it('should show information message for Hello World command', async () => {
    // Create a mock extension context
    const mockContext = {
      subscriptions: [],
      workspaceState: { get: jest.fn(), update: jest.fn() },
      globalState: { get: jest.fn(), update: jest.fn() },
      extensionPath: '/test/path',
      storagePath: '/test/storage'
    };

    // Activate the extension
    extension.activate(mockContext as any);

    // Get the registered command callback
    const registerCommandCall = (mockVscode.commands.registerCommand as jest.Mock).mock.calls[0];
    expect(registerCommandCall[0]).toBe('cppseek-semantic-search.helloWorld');
    
    const commandCallback = registerCommandCall[1];
    
    // Execute the command callback
    commandCallback();

    // Verify that showInformationMessage was called
    expect(mockVscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Hello World from CppSeek - Semantic Search!'
    );
  });
}); 