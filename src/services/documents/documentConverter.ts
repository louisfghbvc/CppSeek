import { Document } from "@langchain/core/documents";
import * as crypto from 'crypto';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Enhanced CodeChunk interface that includes the original TextChunk properties
 */
export interface CodeChunk {
  id: string;
  content: string;
  filename: string;
  lineStart: number;
  lineEnd: number;
  startChar?: number;
  endChar?: number;
  chunkIndex?: number;
  namespace?: string;
  functionName?: string;
  className?: string;
  tokens?: number;
  sourceFile?: string;
  timestamp?: string;
}

/**
 * LangChain Document with enhanced metadata for code search
 */
export interface LangChainDocument extends Document {
  pageContent: string;
  metadata: {
    id: string;
    filename: string;
    lineStart: number;
    lineEnd: number;
    startChar: number;
    endChar: number;
    chunkId: string;
    chunkIndex: number;
    fileType: string;
    lastModified: string;
    hash: string;
    // Code-specific metadata
    namespace?: string;
    functionName?: string;
    className?: string;
    tokens?: number;
    // Context information
    contextInfo: {
      fileType: 'header' | 'source' | 'unknown';
      codeType: 'function' | 'class' | 'namespace' | 'variable' | 'comment' | 'other';
      complexity: number;
      importance: 'critical' | 'high' | 'medium' | 'low';
    };
  };
}

/**
 * Document conversion statistics
 */
export interface ConversionStats {
  totalProcessed: number;
  successfulConversions: number;
  errors: ConversionError[];
  processingTime: number;
}

/**
 * Conversion error information
 */
export interface ConversionError {
  chunkId: string;
  error: string;
  timestamp: string;
}

/**
 * DocumentConverter service for converting between CodeChunk and LangChain Document formats
 * 
 * Provides bidirectional conversion with metadata preservation and enhancement.
 * Includes content hashing, file type detection, and context analysis.
 */
