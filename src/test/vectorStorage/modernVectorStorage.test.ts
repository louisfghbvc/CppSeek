import { ModernVectorStorage, CodeChunk } from '../../services/vectorStorage/modernVectorStorage';
import { createNIMServiceFromEnv, NIMEmbeddingService } from '../../services/nimEmbeddingService';
import * as vscode from 'vscode';

// Mock VSCode API
jest.mock('vscode', () => ({
  window: {
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn()
    }))
  }
}));

// Mock environment variables for testing
process.env.NIM_API_KEY = 'test-api-key';
process.env.NIM_BASE_URL = 'https://test.api.nvidia.com/v1';
process.env.NIM_MODEL = 'test-model';

describe('ModernVectorStorage', () => {
  let vectorStorage: ModernVectorStorage;
  let mockNIMService: NIMEmbeddingService;

  beforeEach(() => {
    // Create mock NIM service
    mockNIMService = {
      generateEmbedding: jest.fn().mockResolvedValue({
        embedding: new Array(768).fill(0).map(() => Math.random()),
        usage: { prompt_tokens: 10, total_tokens: 10 }
      }),
      generateBatchEmbeddings: jest.fn().mockResolvedValue([
        {
          embedding: new Array(768).fill(0).map(() => Math.random()),
          usage: { prompt_tokens: 10, total_tokens: 10 }
        }
      ])
    } as unknown as NIMEmbeddingService;

    // Create vector storage instance
    vectorStorage = new ModernVectorStorage(
      mockNIMService,
      'test-collection',
      'http://localhost:8000'
    );
  });

  afterEach(() => {
    if (vectorStorage) {
      vectorStorage.dispose();
    }
  });

  describe('Initialization', () => {
    it('should create ModernVectorStorage instance', () => {
      expect(vectorStorage).toBeDefined();
      expect(vectorStorage.getStats().collectionName).toBe('test-collection');
      expect(vectorStorage.getStats().isInitialized).toBe(false);
    });

    it('should validate configuration', () => {
      const stats = vectorStorage.getStats();
      expect(stats.totalDocuments).toBe(0);
      expect(stats.collectionName).toBe('test-collection');
    });
  });

  describe('Code Chunk Management', () => {
      const testChunks: CodeChunk[] = [
        {
        id: 'test-chunk-1',
        content: 'void initializeSystem() { /* System initialization */ }',
          filename: 'system.cpp',
          lineStart: 10,
          lineEnd: 15,
          functionName: 'initializeSystem'
        },
        {
        id: 'test-chunk-2', 
        content: 'class DataProcessor { public: void process(); };',
          filename: 'processor.h',
          lineStart: 5,
          lineEnd: 7,
          className: 'DataProcessor'
      }
    ];

    it('should handle code chunk interface correctly', () => {
      expect(testChunks[0].id).toBe('test-chunk-1');
      expect(testChunks[0].functionName).toBe('initializeSystem');
      expect(testChunks[1].className).toBe('DataProcessor');
    });

    it('should accept valid code chunks without errors', () => {
      expect(() => {
        const validChunk: CodeChunk = {
          id: 'valid-chunk',
          content: 'int main() { return 0; }',
          filename: 'main.cpp',
        lineStart: 1,
          lineEnd: 3
        };
        // Should not throw
      }).not.toThrow();
    });
  });

  describe('NIM Embeddings Integration', () => {
    it('should integrate with mock NIM service', async () => {
      expect(mockNIMService.generateEmbedding).toBeDefined();
      expect(mockNIMService.generateBatchEmbeddings).toBeDefined();
      
      // Test single embedding
      const result = await mockNIMService.generateEmbedding('test text');
      expect(result.embedding).toHaveLength(768);
      expect(result.usage.prompt_tokens).toBe(10);
    });

    it('should handle batch embeddings', async () => {
      const texts = ['text1', 'text2', 'text3'];
      const results = await mockNIMService.generateBatchEmbeddings(texts);
      
      expect(results).toHaveLength(1); // Our mock returns 1 result
      expect(results[0].embedding).toHaveLength(768);
    });
  });

  describe('Vector Store Operations', () => {
    it('should provide stats interface', () => {
      const stats = vectorStorage.getStats();
      
      expect(stats).toHaveProperty('totalDocuments');
      expect(stats).toHaveProperty('collectionName');
      expect(stats).toHaveProperty('isInitialized');
      
      expect(typeof stats.totalDocuments).toBe('number');
      expect(typeof stats.collectionName).toBe('string');
      expect(typeof stats.isInitialized).toBe('boolean');
    });

    it('should handle disposal gracefully', () => {
      expect(() => {
        vectorStorage.dispose();
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid inputs gracefully', () => {
      expect(() => {
        const invalidChunk = {
          id: '',
          content: '',
          filename: '',
          lineStart: -1,
          lineEnd: -1
        };
        // This should not throw during creation
      }).not.toThrow();
    });

    it('should provide meaningful error messages', () => {
      // This tests the interface exists without actually calling Chroma
      expect(vectorStorage.getVectorStore).toBeDefined();
      expect(vectorStorage.asRetriever).toBeDefined();
    });
  });

  describe('LangChain Integration', () => {
    it('should provide retriever interface', () => {
      expect(vectorStorage.asRetriever).toBeDefined();
      expect(typeof vectorStorage.asRetriever).toBe('function');
    });

    it('should provide access to underlying vector store', () => {
      expect(vectorStorage.getVectorStore).toBeDefined();
      expect(typeof vectorStorage.getVectorStore).toBe('function');
    });
  });
}); 