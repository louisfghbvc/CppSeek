import * as path from 'path';
import * as fs from 'fs/promises';
import { ChunkMetadata, MetadataFilter } from './types';

/**
 * Pure JavaScript in-memory metadata store
 * Fallback for when SQLite native bindings are not available
 */
export class MemoryMetadataStore {
  private metadata: Map<number, ChunkMetadata> = new Map();
  private fileTracking: Map<string, { hash: string; lastIndexed: Date; chunkCount: number }> = new Map();
  private persistencePath: string;
  private isInitialized = false;

  constructor(persistencePath: string) {
    this.persistencePath = persistencePath;
  }

  /**
   * Initialize the in-memory metadata store
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Ensure directory exists
    await fs.mkdir(this.persistencePath, { recursive: true });
    
    // Try to load existing data
    await this.loadFromDisk();
    
    this.isInitialized = true;
  }

  /**
   * Add metadata for multiple chunks
   */
  async addChunkMetadata(metadataList: ChunkMetadata[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('MemoryMetadataStore not initialized');
    }

    metadataList.forEach(metadata => {
      this.metadata.set(metadata.vectorId, metadata);
    });

    // Auto-save to disk
    await this.saveToDisk();
  }

  /**
   * Get metadata by vector IDs
   */
  async getMetadataByVectorIds(vectorIds: number[]): Promise<ChunkMetadata[]> {
    if (!this.isInitialized) {
      throw new Error('MemoryMetadataStore not initialized');
    }

    return vectorIds
      .map(id => this.metadata.get(id))
      .filter((metadata): metadata is ChunkMetadata => metadata !== undefined);
  }

  /**
   * Query metadata with filters
   */
  async queryMetadata(filters: MetadataFilter[], limit?: number): Promise<ChunkMetadata[]> {
    if (!this.isInitialized) {
      throw new Error('MemoryMetadataStore not initialized');
    }

    let results = Array.from(this.metadata.values());

    // Apply filters
    if (filters.length > 0) {
      results = results.filter(metadata => this.applyFilters(metadata, filters));
    }

    // Sort by last updated (newest first)
    results.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());

    // Apply limit
    if (limit) {
      results = results.slice(0, limit);
    }

    return results;
  }

  /**
   * Update file tracking information
   */
  async updateFileTracking(filePath: string, fileHash: string, chunkCount: number): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('MemoryMetadataStore not initialized');
    }

    this.fileTracking.set(filePath, {
      hash: fileHash,
      lastIndexed: new Date(),
      chunkCount
    });

    await this.saveToDisk();
  }

  /**
   * Remove metadata for a specific file
   */
  async removeFileMetadata(filePath: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('MemoryMetadataStore not initialized');
    }

    // Remove all metadata for this file
    for (const [vectorId, metadata] of this.metadata.entries()) {
      if (metadata.filePath === filePath) {
        this.metadata.delete(vectorId);
      }
    }

    // Remove file tracking
    this.fileTracking.delete(filePath);

    await this.saveToDisk();
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{ totalChunks: number; totalFiles: number }> {
    if (!this.isInitialized) {
      throw new Error('MemoryMetadataStore not initialized');
    }

    return {
      totalChunks: this.metadata.size,
      totalFiles: this.fileTracking.size
    };
  }

  /**
   * Close the metadata store
   */
  async close(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    await this.saveToDisk();
    this.isInitialized = false;
  }

  /**
   * Save metadata to disk as JSON
   */
  private async saveToDisk(): Promise<void> {
    try {
      const dataPath = path.join(this.persistencePath, 'metadata.json');
      
      const data = {
        metadata: Array.from(this.metadata.entries()).map(([vectorId, metadata]) => ({
          ...metadata,
          vectorId, // Explicitly set vectorId to avoid spread conflict
          lastUpdated: metadata.lastUpdated.toISOString()
        })),
        fileTracking: Array.from(this.fileTracking.entries()).map(([filePath, tracking]) => ({
          filePath,
          ...tracking,
          lastIndexed: tracking.lastIndexed.toISOString()
        }))
      };

      await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      // Silently ignore save errors to avoid breaking the main functionality
      console.warn('Failed to save metadata to disk:', error);
    }
  }

  /**
   * Load metadata from disk
   */
  private async loadFromDisk(): Promise<void> {
    try {
      const dataPath = path.join(this.persistencePath, 'metadata.json');
      const content = await fs.readFile(dataPath, 'utf-8');
      const data = JSON.parse(content);

      // Restore metadata
      this.metadata.clear();
      if (data.metadata) {
        data.metadata.forEach((item: any) => {
          const metadata: ChunkMetadata = {
            ...item,
            lastUpdated: new Date(item.lastUpdated)
          };
          this.metadata.set(item.vectorId, metadata);
        });
      }

      // Restore file tracking
      this.fileTracking.clear();
      if (data.fileTracking) {
        data.fileTracking.forEach((item: any) => {
          this.fileTracking.set(item.filePath, {
            hash: item.hash,
            lastIndexed: new Date(item.lastIndexed),
            chunkCount: item.chunkCount
          });
        });
      }
    } catch (error) {
      // File doesn't exist or is corrupted, start fresh
    }
  }

  /**
   * Apply metadata filters
   */
  private applyFilters(metadata: ChunkMetadata, filters: MetadataFilter[]): boolean {
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