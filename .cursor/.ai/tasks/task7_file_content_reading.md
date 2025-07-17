---
id: 7
title: 'Implement file content reading and text processing'
status: pending
priority: high
feature: Code Processing Pipeline
dependencies:
  - 5
assigned_agent: null
created_at: "2025-07-17T05:15:22Z"
started_at: null
completed_at: null
error_log: null
---

## Description

Implement robust file reading system with encoding detection, preprocessing steps (comment handling, whitespace normalization), and error handling for corrupted or binary files.

## Details

### Core Functionality Requirements
- **Encoding Detection**: Automatically detect and handle various text encodings (UTF-8, UTF-16, ASCII)
- **Binary File Detection**: Identify and skip binary files that shouldn't be processed
- **Content Preprocessing**: Normalize whitespace, handle different line endings, filter content
- **Error Recovery**: Graceful handling of corrupted files, permission errors, and encoding issues
- **Memory Management**: Efficient reading of large files without excessive memory usage
- **Content Validation**: Verify file content is suitable for embedding generation

### Implementation Steps
1. **Create FileContentReader class** in `src/services/indexing/FileContentReader.ts`
2. **Implement encoding detection** using chardet or built-in detection methods
3. **Add binary file detection** to filter out non-text files
4. **Implement preprocessing pipeline** with configurable filters and transformations
5. **Add robust error handling** with detailed error reporting and recovery
6. **Implement streaming reader** for large files to manage memory usage
7. **Add content validation** to ensure quality suitable for embedding

### Encoding and Binary Detection
- **Encoding Detection**: Use chardet library for automatic encoding detection
- **Binary File Detection**: Check for null bytes and non-printable character ratios
- **Encoding Fallback**: UTF-8 fallback with error handling for unsupported encodings
- **BOM Handling**: Properly handle Byte Order Marks in Unicode files
- **Mixed Encoding**: Handle files with mixed encoding issues

### Preprocessing Pipeline
```typescript
interface PreprocessingOptions {
  normalizeWhitespace: boolean;     // Convert tabs to spaces, normalize line endings
  removeExcessiveBlankLines: boolean; // Limit consecutive blank lines
  preserveIndentation: boolean;     // Maintain code indentation structure
  handleComments: 'preserve' | 'remove' | 'normalize'; // Comment processing
  stripTrailingWhitespace: boolean; // Remove trailing whitespace
  ensureNewlineAtEof: boolean;     // Ensure file ends with newline
}

interface FileContent {
  path: string;
  content: string;
  encoding: string;
  size: number;
  lineCount: number;
  preprocessed: boolean;
  metadata: FileMetadata;
}

interface FileMetadata {
  language: string;        // Detected language (cpp, c, header)
  hasUnicode: boolean;     // Contains non-ASCII characters
  hasBinaryContent: boolean; // Contains binary data
  lineEndings: 'lf' | 'crlf' | 'mixed'; // Line ending style
  indentationStyle: 'spaces' | 'tabs' | 'mixed'; // Indentation detection
}
```

### Error Handling Strategy
- **Permission Errors**: Log and skip files with access restrictions
- **Encoding Errors**: Attempt multiple encodings, fall back to UTF-8 with replacement
- **File System Errors**: Handle missing files, network issues, and corrupted data
- **Memory Errors**: Stream large files and provide meaningful error messages
- **Binary Content**: Detect and skip binary files with clear logging

### Configuration Settings
- `cppseek.fileReading.maxFileSize`: Maximum file size to process in MB (default: 50)
- `cppseek.fileReading.encoding`: Preferred encoding (default: "auto")
- `cppseek.fileReading.preprocessWhitespace`: Enable whitespace normalization (default: true)
- `cppseek.fileReading.preserveComments`: How to handle comments (default: "preserve")
- `cppseek.fileReading.skipBinaryFiles`: Skip files detected as binary (default: true)

### Memory Management
- **Streaming Reader**: Use Node.js streams for files >1MB
- **Chunk Processing**: Process large files in manageable chunks
- **Memory Monitoring**: Track memory usage and implement backpressure
- **Garbage Collection**: Explicit cleanup for large file processing
- **Progress Reporting**: Show progress for long-running file operations

### Integration Points
- **FileDiscoveryService**: Receive file list from discovery service
- **TextChunker**: Provide preprocessed content to chunking service
- **Configuration Service**: Read preprocessing preferences
- **Status Bar**: Report file reading progress
- **Error Reporting**: Log detailed error information for debugging

## Test Strategy

### Unit Tests
1. **Encoding Detection**: Test with files in various encodings (UTF-8, UTF-16, ISO-8859-1)
2. **Binary Detection**: Verify binary file detection with various file types
3. **Preprocessing**: Test whitespace normalization, comment handling, and formatting
4. **Error Handling**: Test with corrupted files, permission issues, and encoding errors
5. **Memory Management**: Test streaming behavior with large files

### Integration Tests
1. **End-to-End Reading**: Test complete file reading pipeline with real C/C++ projects
2. **Large File Handling**: Test with files >10MB to verify streaming behavior
3. **Mixed Content**: Test with projects containing binary and text files
4. **Configuration Integration**: Test with various preprocessing configuration options

### Performance Tests
1. **Reading Speed**: Benchmark file reading speed across different file sizes
2. **Memory Usage**: Monitor memory consumption during large file processing
3. **Preprocessing Performance**: Measure overhead of various preprocessing options
4. **Concurrent Reading**: Test performance with multiple files being read simultaneously

### Edge Case Testing
1. **Corrupted Files**: Test with files containing invalid UTF-8 sequences
2. **Empty Files**: Handle zero-byte files appropriately
3. **Very Long Lines**: Test with files containing extremely long lines
4. **Unicode Edge Cases**: Test with various Unicode normalization issues
5. **Symlinks**: Handle symbolic links and circular references

### Manual Testing
1. **Open diverse codebase** with mixed file types and encodings
2. **Verify content accuracy** by comparing processed content with original files
3. **Test preprocessing options** with different configuration settings
4. **Monitor performance** with large codebases and complex file structures

### Success Criteria
- Successfully reads and processes 99%+ of valid C/C++ source files
- Accurately detects and skips binary files without false positives
- Handles encoding issues gracefully with <1% data loss
- Processes files at minimum 5MB/second on typical hardware
- Maintains memory usage under 200MB even for very large files
- Provides clear error messages for all failure cases 