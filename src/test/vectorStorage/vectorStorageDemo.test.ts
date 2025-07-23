import { VectorStorageConfig, EmbeddingData, MetadataFilter } from '../../services/vectorStorage/types';
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

// Mock fs/promises to avoid file system operations
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('{"vectors":[],"vectorCount":0}'),
  access: jest.fn().mockRejectedValue(new Error('File not found'))
}));

// Store for our mock metadata
let mockMetadataStore: any = {};

// Mock the metadata store completely
jest.mock('../../services/vectorStorage/metadataStore', () => ({
  MetadataStore: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    addChunkMetadata: jest.fn().mockImplementation((metadataList: any[]) => {
      metadataList.forEach(metadata => {
        mockMetadataStore[metadata.vectorId] = metadata;
      });
      return Promise.resolve(undefined);
    }),
    getMetadataByVectorIds: jest.fn().mockImplementation((vectorIds: number[]) => {
      return Promise.resolve(vectorIds.map(id => mockMetadataStore[id]).filter(Boolean));
    }),
    removeFileMetadata: jest.fn().mockResolvedValue(undefined),
    getStats: jest.fn().mockResolvedValue({ totalChunks: Object.keys(mockMetadataStore).length, totalFiles: 1 }),
    close: jest.fn().mockResolvedValue(undefined)
  }))
}));

// Now import the vector storage after mocking
import { JSVectorStorage } from '../../services/vectorStorage/jsVectorStorage';

