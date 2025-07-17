// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';

// Import our services
import { FileDiscoveryService, type ScanResult } from './services/indexing/FileDiscoveryService';

// Test imports for semantic search dependencies
// Note: Runtime execution may fail due to native bindings, but TypeScript compilation should work
// import Database from 'sqlite3';
// import { AutoTokenizer } from '@xenova/transformers';
// import * as faiss from 'faiss-node';

// Extension state management
interface ExtensionState {
	isActivated: boolean;
	isIndexing: boolean;
	indexedFileCount: number;
	lastIndexTime: Date | null;
}

let extensionState: ExtensionState = {
	isActivated: false,
	isIndexing: false,
	indexedFileCount: 0,
	lastIndexTime: null
};

// Global variables for extension components
let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;
let fileDiscoveryService: FileDiscoveryService;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "cppseek-semantic-search" is now active!');
	
	// Initialize extension state
	extensionState.isActivated = true;
	
	// Create output channel for logging
	outputChannel = vscode.window.createOutputChannel('CppSeek');
	context.subscriptions.push(outputChannel);
	
	// Create status bar item
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = 'cppseek.showSettings';
	context.subscriptions.push(statusBarItem);
	
	// Initialize services
	fileDiscoveryService = new FileDiscoveryService(outputChannel);
	
	// Update status bar
	updateStatusBar();
	
	// Log activation
	logMessage('CppSeek extension activated successfully');

	// Register all commands
	registerCommands(context);
	
	  // Show welcome message if this is first activation
  const hasShownWelcome = context.globalState.get('hasShownWelcome', false);
  
  if (!hasShownWelcome) {
    vscode.window.showInformationMessage(
      'CppSeek: AI-powered semantic search for C/C++ codebases is now active!',
      'Open Settings',
      'Index Workspace'
    ).then(selection => {
      if (selection === 'Open Settings') {
        vscode.commands.executeCommand('cppseek.showSettings');
      } else if (selection === 'Index Workspace') {
        vscode.commands.executeCommand('cppseek.indexWorkspace');
      }
    });
    
    context.globalState.update('hasShownWelcome', true);
  }
}

function registerCommands(context: vscode.ExtensionContext) {
	// Register semantic search command
	const semanticSearchDisposable = vscode.commands.registerCommand(
		'cppseek.semanticSearch',
		async () => {
			try {
				await handleSemanticSearch();
			} catch (error) {
				handleError('semanticSearch', error);
			}
		}
	);

	// Register index workspace command
	const indexWorkspaceDisposable = vscode.commands.registerCommand(
		'cppseek.indexWorkspace',
		async () => {
			try {
				await handleIndexWorkspace();
			} catch (error) {
				handleError('indexWorkspace', error);
			}
		}
	);

	// Register clear index command
	const clearIndexDisposable = vscode.commands.registerCommand(
		'cppseek.clearIndex',
		async () => {
			try {
				await handleClearIndex();
			} catch (error) {
				handleError('clearIndex', error);
			}
		}
	);

	// Register show settings command
	const showSettingsDisposable = vscode.commands.registerCommand(
		'cppseek.showSettings',
		async () => {
			try {
				await handleShowSettings();
			} catch (error) {
				handleError('showSettings', error);
			}
		}
	);

	// Add all disposables to context
	context.subscriptions.push(
		semanticSearchDisposable,
		indexWorkspaceDisposable,
		clearIndexDisposable,
		showSettingsDisposable
	);
}

