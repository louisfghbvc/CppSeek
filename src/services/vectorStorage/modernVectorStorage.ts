import { Chroma } from "@langchain/community/vectorstores/chroma";
import { Document } from "@langchain/core/documents";
import { Embeddings } from "@langchain/core/embeddings";
import { NIMEmbeddingService, EmbeddingResponse } from '../nimEmbeddingService';
import { ChunkMetadata } from './types';
import * as vscode from 'vscode';

/**
 * Custom LangChain Embeddings adapter for Nvidia NIM service
 */
export class NIMEmbeddingsAdapter extends Embeddings {
  private nimService: NIMEmbeddingService;

  constructor(nimService: NIMEmbeddingService) {
    super({});
    this.nimService = nimService;
  }

  /**
   * Embed documents for storage
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    try {
      const responses: EmbeddingResponse[] = await this.nimService.generateBatchEmbeddings(texts);
      return responses.map(response => response.embedding);
    } catch (error) {
      throw new Error(`Failed to embed documents: ${error}`);
    }
  }

  /**
   * Embed query for search
   */
  async embedQuery(text: string): Promise<number[]> {
    try {
      const response: EmbeddingResponse = await this.nimService.generateEmbedding(text);
      return response.embedding;
    } catch (error) {
      throw new Error(`Failed to embed query: ${error}`);
    }
  }
}

/**
 * Code chunk interface for modern vector storage
 */
export interface CodeChunk {
  id: string;
  content: string;
  filename: string;
  lineStart: number;
  lineEnd: number;
  namespace?: string;
  functionName?: string;
  className?: string;
}

/**
 * Search result interface
 */
export interface VectorSearchResult {
  document: Document;
  score: number;
  metadata: ChunkMetadata;
}

/**
 * Modern Vector Storage using LangChain + Chroma
 * 
 * Provides document-based vector storage with semantic search capabilities.
 * Integrates seamlessly with existing Nvidia NIM embeddings.
 */
export class ModernVectorStorage {
  private vectorStore: Chroma | null = null;
  private embeddings: NIMEmbeddingsAdapter;
  private collectionName: string;
  private chromaUrl: string;
  private isInitialized: boolean = false;
  private outputChannel: vscode.OutputChannel;
  private documentCount: number = 0;

  constructor(
    nimService: NIMEmbeddingService,
    collectionName: string = 'cppseek-code-chunks',
    chromaUrl: string = 'http://localhost:8000'
  ) {
    this.embeddings = new NIMEmbeddingsAdapter(nimService);
    this.collectionName = collectionName;
    this.chromaUrl = chromaUrl;
    this.outputChannel = vscode.window.createOutputChannel('CppSeek Modern Vector Storage');
  }

  /**
   * Initialize the modern vector storage
   */
  async initialize(): Promise<void> {
    try {
      this.outputChannel.appendLine('Initializing Modern Vector Storage...');
      
      // Initialize Chroma vector store
      this.vectorStore = new Chroma(this.embeddings, {
        collectionName: this.collectionName,
        url: this.chromaUrl,
        collectionMetadata: {
          "hnsw:space": "cosine" // Use cosine similarity
        }
      });

      this.isInitialized = true;
      this.outputChannel.appendLine(`✅ Modern vector store initialized: ${this.collectionName}`);
    } catch (error) {
      this.outputChannel.appendLine(`❌ Failed to initialize vector store: ${error}`);
      throw new Error(`Modern vector storage initialization failed: ${error}`);
    }
  }

  /**
   * Add code chunks to the vector store as documents
   */
  async addCodeChunks(chunks: CodeChunk[]): Promise<void> {
    if (!this.isInitialized || !this.vectorStore) {
      throw new Error('Vector store not initialized. Call initialize() first.');
    }

    if (!chunks || chunks.length === 0) {
      return;
    }

    try {
      this.outputChannel.appendLine(`Adding ${chunks.length} code chunks to vector store...`);
      
      const documents: Document[] = chunks.map(chunk => ({
        pageContent: chunk.content,
        metadata: {
          id: chunk.id,
          vectorId: 0, // Will be set by Chroma
          filePath: chunk.filename,
          fileName: chunk.filename,
          startLine: chunk.lineStart,
          endLine: chunk.lineEnd,
          startChar: 0,
          endChar: chunk.content.length,
          chunkIndex: 0,
          content: chunk.content,
          contentHash: '',
          contextInfo: {
            functionName: chunk.functionName,
            className: chunk.className,
            namespace: chunk.namespace,
            fileType: chunk.filename.endsWith('.h') ? 'header' : 'source',
            codeType: chunk.functionName ? 'function' : chunk.className ? 'class' : 'other',
            complexity: 1,
            importance: 'medium'
          },
          lastUpdated: new Date()
        }
      }));

      // Generate unique IDs for each document
      const ids = chunks.map(chunk => chunk.id);

      await this.vectorStore.addDocuments(documents, { ids });
      this.documentCount += chunks.length;
      
      this.outputChannel.appendLine(`✅ Successfully added ${chunks.length} code chunks`);
    } catch (error) {
      this.outputChannel.appendLine(`❌ Failed to add code chunks: ${error}`);
      throw new Error(`Failed to add code chunks: ${error}`);
    }
  }

