import { JSVectorStorage } from '../../services/vectorStorage/jsVectorStorage';
import { VectorStorageConfig, EmbeddingData, MetadataFilter } from '../../services/vectorStorage/types';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

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

describe('JSVectorStorage', () => {
  let vectorStorage: JSVectorStorage;
  let outputChannel: vscode.OutputChannel;
  let testConfig: VectorStorageConfig;
  let tempDir: string;

  beforeAll(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'js-vector-test-'));
  });

  afterAll(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    outputChannel = {
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn()
    } as any;

    testConfig = {
      faiss: {
        indexType: 'Flat',
        dimension: 4, // Very small dimension for faster tests
        metric: 'COSINE'
      },
      persistencePath: path.join(tempDir, `test-${Date.now()}`),
      batchSize: 10,
      autoSave: false, // Disable auto-save for tests
      autoSaveInterval: 60000,
      memoryLimit: 100 * 1024 * 1024 // 100MB
    };

    vectorStorage = new JSVectorStorage(outputChannel);
  });

  afterEach(async () => {
    try {
      await vectorStorage.close();
    } catch (error) {
      // Ignore close errors in tests
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      await expect(vectorStorage.initialize(testConfig)).resolves.not.toThrow();
      
      const stats = await vectorStorage.getStats();
      expect(stats.totalVectors).toBe(0);
    });

    it('should create persistence directory if it does not exist', async () => {
      const nonExistentPath = path.join(tempDir, 'new-directory', 'vectors');
      const config = { ...testConfig, persistencePath: nonExistentPath };
      
      await vectorStorage.initialize(config);
      
      // Check if directory was created
      const stats = await fs.stat(nonExistentPath);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('Vector Operations', () => {
    beforeEach(async () => {
      await vectorStorage.initialize(testConfig);
    });

    it('should add embeddings successfully', async () => {
      const embeddings: EmbeddingData[] = [
        {
          embedding: [1, 0, 0, 0],
          metadata: {
            id: 'test-1',
            filePath: '/test/file1.cpp',
            fileName: 'file1.cpp',
            startLine: 1,
            endLine: 10,
            startChar: 0,
            endChar: 100,
            chunkIndex: 0,
            content: 'int main() { return 0; }',
            contentHash: 'hash1',
            contextInfo: {
              fileType: 'source',
              codeType: 'function',
              complexity: 1,
              importance: 'medium'
            },
            lastUpdated: new Date()
          }
        }
      ];

      const vectorIds = await vectorStorage.addEmbeddings(embeddings);
      
      expect(vectorIds).toHaveLength(1);
      expect(vectorIds[0]).toBe('test-1');

      const stats = await vectorStorage.getStats();
      expect(stats.totalVectors).toBe(1);
    });

    it('should add multiple embeddings in batch', async () => {
      const embeddings: EmbeddingData[] = Array(25).fill(null).map((_, index) => ({
        embedding: [Math.random(), Math.random(), Math.random(), Math.random()],
        metadata: {
          id: `test-${index}`,
          filePath: `/test/file${index}.cpp`,
          fileName: `file${index}.cpp`,
          startLine: index * 10,
          endLine: (index + 1) * 10,
          startChar: 0,
          endChar: 100,
          chunkIndex: index,
          content: `function${index}() {}`,
          contentHash: `hash${index}`,
          contextInfo: {
            fileType: 'source',
            codeType: 'function',
            complexity: 1,
            importance: 'medium'
          },
          lastUpdated: new Date()
        }
      }));

      const vectorIds = await vectorStorage.addEmbeddings(embeddings);
      
      expect(vectorIds).toHaveLength(25);
      
      const stats = await vectorStorage.getStats();
      expect(stats.totalVectors).toBe(25);
    });

    it('should handle empty embeddings array', async () => {
      const vectorIds = await vectorStorage.addEmbeddings([]);
      expect(vectorIds).toHaveLength(0);
    });
  });

  describe('Search Operations', () => {
    beforeEach(async () => {
      await vectorStorage.initialize(testConfig);
      
      // Add some test embeddings
      const embeddings: EmbeddingData[] = [
        {
          embedding: [1, 0, 0, 0], // Pure first dimension
          metadata: {
            id: 'test-1',
            filePath: '/test/file1.cpp',
            fileName: 'file1.cpp',
            startLine: 1,
            endLine: 10,
            startChar: 0,
            endChar: 100,
            chunkIndex: 0,
            content: 'int main() { return 0; }',
            contentHash: 'hash1',
            contextInfo: {
              functionName: 'main',
              fileType: 'source',
              codeType: 'function',
              complexity: 1,
              importance: 'high'
            },
            lastUpdated: new Date()
          }
        },
        {
          embedding: [0, 1, 0, 0], // Pure second dimension
          metadata: {
            id: 'test-2',
            filePath: '/test/file2.cpp',
            fileName: 'file2.cpp',
            startLine: 1,
            endLine: 5,
            startChar: 0,
            endChar: 50,
            chunkIndex: 0,
            content: 'void helper() {}',
            contentHash: 'hash2',
            contextInfo: {
              functionName: 'helper',
              fileType: 'source',
              codeType: 'function',
              complexity: 1,
              importance: 'medium'
            },
            lastUpdated: new Date()
          }
        }
      ];

      await vectorStorage.addEmbeddings(embeddings);
    });

    it('should search and return similar vectors', async () => {
      const queryVector = [0.9, 0.1, 0, 0]; // Close to first vector
      
      const results = await vectorStorage.searchSimilar(queryVector, 5);
      
      expect(results).toHaveLength(2);
      expect(results[0].metadata.id).toBe('test-1'); // Should be most similar
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('should calculate cosine similarity correctly', async () => {
      const queryVector = [1, 0, 0, 0]; // Identical to first vector
      
      const results = await vectorStorage.searchSimilar(queryVector, 1);
      
      expect(results).toHaveLength(1);
      expect(results[0].metadata.id).toBe('test-1');
      expect(results[0].score).toBeCloseTo(1.0, 5); // Perfect similarity
    });

    it('should apply metadata filters correctly', async () => {
      const queryVector = [0.5, 0.5, 0, 0];
      const filters: MetadataFilter[] = [
        {
          field: 'functionName',
          operator: 'eq',
          value: 'main'
        }
      ];
      
      const results = await vectorStorage.searchSimilar(queryVector, 5, filters);
      
      expect(results).toHaveLength(1);
      expect(results[0].metadata.contextInfo.functionName).toBe('main');
    });

    it('should handle search with no results when applying strict filters', async () => {
      const queryVector = [0.5, 0.5, 0, 0];
      const filters: MetadataFilter[] = [
        {
          field: 'functionName',
          operator: 'eq',
          value: 'nonexistent'
        }
      ];
      
      const results = await vectorStorage.searchSimilar(queryVector, 5, filters);
      
      expect(results).toHaveLength(0);
    });

    it('should limit results correctly', async () => {
      const queryVector = [0.5, 0.5, 0, 0];
      
      const results = await vectorStorage.searchSimilar(queryVector, 1);
      
      expect(results).toHaveLength(1);
    });
  });

  describe('Persistence', () => {
    it('should save and load index correctly', async () => {
      await vectorStorage.initialize(testConfig);
      
      // Add some embeddings
      const embeddings: EmbeddingData[] = [{
        embedding: [1, 2, 3, 4],
        metadata: {
          id: 'persist-test',
          filePath: '/test/persist.cpp',
          fileName: 'persist.cpp',
          startLine: 1,
          endLine: 10,
          startChar: 0,
          endChar: 100,
          chunkIndex: 0,
          content: 'test content',
          contentHash: 'persist-hash',
          contextInfo: {
            fileType: 'source',
            codeType: 'function',
            complexity: 1,
            importance: 'medium'
          },
          lastUpdated: new Date()
        }
      }];

      await vectorStorage.addEmbeddings(embeddings);
      
      // Save the index
      await vectorStorage.saveIndex();
      
      // Check that files were created
      const indexPath = path.join(testConfig.persistencePath, 'index.json');
      const metaPath = path.join(testConfig.persistencePath, 'index.meta.json');
      
      await expect(fs.access(indexPath)).resolves.not.toThrow();
      await expect(fs.access(metaPath)).resolves.not.toThrow();
      
      // Verify metadata content
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      const metadata = JSON.parse(metaContent);
      expect(metadata.vectorCount).toBe(1);
      expect(metadata.version).toBe('1.0-js');
    });

    it('should load persisted index on initialization', async () => {
      // First, create and save an index
      await vectorStorage.initialize(testConfig);
      const embeddings: EmbeddingData[] = [{
        embedding: [1, 2, 3, 4],
        metadata: {
          id: 'load-test',
          filePath: '/test/load.cpp',
          fileName: 'load.cpp',
          startLine: 1,
          endLine: 10,
          startChar: 0,
          endChar: 100,
          chunkIndex: 0,
          content: 'test content',
          contentHash: 'load-hash',
          contextInfo: {
            fileType: 'source',
            codeType: 'function',
            complexity: 1,
            importance: 'medium'
          },
          lastUpdated: new Date()
        }
      }];

      await vectorStorage.addEmbeddings(embeddings);
      await vectorStorage.saveIndex();
      await vectorStorage.close();

      // Create new instance and initialize with same config
      const newVectorStorage = new JSVectorStorage(outputChannel);
      await newVectorStorage.initialize(testConfig);

      const stats = await newVectorStorage.getStats();
      expect(stats.totalVectors).toBe(1);

      await newVectorStorage.close();
    });
  });

  describe('Performance', () => {
    it('should handle large batch operations efficiently', async () => {
      await vectorStorage.initialize(testConfig);
      
      const largeEmbeddings: EmbeddingData[] = Array(100).fill(null).map((_, index) => ({
        embedding: [Math.random(), Math.random(), Math.random(), Math.random()],
        metadata: {
          id: `perf-test-${index}`,
          filePath: `/test/perf${index}.cpp`,
          fileName: `perf${index}.cpp`,
          startLine: index * 10,
          endLine: (index + 1) * 10,
          startChar: 0,
          endChar: 100,
          chunkIndex: index,
          content: `function${index}() {}`,
          contentHash: `perf-hash${index}`,
          contextInfo: {
            fileType: 'source',
            codeType: 'function',
            complexity: 1,
            importance: 'medium'
          },
          lastUpdated: new Date()
        }
      }));

      const startTime = Date.now();
      await vectorStorage.addEmbeddings(largeEmbeddings);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      const stats = await vectorStorage.getStats();
      expect(stats.totalVectors).toBe(100);

      // Test search performance
      const searchStart = Date.now();
      const results = await vectorStorage.searchSimilar([0.5, 0.5, 0.5, 0.5], 10);
      const searchEnd = Date.now();

      expect(searchEnd - searchStart).toBeLessThan(1000); // Search within 1 second
      expect(results.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when not initialized', async () => {
      await expect(vectorStorage.addEmbeddings([])).rejects.toThrow('not initialized');
      await expect(vectorStorage.searchSimilar([], 5)).rejects.toThrow('not initialized');
      await expect(vectorStorage.getStats()).rejects.toThrow('not initialized');
    });

    it('should handle invalid search parameters gracefully', async () => {
      await vectorStorage.initialize(testConfig);
      
      // Wrong dimension should throw error
      await expect(vectorStorage.searchSimilar([1, 2, 3], 5)).rejects.toThrow('Vector dimensions must match');
    });
  });
}); 