async function handleSemanticSearch() {
	logMessage('Semantic search command executed');
	
	// Check if workspace is indexed
	if (extensionState.indexedFileCount === 0) {
		const selection = await vscode.window.showWarningMessage(
			'No indexed files found. Would you like to index the workspace first?',
			'Index Now',
			'Continue Anyway'
		);
		
		if (selection === 'Index Now') {
			await handleIndexWorkspace();
			return;
		}
	}
	
	// Show input box for search query
	const searchQuery = await vscode.window.showInputBox({
		prompt: 'Enter your semantic search query',
		placeHolder: 'e.g., "Where is the initialization logic?"',
		validateInput: (value) => {
			if (!value || value.trim().length === 0) {
				return 'Please enter a search query';
			}
			return null;
		}
	});
	
	if (!searchQuery) {
		return;
	}
	
	logMessage(`Performing semantic search for: "${searchQuery}"`);
	
	// Show progress indicator
	await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: 'CppSeek: Searching...',
		cancellable: true
	}, async (progress, token) => {
		progress.report({ increment: 0, message: 'Initializing search...' });
		
		// Simulate search progress (replace with actual implementation later)
		for (let i = 0; i < 100; i += 20) {
			if (token.isCancellationRequested) {
				return;
			}
			
			await new Promise(resolve => setTimeout(resolve, 200));
			progress.report({ 
				increment: 20, 
				message: i < 80 ? 'Searching code...' : 'Ranking results...' 
			});
		}
		
		// Show placeholder results
		const results = [
			'src/main.cpp:42 - main() function initialization',
			'src/config.h:15 - Configuration constants',
			'src/utils.cpp:128 - Utility initialization functions'
		];
		
		const selectedResult = await vscode.window.showQuickPick(results, {
			placeHolder: 'Select a search result to open',
			title: `Search results for: "${searchQuery}"`
		});
		
		if (selectedResult) {
			logMessage(`Selected result: ${selectedResult}`);
			vscode.window.showInformationMessage(`Opening: ${selectedResult}`);
			// TODO: Implement actual file opening logic
		}
	});
}

async function handleIndexWorkspace() {
	logMessage('Index workspace command executed');
	
	if (!vscode.workspace.workspaceFolders) {
		vscode.window.showErrorMessage('No workspace folder is open');
		return;
	}
	
	if (extensionState.isIndexing || fileDiscoveryService.isCurrentlyScanning()) {
		vscode.window.showWarningMessage('Indexing is already in progress');
		return;
	}
	
	extensionState.isIndexing = true;
	updateStatusBar();
	
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'CppSeek: Discovering files...',
			cancellable: true
		}, async (progress, token) => {
			try {
				// Use FileDiscoveryService to scan for files
				const scanResult: ScanResult = await fileDiscoveryService.discoverFiles(progress, token);
				
				if (token.isCancellationRequested) {
					logMessage('File discovery cancelled by user');
					return;
				}
				
				if (scanResult.totalFiles === 0) {
					vscode.window.showWarningMessage('No C/C++ files found in workspace');
					return;
				}
				
				// Show scan results summary
				const performanceMsg = 
					`Performance: ${scanResult.performance.filesPerSecond.toFixed(1)} files/sec, ` +
					`${(scanResult.performance.totalSizeBytes / 1024 / 1024).toFixed(1)} MB total`;
				
				logMessage(`File discovery completed: ${scanResult.totalFiles} files found in ${scanResult.scanTime}ms`);
				logMessage(performanceMsg);
				
				if (scanResult.errors.length > 0) {
					logMessage(`Warning: ${scanResult.errors.length} errors encountered during scan`);
				}
				
				// TODO: Pass files to actual indexing pipeline (chunking, embedding, etc.)
				// For now, just simulate indexing progress
				progress.report({ message: 'Starting indexing pipeline...', increment: 0 });
				
				let processedFiles = 0;
				const batchSize = 10;
				
				for (let i = 0; i < scanResult.files.length; i += batchSize) {
					if (token.isCancellationRequested) {
						logMessage('Indexing cancelled by user');
						return;
					}
					
					const batch = scanResult.files.slice(i, i + batchSize);
					
					// Simulate batch processing
					await new Promise(resolve => setTimeout(resolve, 100));
					
					processedFiles += batch.length;
					const progressPercent = Math.round((processedFiles / scanResult.totalFiles) * 100);
					
					progress.report({
						increment: (batch.length / scanResult.totalFiles) * 100,
						message: `Indexing files: ${processedFiles}/${scanResult.totalFiles} (${progressPercent}%)`
					});
					
					// Log first few files for verification
					if (i < 50) {
						for (const file of batch) {
							logMessage(`Indexed: ${file.relativePath} (${file.size} bytes)`);
						}
					}
				}
				
				// Update extension state
				extensionState.indexedFileCount = scanResult.totalFiles;
				extensionState.lastIndexTime = new Date();
				
				const successMsg = `Successfully indexed ${scanResult.totalFiles} C/C++ files in ${scanResult.scanTime}ms`;
				logMessage(successMsg);
				vscode.window.showInformationMessage(`CppSeek: ${successMsg}`);
				
			} catch (error) {
				const errorMsg = `File discovery failed: ${error}`;
				logMessage(errorMsg);
				vscode.window.showErrorMessage(`CppSeek: ${errorMsg}`);
			}
		});
		
	} finally {
		extensionState.isIndexing = false;
		updateStatusBar();
	}
}

