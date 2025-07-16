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
        get: jest.fn(() => false), // hasShownWelcome = false
        update: jest.fn()
      },
      extensionPath: '/test/path',
      storagePath: '/test/storage'
    };

    // Test that activate function doesn't throw
    expect(() => {
      extension.activate(mockContext as any);
    }).not.toThrow();

    // Verify that commands were registered (should have 4 commands now)
    expect(mockVscode.commands.registerCommand).toHaveBeenCalledTimes(4);
    
    // Verify specific commands were registered
    const commandCalls = (mockVscode.commands.registerCommand as jest.Mock).mock.calls;
    const registeredCommands = commandCalls.map(call => call[0]);
    
    expect(registeredCommands).toContain('cppseek.semanticSearch');
    expect(registeredCommands).toContain('cppseek.indexWorkspace');
    expect(registeredCommands).toContain('cppseek.clearIndex');
    expect(registeredCommands).toContain('cppseek.showSettings');
    
    expect(mockContext.subscriptions.length).toBeGreaterThan(0);
  });

  it('should deactivate cleanly', () => {
    // Test that deactivate function doesn't throw
    expect(() => {
      extension.deactivate();
    }).not.toThrow();
  });

  it('should handle semantic search command', async () => {
    // Create a mock extension context
    const mockContext = {
      subscriptions: [],
      workspaceState: { get: jest.fn(), update: jest.fn() },
      globalState: { 
        get: jest.fn(() => true), // hasShownWelcome = true to avoid welcome dialog
        update: jest.fn() 
      },
      extensionPath: '/test/path',
      storagePath: '/test/storage'
    };

    // Activate the extension
    extension.activate(mockContext as any);

    // Find the semantic search command callback
    const commandCalls = (mockVscode.commands.registerCommand as jest.Mock).mock.calls;
    const semanticSearchCall = commandCalls.find(call => call[0] === 'cppseek.semanticSearch');
    
    expect(semanticSearchCall).toBeDefined();
    
    const commandCallback = semanticSearchCall[1];
    
    // Mock showInputBox to return null (user cancels)
    (mockVscode.window.showInputBox as jest.Mock).mockResolvedValue(null);
    
    // Execute the command callback - should not throw
    await expect(commandCallback()).resolves.toBeUndefined();
  });

  it('should handle workspace indexing command', async () => {
    // Create a mock extension context
    const mockContext = {
      subscriptions: [],
      workspaceState: { get: jest.fn(), update: jest.fn() },
      globalState: { 
        get: jest.fn(() => true), // hasShownWelcome = true
        update: jest.fn() 
      },
      extensionPath: '/test/path',
      storagePath: '/test/storage'
    };

    // Mock workspace folders
    mockVscode.workspace.workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];
    
    // Mock workspace.findFiles to return empty array
    mockVscode.workspace.findFiles = jest.fn().mockResolvedValue([]);

    // Activate the extension
    extension.activate(mockContext as any);

    // Find the index workspace command callback
    const commandCalls = (mockVscode.commands.registerCommand as jest.Mock).mock.calls;
    const indexCall = commandCalls.find(call => call[0] === 'cppseek.indexWorkspace');
    
    expect(indexCall).toBeDefined();
    
    const commandCallback = indexCall[1];
    
    // Execute the command callback - should not throw
    await expect(commandCallback()).resolves.toBeUndefined();
  });
}); 