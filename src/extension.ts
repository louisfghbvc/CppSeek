// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';

// Import our services
import { FileDiscoveryService, type ScanResult } from './services/indexing/FileDiscoveryService';
import { TextChunker, type ChunkingResult } from './services/indexing/TextChunker';
import { FileContentReader, type FileContent } from './services/indexing/FileContentReader';
import { VectorStorageService, type SearchResult } from './services/vectorStorageService';
import { SemanticSearchService, type EnhancedSearchResult, type SearchOptions } from './services/semanticSearchService';
import { createNIMServiceFromEnv } from './services/nimEmbeddingService';

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
let textChunker: TextChunker;
let fileContentReader: FileContentReader;
let vectorStorageService: VectorStorageService;
let semanticSearchService: SemanticSearchService;

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
	textChunker = new TextChunker(outputChannel);
	fileContentReader = new FileContentReader(outputChannel);
	vectorStorageService = new VectorStorageService();
	
	// Initialize semantic search service (async initialization will be handled when first used)
	try {
		const nimService = createNIMServiceFromEnv();
		semanticSearchService = new SemanticSearchService(vectorStorageService, nimService);
		logMessage('SemanticSearchService initialized successfully');
	} catch (error) {
		logMessage(`Warning: SemanticSearchService initialization failed: ${error}`);
		// Fall back to direct vector storage service if needed
	}
	
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

	// Register search statistics command
	const searchStatsDisposable = vscode.commands.registerCommand(
		'cppseek.searchStats',
		async () => {
			try {
				await handleSearchStats();
			} catch (error) {
				handleError('searchStats', error);
			}
		}
	);

	// Register clear search cache command
	const clearCacheDisposable = vscode.commands.registerCommand(
		'cppseek.clearSearchCache',
		async () => {
			try {
				await handleClearSearchCache();
			} catch (error) {
				handleError('clearSearchCache', error);
			}
		}
	);

	// Add all disposables to context
	context.subscriptions.push(
		semanticSearchDisposable,
		indexWorkspaceDisposable,
		clearIndexDisposable,
		showSettingsDisposable,
		searchStatsDisposable,
		clearCacheDisposable
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
	
	// Show progress indicator and perform actual search
	await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: 'Semantic Search',
		cancellable: false
	}, async (progress) => {
		try {
			progress.report({ increment: 0, message: 'Initializing search services...' });
			
			// Initialize vector storage if needed
			await vectorStorageService.initialize();
			
			progress.report({ increment: 30, message: 'Processing semantic query...' });
			
			// Use SemanticSearchService if available, otherwise fall back to VectorStorageService
			let results: EnhancedSearchResult[] | SearchResult[];
			if (semanticSearchService) {
				const searchOptions: SearchOptions = {
					topK: 10,
					similarityThreshold: 0.3,
					includeContext: true,
					cacheResults: true,
					enableQueryExpansion: true
				};
				results = await semanticSearchService.search(searchQuery, searchOptions);
			} else {
				logMessage('Falling back to VectorStorageService for search');
				results = await vectorStorageService.searchSimilar(searchQuery, 5);
			}
			
			progress.report({ increment: 100, message: 'Search completed' });
			
			// Display search results
			if (results.length === 0) {
				vscode.window.showInformationMessage(
					`No results found for: "${searchQuery}". Try a different query or index more files.`
				);
				return;
			}
			
			// Create and show search results in a new document
			await displaySearchResults(searchQuery, results);
			
		} catch (error) {
			logMessage(`Semantic search error: ${error}`);
			vscode.window.showErrorMessage(
				`Semantic search failed: ${error}. Check the output channel for details.`
			);
		}
	});
}

/**
 * Display search results in a new document
 */
