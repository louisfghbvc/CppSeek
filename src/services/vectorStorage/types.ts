/**
 * Types and interfaces for FAISS vector storage system
 */

/**
 * FAISS index configuration options
 */
export interface FAISSConfig {
  indexType: 'Flat' | 'IVFFlat' | 'HNSW';
  dimension: number;
  nlist?: number; // For IVF indices
  nprobe?: number; // Search parameters
  efConstruction?: number; // For HNSW
  efSearch?: number; // For HNSW
  metric: 'L2' | 'IP' | 'COSINE';
}

/**
 * Vector storage service configuration
 */
export interface VectorStorageConfig {
  faiss: FAISSConfig;
  persistencePath: string;
  batchSize: number;
  autoSave: boolean;
  autoSaveInterval: number;
  memoryLimit: number;
}

/**
 * Metadata for individual code chunks
 */
export interface ChunkMetadata {
  id: string;
  vectorId: number;
  filePath: string;
  fileName: string;
  startLine: number;
  endLine: number;
  startChar: number;
  endChar: number;
  chunkIndex: number;
  content: string;
  contentHash: string;
  contextInfo: SemanticContext;
  lastUpdated: Date;
}

/**
 * Semantic context information for code chunks
 */
export interface SemanticContext {
  functionName?: string;
  className?: string;
  namespace?: string;
  fileType: 'header' | 'source' | 'implementation';
  codeType: 'function' | 'class' | 'comment' | 'preprocessor' | 'other';
  complexity: number;
  importance: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Embedding data structure for storage
 */
export interface EmbeddingData {
  embedding: number[];
  metadata: Omit<ChunkMetadata, 'vectorId'>;
}

/**
 * Search result structure
 */
export interface SearchResult {
  vectorId: number;
  score: number;
  distance: number;
  metadata: ChunkMetadata;
}

/**
 * Metadata filter for search operations
 */
export interface MetadataFilter {
  field: keyof ChunkMetadata | keyof SemanticContext;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'like';
  value: any;
}

/**
 * Vector storage statistics
 */
export interface VectorStorageStats {
  totalVectors: number;
  indexSize: number;
  memoryUsage: number;
  lastUpdated: Date;
  averageSearchTime: number;
}

/**
 * Index persistence information
 */
export interface IndexPersistenceInfo {
  indexPath: string;
  metadataPath: string;
  version: string;
  created: Date;
  lastSaved: Date;
  vectorCount: number;
} 