describe('Vector Storage Demo (Mocked Dependencies)', () => {
  let vectorStorage: JSVectorStorage;
  let outputChannel: vscode.OutputChannel;
  let testConfig: VectorStorageConfig;

  beforeEach(() => {
    // Clear mock metadata store
    mockMetadataStore = {};
    
    outputChannel = {
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn()
    } as any;

    testConfig = {
      faiss: {
        indexType: 'Flat',
        dimension: 4, // Small dimension for faster tests
        metric: 'COSINE'
      },
      persistencePath: '/mock/path',
      batchSize: 10,
      autoSave: false,
      autoSaveInterval: 60000,
      memoryLimit: 100 * 1024 * 1024
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

  describe('Core Functionality Demo', () => {
    it('should demonstrate complete vector storage workflow', async () => {
      // Initialize the storage
      await vectorStorage.initialize(testConfig);
      
      // Create sample embeddings with realistic data
      const embeddings: EmbeddingData[] = [
        {
          embedding: [1.0, 0.0, 0.0, 0.0], // Pure first dimension - main function
          metadata: {
            id: 'main-function',
            filePath: '/project/src/main.cpp',
            fileName: 'main.cpp',
            startLine: 1,
            endLine: 5,
            startChar: 0,
            endChar: 50,
            chunkIndex: 0,
            content: 'int main() {\n    return 0;\n}',
            contentHash: 'main-hash',
            contextInfo: {
              functionName: 'main',
              fileType: 'source',
              codeType: 'function',
              complexity: 1,
              importance: 'critical'
            },
            lastUpdated: new Date()
          }
        },
        {
          embedding: [0.0, 1.0, 0.0, 0.0], // Pure second dimension - helper function
          metadata: {
            id: 'helper-function',
            filePath: '/project/src/utils.cpp',
            fileName: 'utils.cpp',
            startLine: 10,
            endLine: 15,
            startChar: 0,
            endChar: 80,
            chunkIndex: 0,
            content: 'void initializeSystem() {\n    // Setup code\n}',
            contentHash: 'helper-hash',
            contextInfo: {
              functionName: 'initializeSystem',
              fileType: 'source',
              codeType: 'function',
              complexity: 2,
              importance: 'high'
            },
            lastUpdated: new Date()
          }
        },
        {
          embedding: [0.7, 0.7, 0.0, 0.0], // Mix - initialization code
          metadata: {
            id: 'init-code',
            filePath: '/project/src/init.cpp',
            fileName: 'init.cpp',
            startLine: 20,
            endLine: 30,
            startChar: 0,
            endChar: 200,
            chunkIndex: 0,
            content: 'bool setupConfiguration() {\n    loadConfig();\n    return true;\n}',
            contentHash: 'init-hash',
            contextInfo: {
              functionName: 'setupConfiguration',
              fileType: 'source',
              codeType: 'function',
              complexity: 3,
              importance: 'high'
            },
            lastUpdated: new Date()
          }
        }
      ];

      // Add embeddings to storage
      const vectorIds = await vectorStorage.addEmbeddings(embeddings);
      
      // Verify all embeddings were added
      expect(vectorIds).toHaveLength(3);
      expect(vectorIds).toContain('main-function');
      expect(vectorIds).toContain('helper-function');
      expect(vectorIds).toContain('init-code');

      // Check storage statistics
      const stats = await vectorStorage.getStats();
      expect(stats.totalVectors).toBe(3);

      // Test semantic search - looking for "main" functionality
      const mainQuery = [0.9, 0.1, 0.0, 0.0]; // Close to main function embedding
      const mainResults = await vectorStorage.searchSimilar(mainQuery, 2);
      
      expect(mainResults).toHaveLength(2);
      expect(mainResults[0].metadata.id).toBe('main-function'); // Most similar
      expect(mainResults[0].score).toBeGreaterThan(0.8); // High similarity

      // Test semantic search - looking for "initialization" functionality  
      const initQuery = [0.5, 0.5, 0.0, 0.0]; // Should match init-code best
      const initResults = await vectorStorage.searchSimilar(initQuery, 3);
      
      expect(initResults).toHaveLength(3);
      // init-code should be most similar due to balanced embedding
      expect(initResults[0].metadata.id).toBe('init-code');

      // Test metadata filtering - find only critical importance functions
      const criticalQuery = [0.5, 0.5, 0.0, 0.0];
      const criticalFilters: MetadataFilter[] = [{
        field: 'importance',
        operator: 'eq',
        value: 'critical'
      }];
      
      const criticalResults = await vectorStorage.searchSimilar(criticalQuery, 5, criticalFilters);
      expect(criticalResults).toHaveLength(1);
      expect(criticalResults[0].metadata.contextInfo.importance).toBe('critical');

      // Test function name filtering - find initialization functions
      const funcFilters: MetadataFilter[] = [{
        field: 'functionName',
        operator: 'like',
        value: 'init'
      }];
      
      const funcResults = await vectorStorage.searchSimilar([0.5, 0.5, 0.0, 0.0], 5, funcFilters);
      expect(funcResults.length).toBeGreaterThan(0);
      expect(funcResults[0].metadata.contextInfo.functionName).toContain('init');

      console.log('✅ Vector Storage Demo Complete:');
      console.log(`   📊 Added ${vectorIds.length} embeddings`);
      console.log(`   🔍 Search operations successful`);
      console.log(`   📋 Metadata filtering working`);
      console.log(`   ⚡ Performance: ${stats.averageSearchTime}ms average`);
    });

    it('should demonstrate cosine similarity calculations', async () => {
      await vectorStorage.initialize(testConfig);

      const testVectors: EmbeddingData[] = [
        {
          embedding: [1, 0, 0, 0], // Unit vector along first axis
          metadata: {
            id: 'vector-1',
            filePath: '/test/1.cpp',
            fileName: '1.cpp',
            startLine: 1,
            endLine: 1,
            startChar: 0,
            endChar: 10,
            chunkIndex: 0,
            content: 'test1',
            contentHash: 'hash1',
            contextInfo: {
              fileType: 'source',
              codeType: 'function',
              complexity: 1,
              importance: 'medium'
            },
            lastUpdated: new Date()
          }
        },
        {
          embedding: [0, 1, 0, 0], // Unit vector along second axis
          metadata: {
            id: 'vector-2',
            filePath: '/test/2.cpp',
            fileName: '2.cpp',
            startLine: 1,
            endLine: 1,
            startChar: 0,
            endChar: 10,
            chunkIndex: 0,
            content: 'test2',
            contentHash: 'hash2',
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

      await vectorStorage.addEmbeddings(testVectors);

      // Test perfect similarity (identical vector)
      const perfectQuery = [1, 0, 0, 0];
      const perfectResults = await vectorStorage.searchSimilar(perfectQuery, 1);
      expect(perfectResults[0].score).toBeCloseTo(1.0, 5);
      expect(perfectResults[0].metadata.id).toBe('vector-1');

      // Test orthogonal vectors (should have low similarity)
      const orthogonalQuery = [0, 1, 0, 0];
      const orthogonalToFirst = await vectorStorage.searchSimilar(orthogonalQuery, 2);
      expect(orthogonalToFirst[0].metadata.id).toBe('vector-2'); // Should match second vector
      expect(orthogonalToFirst[1].score).toBeCloseTo(0, 5); // Orthogonal to first vector

      console.log('✅ Cosine Similarity Demo Complete:');
      console.log(`   🎯 Perfect similarity: ${perfectResults[0].score}`);
      console.log(`   ⊥ Orthogonal similarity: ${orthogonalToFirst[1].score}`);
    });

    it('should demonstrate index persistence workflow', async () => {
      await vectorStorage.initialize(testConfig);

      // Add some data
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
          content: 'persistent test content',
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
      
      // Test the save operation (should work with mocked fs)
      await expect(vectorStorage.saveIndex()).resolves.not.toThrow();
      
      // Verify the storage recognizes the data
      const stats = await vectorStorage.getStats();
      expect(stats.totalVectors).toBe(1);

      console.log('✅ Index Persistence Demo Complete:');
      console.log(`   💾 Save operation successful`);
      console.log(`   📈 Vector count: ${stats.totalVectors}`);
    });
  });
}); 