async function displaySearchResults(query: string, results: SearchResult[] | EnhancedSearchResult[]) {
	try {
		// Create markdown content for search results
		let content = `# Semantic Search Results\n\n`;
		content += `**Query:** "${query}"\n`;
		content += `**Results:** ${results.length} matches found\n`;
		content += `**Search Time:** ${new Date().toLocaleTimeString()}\n\n`;
		content += `---\n\n`;
		
		results.forEach((result, index) => {
			// Handle both SearchResult and EnhancedSearchResult
			const score = (result as EnhancedSearchResult).similarity || (result as SearchResult).score;
			const contextSnippet = (result as EnhancedSearchResult).contextSnippet;
			
			content += `## Result ${index + 1} (Score: ${score.toFixed(4)})\n\n`;
			content += `**File:** \`${result.filePath}\`\n`;
			content += `**Lines:** ${result.startLine}-${result.endLine}\n`;
			
			if (contextSnippet) {
				content += `**Context:** ${contextSnippet}\n`;
			}
			
			if (result.functionName) {
				content += `**Function:** \`${result.functionName}\`\n`;
			}
			if (result.className) {
				content += `**Class:** \`${result.className}\`\n`;
			}
			if (result.namespace) {
				content += `**Namespace:** \`${result.namespace}\`\n`;
			}
			
			// Show relevance factors for enhanced results
			const enhancedResult = result as EnhancedSearchResult;
			if (enhancedResult.relevanceFactors) {
				content += `**Relevance:** Semantic: ${enhancedResult.relevanceFactors.semanticScore.toFixed(2)}, `;
				content += `Context: ${enhancedResult.relevanceFactors.contextScore.toFixed(2)}, `;
				content += `Recency: ${enhancedResult.relevanceFactors.recencyScore.toFixed(2)}\n`;
			}
			
			content += `\n**Code:**\n\`\`\`cpp\n${result.content}\n\`\`\`\n\n`;
			content += `[Open File](${vscode.Uri.file(result.filePath)})\n\n`;
			content += `---\n\n`;
		});
		
		// Create and show new document
		const doc = await vscode.workspace.openTextDocument({
			content: content,
			language: 'markdown'
		});
		
		await vscode.window.showTextDocument(doc, {
			viewColumn: vscode.ViewColumn.Beside,
			preview: false
		});
		
		logMessage(`Search results displayed: ${results.length} matches`);
		
	} catch (error) {
		logMessage(`Failed to display search results: ${error}`);
		vscode.window.showErrorMessage(`Failed to display search results: ${error}`);
	}
}

async function handleIndexWorkspace() {
	logMessage('Index workspace command executed');
	
	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
		vscode.window.showErrorMessage('No workspace folder is open');
		return;
	}
	
	if (extensionState.isIndexing) {
		vscode.window.showWarningMessage('Indexing is already in progress');
		return;
	}
	
	extensionState.isIndexing = true;
	updateStatusBar();
	
	try {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Indexing Workspace',
			cancellable: false
		}, async (progress) => {
			
			progress.report({ increment: 0, message: 'Discovering files...' });
			
			// Discover C/C++ files
			const scanResult = await fileDiscoveryService.discoverFiles(progress, { isCancellationRequested: false } as any);
			const files = scanResult.files.map(f => f.path);
			
			if (files.length === 0) {
				vscode.window.showWarningMessage('No C/C++ files found in workspace');
				return;
			}
			
			logMessage(`Found ${files.length} C/C++ files`);
			progress.report({ increment: 20, message: `Found ${files.length} files, processing...` });
			
			// Initialize vector storage
			await vectorStorageService.initialize();
			
			let processedFiles = 0;
			let totalChunks = 0;
			
			// Process files in batches
			for (const file of files) {
				try {
					// Read file content
					const fileContent = await fileContentReader.readFile(file);
					
					if (!fileContent) {
						continue;
					}
					
					// Create chunks
					const chunkingResult = await textChunker.chunkText(
						fileContent.content,
						fileContent.path
					);
					
					if (chunkingResult.chunks.length > 0) {
						// Convert chunks to CodeChunk format
						const codeChunks = chunkingResult.chunks.map(chunk => ({
							id: chunk.id,
							content: chunk.content,
							filename: fileContent.path,
							lineStart: chunk.startLine,
							lineEnd: chunk.endLine,
							functionName: undefined,
							className: undefined,
							namespace: undefined
						}));
						
						// Index chunks using vector storage service
						await vectorStorageService.indexCodeChunks(codeChunks);
						totalChunks += codeChunks.length;
					}
					
					processedFiles++;
					const progressPercent = Math.floor((processedFiles / files.length) * 60) + 20; // 20-80%
					progress.report({ 
						increment: progressPercent - (progress as any).value || 0, 
						message: `Processed ${processedFiles}/${files.length} files (${totalChunks} chunks)` 
					});
					
				} catch (error) {
					logMessage(`Error processing file ${file}: ${error}`);
				}
			}
			
			progress.report({ increment: 90, message: 'Finalizing index...' });
			
			// Update extension state
			extensionState.indexedFileCount = processedFiles;
			extensionState.lastIndexTime = new Date();
			
			progress.report({ increment: 100, message: 'Indexing completed' });
			
			logMessage(`Indexing completed: ${processedFiles} files, ${totalChunks} chunks`);
			vscode.window.showInformationMessage(
				`Indexing completed: ${processedFiles} files processed, ${totalChunks} code chunks indexed`
			);
		});
		
			} catch (error) {
		logMessage(`Indexing error: ${error}`);
		vscode.window.showErrorMessage(`Indexing failed: ${error}`);
	} finally {
		extensionState.isIndexing = false;
		updateStatusBar();
	}
}

