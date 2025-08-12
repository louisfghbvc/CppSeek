import { Document } from "@langchain/core/documents";
import * as vscode from 'vscode';
import { ModernVectorStorage } from '../vectorStorage/modernVectorStorage';
import { DocumentConverter, CodeChunk, LangChainDocument, ConversionStats } from './documentConverter';

/**
 * Document management result
 */
export interface DocumentResult {
  success: boolean;
  documentsProcessed: number;
  errors: string[];
  processingTime: number;
}

/**
 * Document query options
 */
export interface DocumentQueryOptions {
  filename?: string;
  functionName?: string;
  className?: string;
  namespace?: string;
  codeType?: 'function' | 'class' | 'namespace' | 'variable' | 'comment' | 'other';
  importance?: 'critical' | 'high' | 'medium' | 'low';
  limit?: number;
}

/**
 * Document statistics
 */
export interface DocumentStats {
  totalDocuments: number;
  documentsByFileType: { [fileType: string]: number };
  documentsByCodeType: { [codeType: string]: number };
  averageComplexity: number;
  lastUpdate: string;
}

/**
 * Batch operation result
 */
export interface BatchOperationResult {
  totalRequested: number;
  successful: number;
  failed: number;
  errors: Array<{
    id: string;
    error: string;
  }>;
  processingTime: number;
}

/**
 * DocumentManager handles document lifecycle management and vector storage integration
 * 
 * Provides high-level operations for adding, updating, removing, and querying documents
 * in the modern vector storage system. Integrates with DocumentConverter for format handling.
 */
export class DocumentManager {
  private converter: DocumentConverter;
  private vectorStorage: ModernVectorStorage;
  private outputChannel: vscode.OutputChannel;
  private documentCache: Map<string, LangChainDocument>;
  private lastUpdateTime: string;

  constructor(vectorStorage: ModernVectorStorage) {
    this.converter = new DocumentConverter();
    this.vectorStorage = vectorStorage;
    this.outputChannel = vscode.window.createOutputChannel('CppSeek Document Manager');
    this.documentCache = new Map();
    this.lastUpdateTime = new Date().toISOString();
  }

  /**
   * Add multiple CodeChunks as documents to the vector storage
   */
  async addDocuments(chunks: CodeChunk[]): Promise<DocumentResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let documentsProcessed = 0;

