import * as vscode from 'vscode';
import { TextChunk } from './TextChunker';

export interface SemanticBoundary {
  type: 'function' | 'class' | 'namespace' | 'comment' | 'preprocessor';
  startLine: number;
  endLine: number;
  startChar: number;
  endChar: number;
  importance: 'critical' | 'high' | 'medium' | 'low';
  context: string; // Function name, class name, etc.
}

export interface OverlapRegion {
  chunkA: string;        // Previous chunk ID
  chunkB: string;        // Next chunk ID
  overlapStart: number;  // Start position in chunkA
  overlapEnd: number;    // End position in chunkB
  content: string;       // Overlapping content
  semanticValue: number; // Importance score (0-1)
  boundaries: SemanticBoundary[]; // Preserved constructs
}

export interface OverlapQuality {
  totalOverlaps: number;
  averageOverlapSize: number;
  semanticPreservation: number; // 0-1 score
  functionsPreserved: number;
  classesPreserved: number;
  commentsPreserved: number;
  duplicateContentRatio: number;
}

export interface OverlapConfiguration {
  minSize: number;
  maxSize: number;
  adaptiveMode: boolean;
  preserveFunctions: boolean;
  preserveComments: boolean;
}

/**
 * Manages intelligent chunk overlap logic for maintaining semantic context continuity
 */
export class ChunkOverlapManager {
  private static readonly DEFAULT_MIN_OVERLAP = 25;
  private static readonly DEFAULT_MAX_OVERLAP = 100;
  
  private readonly outputChannel: vscode.OutputChannel;
  private boundaryCache = new Map<string, SemanticBoundary[]>();
  private overlapQuality: OverlapQuality = {
    totalOverlaps: 0,
    averageOverlapSize: 0,
    semanticPreservation: 0,
    functionsPreserved: 0,
    classesPreserved: 0,
    commentsPreserved: 0,
    duplicateContentRatio: 0
  };

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * Apply intelligent overlap logic to a sequence of text chunks
   */
  async applyOverlapLogic(
    chunks: TextChunk[], 
    sourceContent: string,
    sourceFile: string
  ): Promise<{ chunks: TextChunk[], overlaps: OverlapRegion[], quality: OverlapQuality }> {
    const startTime = Date.now();
    
    if (chunks.length <= 1) {
      return { chunks, overlaps: [], quality: this.overlapQuality };
    }

    this.outputChannel.appendLine(`[ChunkOverlapManager] Processing ${chunks.length} chunks for overlap logic`);
    
    const config = this.getOverlapConfiguration();
    const overlaps: OverlapRegion[] = [];
    const enhancedChunks: TextChunk[] = [];
    
    // Process chunks sequentially to maintain context
    for (let i = 0; i < chunks.length; i++) {
      const currentChunk = chunks[i];
      const nextChunk = i < chunks.length - 1 ? chunks[i + 1] : null;
      
      let enhancedChunk = { ...currentChunk };
      
      if (nextChunk && config.adaptiveMode) {
        // Analyze semantic boundaries at chunk boundary
        const boundaryInfo = await this.analyzeBoundary(
          sourceContent, 
          currentChunk, 
          nextChunk, 
          sourceFile
        );
        
        // Calculate optimal overlap based on semantic analysis
        const optimalOverlap = this.calculateOptimalOverlap(
          boundaryInfo, 
          config
        );
        
        if (optimalOverlap > 0) {
          // Apply overlap to current chunk
          const overlapRegion = this.createOverlapRegion(
            currentChunk,
            nextChunk,
            sourceContent,
            optimalOverlap,
            boundaryInfo
          );
          
          enhancedChunk = this.enhanceChunkWithOverlap(
            currentChunk,
            overlapRegion,
            'forward'
          );
          
          overlaps.push(overlapRegion);
          
          this.outputChannel.appendLine(
            `  Applied ${optimalOverlap} token overlap between chunks ${i} and ${i + 1}`
          );
        }
      }
      
      enhancedChunks.push(enhancedChunk);
    }
    
    // Update quality metrics
    this.updateQualityMetrics(overlaps, chunks.length);
    
    const processingTime = Date.now() - startTime;
    this.outputChannel.appendLine(
      `[ChunkOverlapManager] Overlap processing completed in ${processingTime}ms`
    );
    
    return { 
      chunks: enhancedChunks, 
      overlaps, 
      quality: this.overlapQuality 
    };
  }

