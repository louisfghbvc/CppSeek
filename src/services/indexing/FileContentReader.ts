import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

// Define interfaces for file content and metadata
export interface PreprocessingOptions {
  normalizeWhitespace: boolean;
  removeExcessiveBlankLines: boolean;
  preserveIndentation: boolean;
  handleComments: 'preserve' | 'remove' | 'normalize';
  stripTrailingWhitespace: boolean;
  ensureNewlineAtEof: boolean;
}

export interface FileMetadata {
  language: string;
  hasUnicode: boolean;
  hasBinaryContent: boolean;
  lineEndings: 'lf' | 'crlf' | 'mixed';
  indentationStyle: 'spaces' | 'tabs' | 'mixed';
}

export interface FileContent {
  path: string;
  content: string;
  encoding: string;
  size: number;
  lineCount: number;
  preprocessed: boolean;
  metadata: FileMetadata;
}

/**
 * Service for reading and preprocessing file content with encoding detection and binary filtering
 */
export class FileContentReader {
  private static readonly MAX_FILE_SIZE_DEFAULT = 50 * 1024 * 1024; // 50MB default
  private static readonly BINARY_DETECTION_SAMPLE_SIZE = 8192; // 8KB sample
  private static readonly MAX_LINE_LENGTH_WARNING = 10000; // Warn for very long lines