async function handleClearIndex() {
	logMessage('Clear index command executed');
	
	if (extensionState.indexedFileCount === 0) {
		vscode.window.showInformationMessage('No index data to clear');
		return;
	}
	
	const selection = await vscode.window.showWarningMessage(
		`Clear search index? This will remove indexing data for ${extensionState.indexedFileCount} files.`,
		{ modal: true },
		'Clear Index',
		'Cancel'
	);
	
	if (selection === 'Clear Index') {
		// Reset state
		extensionState.indexedFileCount = 0;
		extensionState.lastIndexTime = null;
		
		// TODO: Clear actual index data when implemented
		
		updateStatusBar();
		logMessage('Index cleared successfully');
		vscode.window.showInformationMessage('CppSeek: Index cleared successfully');
	}
}

async function handleShowSettings() {
	logMessage('Show settings command executed');
	
	// Open CppSeek settings
	await vscode.commands.executeCommand('workbench.action.openSettings', 'cppseek');
}

function updateStatusBar() {
	if (!statusBarItem) {
		return;
	}
	
	if (extensionState.isIndexing) {
		statusBarItem.text = '$(sync~spin) CppSeek: Indexing...';
		statusBarItem.tooltip = 'CppSeek is indexing workspace files';
	} else if (extensionState.indexedFileCount > 0) {
		statusBarItem.text = `$(database) CppSeek: ${extensionState.indexedFileCount} files`;
		statusBarItem.tooltip = `CppSeek: ${extensionState.indexedFileCount} files indexed` + 
			(extensionState.lastIndexTime ? `\nLast indexed: ${extensionState.lastIndexTime.toLocaleString()}` : '');
	} else {
		statusBarItem.text = '$(database) CppSeek: Ready';
		statusBarItem.tooltip = 'CppSeek: Ready to index workspace';
	}
	
	statusBarItem.show();
}

function logMessage(message: string) {
	const timestamp = new Date().toLocaleTimeString();
	const logLine = `[${timestamp}] ${message}`;
	
	outputChannel.appendLine(logLine);
	console.log(`CppSeek: ${message}`);
}

function handleError(command: string, error: any) {
	const errorMessage = `Error in ${command}: ${error instanceof Error ? error.message : String(error)}`;
	logMessage(errorMessage);
	
	vscode.window.showErrorMessage(`CppSeek: ${errorMessage}`);
}

// This method is called when your extension is deactivated
export function deactivate() {
	logMessage('CppSeek extension deactivated');
	
	// Clean up resources
	extensionState.isActivated = false;
	
	if (outputChannel) {
		outputChannel.dispose();
	}
	
	if (statusBarItem) {
		statusBarItem.dispose();
	}
}
