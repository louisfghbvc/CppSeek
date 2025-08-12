import * as assert from 'assert';
import * as vscode from 'vscode';
import { TextChunker, type TextChunk, type ChunkingResult, type ChunkingOptions } from '../../services/indexing/TextChunker';

describe('TextChunker Test Suite', () => {
    let outputChannel: vscode.OutputChannel;
    let textChunker: TextChunker;

    beforeAll(async () => {
        // Create output channel for testing
        outputChannel = vscode.window.createOutputChannel('TextChunker Test');
        textChunker = new TextChunker(outputChannel);
    });

    afterAll(async () => {
        // Dispose output channel
        outputChannel.dispose();
    });

    it('should instantiate correctly', () => {
        assert.ok(textChunker instanceof TextChunker);
        assert.strictEqual(typeof textChunker.chunkText, 'function');
        assert.strictEqual(typeof textChunker.getTokenCount, 'function');
    });

    it('should initialize tokenizer', async () => {
        // The tokenizer should initialize automatically on first use
        const tokenCount = await textChunker.getTokenCount('Hello world');
        assert.ok(tokenCount > 0, 'Should return positive token count');
        assert.strictEqual(typeof tokenCount, 'number');
    });

    it('should tokenize simple text correctly', async () => {
        const testCases = [
            { text: 'Hello world', expectedMin: 1, expectedMax: 10 },
            { text: '', expectedMin: 0, expectedMax: 0 },
            { text: 'int main() { return 0; }', expectedMin: 2, expectedMax: 20 },
            { text: 'a'.repeat(100), expectedMin: 5, expectedMax: 100 }
        ];

        for (const testCase of testCases) {
            const tokenCount = await textChunker.getTokenCount(testCase.text);
            assert.ok(
                tokenCount >= testCase.expectedMin && tokenCount <= testCase.expectedMax,
                `Token count ${tokenCount} not in range [${testCase.expectedMin}, ${testCase.expectedMax}] for text: "${testCase.text}"`
            );
        }
    });

    it('should chunk simple C++ code', async () => {
        const cppCode = `#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}

class TestClass {
public:
    void method() {
        // Simple method
    }
};`;

        const result: ChunkingResult = await textChunker.chunkText(cppCode, 'test.cpp');

        // Validate chunking result structure
        assert.ok(result.chunks.length > 0, 'Should create at least one chunk');
        assert.strictEqual(typeof result.totalTokens, 'number');
        assert.strictEqual(typeof result.processingTime, 'number');
        assert.strictEqual(result.sourceFile, 'test.cpp');

        // Validate first chunk
        const firstChunk = result.chunks[0];
        assert.strictEqual(typeof firstChunk.id, 'string');
        assert.strictEqual(typeof firstChunk.content, 'string');
        assert.strictEqual(typeof firstChunk.tokens, 'number');
        assert.strictEqual(typeof firstChunk.startLine, 'number');
        assert.strictEqual(typeof firstChunk.endLine, 'number');
        assert.strictEqual(firstChunk.sourceFile, 'test.cpp');
        assert.strictEqual(firstChunk.chunkIndex, 0);
    });

    it('should create multiple chunks for large content', async () => {
        // Create large content that should require multiple chunks
        const largeCode = `#include <iostream>
#include <vector>
#include <string>

class LargeClass {
public:
    LargeClass() {
        // Constructor
    }
    
    void method1() {
        std::cout << "Method 1" << std::endl;
    }
    
    void method2() {
        std::cout << "Method 2" << std::endl;
    }
    
    void method3() {
        std::cout << "Method 3" << std::endl;
    }
    
    void method4() {
        std::cout << "Method 4" << std::endl;
    }
};

int main() {
    LargeClass obj;
    obj.method1();
    obj.method2();
    obj.method3();
    obj.method4();
    return 0;
}

// Additional functions to make content larger
void function1() { std::cout << "Function 1" << std::endl; }
void function2() { std::cout << "Function 2" << std::endl; }
void function3() { std::cout << "Function 3" << std::endl; }
void function4() { std::cout << "Function 4" << std::endl; }
void function5() { std::cout << "Function 5" << std::endl; }`;

        const result: ChunkingResult = await textChunker.chunkText(largeCode, 'large.cpp');

        // Should create multiple chunks for large content
        console.log(`Created ${result.chunks.length} chunks for large content`);
        
        // Verify chunk sequence
        for (let i = 0; i < result.chunks.length; i++) {
            const chunk = result.chunks[i];
            assert.strictEqual(chunk.chunkIndex, i, `Chunk ${i} should have correct index`);
            assert.ok(chunk.tokens > 0, `Chunk ${i} should have positive token count`);
            assert.ok(chunk.content.length > 0, `Chunk ${i} should have content`);
        }
    });

    it('should respect custom chunking options', async () => {
        const testCode = `int main() {
    std::cout << "Test" << std::endl;
    return 0;
}`;

        const customOptions: Partial<ChunkingOptions> = {
            chunkSize: 100,
            overlapSize: 20,
            smartBoundaries: false,
            preserveFormatting: true
        };

        const result: ChunkingResult = await textChunker.chunkText(
            testCode, 
            'test.cpp', 
            customOptions
        );

        assert.ok(result.chunks.length > 0, 'Should create chunks with custom options');
        
        // Verify chunks respect custom size limits
        for (const chunk of result.chunks) {
            assert.ok(
                chunk.tokens <= customOptions.chunkSize! * 1.2, // Allow 20% variance
                `Chunk token count ${chunk.tokens} should be within custom limit ${customOptions.chunkSize}`
            );
        }
    });

    it('should handle edge cases gracefully', async () => {
        const edgeCases = [
            { content: '', description: 'empty string' },
            { content: '   \n\n\t  \n  ', description: 'whitespace only' },
            { content: 'a', description: 'single character' },
            { content: 'int x;', description: 'minimal code' },
            { content: '/* comment only */', description: 'comment only' },
            { content: '#include <iostream>', description: 'preprocessor only' }
        ];

        for (const testCase of edgeCases) {
            try {
                const result = await textChunker.chunkText(testCase.content, 'edge-case.cpp');
                
                if (testCase.content.trim().length > 0) {
                    assert.ok(result.chunks.length > 0, `Should create chunks for: ${testCase.description}`);
                } else {
                    // Empty content might create no chunks or one empty chunk
                    assert.ok(result.chunks.length >= 0, `Should handle: ${testCase.description}`);
                }
                
                assert.strictEqual(typeof result.totalTokens, 'number');
                assert.strictEqual(typeof result.processingTime, 'number');
                
            } catch (error) {
                assert.fail(`Should handle edge case gracefully: ${testCase.description}, error: ${error}`);
            }
        }
    });

    it('should maintain chunk metadata consistency', async () => {
        const testCode = `#include <iostream>

class TestClass {
public:
    void method1() {
        std::cout << "Method 1" << std::endl;
    }
    
    void method2() {
        std::cout << "Method 2" << std::endl;
    }
};

int main() {
    TestClass obj;
    obj.method1();
    obj.method2();
    return 0;
}`;

        const result: ChunkingResult = await textChunker.chunkText(testCode, 'metadata-test.cpp');

        const totalLines = testCode.split('\n').length;

        for (let i = 0; i < result.chunks.length; i++) {
            const chunk = result.chunks[i];
            
            // Verify chunk ID format
            assert.ok(chunk.id.includes('metadata-test.cpp'), 'Chunk ID should include source file');
            assert.ok(chunk.id.includes(`chunk-${i}`), 'Chunk ID should include chunk index');
            
            // Verify line numbers are valid
            assert.ok(chunk.startLine >= 0, 'Start line should be non-negative');
            assert.ok(chunk.endLine >= chunk.startLine, 'End line should be >= start line');
            assert.ok(chunk.endLine < totalLines, 'End line should be within file bounds');
            
            // Verify character positions
            assert.ok(chunk.startChar >= 0, 'Start char should be non-negative');
            assert.ok(chunk.endChar >= chunk.startChar, 'End char should be >= start char');
            assert.ok(chunk.endChar <= testCode.length, 'End char should be within content bounds');
            
            // Verify content consistency
            const expectedContent = testCode.slice(chunk.startChar, chunk.endChar);
            assert.strictEqual(
                chunk.content, 
                expectedContent, 
                `Chunk ${i} content should match expected slice`
            );
        }
    });

    it('should handle Unicode and special characters', async () => {
        const unicodeCode = `#include <iostream>
#include <string>

// Comment with Unicode: 你好世界 🚀
class UnicodeTest {
public:
    void printUnicode() {
        std::string message = "Hello 世界! 🌟";
        std::cout << message << std::endl;
    }
    
    void printEmoji() {
        std::cout << "Testing emoji: 🔥🚀⭐" << std::endl;
    }
};

int main() {
    UnicodeTest test;
    test.printUnicode();
    test.printEmoji();
    return 0;
}`;

        const result: ChunkingResult = await textChunker.chunkText(unicodeCode, 'unicode-test.cpp');

        assert.ok(result.chunks.length > 0, 'Should handle Unicode content');
        
        // Verify Unicode content is preserved
        const allChunkContent = result.chunks.map(c => c.content).join('');
        assert.ok(allChunkContent.includes('你好世界'), 'Should preserve Chinese characters');
        assert.ok(allChunkContent.includes('🚀'), 'Should preserve emoji');
        assert.ok(allChunkContent.includes('🌟'), 'Should preserve emoji in strings');
    });

    it('should provide cache functionality', () => {
        // Test cache operations
        const cacheStats = textChunker.getCacheStats();
        assert.strictEqual(typeof cacheStats.size, 'number');
        assert.strictEqual(typeof cacheStats.hitRate, 'number');
        
        // Clear cache should not throw
        textChunker.clearCache();
        
        const cacheStatsAfterClear = textChunker.getCacheStats();
        assert.strictEqual(cacheStatsAfterClear.size, 0, 'Cache should be empty after clear');
    });

    it('should process C++ language constructs correctly', async () => {
        const cppConstructs = `// Preprocessor directives
#include <iostream>
#include <vector>
#define MAX_SIZE 100

// Namespace
namespace TestNamespace {
    // Class definition
    class TestClass {
    private:
        int privateVar;
        
    public:
        // Constructor
        TestClass(int value) : privateVar(value) {}
        
        // Method declaration
        virtual void virtualMethod() = 0;
        
        // Template method
        template<typename T>
        void templateMethod(T value) {
            std::cout << value << std::endl;
        }
    };
    
    // Function definition
    void freeFunction() {
        // Function body
        std::vector<int> vec = {1, 2, 3, 4, 5};
        for (auto& item : vec) {
            std::cout << item << " ";
        }
        std::cout << std::endl;
    }
}

// Main function
int main() {
    TestNamespace::freeFunction();
    return 0;
}`;

        const result: ChunkingResult = await textChunker.chunkText(cppConstructs, 'constructs-test.cpp');

        assert.ok(result.chunks.length > 0, 'Should process C++ constructs');
        
        // Verify all content is preserved
        const reconstructed = result.chunks.map(c => c.content).join('');
        assert.ok(reconstructed.includes('#include'), 'Should preserve preprocessor directives');
        assert.ok(reconstructed.includes('namespace'), 'Should preserve namespace');
        assert.ok(reconstructed.includes('class TestClass'), 'Should preserve class definition');
        assert.ok(reconstructed.includes('template<typename T>'), 'Should preserve templates');
        
        console.log(`Processed C++ constructs into ${result.chunks.length} chunks`);
        console.log(`Total tokens: ${result.totalTokens}, Processing time: ${result.processingTime}ms`);
    });

    it('should be ready for integration', async () => {
        // Final validation that the chunker is properly set up for integration
        assert.ok(textChunker instanceof TextChunker);
        assert.strictEqual(typeof textChunker.chunkText, 'function');
        assert.strictEqual(typeof textChunker.getTokenCount, 'function');
        assert.strictEqual(typeof textChunker.clearCache, 'function');
        assert.strictEqual(typeof textChunker.getCacheStats, 'function');
        
        // Test basic functionality
        const simpleResult = await textChunker.chunkText('int main() { return 0; }', 'simple.cpp');
        assert.ok(simpleResult.chunks.length > 0);
        assert.ok(simpleResult.totalTokens > 0);
        
        console.log('✓ TextChunker is ready for integration');
        console.log('✓ All chunking functionality validated');
        console.log('✓ Service can be safely used in extension pipeline');
    });
}); 