  private readonly outputChannel: vscode.OutputChannel;
  private readonly cancelTokenSource: vscode.CancellationTokenSource;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
    this.cancelTokenSource = new vscode.CancellationTokenSource();
  }

  /**
   * Read and process a single file with encoding detection and preprocessing
   */
  async readFile(filePath: string, options?: Partial<PreprocessingOptions>): Promise<FileContent | null> {
    try {
      const config = vscode.workspace.getConfiguration('cppseek.fileReading');
      const maxFileSize = (config.get<number>('maxFileSize') || 50) * 1024 * 1024;
      
      // Check file stats
      const stats = await fs.promises.stat(filePath);
      if (stats.size > maxFileSize) {
        this.outputChannel.appendLine(`Skipping large file: ${filePath} (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
        return null;
      }

      // Detect if file is binary
      if (await this.isBinaryFile(filePath)) {
        this.outputChannel.appendLine(`Skipping binary file: ${filePath}`);
        return null;
      }

      // Read file content with encoding detection
      const rawContent = await fs.promises.readFile(filePath);
      const encoding = this.detectEncoding(rawContent);
      const content = this.decodeContent(rawContent, encoding);

      // Analyze file metadata
      const metadata = this.analyzeFileMetadata(filePath, content);

      // Apply preprocessing if requested
      const preprocessingOptions = this.getPreprocessingOptions(options);
      const processedContent = preprocessingOptions ? this.preprocessContent(content, preprocessingOptions) : content;

      return {
        path: filePath,
        content: processedContent,
        encoding,
        size: stats.size,
        lineCount: processedContent.split('\n').length,
        preprocessed: !!preprocessingOptions,
        metadata
      };

    } catch (error) {
      this.outputChannel.appendLine(`Error reading file ${filePath}: ${error}`);
      return null;
    }
  }

  /**
   * Read multiple files concurrently with progress reporting
   */
  async readFiles(
    filePaths: string[], 
    options?: Partial<PreprocessingOptions>,
    progressCallback?: (processed: number, total: number, currentFile: string) => void
  ): Promise<FileContent[]> {
    const results: FileContent[] = [];
    const batchSize = 10; // Process files in batches to manage memory

    for (let i = 0; i < filePaths.length; i += batchSize) {
      if (this.cancelTokenSource.token.isCancellationRequested) {
        break;
      }

      const batch = filePaths.slice(i, i + batchSize);
      const batchPromises = batch.map(async (filePath, batchIndex) => {
        const globalIndex = i + batchIndex;
        progressCallback?.(globalIndex, filePaths.length, filePath);
        return this.readFile(filePath, options);
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((result): result is FileContent => result !== null));
    }

    return results;
  }

  /**
   * Detect if a file is binary by checking for null bytes and non-printable characters
   */
  private async isBinaryFile(filePath: string): Promise<boolean> {
    try {
      const config = vscode.workspace.getConfiguration('cppseek.fileReading');
      if (!config.get<boolean>('skipBinaryFiles', true)) {
        return false; // Skip binary detection if disabled
      }

      const handle = await fs.promises.open(filePath, 'r');
      const buffer = Buffer.alloc(FileContentReader.BINARY_DETECTION_SAMPLE_SIZE);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      await handle.close();

      if (bytesRead === 0) {
        return false; // Empty files are not binary
      }

      const sample = buffer.subarray(0, bytesRead);

      // Check for null bytes (strong indicator of binary content)
      if (sample.includes(0)) {
        return true;
      }

      // Calculate ratio of non-printable characters
      let nonPrintableCount = 0;
      for (const byte of sample) {
        // Allow common whitespace characters: space, tab, newline, carriage return
        if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
          nonPrintableCount++;
        }
        // High-byte characters that might indicate binary
        if (byte > 127) {
          nonPrintableCount++;
        }
      }

      const nonPrintableRatio = nonPrintableCount / bytesRead;
      return nonPrintableRatio > 0.3; // Consider binary if >30% non-printable
    } catch (error) {
      this.outputChannel.appendLine(`Error checking binary status for ${filePath}: ${error}`);
      return false; // Assume text if we can't determine
    }
  }

  /**
   * Detect text encoding using heuristics
   */
  private detectEncoding(buffer: Buffer): string {
    // Check for BOM (Byte Order Mark)
    if (buffer.length >= 3) {
      // UTF-8 BOM
      if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        return 'utf8';
      }
    }

    if (buffer.length >= 2) {
      // UTF-16 LE BOM
      if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
        return 'utf16le';
      }
      // UTF-16 BE BOM
      if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
        return 'utf16be';
      }
    }

    // Simple heuristic: try to decode as UTF-8 first
    try {
      const decoded = buffer.toString('utf8');
      // Check if the decoded string contains replacement characters
      if (!decoded.includes('\uFFFD')) {
        return 'utf8';
      }
    } catch {
      // Fall through to other encodings
    }

    // Fallback to ASCII/Latin-1 for older files
    return 'latin1';
  }

  /**
   * Decode buffer content using the detected encoding
   */
  private decodeContent(buffer: Buffer, encoding: string): string {
    try {
      switch (encoding) {
        case 'utf8':
          // Remove UTF-8 BOM if present (EF BB BF)
          if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
            return buffer.subarray(3).toString('utf8');
          }
          return buffer.toString('utf8');
        case 'utf16le':
          // Remove BOM if present
          const utf16Buffer = buffer[0] === 0xFF && buffer[1] === 0xFE 
            ? buffer.subarray(2) 
            : buffer;
          return utf16Buffer.toString('utf16le');
        case 'utf16be':
          // Remove BOM if present
          const utf16beBuffer = buffer[0] === 0xFE && buffer[1] === 0xFF 
            ? buffer.subarray(2) 
            : buffer;
          return utf16beBuffer.toString('utf16le'); // Node.js doesn't have utf16be, swap bytes manually if needed
        case 'latin1':
          return buffer.toString('latin1');
        default:
          return buffer.toString('utf8'); // Final fallback
      }
    } catch (error) {
      this.outputChannel.appendLine(`Encoding error, falling back to UTF-8: ${error}`);
      return buffer.toString('utf8');
    }
  }

  /**
   * Analyze file metadata including language, encoding, and structure
   */
  private analyzeFileMetadata(filePath: string, content: string): FileMetadata {
    const ext = path.extname(filePath).toLowerCase();
    
    // Determine language from extension
    const language = this.detectLanguage(ext);
    
    // Check for Unicode characters
    const hasUnicode = /[^\x00-\x7F]/.test(content);
    
    // Detect line endings
    const lineEndings = this.detectLineEndings(content);
    
    // Detect indentation style
    const indentationStyle = this.detectIndentationStyle(content);
    
    return {
      language,
      hasUnicode,
      hasBinaryContent: false, // We already filtered binary files
      lineEndings,
      indentationStyle
    };
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(extension: string): string {
    const languageMap: Record<string, string> = {
      '.cpp': 'cpp',
      '.cxx': 'cpp',
      '.cc': 'cpp',
      '.c': 'c',
      '.h': 'header',
      '.hpp': 'header',
      '.hxx': 'header'
    };
    return languageMap[extension] || 'unknown';
  }

  /**
   * Detect line ending style in the content
   */
  private detectLineEndings(content: string): 'lf' | 'crlf' | 'mixed' {
    const crlfCount = (content.match(/\r\n/g) || []).length;
    const lfOnlyCount = (content.match(/(?<!\r)\n/g) || []).length;
    
    if (crlfCount > 0 && lfOnlyCount > 0) {
      return 'mixed';
    } else if (crlfCount > 0) {
      return 'crlf';
    } else {
      return 'lf';
    }
  }

  /**
   * Detect indentation style (spaces vs tabs)
   */
  private detectIndentationStyle(content: string): 'spaces' | 'tabs' | 'mixed' {
    const lines = content.split('\n');
    let spaceIndentedLines = 0;
    let tabIndentedLines = 0;
    
    for (const line of lines) {
      if (line.length === 0) continue;
      
      if (line.startsWith('    ')) { // 4+ spaces
        spaceIndentedLines++;
      } else if (line.startsWith('\t')) {
        tabIndentedLines++;
      }
    }
    
    if (spaceIndentedLines > 0 && tabIndentedLines > 0) {
      return 'mixed';
    } else if (tabIndentedLines > spaceIndentedLines) {
      return 'tabs';
    } else {
      return 'spaces';
    }
  }

  /**
   * Get preprocessing options from configuration and overrides
   */
  private getPreprocessingOptions(overrides?: Partial<PreprocessingOptions>): PreprocessingOptions | null {
    const config = vscode.workspace.getConfiguration('cppseek.fileReading');
    
    // Only apply preprocessing if explicitly enabled via overrides
    if (!overrides || Object.keys(overrides).length === 0) {
      return null;
    }
    
    return {
      normalizeWhitespace: config.get<boolean>('preprocessWhitespace', true),
      removeExcessiveBlankLines: true,
      preserveIndentation: true,
      handleComments: config.get<'preserve' | 'remove' | 'normalize'>('preserveComments', 'preserve'),
      stripTrailingWhitespace: true,
      ensureNewlineAtEof: false, // Default to false to preserve original content
      ...overrides
    };
  }

  /**
   * Apply preprocessing transformations to content
   */
  private preprocessContent(content: string, options: PreprocessingOptions): string {
    let processed = content;

    // Normalize whitespace
    if (options.normalizeWhitespace) {
      // Convert tabs to spaces (4 spaces per tab)
      processed = processed.replace(/\t/g, '    ');
      // Normalize line endings to LF
      processed = processed.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }

    // Remove excessive blank lines (more than 2 consecutive)
    if (options.removeExcessiveBlankLines) {
      processed = processed.replace(/\n{3,}/g, '\n\n');
    }

    // Strip trailing whitespace
    if (options.stripTrailingWhitespace) {
      processed = processed.replace(/[ \t]+$/gm, '');
    }

    // Handle comments based on preference
    if (options.handleComments === 'remove') {
      // Remove C++ style comments but preserve license headers
      processed = this.removeComments(processed);
    } else if (options.handleComments === 'normalize') {
      // Normalize comment formatting
      processed = this.normalizeComments(processed);
    }

    // Ensure file ends with newline
    if (options.ensureNewlineAtEof && !processed.endsWith('\n')) {
      processed += '\n';
    }

    return processed;
  }

  /**
   * Remove comments while preserving license headers and important documentation
   */
  private removeComments(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];
    let inBlockComment = false;
    let lineCount = 0;

    for (const line of lines) {
      lineCount++;
      let processedLine = line;

      // Preserve license headers (typically in first 20 lines)
      if (lineCount <= 20 && (line.includes('Copyright') || line.includes('License') || line.includes('SPDX'))) {
        result.push(line);
        continue;
      }

      // Handle block comments
      if (inBlockComment) {
        const endIndex = line.indexOf('*/');
        if (endIndex !== -1) {
          inBlockComment = false;
          processedLine = line.substring(endIndex + 2);
        } else {
          continue; // Skip entire line if in block comment
        }
      }

      // Check for start of block comment
      const startIndex = processedLine.indexOf('/*');
      if (startIndex !== -1) {
        const endIndex = processedLine.indexOf('*/', startIndex);
        if (endIndex !== -1) {
          // Single-line block comment
          processedLine = processedLine.substring(0, startIndex) + processedLine.substring(endIndex + 2);
        } else {
          // Multi-line block comment starts
          inBlockComment = true;
          processedLine = processedLine.substring(0, startIndex);
        }
      }

      // Remove line comments
      const lineCommentIndex = processedLine.indexOf('//');
      if (lineCommentIndex !== -1) {
        processedLine = processedLine.substring(0, lineCommentIndex);
      }

      // Only add non-empty lines or preserve intentional blank lines
      if (processedLine.trim() !== '' || result[result.length - 1]?.trim() === '') {
        result.push(processedLine.trimEnd());
      }
    }

    return result.join('\n');
  }

  /**
   * Normalize comment formatting for consistency
   */
  private normalizeComments(content: string): string {
    return content
      // Normalize single-line comments to have single space after //
      .replace(/\/\/\s*/g, '// ')
      // Normalize block comment start
      .replace(/\/\*\s*/g, '/* ')
      // Normalize block comment end
      .replace(/\s*\*\//g, ' */');
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.cancelTokenSource.cancel();
    this.cancelTokenSource.dispose();
  }
} 