  /**
   * Analyze semantic boundaries at the junction between two chunks
   */
  private async analyzeBoundary(
    sourceContent: string,
    currentChunk: TextChunk,
    nextChunk: TextChunk,
    sourceFile: string
  ): Promise<SemanticBoundary[]> {
    const cacheKey = `${sourceFile}:${currentChunk.endChar}-${nextChunk.startChar}`;
    
    if (this.boundaryCache.has(cacheKey)) {
      return this.boundaryCache.get(cacheKey)!;
    }
    
    const boundaries: SemanticBoundary[] = [];
    
    // Analyze content around the boundary (±200 characters)
    const boundaryStart = Math.max(0, currentChunk.endChar - 200);
    const boundaryEnd = Math.min(sourceContent.length, nextChunk.startChar + 200);
    const boundaryContent = sourceContent.substring(boundaryStart, boundaryEnd);
    
    // Find semantic constructs in boundary region
    boundaries.push(...this.detectFunctions(boundaryContent, boundaryStart));
    boundaries.push(...this.detectClasses(boundaryContent, boundaryStart));
    boundaries.push(...this.detectComments(boundaryContent, boundaryStart));
    boundaries.push(...this.detectPreprocessor(boundaryContent, boundaryStart));
    boundaries.push(...this.detectNamespaces(boundaryContent, boundaryStart));
    
    // Cache the results
    this.boundaryCache.set(cacheKey, boundaries);
    
    return boundaries;
  }

  /**
   * Detect function definitions and declarations
   */
  private detectFunctions(content: string, offset: number): SemanticBoundary[] {
    const boundaries: SemanticBoundary[] = [];
    
    // Function definition pattern: return_type function_name(params) {
    const functionRegex = /^\s*(?:(?:inline|static|virtual|explicit|friend)\s+)*(?:(?:const|unsigned|signed|long|short)\s+)*(?:\w+(?:::\w+)*(?:\s*\*|\s*&)*\s+)+(\w+)\s*\([^)]*\)\s*(?:const)?\s*(?:override)?\s*(?:final)?\s*{/gm;
    
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      const startPos = offset + match.index;
      const functionName = match[1];
      
      // Find end of function (simplified - find matching brace)
      const endPos = this.findFunctionEnd(content, match.index);
      
      boundaries.push({
        type: 'function',
        startLine: this.getLineNumber(content, match.index),
        endLine: this.getLineNumber(content, endPos),
        startChar: startPos,
        endChar: offset + endPos,
        importance: 'critical',
        context: functionName
      });
    }
    
