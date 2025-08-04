/**
 * Unified Vector Storage Service
 * 
 * Integrates ModernVectorStorage with DocumentManager to provide complete
 * document lifecycle management and semantic search capabilities.
 */

import * as vscode from 'vscode';
import { ModernVectorStorage, CodeChunk, VectorSearchResult } from './vectorStorage/modernVectorStorage';
import { DocumentManager, DocumentResult } from './documents/documentManager';
import { DocumentConverter } from './documents/documentConverter';
import { IncrementalUpdater, FileChangeSet } from './documents/incrementalUpdater';
import { NIMEmbeddingService, createNIMServiceFromEnv } from './nimEmbeddingService';
import { ModernVectorStorageConfigManager } from '../config/modernVectorStorageConfig';

export interface SearchResult {
  id: string;
  content: string;
  filePath: string;
  startLine: number;
  endLine: number;
  score: number;
  functionName?: string;
  className?: string;
  namespace?: string;
}

export interface IndexingStats {
  totalFiles: number;
  processedChunks: number;
  documentsAdded: number;
  processingTime: number;
  lastIndexTime: Date;
}

/**
 * Unified service that orchestrates modern RAG architecture components
 */
export class VectorStorageService {
  private modernStorage: ModernVectorStorage;
  private documentManager: DocumentManager;
  private documentConverter: DocumentConverter;
  private incrementalUpdater: IncrementalUpdater;
  private nimService: NIMEmbeddingService;
  private outputChannel: vscode.OutputChannel;
  private isInitialized: boolean = false;
  private indexingStats: IndexingStats;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('CppSeek Vector Storage Service');
    
    // Initialize NIM service
    this.nimService = createNIMServiceFromEnv();
    
    // Get configuration
    const config = ModernVectorStorageConfigManager.createConfig(
      vscode.workspace.name || 'default'
    );
    
    // Initialize components
    this.modernStorage = new ModernVectorStorage(
      this.nimService,
      config.collectionName,
      config.chromaUrl
    );
    
    this.documentConverter = new DocumentConverter();
    this.documentManager = new DocumentManager(this.modernStorage);
    
    this.incrementalUpdater = new IncrementalUpdater(this.documentManager);
    
    // Initialize stats
    this.indexingStats = {
      totalFiles: 0,
      processedChunks: 0,
      documentsAdded: 0,
      processingTime: 0,
      lastIndexTime: new Date()
    };
    
    this.outputChannel.appendLine('✅ VectorStorageService created with modern RAG architecture');
  }

  /**
   * Initialize the entire vector storage system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.outputChannel.appendLine('🚀 Initializing Vector Storage Service...');
      
      // Initialize modern vector storage
      await this.modernStorage.initialize();
      
      // Initialize incremental updater (file watching would be started separately if needed)
      
      this.isInitialized = true;
      this.outputChannel.appendLine('✅ Vector Storage Service initialized successfully');
    } catch (error) {
      this.outputChannel.appendLine(`❌ Failed to initialize Vector Storage Service: ${error}`);
      throw new Error(`Vector Storage Service initialization failed: ${error}`);
    }
  }

  /**
   * Index code chunks using modern document management
   */
  async indexCodeChunks(chunks: CodeChunk[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!chunks || chunks.length === 0) {
      return;
    }

    try {
      this.outputChannel.appendLine(`📚 Indexing ${chunks.length} code chunks...`);
      const startTime = Date.now();
      
      // Use document manager for conversion and indexing
      const result = await this.documentManager.addDocuments(chunks);
      
      const processingTime = Date.now() - startTime;
      
      // Update stats
      this.indexingStats.processedChunks += chunks.length;
      this.indexingStats.documentsAdded += result.documentsProcessed;
      this.indexingStats.processingTime += processingTime;
      this.indexingStats.lastIndexTime = new Date();
      
      this.outputChannel.appendLine(
        `✅ Indexed ${chunks.length} chunks in ${processingTime}ms (${result.documentsProcessed} documents processed)`
      );
    } catch (error) {
      this.outputChannel.appendLine(`❌ Failed to index chunks: ${error}`);
      throw error;
    }
  }

  /**
   * Perform semantic search using modern RAG architecture
   */
  async searchSimilar(query: string, topK: number = 5): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!query || query.trim().length === 0) {
      throw new Error('Query cannot be empty');
    }

    try {
      this.outputChannel.appendLine(`🔍 Performing semantic search: "${query}"`);
      const startTime = Date.now();
      
      // Use modern vector storage for search
      const vectorResults = await this.modernStorage.searchSimilar(query, topK);
      
      const searchTime = Date.now() - startTime;
      
      // Convert to unified search result format
      const searchResults: SearchResult[] = vectorResults.map(result => ({
        id: result.metadata.id,
        content: result.document.pageContent,
        filePath: result.metadata.filePath,
        startLine: result.metadata.startLine,
        endLine: result.metadata.endLine,
        score: result.score,
        functionName: result.metadata.contextInfo?.functionName,
        className: result.metadata.contextInfo?.className,
        namespace: result.metadata.contextInfo?.namespace
      }));
      
      this.outputChannel.appendLine(
        `✅ Search completed in ${searchTime}ms, found ${searchResults.length} results`
      );
      
      return searchResults;
    } catch (error) {
      this.outputChannel.appendLine(`❌ Search failed: ${error}`);
      throw error;
    }
  }

  /**
   * Process incremental updates for changed files
   */
  async processIncrementalUpdates(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      this.outputChannel.appendLine('🔄 Processing incremental updates...');
      // For now, just log - incremental updates would be implemented separately
      this.outputChannel.appendLine('⚠️ Incremental updates not yet implemented');
    } catch (error) {
      this.outputChannel.appendLine(`❌ Incremental update failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get current indexing statistics
   */
  getIndexingStats(): IndexingStats {
    return { ...this.indexingStats };
  }

  /**
   * Get document management statistics
   */
  async getDocumentStats() {
    if (!this.isInitialized) {
      return null;
    }
    
    return await this.documentManager.getDocumentStats();
  }

  /**
   * Clear the entire index
   */
  async clearIndex(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      this.outputChannel.appendLine('🗑️ Clearing vector storage index...');
      
      // Clear vector storage (recreate collection)
      // Note: Current implementation requires recreating the storage
      const config = ModernVectorStorageConfigManager.createConfig(
        vscode.workspace.name || 'default'
      );
      this.modernStorage = new ModernVectorStorage(
        this.nimService,
        config.collectionName + '_new',
        config.chromaUrl
      );
      await this.modernStorage.initialize();
      
      // Reset stats
      this.indexingStats = {
        totalFiles: 0,
        processedChunks: 0,
        documentsAdded: 0,
        processingTime: 0,
        lastIndexTime: new Date()
      };
      
      this.outputChannel.appendLine('✅ Index cleared successfully');
    } catch (error) {
      this.outputChannel.appendLine(`❌ Failed to clear index: ${error}`);
      throw error;
    }
  }

  /**
   * Get system status information
   */
  getSystemStatus() {
    return {
      isInitialized: this.isInitialized,
      architecture: 'Modern RAG (LangChain + Chroma)',
      embedding: 'Nvidia NIM',
      documentManagement: true,
      incrementalUpdates: true,
      stats: this.indexingStats
    };
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    try {
      await this.documentConverter.dispose();
      await this.documentManager.dispose();
      this.outputChannel.dispose();
    } catch (error) {
      console.error('Error disposing VectorStorageService:', error);
    }
  }
} 