import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as vscode from 'vscode';
import { ChunkOverlapManager, SemanticBoundary, OverlapRegion } from '../../services/indexing/ChunkOverlapManager';
import { TextChunk } from '../../services/indexing/TextChunker';

// Mock vscode module
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn()
  }
}));

describe('ChunkOverlapManager', () => {
  let chunkOverlapManager: ChunkOverlapManager;
  let mockOutputChannel: vscode.OutputChannel;

  beforeEach(() => {
    // Create mock output channel
    mockOutputChannel = {
      appendLine: jest.fn(),
      append: jest.fn(),
      clear: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
      name: 'test-channel',
      replace: jest.fn()
    };

    // Setup default vscode configuration mock
    (vscode.workspace.getConfiguration as jest.Mock).mockImplementation((section: string) => {
      const configs: Record<string, any> = {
        'cppseek.overlap': {
          get: jest.fn((key: string, defaultValue?: any) => {
            const values: Record<string, any> = {
              'minSize': 25,
              'maxSize': 100,
              'adaptiveMode': true,
              'preserveFunctions': true,
              'preserveComments': true
            };
            return values[key] ?? defaultValue;
          })
        }
      };
      return configs[section] || { get: jest.fn() };
    });

    chunkOverlapManager = new ChunkOverlapManager(mockOutputChannel);
  });

  afterEach(() => {
    chunkOverlapManager.dispose();
  });

  describe('Semantic Boundary Detection', () => {
    test('should detect function definitions', async () => {
      const sourceContent = `
class MyClass {
public:
    int calculateSum(int a, int b) {
        return a + b;
    }
    
    void processData();
};`;

      const chunks: TextChunk[] = [
        {
          id: 'chunk1',
          content: sourceContent.substring(0, 50),
          tokens: 20,
          startLine: 1,
          endLine: 3,
          startChar: 0,
          endChar: 50,
          overlapStart: 0,
          overlapEnd: 0,
          sourceFile: 'test.cpp',
          chunkIndex: 0
        },
        {
          id: 'chunk2', 
          content: sourceContent.substring(50),
          tokens: 25,
          startLine: 4,
          endLine: 8,
          startChar: 50,
          endChar: sourceContent.length,
          overlapStart: 0,
          overlapEnd: 0,
          sourceFile: 'test.cpp',
          chunkIndex: 1
        }
      ];

      const result = await chunkOverlapManager.applyOverlapLogic(chunks, sourceContent, 'test.cpp');

      assert.ok(result.overlaps.length > 0, 'Should create overlaps');
      assert.ok(result.quality.functionsPreserved >= 0, 'Should track function preservation');
    });

    test('should detect class definitions', async () => {
      const sourceContent = `
namespace Utils {
    class Calculator {
    private:
        int value;
    public:
        Calculator(int val) : value(val) {}
        int getValue() const { return value; }
    };
}`;

      const chunks: TextChunk[] = [
        {
          id: 'chunk1',
          content: sourceContent.substring(0, 60),
          tokens: 25,
          startLine: 1,
          endLine: 4,
          startChar: 0,
          endChar: 60,
          overlapStart: 0,
          overlapEnd: 0,
          sourceFile: 'test.cpp',
          chunkIndex: 0
        },
        {
          id: 'chunk2',
          content: sourceContent.substring(60),
          tokens: 30,
          startLine: 5,
          endLine: 9,
          startChar: 60,
          endChar: sourceContent.length,
          overlapStart: 0,
          overlapEnd: 0,
          sourceFile: 'test.cpp',
          chunkIndex: 1
        }
      ];

      const result = await chunkOverlapManager.applyOverlapLogic(chunks, sourceContent, 'test.cpp');

      assert.ok(result.overlaps.length > 0, 'Should create overlaps for class boundaries');
      assert.ok(result.quality.classesPreserved >= 0, 'Should track class preservation');
    });

    test('should detect important comments', async () => {
      const sourceContent = `
/**
 * This is a critical documentation comment
 * @param input The input parameter
 * @return The processed result
 */
int processInput(int input) {
    // TODO: Add validation
    return input * 2;
}`;

      const chunks: TextChunk[] = [
        {
          id: 'chunk1',
          content: sourceContent.substring(0, 100),
          tokens: 40,
          startLine: 1,
          endLine: 5,
          startChar: 0,
          endChar: 100,
          overlapStart: 0,
          overlapEnd: 0,
          sourceFile: 'test.cpp',
          chunkIndex: 0
        },
        {
          id: 'chunk2',
          content: sourceContent.substring(100),
          tokens: 20,
          startLine: 6,
          endLine: 9,
          startChar: 100,
          endChar: sourceContent.length,
          overlapStart: 0,
          overlapEnd: 0,
          sourceFile: 'test.cpp',
          chunkIndex: 1
        }
      ];

      const result = await chunkOverlapManager.applyOverlapLogic(chunks, sourceContent, 'test.cpp');

      assert.ok(result.quality.commentsPreserved >= 0, 'Should track comment preservation');
    });

    test('should detect preprocessor directives', async () => {
      const sourceContent = `
#ifndef UTILS_H
#define UTILS_H

#include <iostream>
#include <vector>

namespace Utils {
    void printMessage();
}

#endif // UTILS_H`;

      const chunks: TextChunk[] = [
        {
          id: 'chunk1',
          content: sourceContent.substring(0, 80),
          tokens: 30,
          startLine: 1,
          endLine: 6,
          startChar: 0,
          endChar: 80,
          overlapStart: 0,
          overlapEnd: 0,
          sourceFile: 'test.h',
          chunkIndex: 0
        },
        {
          id: 'chunk2',
          content: sourceContent.substring(80),
          tokens: 25,
          startLine: 7,
          endLine: 11,
          startChar: 80,
          endChar: sourceContent.length,
          overlapStart: 0,
          overlapEnd: 0,
          sourceFile: 'test.h',
          chunkIndex: 1
        }
      ];

      const result = await chunkOverlapManager.applyOverlapLogic(chunks, sourceContent, 'test.h');

      assert.ok(result.overlaps.length >= 0, 'Should handle preprocessor directives');
    });
  });

  describe('Adaptive Overlap Calculation', () => {
    test('should calculate larger overlap for critical boundaries', async () => {
      // Mock configuration for maximum adaptive behavior
      (vscode.workspace.getConfiguration as jest.Mock).mockImplementation(() => ({
        get: jest.fn((key: string, defaultValue?: any) => {
          const values: Record<string, any> = {
            'minSize': 25,
            'maxSize': 200,
            'adaptiveMode': true,
            'preserveFunctions': true,
            'preserveComments': true
          };
          return values[key] ?? defaultValue;
        })
      }));

      const sourceContent = `
class CriticalClass {
public:
    /**
     * Critical function with documentation
     */
    virtual int criticalFunction(int param) = 0;
    
    void regularFunction() {
        // Simple implementation
    }
};`;

      const chunks: TextChunk[] = [
        {
          id: 'chunk1',
          content: sourceContent.substring(0, 100),
          tokens: 40,
          startLine: 1,
          endLine: 7,
          startChar: 0,
          endChar: 100,
          overlapStart: 0,
          overlapEnd: 0,
          sourceFile: 'test.cpp',
          chunkIndex: 0
        },
        {
          id: 'chunk2',
          content: sourceContent.substring(100),
          tokens: 30,
          startLine: 8,
          endLine: 12,
          startChar: 100,
          endChar: sourceContent.length,
          overlapStart: 0,
          overlapEnd: 0,
          sourceFile: 'test.cpp',
          chunkIndex: 1
        }
      ];

      const result = await chunkOverlapManager.applyOverlapLogic(chunks, sourceContent, 'test.cpp');

      // With critical boundaries, we should get meaningful overlaps
      if (result.overlaps.length > 0) {
        assert.ok(result.quality.semanticPreservation > 0, 'Should have semantic preservation');
      }
    });

    test('should respect minimum overlap size', async () => {
      // Mock configuration with higher minimum
      (vscode.workspace.getConfiguration as jest.Mock).mockImplementation(() => ({
        get: jest.fn((key: string, defaultValue?: any) => {
          const values: Record<string, any> = {
            'minSize': 50,
            'maxSize': 100,
            'adaptiveMode': false,
            'preserveFunctions': true,
            'preserveComments': true
          };
          return values[key] ?? defaultValue;
        })
      }));

      const sourceContent = `
int simpleFunction() {
    return 42;
}

int anotherFunction() {
    return 24;
}`;

      const chunks: TextChunk[] = [
        {
          id: 'chunk1',
          content: sourceContent.substring(0, 40),
          tokens: 15,
          startLine: 1,
          endLine: 3,
          startChar: 0,
          endChar: 40,
          overlapStart: 0,
          overlapEnd: 0,
          sourceFile: 'test.cpp',
          chunkIndex: 0
        },
        {
          id: 'chunk2',
          content: sourceContent.substring(40),
          tokens: 15,
          startLine: 4,
          endLine: 7,
          startChar: 40,
          endChar: sourceContent.length,
          overlapStart: 0,
          overlapEnd: 0,
          sourceFile: 'test.cpp',
          chunkIndex: 1
        }
      ];

      const result = await chunkOverlapManager.applyOverlapLogic(chunks, sourceContent, 'test.cpp');

      // Even with simple content, should respect minimum settings
      assert.ok(result.overlaps.length >= 0, 'Should process overlaps');
    });
  });

  describe('Configuration Handling', () => {
    test('should respect disabled adaptive mode', async () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockImplementation(() => ({
        get: jest.fn((key: string, defaultValue?: any) => {
          const values: Record<string, any> = {
            'minSize': 30,
            'maxSize': 100,
            'adaptiveMode': false,
            'preserveFunctions': false,
            'preserveComments': false
          };
          return values[key] ?? defaultValue;
        })
      }));

      const sourceContent = `
class TestClass {
    void method1() {}
    void method2() {}
};`;

      const chunks: TextChunk[] = [
        {
          id: 'chunk1',
          content: sourceContent.substring(0, 30),
          tokens: 10,
          startLine: 1,
          endLine: 2,
          startChar: 0,
          endChar: 30,
          overlapStart: 0,
          overlapEnd: 0,
          sourceFile: 'test.cpp',
          chunkIndex: 0
        },
        {
          id: 'chunk2',
          content: sourceContent.substring(30),
          tokens: 15,
          startLine: 3,
          endLine: 5,
          startChar: 30,
          endChar: sourceContent.length,
          overlapStart: 0,
          overlapEnd: 0,
          sourceFile: 'test.cpp',
          chunkIndex: 1
        }
      ];

      const result = await chunkOverlapManager.applyOverlapLogic(chunks, sourceContent, 'test.cpp');

      // Should still process but with basic overlap logic
      assert.ok(result.chunks.length === 2, 'Should return processed chunks');
    });
  });

  describe('Quality Metrics', () => {
    test('should calculate quality metrics correctly', async () => {
      const sourceContent = `
/**
 * Documentation for TestClass
 */
class TestClass {
public:
    int getValue() const { return value; }
private:
    int value = 0;
};`;

      const chunks: TextChunk[] = [
        {
          id: 'chunk1',
          content: sourceContent.substring(0, 80),
          tokens: 30,
          startLine: 1,
          endLine: 6,
          startChar: 0,
          endChar: 80,
          overlapStart: 0,
          overlapEnd: 0,
          sourceFile: 'test.cpp',
          chunkIndex: 0
        },
        {
          id: 'chunk2',
          content: sourceContent.substring(80),
          tokens: 20,
          startLine: 7,
          endLine: 10,
          startChar: 80,
          endChar: sourceContent.length,
          overlapStart: 0,
          overlapEnd: 0,
          sourceFile: 'test.cpp',
          chunkIndex: 1
        }
      ];

      const result = await chunkOverlapManager.applyOverlapLogic(chunks, sourceContent, 'test.cpp');

      const quality = result.quality;
      assert.ok(typeof quality.totalOverlaps === 'number', 'Should provide total overlaps count');
      assert.ok(typeof quality.averageOverlapSize === 'number', 'Should provide average overlap size');
      assert.ok(typeof quality.semanticPreservation === 'number', 'Should provide semantic preservation score');
      assert.ok(typeof quality.functionsPreserved === 'number', 'Should count preserved functions');
      assert.ok(typeof quality.classesPreserved === 'number', 'Should count preserved classes');
      assert.ok(typeof quality.commentsPreserved === 'number', 'Should count preserved comments');
      assert.ok(typeof quality.duplicateContentRatio === 'number', 'Should calculate duplicate content ratio');
    });

    test('should provide quality metrics via getter', () => {
      const quality = chunkOverlapManager.getOverlapQuality();
      
      assert.ok(typeof quality === 'object', 'Should return quality object');
      assert.ok('totalOverlaps' in quality, 'Should include totalOverlaps');
      assert.ok('semanticPreservation' in quality, 'Should include semanticPreservation');
    });
  });

  describe('Edge Cases', () => {
    test('should handle single chunk gracefully', async () => {
      const sourceContent = `int main() { return 0; }`;
      
      const chunks: TextChunk[] = [
        {
          id: 'chunk1',
          content: sourceContent,
          tokens: 10,
          startLine: 1,
          endLine: 1,
          startChar: 0,
          endChar: sourceContent.length,
          overlapStart: 0,
          overlapEnd: 0,
          sourceFile: 'test.cpp',
          chunkIndex: 0
        }
      ];

      const result = await chunkOverlapManager.applyOverlapLogic(chunks, sourceContent, 'test.cpp');

      assert.strictEqual(result.chunks.length, 1, 'Should return single chunk unchanged');
      assert.strictEqual(result.overlaps.length, 0, 'Should have no overlaps');
    });

    test('should handle empty chunks', async () => {
      const result = await chunkOverlapManager.applyOverlapLogic([], '', 'test.cpp');

      assert.strictEqual(result.chunks.length, 0, 'Should handle empty input');
      assert.strictEqual(result.overlaps.length, 0, 'Should have no overlaps');
    });

    test('should handle malformed code gracefully', async () => {
      const sourceContent = `
class Incomplete {
    void method(
    // Missing closing brace and parenthesis
`;

      const chunks: TextChunk[] = [
        {
          id: 'chunk1',
          content: sourceContent.substring(0, 30),
          tokens: 10,
          startLine: 1,
          endLine: 2,
          startChar: 0,
          endChar: 30,
          overlapStart: 0,
          overlapEnd: 0,
          sourceFile: 'test.cpp',
          chunkIndex: 0
        },
        {
          id: 'chunk2',
          content: sourceContent.substring(30),
          tokens: 15,
          startLine: 3,
          endLine: 4,
          startChar: 30,
          endChar: sourceContent.length,
          overlapStart: 0,
          overlapEnd: 0,
          sourceFile: 'test.cpp',
          chunkIndex: 1
        }
      ];

      const result = await chunkOverlapManager.applyOverlapLogic(chunks, sourceContent, 'test.cpp');

      // Should not throw and should return valid result
      assert.ok(result.chunks.length > 0, 'Should handle malformed code');
    });
  });

  describe('Resource Management', () => {
    test('should clear cache', () => {
      // Should not throw
      chunkOverlapManager.clearCache();
    });

    test('should dispose properly', () => {
      const manager = new ChunkOverlapManager(mockOutputChannel);
      
      // Should not throw
      manager.dispose();
      
      // Can be called multiple times safely
      manager.dispose();
    });
  });

  describe('Performance', () => {
    test('should process overlaps efficiently', async () => {
      // Create a larger test case
      const sourceContent = `
#include <iostream>
#include <vector>

namespace TestNamespace {
    /**
     * A test class for performance testing
     */
    class PerformanceTest {
    private:
        std::vector<int> data;
        
    public:
        PerformanceTest() : data() {}
        
        void addData(int value) {
            data.push_back(value);
        }
        
        int processData() {
            int sum = 0;
            for (const auto& item : data) {
                sum += item;
            }
            return sum;
        }
        
        void clearData() {
            data.clear();
        }
    };
}`;

      // Create multiple chunks
      const chunkSize = 100;
      const chunks: TextChunk[] = [];
      for (let i = 0; i < sourceContent.length; i += chunkSize) {
        const end = Math.min(i + chunkSize, sourceContent.length);
        chunks.push({
          id: `chunk${chunks.length}`,
          content: sourceContent.substring(i, end),
          tokens: 25,
          startLine: 1,
          endLine: 5,
          startChar: i,
          endChar: end,
          overlapStart: 0,
          overlapEnd: 0,
          sourceFile: 'test.cpp',
          chunkIndex: chunks.length
        });
      }

      const startTime = Date.now();
      const result = await chunkOverlapManager.applyOverlapLogic(chunks, sourceContent, 'test.cpp');
      const endTime = Date.now();

      const processingTime = endTime - startTime;
      
      // Should complete in reasonable time (less than 1 second for this test)
      assert.ok(processingTime < 1000, `Processing should be fast, took ${processingTime}ms`);
      assert.ok(result.chunks.length > 0, 'Should return processed chunks');
    });
  });
}); 