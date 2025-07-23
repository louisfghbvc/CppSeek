import * as path from 'path';
import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import { MemoryMetadataStore } from './memoryMetadataStore';
import {
  VectorStorageConfig,
  EmbeddingData,
  SearchResult,
  MetadataFilter,
  VectorStorageStats,
  IndexPersistenceInfo,
  ChunkMetadata
} from './types';

/**
 * Vector data structure for in-memory storage
 */
interface VectorData {
  id: number;
  vector: number[];
  chunkId: string;
}

/**
 * JavaScript-based vector storage implementation
 * 
 * This is a fallback implementation for when FAISS native bindings are not available.
 * It provides the same interface as FAISSVectorStorage but uses pure JavaScript
 * for vector operations. Can be easily upgraded to FAISS when native bindings work.
 */
export class JSVectorStorage {
  private vectors: VectorData[] = [];
  private config!: VectorStorageConfig;
  private metadataStore!: MemoryMetadataStore;
  private outputChannel: vscode.OutputChannel;
  private vectorCount = 0;
  private isInitialized = false;
  private lastAutoSave = Date.now();
  private searchTimes: number[] = [];

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * Initialize the JavaScript vector storage system
   */
  async initialize(config: VectorStorageConfig): Promise<void> {
    try {
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Initializing JS Vector Storage (FAISS fallback)...`);
      
      this.config = config;
      
      // Initialize metadata store with memory-based implementation
      this.metadataStore = new MemoryMetadataStore(config.persistencePath);
      await this.metadataStore.initialize();
      
      // Try to load existing index
      await this.loadPersistedIndex();
      
      this.isInitialized = true;
      this.outputChannel.appendLine(`[${new Date().toISOString()}] JS Vector Storage initialized successfully`);
      
    } catch (error) {
      const errorMsg = `Failed to initialize JS Vector Storage: ${error instanceof Error ? error.message : String(error)}`;
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * Add embeddings to the vector storage
   */
  async addEmbeddings(embeddings: EmbeddingData[]): Promise<string[]> {
    if (!this.isInitialized) {
      throw new Error('JSVectorStorage not initialized');
    }

    if (embeddings.length === 0) {
      return [];
    }

    try {
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Adding ${embeddings.length} embeddings to JS vector storage...`);
      
      // Process in batches to manage memory
      const batchSize = this.config.batchSize;
      const vectorIds: string[] = [];
      
      for (let i = 0; i < embeddings.length; i += batchSize) {
        const batch = embeddings.slice(i, i + batchSize);
        const batchIds = await this.addEmbeddingBatch(batch);
        vectorIds.push(...batchIds);
      }
      
      // Auto-save if enabled and interval has passed
      if (this.config.autoSave && Date.now() - this.lastAutoSave > this.config.autoSaveInterval) {
        await this.saveIndex();
        this.lastAutoSave = Date.now();
      }
      
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Successfully added ${embeddings.length} embeddings (total: ${this.vectorCount})`);
      return vectorIds;
      
    } catch (error) {
      const errorMsg = `Failed to add embeddings: ${error instanceof Error ? error.message : String(error)}`;
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * Add a batch of embeddings
   */
  private async addEmbeddingBatch(embeddings: EmbeddingData[]): Promise<string[]> {
    // Add vectors to in-memory storage
    const startVectorId = this.vectorCount;
    
    embeddings.forEach((embedding, idx) => {
      const vectorId = startVectorId + idx;
      this.vectors.push({
        id: vectorId,
        vector: embedding.embedding,
        chunkId: embedding.metadata.id
      });
    });
    
    this.vectorCount += embeddings.length;
    
    // Prepare metadata with vector IDs
    const metadataList: ChunkMetadata[] = embeddings.map((embedding, idx) => ({
      ...embedding.metadata,
      vectorId: startVectorId + idx
    }));
    
    // Store metadata
    await this.metadataStore.addChunkMetadata(metadataList);
    
    return metadataList.map(m => m.id);
  }

  /**
   * Search for similar vectors using cosine similarity
   */
  async searchSimilar(
    queryEmbedding: number[],
    topK: number,
    filters?: MetadataFilter[]
  ): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      throw new Error('JSVectorStorage not initialized');
    }

    if (this.vectorCount === 0) {
      return [];
    }

    try {
      const startTime = Date.now();
      
      // Calculate cosine similarity for all vectors
      const similarities: { vectorId: number; score: number; distance: number }[] = [];
      
      for (const vectorData of this.vectors) {
        const similarity = this.calculateCosineSimilarity(queryEmbedding, vectorData.vector);
        const distance = 1 - similarity; // Convert similarity to distance
        
        similarities.push({
          vectorId: vectorData.id,
          score: similarity,
          distance: distance
        });
      }
      
      // Sort by similarity (highest first)
      similarities.sort((a, b) => b.score - a.score);
      
      // Get top K vector IDs
      const topSimilarities = similarities.slice(0, Math.min(topK * 2, similarities.length));
      const vectorIds = topSimilarities.map(s => s.vectorId);
      
      // Get metadata for results
      const metadataList = await this.metadataStore.getMetadataByVectorIds(vectorIds);
      
      // Create search results
      let results: SearchResult[] = metadataList.map((metadata) => {
        const similarity = topSimilarities.find(s => s.vectorId === metadata.vectorId);
        return {
          vectorId: metadata.vectorId,
          score: similarity?.score || 0,
          distance: similarity?.distance || 1,
          metadata
        };
      });
      
      // Apply metadata filters if provided
      if (filters && filters.length > 0) {
        results = results.filter(result => this.applyMetadataFilters(result.metadata, filters));
      }
      
      // Limit to requested number of results
      results = results.slice(0, topK);
      
      // Track search performance
      const searchTime = Date.now() - startTime;
      this.searchTimes.push(searchTime);
      if (this.searchTimes.length > 100) {
        this.searchTimes.shift(); // Keep only last 100 search times
      }
      
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Search completed in ${searchTime}ms, found ${results.length} results`);
      return results;
      
    } catch (error) {
      const errorMsg = `Failed to search vectors: ${error instanceof Error ? error.message : String(error)}`;
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vector dimensions must match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Remove vectors by file path
   */
  async removeFileVectors(filePath: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('JSVectorStorage not initialized');
    }

    try {
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Removing vectors for file: ${filePath}`);
      
      // Remove from metadata store and get affected vector IDs
      await this.metadataStore.removeFileMetadata(filePath);
      
      // Note: For simplicity, we don't remove from vectors array here
      // In a production system, this would be more efficient
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Metadata removed for file: ${filePath}`);
      
    } catch (error) {
      const errorMsg = `Failed to remove file vectors: ${error instanceof Error ? error.message : String(error)}`;
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * Save index to disk
   */
  async saveIndex(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('JSVectorStorage not initialized');
    }

    try {
      const indexPath = path.join(this.config.persistencePath, 'index.json');
      const metaPath = path.join(this.config.persistencePath, 'index.meta.json');
      
      // Ensure directory exists
      await fs.mkdir(this.config.persistencePath, { recursive: true });
      
      // Save vector data
      const indexData = {
        vectors: this.vectors,
        vectorCount: this.vectorCount,
        config: this.config
      };
      
      await fs.writeFile(indexPath, JSON.stringify(indexData));
      
      // Save index metadata
      const metadata: IndexPersistenceInfo = {
        indexPath,
        metadataPath: path.join(this.config.persistencePath, 'metadata.db'),
        version: '1.0-js',
        created: new Date(),
        lastSaved: new Date(),
        vectorCount: this.vectorCount
      };
      
      await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));
      
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Index saved to ${indexPath} (${this.vectorCount} vectors)`);
      
    } catch (error) {
      const errorMsg = `Failed to save index: ${error instanceof Error ? error.message : String(error)}`;
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * Load persisted index from disk
   */
  private async loadPersistedIndex(): Promise<void> {
    try {
      const indexPath = path.join(this.config.persistencePath, 'index.json');
      const metaPath = path.join(this.config.persistencePath, 'index.meta.json');
      
      // Check if files exist
      try {
        await fs.access(indexPath);
        await fs.access(metaPath);
      } catch {
        this.outputChannel.appendLine(`[${new Date().toISOString()}] No existing index found, starting with empty index`);
        return;
      }
      
      // Load index data
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      const indexData = JSON.parse(indexContent);
      
      this.vectors = indexData.vectors || [];
      this.vectorCount = indexData.vectorCount || 0;
      
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Loaded existing index with ${this.vectorCount} vectors`);
      
    } catch (error) {
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Warning: Failed to load existing index, starting fresh: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<VectorStorageStats> {
    if (!this.isInitialized) {
      throw new Error('JSVectorStorage not initialized');
    }

    const metadataStats = await this.metadataStore.getStats();
    const averageSearchTime = this.searchTimes.length > 0 
      ? this.searchTimes.reduce((sum, time) => sum + time, 0) / this.searchTimes.length 
      : 0;

    return {
      totalVectors: this.vectorCount,
      indexSize: this.vectorCount * this.config.faiss.dimension * 4, // Estimate in bytes
      memoryUsage: process.memoryUsage().heapUsed,
      lastUpdated: new Date(),
      averageSearchTime
    };
  }

  /**
   * Clear all vectors and metadata
   */
  async clear(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('JSVectorStorage not initialized');
    }

    try {
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Clearing vector storage...`);
      
      // Clear in-memory vectors
      this.vectors = [];
      this.vectorCount = 0;
      
      // Clear metadata store (this would require implementing clear method in MetadataStore)
      // For now, we'll close and reinitialize
      await this.metadataStore.close();
      this.metadataStore = new MemoryMetadataStore(this.config.persistencePath);
      await this.metadataStore.initialize();
      
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Vector storage cleared successfully`);
      
    } catch (error) {
      const errorMsg = `Failed to clear vector storage: ${error instanceof Error ? error.message : String(error)}`;
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * Close the vector storage and release resources
   */
  async close(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Save index if auto-save is enabled
      if (this.config.autoSave) {
        await this.saveIndex();
      }
      
      // Close metadata store
      await this.metadataStore.close();
      
      this.isInitialized = false;
      this.outputChannel.appendLine(`[${new Date().toISOString()}] Vector storage closed successfully`);
      
    } catch (error) {
      const errorMsg = `Failed to close vector storage: ${error instanceof Error ? error.message : String(error)}`;
      this.outputChannel.appendLine(`[${new Date().toISOString()}] ERROR: ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  /**
   * Apply metadata filters to search results
   */
  private applyMetadataFilters(metadata: ChunkMetadata, filters: MetadataFilter[]): boolean {
    return filters.every(filter => {
      let value: any;
      
      // Get value from metadata or context
      if (filter.field in metadata) {
        value = (metadata as any)[filter.field];
      } else if (filter.field in metadata.contextInfo) {
        value = (metadata.contextInfo as any)[filter.field];
      } else {
        return false;
      }
      
      // Apply filter operator
      switch (filter.operator) {
        case 'eq': return value === filter.value;
        case 'ne': return value !== filter.value;
        case 'gt': return value > filter.value;
        case 'lt': return value < filter.value;
        case 'gte': return value >= filter.value;
        case 'lte': return value <= filter.value;
        case 'in': return Array.isArray(filter.value) && filter.value.includes(value);
        case 'like': return typeof value === 'string' && value.includes(filter.value);
        default: return true;
      }
    });
  }
} 