    // Function declaration pattern: return_type function_name(params);
    const declarationRegex = /^\s*(?:(?:inline|static|virtual|explicit|friend)\s+)*(?:(?:const|unsigned|signed|long|short)\s+)*(?:\w+(?:::\w+)*(?:\s*\*|\s*&)*\s+)+(\w+)\s*\([^)]*\)\s*(?:const)?\s*(?:override)?\s*(?:final)?\s*;/gm;
    
    while ((match = declarationRegex.exec(content)) !== null) {
      const startPos = offset + match.index;
      const functionName = match[1];
      
      boundaries.push({
        type: 'function',
        startLine: this.getLineNumber(content, match.index),
        endLine: this.getLineNumber(content, match.index + match[0].length),
        startChar: startPos,
        endChar: startPos + match[0].length,
        importance: 'high',
        context: functionName
      });
    }
    
    return boundaries;
  }

  /**
   * Detect class definitions
   */
  private detectClasses(content: string, offset: number): SemanticBoundary[] {
    const boundaries: SemanticBoundary[] = [];
    
    // Class definition pattern: class ClassName : inheritance {
    const classRegex = /^\s*(?:template\s*<[^>]*>\s*)?(?:class|struct)\s+(\w+)(?:\s*:\s*[^{]+)?\s*{/gm;
    
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      const startPos = offset + match.index;
      const className = match[1];
      
      // Find end of class (simplified - find matching brace)
      const endPos = this.findClassEnd(content, match.index);
      
      boundaries.push({
        type: 'class',
        startLine: this.getLineNumber(content, match.index),
        endLine: this.getLineNumber(content, endPos),
        startChar: startPos,
        endChar: offset + endPos,
        importance: 'critical',
        context: className
      });
    }
    
    return boundaries;
  }

  /**
   * Detect important comments (documentation, TODOs, etc.)
   */
  private detectComments(content: string, offset: number): SemanticBoundary[] {
    const boundaries: SemanticBoundary[] = [];
    
    // Multi-line comments /** ... */ or /* ... */
    const blockCommentRegex = /\/\*[\s\S]*?\*\//g;
    
    let match;
    while ((match = blockCommentRegex.exec(content)) !== null) {
      const startPos = offset + match.index;
      const commentContent = match[0];
      
      // Determine importance based on content
      let importance: 'critical' | 'high' | 'medium' | 'low' = 'medium';
      if (commentContent.includes('/**') || commentContent.includes('@param') || commentContent.includes('@return')) {
        importance = 'high'; // Documentation comment
      } else if (commentContent.includes('TODO') || commentContent.includes('FIXME') || commentContent.includes('NOTE')) {
        importance = 'medium';
      }
      
      boundaries.push({
        type: 'comment',
        startLine: this.getLineNumber(content, match.index),
        endLine: this.getLineNumber(content, match.index + match[0].length),
        startChar: startPos,
        endChar: startPos + match[0].length,
        importance,
        context: commentContent.substring(0, 50) + '...'
      });
    }
    
    // Single-line comments with special markers
    const lineCommentRegex = /\/\/.*(?:TODO|FIXME|NOTE|BUG|HACK).*$/gm;
    
    while ((match = lineCommentRegex.exec(content)) !== null) {
      const startPos = offset + match.index;
      
      boundaries.push({
        type: 'comment',
        startLine: this.getLineNumber(content, match.index),
        endLine: this.getLineNumber(content, match.index + match[0].length),
        startChar: startPos,
        endChar: startPos + match[0].length,
        importance: 'medium',
        context: match[0].trim()
      });
    }
    
    return boundaries;
  }

  /**
   * Detect preprocessor directives
   */
  private detectPreprocessor(content: string, offset: number): SemanticBoundary[] {
    const boundaries: SemanticBoundary[] = [];
    
    // Preprocessor directives: #include, #define, #ifdef, etc.
    const preprocessorRegex = /^\s*#\s*(\w+).*$/gm;
    
    let match;
    while ((match = preprocessorRegex.exec(content)) !== null) {
      const startPos = offset + match.index;
      const directive = match[1];
      
      let importance: 'critical' | 'high' | 'medium' | 'low' = 'medium';
      if (['include', 'define'].includes(directive)) {
        importance = 'high';
      } else if (['ifdef', 'ifndef', 'endif'].includes(directive)) {
        importance = 'medium';
      }
      
      boundaries.push({
        type: 'preprocessor',
        startLine: this.getLineNumber(content, match.index),
        endLine: this.getLineNumber(content, match.index + match[0].length),
        startChar: startPos,
        endChar: startPos + match[0].length,
        importance,
        context: `#${directive}`
      });
    }
    
    return boundaries;
  }

  /**
   * Detect namespace definitions
   */
  private detectNamespaces(content: string, offset: number): SemanticBoundary[] {
    const boundaries: SemanticBoundary[] = [];
    
    // Namespace pattern: namespace name {
    const namespaceRegex = /^\s*namespace\s+(\w+)\s*{/gm;
    
    let match;
    while ((match = namespaceRegex.exec(content)) !== null) {
      const startPos = offset + match.index;
      const namespaceName = match[1];
      
      // Find end of namespace
      const endPos = this.findNamespaceEnd(content, match.index);
      
      boundaries.push({
        type: 'namespace',
        startLine: this.getLineNumber(content, match.index),
        endLine: this.getLineNumber(content, endPos),
        startChar: startPos,
        endChar: offset + endPos,
        importance: 'high',
        context: namespaceName
      });
    }
    
    return boundaries;
  }

  /**
   * Calculate optimal overlap size based on semantic analysis
   */
  private calculateOptimalOverlap(
    boundaries: SemanticBoundary[], 
    config: OverlapConfiguration
  ): number {
    if (!config.adaptiveMode) {
      return config.minSize;
    }
    
    let recommendedOverlap = config.minSize;
    
    // Analyze boundaries to determine optimal overlap
    for (const boundary of boundaries) {
      let additionalOverlap = 0;
      
      switch (boundary.importance) {
        case 'critical':
          additionalOverlap = 40;
          break;
        case 'high':
          additionalOverlap = 25;
          break;
        case 'medium':
          additionalOverlap = 15;
          break;
        case 'low':
          additionalOverlap = 5;
          break;
      }
      
      // Apply type-specific bonuses
      if (boundary.type === 'function' && config.preserveFunctions) {
        additionalOverlap += 20;
      } else if (boundary.type === 'comment' && config.preserveComments) {
        additionalOverlap += 10;
      }
      
      recommendedOverlap = Math.max(recommendedOverlap, config.minSize + additionalOverlap);
    }
    
    // Cap at maximum size
    return Math.min(recommendedOverlap, config.maxSize);
  }

  /**
   * Create overlap region between two chunks
   */
  private createOverlapRegion(
    currentChunk: TextChunk,
    nextChunk: TextChunk,
    sourceContent: string,
    overlapSize: number,
    boundaries: SemanticBoundary[]
  ): OverlapRegion {
    // Calculate overlap boundaries
    const overlapStart = Math.max(0, currentChunk.endChar - overlapSize * 4); // Rough token-to-char conversion
    const overlapEnd = Math.min(sourceContent.length, nextChunk.startChar + overlapSize * 4);
    
    const overlapContent = sourceContent.substring(overlapStart, overlapEnd);
    
    // Calculate semantic value based on preserved boundaries
    const semanticValue = this.calculateSemanticValue(boundaries);
    
    return {
      chunkA: currentChunk.id,
      chunkB: nextChunk.id,
      overlapStart,
      overlapEnd,
      content: overlapContent,
      semanticValue,
      boundaries: boundaries.filter(b => 
        b.startChar >= overlapStart && b.endChar <= overlapEnd
      )
    };
  }

  /**
   * Enhance a chunk with overlap information
   */
  private enhanceChunkWithOverlap(
    chunk: TextChunk,
    overlap: OverlapRegion,
    direction: 'forward' | 'backward'
  ): TextChunk {
    const enhancedChunk = { ...chunk };
    
    if (direction === 'forward') {
      // Add overlap content to the end of current chunk
      enhancedChunk.overlapEnd = overlap.overlapEnd - overlap.overlapStart;
      enhancedChunk.content += '\n' + overlap.content;
    } else {
      // Add overlap content to the beginning of current chunk
      enhancedChunk.overlapStart = overlap.overlapEnd - overlap.overlapStart;
      enhancedChunk.content = overlap.content + '\n' + enhancedChunk.content;
    }
    
    return enhancedChunk;
  }

  /**
   * Get overlap configuration from VSCode settings
   */
  private getOverlapConfiguration(): OverlapConfiguration {
    const config = vscode.workspace.getConfiguration('cppseek.overlap');
    
    return {
      minSize: config.get<number>('minSize', ChunkOverlapManager.DEFAULT_MIN_OVERLAP),
      maxSize: config.get<number>('maxSize', ChunkOverlapManager.DEFAULT_MAX_OVERLAP),
      adaptiveMode: config.get<boolean>('adaptiveMode', true),
      preserveFunctions: config.get<boolean>('preserveFunctions', true),
      preserveComments: config.get<boolean>('preserveComments', true)
    };
  }

  /**
   * Helper methods for finding construct boundaries
   */
  private findFunctionEnd(content: string, startIndex: number): number {
    let braceCount = 0;
    let inFunction = false;
    
    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];
      
      if (char === '{') {
        braceCount++;
        inFunction = true;
      } else if (char === '}' && inFunction) {
        braceCount--;
        if (braceCount === 0) {
          return i + 1;
        }
      }
    }
    
    return content.length;
  }

  private findClassEnd(content: string, startIndex: number): number {
    return this.findFunctionEnd(content, startIndex); // Same logic
  }

  private findNamespaceEnd(content: string, startIndex: number): number {
    return this.findFunctionEnd(content, startIndex); // Same logic
  }

  private getLineNumber(content: string, charIndex: number): number {
    return content.substring(0, charIndex).split('\n').length;
  }

  private calculateSemanticValue(boundaries: SemanticBoundary[]): number {
    if (boundaries.length === 0) return 0;
    
    const totalImportance = boundaries.reduce((sum, boundary) => {
      const importanceValues = { critical: 1.0, high: 0.8, medium: 0.5, low: 0.2 };
      return sum + importanceValues[boundary.importance];
    }, 0);
    
    return Math.min(1.0, totalImportance / boundaries.length);
  }

  private updateQualityMetrics(overlaps: OverlapRegion[], totalChunks: number): void {
    this.overlapQuality.totalOverlaps = overlaps.length;
    this.overlapQuality.averageOverlapSize = overlaps.length > 0 
      ? overlaps.reduce((sum, overlap) => sum + overlap.content.length, 0) / overlaps.length 
      : 0;
    
    const totalBoundaries = overlaps.reduce((sum, overlap) => sum + overlap.boundaries.length, 0);
    this.overlapQuality.functionsPreserved = overlaps.reduce((sum, overlap) => 
      sum + overlap.boundaries.filter(b => b.type === 'function').length, 0);
    this.overlapQuality.classesPreserved = overlaps.reduce((sum, overlap) => 
      sum + overlap.boundaries.filter(b => b.type === 'class').length, 0);
    this.overlapQuality.commentsPreserved = overlaps.reduce((sum, overlap) => 
      sum + overlap.boundaries.filter(b => b.type === 'comment').length, 0);
    
    this.overlapQuality.semanticPreservation = overlaps.length > 0
      ? overlaps.reduce((sum, overlap) => sum + overlap.semanticValue, 0) / overlaps.length
      : 0;
    
    this.overlapQuality.duplicateContentRatio = overlaps.length > 0
      ? (overlaps.reduce((sum, overlap) => sum + overlap.content.length, 0) / totalChunks) / 1000 // Rough estimate
      : 0;
  }

  /**
   * Get current overlap quality metrics
   */
  getOverlapQuality(): OverlapQuality {
    return { ...this.overlapQuality };
  }

  /**
   * Clear boundary cache
   */
  clearCache(): void {
    this.boundaryCache.clear();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.clearCache();
  }
} 