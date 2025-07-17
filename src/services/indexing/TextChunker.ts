import * as vscode from 'vscode';

export interface TextChunk {
    id: string;           // Unique chunk identifier
    content: string;      // Raw text content
    tokens: number;       // Actual token count
    startLine: number;    // Starting line in source file
    endLine: number;      // Ending line in source file
    startChar: number;    // Starting character position
    endChar: number;      // Ending character position
    overlapStart: number; // Overlap tokens from previous chunk
    overlapEnd: number;   // Overlap tokens to next chunk
    sourceFile: string;   // Source file path
    chunkIndex: number;   // Position in sequence
}

export interface ChunkingResult {
    chunks: TextChunk[];
    totalTokens: number;
    processingTime: number;
    sourceFile: string;
}

export interface ChunkingOptions {
    chunkSize: number;
    overlapSize: number;
    smartBoundaries: boolean;
    preserveFormatting: boolean;
}

interface SmartBoundary {
    position: number;
    type: 'function' | 'class' | 'statement' | 'comment' | 'preprocessor' | 'string';
    priority: number; // Higher is better for splitting
}

export class TextChunker {
    private outputChannel: vscode.OutputChannel;
    private tokenizer: any = null;
    private tokenizerCache = new Map<string, number[]>();
    private isInitializing = false;
    
    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }

    /**
     * Initialize the Llama-compatible tokenizer
     */
    async initializeTokenizer(): Promise<void> {
        if (this.tokenizer || this.isInitializing) {
            return;
        }

        this.isInitializing = true;
        
        try {
            this.outputChannel.appendLine('[TextChunker] Initializing Llama tokenizer...');
            
            // Use dynamic import for ES module
            const { AutoTokenizer } = await import('@xenova/transformers');
            
            // Use Llama tokenizer compatible with llama-3.2-nv-embedqa-1b-v2
            this.tokenizer = await AutoTokenizer.from_pretrained('microsoft/DialoGPT-medium', {
                // Use a fallback tokenizer that's compatible with Llama architecture
                revision: 'main',
                cache_dir: undefined
            });
            
            this.outputChannel.appendLine('[TextChunker] Tokenizer initialized successfully');
        } catch (error) {
            this.outputChannel.appendLine(`[TextChunker] Warning: Failed to load optimal tokenizer, using fallback: ${error}`);
            
            // Fallback to a simple token counting method
            this.tokenizer = {
                encode: (text: string) => {
                    // Simple tokenization fallback - roughly 4 chars per token for code
                    const tokens = Math.ceil(text.length / 4);
                    return Array.from({ length: tokens }, (_, i) => i);
                },
                decode: (tokens: number[]) => {
                    return tokens.map(t => t.toString()).join('');
                }
            };
            
            this.outputChannel.appendLine('[TextChunker] Using fallback tokenizer');
        } finally {
            this.isInitializing = false;
        }
    }

    /**
     * Tokenize text with caching for performance
     */
    private async tokenizeText(text: string): Promise<number[]> {
        // Check cache first
        const cacheKey = text.slice(0, 100); // Use first 100 chars as cache key
        if (this.tokenizerCache.has(cacheKey)) {
            const cachedTokens = this.tokenizerCache.get(cacheKey)!;
            // For full text, estimate based on cache
            if (text.length <= 100) {
                return cachedTokens;
            } else {
                // Extrapolate for longer text
                const ratio = text.length / 100;
                return Array.from({ length: Math.ceil(cachedTokens.length * ratio) }, (_, i) => i);
            }
        }

        await this.initializeTokenizer();
        
        try {
            const tokens = await this.tokenizer.encode(text);
            
            // Cache result for performance
            if (text.length <= 100) {
                this.tokenizerCache.set(cacheKey, tokens);
            }
            
            return tokens;
        } catch (error) {
            this.outputChannel.appendLine(`[TextChunker] Tokenization error: ${error}`);
            // Fallback tokenization
            const fallbackTokens = Array.from({ length: Math.ceil(text.length / 4) }, (_, i) => i);
            return fallbackTokens;
        }
    }

    /**
     * Get token count for text
     */
    async getTokenCount(text: string): Promise<number> {
        const tokens = await this.tokenizeText(text);
        return tokens.length;
    }

    /**
     * Find smart boundaries in text for better chunking
     */
    private findSmartBoundaries(lines: string[]): SmartBoundary[] {
        const boundaries: SmartBoundary[] = [];
        let position = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            // Function boundaries (high priority)
            if (trimmedLine.match(/^\s*(public|private|protected|static|inline|virtual|friend)?\s*\w+\s*\w+\s*\([^)]*\)\s*\{?\s*$/)) {
                boundaries.push({
                    position: position + line.length,
                    type: 'function',
                    priority: 10
                });
            }
            
            // Class boundaries (high priority)
            if (trimmedLine.match(/^\s*(class|struct|enum|namespace)\s+\w+/)) {
                boundaries.push({
                    position: position + line.length,
                    type: 'class',
                    priority: 9
                });
            }
            
            // Statement boundaries (medium priority)
            if (trimmedLine.endsWith(';') || trimmedLine.endsWith('}') || trimmedLine.endsWith('{')) {
                boundaries.push({
                    position: position + line.length,
                    type: 'statement',
                    priority: 7
                });
            }
            
            // Comment blocks (medium priority)
            if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.endsWith('*/')) {
                boundaries.push({
                    position: position + line.length,
                    type: 'comment',
                    priority: 6
                });
            }
            
            // Preprocessor directives (medium priority)
            if (trimmedLine.startsWith('#')) {
                boundaries.push({
                    position: position + line.length,
                    type: 'preprocessor',
                    priority: 8
                });
            }
            
            position += line.length + 1; // +1 for newline
        }

        return boundaries.sort((a, b) => a.position - b.position);
    }

    /**
     * Find best split position near target using smart boundaries
     */
    private findBestSplitPosition(
        text: string, 
        targetPosition: number, 
        boundaries: SmartBoundary[], 
        searchRadius: number = 100
    ): number {
        const minPos = Math.max(0, targetPosition - searchRadius);
        const maxPos = Math.min(text.length, targetPosition + searchRadius);
        
        // Find boundaries within search radius
        const candidateBoundaries = boundaries.filter(b => 
            b.position >= minPos && b.position <= maxPos
        );
        
        if (candidateBoundaries.length === 0) {
            return targetPosition;
        }
        
        // Choose best boundary based on priority and distance to target
        let bestBoundary = candidateBoundaries[0];
        let bestScore = 0;
        
        for (const boundary of candidateBoundaries) {
            const distance = Math.abs(boundary.position - targetPosition);
            const distanceScore = 1 - (distance / searchRadius);
            const priorityScore = boundary.priority / 10;
            const score = (distanceScore + priorityScore) / 2;
            
            if (score > bestScore) {
                bestScore = score;
                bestBoundary = boundary;
            }
        }
        
        return bestBoundary.position;
    }

    /**
     * Create text chunks from content
     */
    async chunkText(
        content: string, 
        sourceFile: string, 
        options?: Partial<ChunkingOptions>
    ): Promise<ChunkingResult> {
        const startTime = Date.now();
        
        // Get configuration
        const config = vscode.workspace.getConfiguration('cppseek');
        const chunkingOptions: ChunkingOptions = {
            chunkSize: options?.chunkSize ?? config.get('searchBehavior.chunkSize', 500),
            overlapSize: options?.overlapSize ?? config.get('searchBehavior.chunkOverlap', 50),
            smartBoundaries: options?.smartBoundaries ?? config.get('chunking.smartBoundaries', true),
            preserveFormatting: options?.preserveFormatting ?? config.get('chunking.preserveFormatting', true)
        };

        this.outputChannel.appendLine(
            `[TextChunker] Chunking ${sourceFile} with size=${chunkingOptions.chunkSize}, ` +
            `overlap=${chunkingOptions.overlapSize}, smart=${chunkingOptions.smartBoundaries}`
        );

        // Prepare text
        const lines = content.split('\n');
        const processedContent = chunkingOptions.preserveFormatting ? content : content.replace(/\s+/g, ' ');
        
        // Find smart boundaries if enabled
        const boundaries = chunkingOptions.smartBoundaries ? 
            this.findSmartBoundaries(lines) : [];

        const chunks: TextChunk[] = [];
        let totalTokens = 0;
        let currentPosition = 0;
        let chunkIndex = 0;

        while (currentPosition < processedContent.length) {
            // Calculate target chunk end position
            const remainingText = processedContent.slice(currentPosition);
            const remainingTokens = await this.getTokenCount(remainingText);
            
            if (remainingTokens <= chunkingOptions.chunkSize) {
                // Last chunk - take all remaining content
                const chunk = await this.createChunk(
                    processedContent.slice(currentPosition),
                    currentPosition,
                    processedContent.length,
                    sourceFile,
                    chunkIndex,
                    chunks.length > 0 ? chunkingOptions.overlapSize : 0,
                    0,
                    lines
                );
                
                chunks.push(chunk);
                totalTokens += chunk.tokens;
                break;
            }

            // Find optimal chunk size
            let chunkEndPosition = await this.findChunkEndPosition(
                processedContent,
                currentPosition,
                chunkingOptions.chunkSize,
                boundaries
            );

            // Create chunk content
            const chunkContent = processedContent.slice(currentPosition, chunkEndPosition);
            const overlapStart = chunkIndex > 0 ? chunkingOptions.overlapSize : 0;
            
            // Calculate overlap for next chunk
            const nextOverlapTokens = Math.min(
                chunkingOptions.overlapSize,
                await this.getTokenCount(chunkContent)
            );

            const chunk = await this.createChunk(
                chunkContent,
                currentPosition,
                chunkEndPosition,
                sourceFile,
                chunkIndex,
                overlapStart,
                nextOverlapTokens,
                lines
            );

            chunks.push(chunk);
            totalTokens += chunk.tokens;

            // Move to next chunk position with overlap
            if (chunkIndex === 0) {
                currentPosition = chunkEndPosition;
            } else {
                // Find overlap start position
                const overlapTokens = Math.min(chunkingOptions.overlapSize, chunk.tokens);
                const overlapStartPos = await this.findOverlapStartPosition(
                    chunkContent,
                    overlapTokens
                );
                currentPosition = currentPosition + overlapStartPos;
            }

            chunkIndex++;

            // Safety check to prevent infinite loops
            if (chunkIndex > 1000) {
                this.outputChannel.appendLine(`[TextChunker] Warning: Chunking stopped at 1000 chunks for ${sourceFile}`);
                break;
            }
        }

        const processingTime = Date.now() - startTime;
        
        this.outputChannel.appendLine(
            `[TextChunker] Created ${chunks.length} chunks from ${sourceFile} ` +
            `(${totalTokens} total tokens) in ${processingTime}ms`
        );

        return {
            chunks,
            totalTokens,
            processingTime,
            sourceFile
        };
    }

    /**
     * Find optimal end position for a chunk
     */
    private async findChunkEndPosition(
        content: string,
        startPosition: number,
        targetTokens: number,
        boundaries: SmartBoundary[]
    ): Promise<number> {
        // Binary search for optimal position
        let low = startPosition;
        let high = content.length;
        let bestPosition = high;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const chunkContent = content.slice(startPosition, mid);
            const tokenCount = await this.getTokenCount(chunkContent);

            if (tokenCount <= targetTokens) {
                bestPosition = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        // Use smart boundaries if enabled
        if (boundaries.length > 0) {
            const smartPosition = this.findBestSplitPosition(content, bestPosition, boundaries);
            const smartChunk = content.slice(startPosition, smartPosition);
            const smartTokens = await this.getTokenCount(smartChunk);
            
            // Accept smart position if within reasonable bounds
            if (smartTokens >= targetTokens * 0.8 && smartTokens <= targetTokens * 1.2) {
                return smartPosition;
            }
        }

        return bestPosition;
    }

    /**
     * Find overlap start position based on token count
     */
    private async findOverlapStartPosition(chunkContent: string, overlapTokens: number): Promise<number> {
        const lines = chunkContent.split('\n');
        let position = 0;
        let bestPosition = 0;

        // Try to find position that gives us the desired overlap tokens
        for (let i = 0; i < lines.length; i++) {
            const remainingContent = lines.slice(i).join('\n');
            const remainingTokenCount = await this.getTokenCount(remainingContent);
            
            if (remainingTokenCount <= overlapTokens) {
                bestPosition = position;
                break;
            }
            
            position += lines[i].length + 1; // +1 for newline
        }

        return bestPosition;
    }

    /**
     * Create a TextChunk object with metadata
     */
    private async createChunk(
        content: string,
        startChar: number,
        endChar: number,
        sourceFile: string,
        chunkIndex: number,
        overlapStart: number,
        overlapEnd: number,
        allLines: string[]
    ): Promise<TextChunk> {
        // Calculate line numbers
        let currentPos = 0;
        let startLine = 0;
        let endLine = allLines.length - 1;

        // Find start line
        for (let i = 0; i < allLines.length; i++) {
            if (currentPos >= startChar) {
                startLine = i;
                break;
            }
            currentPos += allLines[i].length + 1; // +1 for newline
        }

        // Find end line
        currentPos = 0;
        for (let i = 0; i < allLines.length; i++) {
            currentPos += allLines[i].length + 1;
            if (currentPos >= endChar) {
                endLine = i;
                break;
            }
        }

        const tokens = await this.getTokenCount(content);
        const chunkId = `${sourceFile}-chunk-${chunkIndex}-${startLine}-${endLine}`;

        return {
            id: chunkId,
            content,
            tokens,
            startLine,
            endLine,
            startChar,
            endChar,
            overlapStart,
            overlapEnd,
            sourceFile,
            chunkIndex
        };
    }

    /**
     * Clear tokenization cache
     */
    clearCache(): void {
        this.tokenizerCache.clear();
        this.outputChannel.appendLine('[TextChunker] Cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; hitRate: number } {
        return {
            size: this.tokenizerCache.size,
            hitRate: 0 // TODO: Implement hit rate tracking
        };
    }
} 