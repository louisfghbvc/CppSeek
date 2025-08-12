/**
 * Result Navigation Handler
 * 
 * Handles click-to-navigate functionality, keyboard shortcuts, and seamless
 * editor integration for search result navigation within VSCode.
 */

import * as vscode from 'vscode';
import { RankedSearchResult } from '../services/searchResultRanker';

export interface NavigationOptions {
  revealType: vscode.TextEditorRevealType;
  preserveFocus: boolean;
  openToSide: boolean;
  highlightDuration: number;
  enableAutoScroll: boolean;
}

export interface NavigationTarget {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface NavigationHistory {
  targets: NavigationTarget[];
  currentIndex: number;
  maxHistorySize: number;
}

export interface EditorDecoration {
  type: vscode.TextEditorDecorationType;
  ranges: vscode.Range[];
  timeout?: NodeJS.Timeout;
}

/**
 * Main result navigation handler
 */
export class ResultNavigationHandler {
  private navigationHistory: NavigationHistory;
  private activeDecorations: Map<string, EditorDecoration>;
  private disposables: vscode.Disposable[];
  private outputChannel: vscode.OutputChannel;
  private defaultOptions: NavigationOptions;

  constructor() {
    this.navigationHistory = {
      targets: [],
      currentIndex: -1,
      maxHistorySize: 50
    };
    
    this.activeDecorations = new Map();
    this.disposables = [];
    this.outputChannel = vscode.window.createOutputChannel('CppSeek Navigation Handler');
    
    this.defaultOptions = {
      revealType: vscode.TextEditorRevealType.InCenter,
      preserveFocus: false,
      openToSide: false,
      highlightDuration: 3000,
      enableAutoScroll: true
    };

    this.setupKeyboardShortcuts();
    this.setupEventHandlers();
    
    this.outputChannel.appendLine('🧭 ResultNavigationHandler initialized');
  }

  /**
   * Navigate to a search result
   */
  async navigateToResult(
    result: RankedSearchResult, 
    options?: Partial<NavigationOptions>
  ): Promise<boolean> {
    try {
      const navOptions = { ...this.defaultOptions, ...options };
      
      this.outputChannel.appendLine(
        `🎯 Navigating to ${result.filePath}:${result.startLine}-${result.endLine}`
      );

      // Create navigation target
      const target: NavigationTarget = {
        file: result.filePath,
        line: result.startLine,
        column: 0,
        endLine: result.endLine,
        endColumn: undefined
      };

      // Open the document
      const document = await this.openDocument(target.file);
      if (!document) {
        return false;
      }

      // Show the document in editor
      const editor = await this.showDocument(document, navOptions);
      if (!editor) {
        return false;
      }

      // Navigate to specific position
      await this.navigateToPosition(editor, target, navOptions);

      // Highlight the result
      await this.highlightResult(editor, result, navOptions);

      // Update navigation history
      this.updateNavigationHistory(target);

      this.outputChannel.appendLine(`✅ Navigation completed successfully`);
      return true;

    } catch (error) {
      this.outputChannel.appendLine(`❌ Navigation failed: ${error}`);
      vscode.window.showErrorMessage(`Failed to navigate to result: ${error}`);
      return false;
    }
  }

  /**
   * Navigate to a specific target
   */
  async navigateToTarget(
    target: NavigationTarget,
    options?: Partial<NavigationOptions>
  ): Promise<boolean> {
    try {
      const navOptions = { ...this.defaultOptions, ...options };
      
      const document = await this.openDocument(target.file);
      if (!document) return false;

      const editor = await this.showDocument(document, navOptions);
      if (!editor) return false;

      await this.navigateToPosition(editor, target, navOptions);
      this.updateNavigationHistory(target);

      return true;
    } catch (error) {
      this.outputChannel.appendLine(`❌ Target navigation failed: ${error}`);
      return false;
    }
  }

