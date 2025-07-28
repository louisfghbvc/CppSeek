/**
 * Types and interfaces for modern vector storage system
 */

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