async function handleClearIndex() {
	logMessage('Clear index command executed');
	
	const confirmation = await vscode.window.showWarningMessage(
		'This will clear all indexed data. Are you sure?',
		{ modal: true },
		'Clear Index'
	);
	
	if (confirmation !== 'Clear Index') {
		return;
	}
	
	try {
		await vectorStorageService.clearIndex();
		
		// Reset extension state
		extensionState.indexedFileCount = 0;
		extensionState.lastIndexTime = null;
		updateStatusBar();
		
		logMessage('Index cleared successfully');
		vscode.window.showInformationMessage('Index cleared successfully');
		
	} catch (error) {
		logMessage(`Clear index error: ${error}`);
		vscode.window.showErrorMessage(`Failed to clear index: ${error}`);
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

/**
 * Handle search statistics command
 */
async function handleSearchStats() {
	logMessage('Search statistics command executed');
	
	if (!semanticSearchService) {
		vscode.window.showWarningMessage('SemanticSearchService not available. Statistics cannot be displayed.');
		return;
	}
	
	try {
		const stats = semanticSearchService.getSearchStats();
		
		let content = `# CppSeek Search Statistics\n\n`;
		content += `**Total Searches:** ${stats.totalSearches}\n`;
		content += `**Cache Hit Rate:** ${(stats.cacheHitRate * 100).toFixed(1)}%\n`;
		content += `**Average Latency:** ${stats.averageLatency.toFixed(0)}ms\n\n`;
		
		if (stats.mostFrequentQueries.length > 0) {
			content += `## Most Frequent Queries\n\n`;
			stats.mostFrequentQueries.forEach((query, index) => {
				content += `${index + 1}. "${query.query}" (${query.count} times)\n`;
			});
		} else {
			content += `No search history available.\n`;
		}
		
		// Create and show statistics document
		const doc = await vscode.workspace.openTextDocument({
			content: content,
			language: 'markdown'
		});
		
		await vscode.window.showTextDocument(doc, {
			viewColumn: vscode.ViewColumn.Beside,
			preview: true
		});
		
	} catch (error) {
		logMessage(`Search statistics error: ${error}`);
		vscode.window.showErrorMessage(`Failed to get search statistics: ${error}`);
	}
}

/**
 * Handle clear search cache command
 */
async function handleClearSearchCache() {
	logMessage('Clear search cache command executed');
	
	if (!semanticSearchService) {
		vscode.window.showWarningMessage('SemanticSearchService not available. No cache to clear.');
		return;
	}
	
	try {
		const selection = await vscode.window.showWarningMessage(
			'Are you sure you want to clear the search cache?',
			'Clear Cache',
			'Cancel'
		);
		
		if (selection === 'Clear Cache') {
			await semanticSearchService.invalidateCache();
			vscode.window.showInformationMessage('Search cache cleared successfully.');
			logMessage('Search cache cleared');
		}
		
	} catch (error) {
		logMessage(`Clear search cache error: ${error}`);
		vscode.window.showErrorMessage(`Failed to clear search cache: ${error}`);
	}
}

// This method is called when your extension is deactivated
export function deactivate() {
	logMessage('CppSeek extension deactivated');
	
	// Clean up resources
	extensionState.isActivated = false;
	
	if (semanticSearchService) {
		semanticSearchService.dispose();
	}
	
	if (outputChannel) {
		outputChannel.dispose();
	}
	
	if (statusBarItem) {
		statusBarItem.dispose();
	}
	
	// Dispose of services
	fileContentReader?.dispose();
}