  /**
   * Navigate to next result in history
   */
  async navigateToNextResult(): Promise<boolean> {
    if (this.navigationHistory.currentIndex < this.navigationHistory.targets.length - 1) {
      this.navigationHistory.currentIndex++;
      const target = this.navigationHistory.targets[this.navigationHistory.currentIndex];
      return await this.navigateToTarget(target);
    }
    
    vscode.window.showInformationMessage('No next result in navigation history');
    return false;
  }

  /**
   * Navigate to previous result in history
   */
  async navigateToPreviousResult(): Promise<boolean> {
    if (this.navigationHistory.currentIndex > 0) {
      this.navigationHistory.currentIndex--;
      const target = this.navigationHistory.targets[this.navigationHistory.currentIndex];
      return await this.navigateToTarget(target);
    }
    
    vscode.window.showInformationMessage('No previous result in navigation history');
    return false;
  }

  /**
   * Jump to specific line in current editor
   */
  async jumpToLine(lineNumber: number): Promise<boolean> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor');
      return false;
    }

    try {
      const position = new vscode.Position(Math.max(0, lineNumber - 1), 0);
      const range = new vscode.Range(position, position);
      
      editor.selection = new vscode.Selection(range.start, range.end);
      editor.revealRange(range, this.defaultOptions.revealType);
      
      return true;
    } catch (error) {
      this.outputChannel.appendLine(`❌ Jump to line failed: ${error}`);
      return false;
    }
  }

  /**
   * Show quick pick for navigation history
   */
  async showNavigationHistory(): Promise<void> {
    if (this.navigationHistory.targets.length === 0) {
      vscode.window.showInformationMessage('No navigation history available');
      return;
    }

    const items = this.navigationHistory.targets.map((target, index) => ({
      label: `${target.file}:${target.line}`,
      description: target.file,
      detail: `Line ${target.line}${target.endLine ? `-${target.endLine}` : ''}`,
      target,
      index
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a navigation target',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (selected) {
      this.navigationHistory.currentIndex = selected.index;
      await this.navigateToTarget(selected.target);
    }
  }

  /**
   * Clear navigation history
   */
  clearNavigationHistory(): void {
    this.navigationHistory.targets = [];
    this.navigationHistory.currentIndex = -1;
    this.outputChannel.appendLine('🗑️ Navigation history cleared');
  }

  /**
   * Get current navigation statistics
   */
  getNavigationStats(): {
    totalNavigations: number;
    currentPosition: number;
    hasNext: boolean;
    hasPrevious: boolean;
  } {
    return {
      totalNavigations: this.navigationHistory.targets.length,
      currentPosition: this.navigationHistory.currentIndex + 1,
      hasNext: this.navigationHistory.currentIndex < this.navigationHistory.targets.length - 1,
      hasPrevious: this.navigationHistory.currentIndex > 0
    };
  }

  /**
   * Open document in VSCode
   */
  private async openDocument(filePath: string): Promise<vscode.TextDocument | null> {
    try {
      const uri = vscode.Uri.file(filePath);
      const document = await vscode.workspace.openTextDocument(uri);
      return document;
    } catch (error) {
      this.outputChannel.appendLine(`❌ Failed to open document ${filePath}: ${error}`);
      vscode.window.showErrorMessage(`Failed to open file: ${filePath}`);
      return null;
    }
  }

  /**
   * Show document in editor
   */
  private async showDocument(
    document: vscode.TextDocument,
    options: NavigationOptions
  ): Promise<vscode.TextEditor | null> {
    try {
      const showOptions: vscode.TextDocumentShowOptions = {
        preserveFocus: options.preserveFocus,
        preview: false,
        viewColumn: options.openToSide ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active
      };

      const editor = await vscode.window.showTextDocument(document, showOptions);
      return editor;
    } catch (error) {
      this.outputChannel.appendLine(`❌ Failed to show document: ${error}`);
      return null;
    }
  }

  /**
   * Navigate to specific position in editor
   */
  private async navigateToPosition(
    editor: vscode.TextEditor,
    target: NavigationTarget,
    options: NavigationOptions
  ): Promise<void> {
    // Create position and range
    const startPosition = new vscode.Position(
      Math.max(0, target.line - 1),
      Math.max(0, target.column)
    );
    
    const endPosition = target.endLine ? 
      new vscode.Position(Math.max(0, target.endLine - 1), target.endColumn || 0) :
      startPosition;
    
    const range = new vscode.Range(startPosition, endPosition);

    // Set selection
    editor.selection = new vscode.Selection(range.start, range.end);

    // Reveal the range
    if (options.enableAutoScroll) {
      editor.revealRange(range, options.revealType);
    }

    this.outputChannel.appendLine(
      `📍 Navigated to position ${target.line}:${target.column}`
    );
  }

  /**
   * Highlight search result in editor
   */
  private async highlightResult(
    editor: vscode.TextEditor,
    result: RankedSearchResult,
    options: NavigationOptions
  ): Promise<void> {
    try {
      // Clear existing decorations for this editor
      this.clearDecorations(editor.document.uri.toString());

      // Create decoration type
      const decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
        border: '2px solid',
        borderColor: new vscode.ThemeColor('editor.findMatchBorder'),
        borderRadius: '3px',
        isWholeLine: false,
        overviewRulerColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
        overviewRulerLane: vscode.OverviewRulerLane.Center
      });

      // Create range for highlighting
      const startPos = new vscode.Position(result.startLine - 1, 0);
      const endPos = new vscode.Position(
        result.endLine - 1, 
        editor.document.lineAt(result.endLine - 1).text.length
      );
      const range = new vscode.Range(startPos, endPos);

      // Apply decoration
      editor.setDecorations(decorationType, [range]);

      // Store decoration for cleanup
      const documentKey = editor.document.uri.toString();
      const decoration: EditorDecoration = {
        type: decorationType,
        ranges: [range]
      };

      // Auto-clear highlight after specified duration
      if (options.highlightDuration > 0) {
        decoration.timeout = setTimeout(() => {
          this.clearDecorations(documentKey);
        }, options.highlightDuration);
      }

      this.activeDecorations.set(documentKey, decoration);

      this.outputChannel.appendLine(
        `🎨 Applied highlight for ${result.filePath}:${result.startLine}-${result.endLine}`
      );

    } catch (error) {
      this.outputChannel.appendLine(`❌ Failed to highlight result: ${error}`);
    }
  }

  /**
   * Clear decorations for a specific document
   */
  private clearDecorations(documentKey: string): void {
    const decoration = this.activeDecorations.get(documentKey);
    if (decoration) {
      // Clear timeout if exists
      if (decoration.timeout) {
        clearTimeout(decoration.timeout);
      }
      
      // Dispose decoration type
      decoration.type.dispose();
      
      // Remove from active decorations
      this.activeDecorations.delete(documentKey);
    }
  }

  /**
   * Clear all active decorations
   */
  private clearAllDecorations(): void {
    this.activeDecorations.forEach((_decoration, documentKey) => {
      this.clearDecorations(documentKey);
    });
  }

  /**
   * Update navigation history
   */
  private updateNavigationHistory(target: NavigationTarget): void {
    // Remove duplicates of the same target
    this.navigationHistory.targets = this.navigationHistory.targets.filter(
      existing => !(existing.file === target.file && existing.line === target.line)
    );

    // Add new target
    this.navigationHistory.targets.push(target);

    // Trim history if too large
    if (this.navigationHistory.targets.length > this.navigationHistory.maxHistorySize) {
      this.navigationHistory.targets.shift();
    }

    // Update current index
    this.navigationHistory.currentIndex = this.navigationHistory.targets.length - 1;

    this.outputChannel.appendLine(
      `📚 Updated navigation history (${this.navigationHistory.targets.length} entries)`
    );
  }

  /**
   * Setup keyboard shortcuts for navigation
   */
  private setupKeyboardShortcuts(): void {
    // Register navigation commands
    this.disposables.push(
      vscode.commands.registerCommand('cppseek.navigateToNextResult', () => {
        this.navigateToNextResult();
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand('cppseek.navigateToPreviousResult', () => {
        this.navigateToPreviousResult();
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand('cppseek.showNavigationHistory', () => {
        this.showNavigationHistory();
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand('cppseek.clearNavigationHistory', () => {
        this.clearNavigationHistory();
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand('cppseek.jumpToLine', async () => {
        const lineInput = await vscode.window.showInputBox({
          prompt: 'Enter line number to jump to',
          placeHolder: 'Line number',
          validateInput: (value) => {
            const lineNum = parseInt(value);
            if (isNaN(lineNum) || lineNum < 1) {
              return 'Please enter a valid line number (>= 1)';
            }
            return undefined;
          }
        });

        if (lineInput) {
          const lineNumber = parseInt(lineInput);
          await this.jumpToLine(lineNumber);
        }
      })
    );

    this.outputChannel.appendLine('⌨️ Keyboard shortcuts registered');
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Clear decorations when document is closed
    this.disposables.push(
      vscode.workspace.onDidCloseTextDocument(document => {
        this.clearDecorations(document.uri.toString());
      })
    );

    // Clear decorations when editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        // Optionally clear decorations when switching editors
        // this.clearAllDecorations();
      })
    );

    // Handle document changes
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(event => {
        // Clear decorations if document is modified significantly
        if (event.contentChanges.length > 0) {
          this.clearDecorations(event.document.uri.toString());
        }
      })
    );

    this.outputChannel.appendLine('🔄 Event handlers registered');
  }

  /**
   * Get available navigation commands
   */
  getNavigationCommands(): Array<{
    command: string;
    title: string;
    description: string;
    keybinding?: string;
  }> {
    return [
      {
        command: 'cppseek.navigateToNextResult',
        title: 'Navigate to Next Result',
        description: 'Navigate to the next result in navigation history',
        keybinding: 'Ctrl+Shift+N (Cmd+Shift+N on Mac)'
      },
      {
        command: 'cppseek.navigateToPreviousResult',
        title: 'Navigate to Previous Result',
        description: 'Navigate to the previous result in navigation history',
        keybinding: 'Ctrl+Shift+P (Cmd+Shift+P on Mac)'
      },
      {
        command: 'cppseek.showNavigationHistory',
        title: 'Show Navigation History',
        description: 'Show quick pick list of navigation history',
        keybinding: 'Ctrl+Shift+H (Cmd+Shift+H on Mac)'
      },
      {
        command: 'cppseek.clearNavigationHistory',
        title: 'Clear Navigation History',
        description: 'Clear the navigation history'
      },
      {
        command: 'cppseek.jumpToLine',
        title: 'Jump to Line',
        description: 'Jump to a specific line number in the current editor',
        keybinding: 'Ctrl+G (Cmd+G on Mac)'
      }
    ];
  }

  /**
   * Update navigation options
   */
  updateNavigationOptions(options: Partial<NavigationOptions>): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
    this.outputChannel.appendLine('⚙️ Navigation options updated');
  }

  /**
   * Export navigation history
   */
  exportNavigationHistory(): {
    targets: NavigationTarget[];
    currentIndex: number;
    totalNavigations: number;
    exportTimestamp: string;
  } {
    return {
      targets: [...this.navigationHistory.targets],
      currentIndex: this.navigationHistory.currentIndex,
      totalNavigations: this.navigationHistory.targets.length,
      exportTimestamp: new Date().toISOString()
    };
  }

  /**
   * Import navigation history
   */
  importNavigationHistory(data: {
    targets: NavigationTarget[];
    currentIndex: number;
  }): void {
    this.navigationHistory.targets = data.targets.slice(0, this.navigationHistory.maxHistorySize);
    this.navigationHistory.currentIndex = Math.min(
      data.currentIndex,
      this.navigationHistory.targets.length - 1
    );
    
    this.outputChannel.appendLine(
      `📥 Imported navigation history (${this.navigationHistory.targets.length} entries)`
    );
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    // Clear all decorations
    this.clearAllDecorations();
    
    // Dispose of commands and event handlers
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];
    
    // Clear navigation history
    this.navigationHistory.targets = [];
    this.navigationHistory.currentIndex = -1;
    
    // Dispose output channel
    this.outputChannel.dispose();
  }
} 