    try {
      this.outputChannel.appendLine(
        `[DocumentManager] Adding ${chunks.length} code chunks as documents...`
      );

      // Convert CodeChunks to LangChain Documents
      const documents = await this.converter.batchConvert(chunks);
      documentsProcessed = documents.length;

      if (documents.length === 0) {
        const error = 'No valid documents were converted from CodeChunks';
        errors.push(error);
        this.outputChannel.appendLine(`[DocumentManager] ❌ ${error}`);
        
        return {
          success: false,
          documentsProcessed: 0,
          errors,
          processingTime: Date.now() - startTime
        };
      }

      // Add documents to vector storage
      await this.vectorStorage.addCodeChunks(chunks);

      // Update cache
      documents.forEach(doc => {
        this.documentCache.set(doc.metadata.id, doc);
      });

      this.lastUpdateTime = new Date().toISOString();
      
      const processingTime = Date.now() - startTime;
      this.outputChannel.appendLine(
        `[DocumentManager] ✅ Successfully added ${documentsProcessed} documents in ${processingTime}ms`
      );

      return {
        success: true,
        documentsProcessed,
        errors,
        processingTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);
      
      this.outputChannel.appendLine(
        `[DocumentManager] ❌ Failed to add documents: ${errorMessage}`
      );

      return {
        success: false,
        documentsProcessed,
        errors,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Convert and add CodeChunks in a single operation
   */
  async convertAndAdd(chunks: CodeChunk[]): Promise<LangChainDocument[]> {
    try {
      this.outputChannel.appendLine(
        `[DocumentManager] Converting and adding ${chunks.length} code chunks...`
      );

      // Convert to documents
      const documents = await this.converter.batchConvert(chunks);
      
      // Add to vector storage
      if (documents.length > 0) {
        await this.addDocuments(chunks);
      }

      return documents;
    } catch (error) {
      this.outputChannel.appendLine(
        `[DocumentManager] ❌ Failed to convert and add chunks: ${error}`
      );
      throw error;
    }
  }

  /**
   * Update documents for changed files
   */
  async updateDocuments(changedFiles: string[]): Promise<DocumentResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let documentsProcessed = 0;

    try {
      this.outputChannel.appendLine(
        `[DocumentManager] Updating documents for ${changedFiles.length} changed files...`
      );

      // For each changed file, we need to:
      // 1. Remove existing documents for that file
      // 2. Re-chunk the file
      // 3. Add new documents

      for (const filename of changedFiles) {
        try {
          // Remove existing documents for this file
          await this.removeDocumentsByFile(filename);
          
          // Note: In a complete implementation, we would:
          // - Re-read the file content
          // - Re-chunk it using TextChunker
          // - Add the new chunks
          // For now, we'll log the placeholder
          
          this.outputChannel.appendLine(
            `[DocumentManager] ⚠️ Placeholder: Need to re-chunk and index file ${filename}`
          );
          
          documentsProcessed++;
        } catch (error) {
          const errorMessage = `Failed to update ${filename}: ${error}`;
          errors.push(errorMessage);
          this.outputChannel.appendLine(`[DocumentManager] ❌ ${errorMessage}`);
        }
      }

      this.lastUpdateTime = new Date().toISOString();
      
      const processingTime = Date.now() - startTime;
      this.outputChannel.appendLine(
        `[DocumentManager] ✅ Processed updates for ${documentsProcessed} files in ${processingTime}ms`
      );

      return {
        success: errors.length === 0,
        documentsProcessed,
        errors,
        processingTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);
      
      this.outputChannel.appendLine(
        `[DocumentManager] ❌ Failed to update documents: ${errorMessage}`
      );

      return {
        success: false,
        documentsProcessed,
        errors,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Remove documents for deleted files
   */
  async removeDocuments(deletedFiles: string[]): Promise<DocumentResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let documentsProcessed = 0;

    try {
      this.outputChannel.appendLine(
        `[DocumentManager] Removing documents for ${deletedFiles.length} deleted files...`
      );

      for (const filename of deletedFiles) {
        try {
          const removed = await this.removeDocumentsByFile(filename);
          documentsProcessed += removed;
        } catch (error) {
          const errorMessage = `Failed to remove documents for ${filename}: ${error}`;
          errors.push(errorMessage);
          this.outputChannel.appendLine(`[DocumentManager] ❌ ${errorMessage}`);
        }
      }

      this.lastUpdateTime = new Date().toISOString();
      
      const processingTime = Date.now() - startTime;
      this.outputChannel.appendLine(
        `[DocumentManager] ✅ Removed ${documentsProcessed} documents in ${processingTime}ms`
      );

      return {
        success: errors.length === 0,
        documentsProcessed,
        errors,
        processingTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);
      
      this.outputChannel.appendLine(
        `[DocumentManager] ❌ Failed to remove documents: ${errorMessage}`
      );

      return {
        success: false,
        documentsProcessed,
        errors,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get documents by filename
   */
  async getDocumentsByFile(filename: string): Promise<LangChainDocument[]> {
    try {
      this.outputChannel.appendLine(
        `[DocumentManager] Retrieving documents for file: ${filename}`
      );

      // Check cache first
      const cachedDocs = Array.from(this.documentCache.values())
        .filter(doc => doc.metadata.filename === filename);

      if (cachedDocs.length > 0) {
        this.outputChannel.appendLine(
          `[DocumentManager] Found ${cachedDocs.length} cached documents for ${filename}`
        );
        return cachedDocs;
      }

      // For a complete implementation, we would query the vector storage
      // to find documents by filename metadata
      this.outputChannel.appendLine(
        `[DocumentManager] ⚠️ Placeholder: Query vector storage for documents by filename`
      );

      return [];
    } catch (error) {
      this.outputChannel.appendLine(
        `[DocumentManager] ❌ Failed to get documents for file ${filename}: ${error}`
      );
      throw error;
    }
  }

  /**
   * Query documents with filters
   */
  async queryDocuments(options: DocumentQueryOptions): Promise<LangChainDocument[]> {
    try {
      this.outputChannel.appendLine(
        `[DocumentManager] Querying documents with filters: ${JSON.stringify(options)}`
      );

      // For now, filter from cache
      let results = Array.from(this.documentCache.values());

      if (options.filename) {
        results = results.filter(doc => doc.metadata.filename.includes(options.filename!));
      }

      if (options.functionName) {
        results = results.filter(doc => doc.metadata.functionName === options.functionName);
      }

      if (options.className) {
        results = results.filter(doc => doc.metadata.className === options.className);
      }

      if (options.namespace) {
        results = results.filter(doc => doc.metadata.namespace === options.namespace);
      }

      if (options.codeType) {
        results = results.filter(doc => doc.metadata.contextInfo.codeType === options.codeType);
      }

      if (options.importance) {
        results = results.filter(doc => doc.metadata.contextInfo.importance === options.importance);
      }

      if (options.limit) {
        results = results.slice(0, options.limit);
      }

      this.outputChannel.appendLine(
        `[DocumentManager] Query returned ${results.length} documents`
      );

      return results;
    } catch (error) {
      this.outputChannel.appendLine(
        `[DocumentManager] ❌ Failed to query documents: ${error}`
      );
      throw error;
    }
  }

  /**
   * Get document statistics
   */
  getDocumentStats(): DocumentStats {
    const docs = Array.from(this.documentCache.values());
    
    const documentsByFileType: { [fileType: string]: number } = {};
    const documentsByCodeType: { [codeType: string]: number } = {};
    let totalComplexity = 0;

    docs.forEach(doc => {
      const fileType = doc.metadata.fileType;
      const codeType = doc.metadata.contextInfo.codeType;
      const complexity = doc.metadata.contextInfo.complexity;

      documentsByFileType[fileType] = (documentsByFileType[fileType] || 0) + 1;
      documentsByCodeType[codeType] = (documentsByCodeType[codeType] || 0) + 1;
      totalComplexity += complexity;
    });

    return {
      totalDocuments: docs.length,
      documentsByFileType,
      documentsByCodeType,
      averageComplexity: docs.length > 0 ? totalComplexity / docs.length : 0,
      lastUpdate: this.lastUpdateTime
    };
  }

  /**
   * Validate document integrity
   */
  async validateDocuments(): Promise<{ valid: number; invalid: number; errors: string[] }> {
    const errors: string[] = [];
    let valid = 0;
    let invalid = 0;

    try {
      this.outputChannel.appendLine(
        `[DocumentManager] Validating ${this.documentCache.size} cached documents...`
      );

      for (const [id, doc] of this.documentCache.entries()) {
        try {
          if (this.converter.validateDocument(doc)) {
            valid++;
          } else {
            invalid++;
            errors.push(`Document ${id} failed validation`);
          }
        } catch (error) {
          invalid++;
          errors.push(`Document ${id} validation error: ${error}`);
        }
      }

      this.outputChannel.appendLine(
        `[DocumentManager] Validation complete: ${valid} valid, ${invalid} invalid`
      );

      return { valid, invalid, errors };
    } catch (error) {
      this.outputChannel.appendLine(
        `[DocumentManager] ❌ Document validation failed: ${error}`
      );
      throw error;
    }
  }

  /**
   * Clear the document cache
   */
  clearCache(): void {
    this.documentCache.clear();
    this.outputChannel.appendLine(`[DocumentManager] Document cache cleared`);
  }

  /**
   * Get conversion statistics from the converter
   */
  getConversionStats(): ConversionStats {
    return this.converter.getStats();
  }

  /**
   * Remove documents by filename (helper method)
   */
  private async removeDocumentsByFile(filename: string): Promise<number> {
    const docsToRemove = Array.from(this.documentCache.values())
      .filter(doc => doc.metadata.filename === filename);

    if (docsToRemove.length === 0) {
      return 0;
    }

    const idsToRemove = docsToRemove.map(doc => doc.metadata.id);
    
    try {
      // Remove from vector storage
      await this.vectorStorage.deleteDocuments(idsToRemove);
      
      // Remove from cache
      idsToRemove.forEach(id => this.documentCache.delete(id));
      
      this.outputChannel.appendLine(
        `[DocumentManager] Removed ${docsToRemove.length} documents for file ${filename}`
      );
      
      return docsToRemove.length;
    } catch (error) {
      this.outputChannel.appendLine(
        `[DocumentManager] ❌ Failed to remove documents for file ${filename}: ${error}`
      );
      throw error;
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.converter.dispose();
    this.outputChannel.dispose();
    this.documentCache.clear();
  }
} 