  /**
   * Perform semantic search with natural language queries
   */
  async searchSimilar(query: string, topK: number = 5): Promise<VectorSearchResult[]> {
    if (!this.isInitialized || !this.vectorStore) {
      throw new Error('Vector store not initialized. Call initialize() first.');
    }

    if (!query || query.trim().length === 0) {
      throw new Error('Query cannot be empty');
    }

    try {
      this.outputChannel.appendLine(`Searching for: "${query}" (top ${topK} results)`);
      
      const startTime = Date.now();
      const results = await this.vectorStore.similaritySearchWithScore(query, topK);
      const searchTime = Date.now() - startTime;

      this.outputChannel.appendLine(`✅ Search completed in ${searchTime}ms, found ${results.length} results`);

      return results.map(([document, score]) => ({
        document,
        score,
        metadata: document.metadata as ChunkMetadata
      }));
    } catch (error) {
      this.outputChannel.appendLine(`❌ Search failed: ${error}`);
      throw new Error(`Semantic search failed: ${error}`);
    }
  }

  /**
   * Incremental update for changed files
   */
  async incrementalUpdate(changedFiles: string[]): Promise<void> {
    if (!this.isInitialized || !this.vectorStore) {
      throw new Error('Vector store not initialized. Call initialize() first.');
    }

    try {
      this.outputChannel.appendLine(`Processing incremental update for ${changedFiles.length} files...`);
      
      // For now, we'll implement a simple approach
      // In a production environment, you'd want to:
      // 1. Identify which chunks are from changed files
      // 2. Remove old chunks
      // 3. Add new chunks
      // This requires additional metadata tracking

      this.outputChannel.appendLine('⚠️ Incremental update placeholder - implement chunk-level updates');
    } catch (error) {
      this.outputChannel.appendLine(`❌ Incremental update failed: ${error}`);
      throw new Error(`Incremental update failed: ${error}`);
    }
  }

  /**
   * Delete documents by IDs
   */
  async deleteDocuments(ids: string[]): Promise<void> {
    if (!this.isInitialized || !this.vectorStore) {
      throw new Error('Vector store not initialized. Call initialize() first.');
    }

    if (!ids || ids.length === 0) {
      return;
    }

    try {
      this.outputChannel.appendLine(`Deleting ${ids.length} documents...`);
      
      await this.vectorStore.delete({ ids });
      this.documentCount = Math.max(0, this.documentCount - ids.length);
      
      this.outputChannel.appendLine(`✅ Successfully deleted ${ids.length} documents`);
    } catch (error) {
      this.outputChannel.appendLine(`❌ Failed to delete documents: ${error}`);
      throw new Error(`Failed to delete documents: ${error}`);
    }
  }

  /**
   * Clear all documents from the collection
   */
  async clear(): Promise<void> {
    if (!this.isInitialized || !this.vectorStore) {
      throw new Error('Vector store not initialized. Call initialize() first.');
    }

    try {
      this.outputChannel.appendLine('Clearing all documents from vector store...');
      
      // Note: Chroma doesn't have a built-in clear method
      // We would need to recreate the collection or delete all documents
      // For now, we'll reset the document count
      this.documentCount = 0;
      
      this.outputChannel.appendLine('⚠️ Clear operation placeholder - implement collection reset');
    } catch (error) {
      this.outputChannel.appendLine(`❌ Failed to clear vector store: ${error}`);
      throw new Error(`Failed to clear vector store: ${error}`);
    }
  }

  /**
   * Get statistics about the vector store
   */
  getStats(): { totalDocuments: number; collectionName: string; isInitialized: boolean } {
    return {
      totalDocuments: this.documentCount,
      collectionName: this.collectionName,
      isInitialized: this.isInitialized
    };
  }

  /**
   * Test the vector store functionality
   */
  async testVectorStore(): Promise<boolean> {
    try {
      this.outputChannel.appendLine('Testing vector store functionality...');
      
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Add a test document
      const testChunk: CodeChunk = {
        id: 'test-chunk-1',
        content: 'void testFunction() { /* Test function implementation */ }',
        filename: 'test.cpp',
        lineStart: 1,
        lineEnd: 1,
        functionName: 'testFunction'
      };

      await this.addCodeChunks([testChunk]);
      
      // Search for the test document
      const results = await this.searchSimilar('test function', 1);
      
      if (results.length > 0) {
        this.outputChannel.appendLine('✅ Vector store test successful');
        
        // Clean up test document
        await this.deleteDocuments(['test-chunk-1']);
        return true;
      }
      
      this.outputChannel.appendLine('❌ Vector store test failed: No results returned');
      return false;
    } catch (error) {
      this.outputChannel.appendLine(`❌ Vector store test failed: ${error}`);
      return false;
    }
  }

  /**
   * Get the underlying Chroma vector store (for advanced operations)
   */
  getVectorStore(): Chroma | null {
    return this.vectorStore;
  }

  /**
   * Convert to LangChain retriever
   */
  asRetriever(options?: { k?: number; filter?: any }) {
    if (!this.isInitialized || !this.vectorStore) {
      throw new Error('Vector store not initialized. Call initialize() first.');
    }

    return this.vectorStore.asRetriever({
      k: options?.k || 5,
      filter: options?.filter
    });
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.outputChannel.dispose();
  }
} 