export class DocumentConverter {
  private outputChannel: vscode.OutputChannel;
  private conversionStats: ConversionStats;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('CppSeek Document Converter');
    this.conversionStats = {
      totalProcessed: 0,
      successfulConversions: 0,
      errors: [],
      processingTime: 0
    };
    this.resetStats();
  }

  /**
   * Convert a single CodeChunk to LangChain Document format
   */
  convertCodeChunkToDocument(chunk: CodeChunk): LangChainDocument {
    try {
      const startTime = Date.now();
      
      // Generate content hash for change detection
      const hash = this.generateContentHash(chunk.content);
      
      // Extract file type and extension
      const fileExtension = path.extname(chunk.filename).toLowerCase();
      const fileType = this.getFileType(fileExtension);
      
      // Analyze code context
      const contextInfo = this.analyzeCodeContext(chunk);
      
      // Create timestamp if not provided
      const timestamp = chunk.timestamp || new Date().toISOString();
      
      const document: LangChainDocument = {
        pageContent: chunk.content,
        metadata: {
          id: chunk.id,
          filename: chunk.filename,
          lineStart: chunk.lineStart,
          lineEnd: chunk.lineEnd,
          startChar: chunk.startChar || 0,
          endChar: chunk.endChar || chunk.content.length,
          chunkId: chunk.id,
          chunkIndex: chunk.chunkIndex || 0,
          fileType: fileExtension,
          lastModified: timestamp,
          hash: hash,
          // Code-specific metadata
          namespace: chunk.namespace,
          functionName: chunk.functionName,
          className: chunk.className,
          tokens: chunk.tokens,
          // Enhanced context
          contextInfo: contextInfo
        }
      };

      this.conversionStats.successfulConversions++;
      
      const processingTime = Date.now() - startTime;
      this.outputChannel.appendLine(
        `[DocumentConverter] Converted chunk ${chunk.id} in ${processingTime}ms`
      );

      return document;
    } catch (error) {
      const conversionError: ConversionError = {
        chunkId: chunk.id,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };
      
      this.conversionStats.errors.push(conversionError);
      this.outputChannel.appendLine(
        `[DocumentConverter] ❌ Failed to convert chunk ${chunk.id}: ${conversionError.error}`
      );
      
      throw new Error(`Failed to convert CodeChunk ${chunk.id}: ${conversionError.error}`);
    }
  }

  /**
   * Convert a LangChain Document back to CodeChunk format
   */
  convertDocumentToCodeChunk(doc: LangChainDocument): CodeChunk {
    try {
      const chunk: CodeChunk = {
        id: doc.metadata.id,
        content: doc.pageContent,
        filename: doc.metadata.filename,
        lineStart: doc.metadata.lineStart,
        lineEnd: doc.metadata.lineEnd,
        startChar: doc.metadata.startChar,
        endChar: doc.metadata.endChar,
        chunkIndex: doc.metadata.chunkIndex,
        namespace: doc.metadata.namespace,
        functionName: doc.metadata.functionName,
        className: doc.metadata.className,
        tokens: doc.metadata.tokens,
        sourceFile: doc.metadata.filename,
        timestamp: doc.metadata.lastModified
      };

      this.outputChannel.appendLine(
        `[DocumentConverter] Converted document ${doc.metadata.id} back to CodeChunk`
      );

      return chunk;
    } catch (error) {
      this.outputChannel.appendLine(
        `[DocumentConverter] ❌ Failed to convert document to CodeChunk: ${error}`
      );
      throw new Error(`Failed to convert Document to CodeChunk: ${error}`);
    }
  }

  /**
   * Batch convert multiple CodeChunks to Documents
   */
  async batchConvert(chunks: CodeChunk[]): Promise<LangChainDocument[]> {
    const startTime = Date.now();
    this.resetStats();
    this.conversionStats.totalProcessed = chunks.length;

    this.outputChannel.appendLine(
      `[DocumentConverter] Starting batch conversion of ${chunks.length} chunks...`
    );

    const documents: LangChainDocument[] = [];
    
    for (const chunk of chunks) {
      try {
        const document = this.convertCodeChunkToDocument(chunk);
        documents.push(document);
      } catch (error) {
        // Error already logged in convertCodeChunkToDocument
        continue;
      }
    }

    const processingTime = Date.now() - startTime;
    this.conversionStats.processingTime = processingTime;

    this.outputChannel.appendLine(
      `[DocumentConverter] ✅ Batch conversion completed: ` +
      `${this.conversionStats.successfulConversions}/${this.conversionStats.totalProcessed} successful ` +
      `in ${processingTime}ms`
    );

    if (this.conversionStats.errors.length > 0) {
      this.outputChannel.appendLine(
        `[DocumentConverter] ⚠️ ${this.conversionStats.errors.length} conversion errors occurred`
      );
    }

    return documents;
  }

  /**
   * Batch convert Documents back to CodeChunks
   */
  async batchConvertToCodeChunks(documents: LangChainDocument[]): Promise<CodeChunk[]> {
    const startTime = Date.now();
    
    this.outputChannel.appendLine(
      `[DocumentConverter] Converting ${documents.length} documents back to CodeChunks...`
    );

    const chunks: CodeChunk[] = documents.map(doc => this.convertDocumentToCodeChunk(doc));
    
    const processingTime = Date.now() - startTime;
    this.outputChannel.appendLine(
      `[DocumentConverter] ✅ Converted ${chunks.length} documents back to CodeChunks in ${processingTime}ms`
    );

    return chunks;
  }

  /**
   * Generate content hash for change detection
   */
  generateContentHash(content: string): string {
    return crypto.createHash('md5').update(content.trim()).digest('hex');
  }

  /**
   * Detect file type from extension
   */
  private getFileType(extension: string): string {
    const typeMap: { [key: string]: string } = {
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.c': 'c',
      '.h': 'header',
      '.hpp': 'header',
      '.hxx': 'header',
      '.js': 'javascript',
      '.ts': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala'
    };

    return typeMap[extension] || 'unknown';
  }

  /**
   * Analyze code context to categorize and assess complexity
   */
  private analyzeCodeContext(chunk: CodeChunk): LangChainDocument['metadata']['contextInfo'] {
    const content = chunk.content.toLowerCase();
    const extension = path.extname(chunk.filename).toLowerCase();
    
    // Determine file type
    const fileType: 'header' | 'source' | 'unknown' = 
      ['.h', '.hpp', '.hxx'].includes(extension) ? 'header' :
      ['.cpp', '.cc', '.cxx', '.c'].includes(extension) ? 'source' : 'unknown';

    // Determine code type
    let codeType: 'function' | 'class' | 'namespace' | 'variable' | 'comment' | 'other' = 'other';
    
    if (chunk.functionName) {
      codeType = 'function';
    } else if (chunk.className) {
      codeType = 'class';
    } else if (chunk.namespace) {
      codeType = 'namespace';
    } else if (content.includes('//') || content.includes('/*')) {
      codeType = 'comment';
    } else if (content.match(/\b(int|float|double|char|bool|string|auto)\s+\w+/)) {
      codeType = 'variable';
    }

    // Assess complexity based on content patterns
    let complexity = 1;
    const complexityIndicators = [
      /\bfor\s*\(/g, /\bwhile\s*\(/g, /\bif\s*\(/g,  // Control structures
      /\bswitch\s*\(/g, /\btry\s*{/g, /\bcatch\s*\(/g,  // Exception handling
      /\bclass\s+\w+/g, /\bstruct\s+\w+/g,  // Type definitions
      /\btemplate\s*</g, /\btypename\s+/g,  // Templates
      /\boperator\s*[=+\-*/]/g,  // Operator overloading
      /\bvirtual\s+/g, /\boverride\b/g  // Inheritance
    ];

    complexity += complexityIndicators.reduce((count, pattern) => {
      const matches = content.match(pattern);
      return count + (matches ? matches.length : 0);
    }, 0);

    // Determine importance based on context
    let importance: 'critical' | 'high' | 'medium' | 'low' = 'medium';
    
    if (chunk.functionName) {
      if (chunk.functionName.includes('main') || chunk.functionName.includes('init')) {
        importance = 'critical';
      } else if (chunk.functionName.includes('test') || chunk.functionName.includes('debug')) {
        importance = 'low';
      } else {
        importance = 'high';
      }
    } else if (chunk.className) {
      importance = 'high';
    } else if (codeType === 'comment') {
      importance = 'low';
    }

    return {
      fileType,
      codeType,
      complexity: Math.min(complexity, 10), // Cap at 10
      importance
    };
  }

  /**
   * Get conversion statistics
   */
  getStats(): ConversionStats {
    return { ...this.conversionStats };
  }

  /**
   * Reset conversion statistics
   */
  private resetStats(): void {
    this.conversionStats = {
      totalProcessed: 0,
      successfulConversions: 0,
      errors: [],
      processingTime: 0
    };
  }

  /**
   * Validate document structure
   */
  validateDocument(document: LangChainDocument): boolean {
    try {
      const required = ['id', 'filename', 'lineStart', 'lineEnd', 'hash'];
      const metadata = document.metadata;
      
      for (const field of required) {
        if (!(field in metadata) || (metadata as any)[field] === undefined) {
          this.outputChannel.appendLine(
            `[DocumentConverter] ❌ Validation failed: missing ${field} in document metadata`
          );
          return false;
        }
      }

      if (!document.pageContent || document.pageContent.trim().length === 0) {
        this.outputChannel.appendLine(
          `[DocumentConverter] ❌ Validation failed: empty pageContent`
        );
        return false;
      }

      return true;
    } catch (error) {
      this.outputChannel.appendLine(
        `[DocumentConverter] ❌ Validation error: ${error}`
      );
      return false;
    }
  }

  /**
   * Compare two documents for changes
   */
  hasContentChanged(doc1: LangChainDocument, doc2: LangChainDocument): boolean {
    return doc1.metadata.hash !== doc2.metadata.hash;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.outputChannel.dispose();
  }
} 