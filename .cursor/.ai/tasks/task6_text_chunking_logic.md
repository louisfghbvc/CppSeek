---
id: 6
title: 'Create fixed-size text chunking logic (500 tokens with overlap)'
status: pending
priority: critical
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

Implement text chunking algorithm that splits file content into fixed-size chunks of 500 tokens using @xenova/transformers for Llama-compatible tokenization, with configurable overlap between chunks for context continuity.

## Details

### Core Functionality Requirements
- **Llama-Compatible Tokenization**: Use @xenova/transformers tokenizer for accurate token counting
- **Fixed-Size Chunking**: Split text into exactly 500-token chunks (configurable)
- **Overlap Logic**: Implement 50-token overlap between adjacent chunks (configurable)
- **Boundary Preservation**: Avoid splitting in the middle of important constructs where possible
- **Metadata Generation**: Track chunk position, overlap regions, and source location
- **Performance Optimization**: Efficient processing for large files (10k+ lines)

### Implementation Steps
1. **Create TextChunker class** in `src/services/indexing/TextChunker.ts`
2. **Initialize Llama tokenizer** using @xenova/transformers configuration
3. **Implement token-aware splitting** with configurable chunk size and overlap
4. **Add smart boundary detection** to avoid splitting mid-function or mid-statement
5. **Generate chunk metadata** including source mapping and position tracking
6. **Add caching for tokenization** to improve performance on repeated processing
7. **Implement validation** to ensure chunk sizes are within expected ranges

### Tokenization Strategy
- **Model**: Use tokenizer compatible with llama-3.2-nv-embedqa-1b-v2
- **Token Limits**: 500 tokens per chunk (configurable 100-2000 range)
- **Overlap**: 50 tokens overlap (configurable 10-200 range)
- **Encoding**: Handle UTF-8 text with proper character boundaries
- **Special Tokens**: Preserve code-specific tokens and formatting

### Configuration Settings
- `cppseek.chunking.chunkSize`: Number of tokens per chunk (default: 500)
- `cppseek.chunking.overlapSize`: Number of tokens to overlap (default: 50)
- `cppseek.chunking.smartBoundaries`: Enable smart boundary detection (default: true)
- `cppseek.chunking.preserveFormatting`: Maintain whitespace and indentation (default: true)

### Data Structures
```typescript
interface TextChunk {
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

interface ChunkingResult {
  chunks: TextChunk[];
  totalTokens: number;
  processingTime: number;
  sourceFile: string;
}
```

### Smart Boundary Detection
- **Function Boundaries**: Avoid splitting within function definitions
- **Comment Blocks**: Keep comment blocks intact when possible
- **Statement Boundaries**: Prefer breaking at statement ends (semicolons, braces)
- **String Literals**: Never split string or character literals
- **Preprocessor Directives**: Keep #include/#define statements intact

### Performance Considerations
- **Tokenization Caching**: Cache tokenizer results for repeated content
- **Incremental Processing**: Process files in chunks to manage memory
- **Streaming Support**: Handle large files without loading entirely into memory
- **Error Recovery**: Continue processing if individual chunks fail

## Test Strategy

### Unit Tests
1. **Tokenization Accuracy**: Verify token counts match @xenova/transformers output
2. **Chunk Size Validation**: Ensure all chunks are within specified size limits
3. **Overlap Logic**: Verify correct overlap implementation and metadata
4. **Boundary Detection**: Test smart boundary detection with various code patterns
5. **Unicode Handling**: Test with files containing Unicode characters and symbols

### Integration Tests
1. **Real Code Files**: Test chunking with actual C/C++ source files from various projects
2. **Large File Handling**: Test performance with files >10k lines
3. **Configuration Integration**: Test with different chunk size and overlap settings
4. **Error Handling**: Test with malformed or binary files

### Performance Tests
1. **Speed Benchmarks**: Measure chunking speed for various file sizes
2. **Memory Usage**: Monitor memory consumption during large file processing
3. **Tokenizer Performance**: Benchmark tokenization speed vs alternatives
4. **Cache Effectiveness**: Measure cache hit rates and performance improvements

### Manual Testing
1. **Open large C++ file** and trigger chunking via command palette
2. **Verify chunk boundaries** don't split critical code constructs inappropriately
3. **Check overlap consistency** between adjacent chunks
4. **Monitor performance** with real-world codebases

### Success Criteria
- Processes files at minimum 1000 lines/second on typical hardware
- Maintains <5% variance in actual vs target chunk sizes
- Preserves semantic boundaries in >90% of cases with smart boundary detection
- Handles files up to 50k lines without memory issues
- Produces consistent, reproducible chunking results for identical input 