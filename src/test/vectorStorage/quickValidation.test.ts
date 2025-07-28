import { ModernVectorStorage, CodeChunk } from '../../services/vectorStorage/modernVectorStorage';
import { NIMEmbeddingService } from '../../services/nimEmbeddingService';
import { ModernVectorStorageConfigManager } from '../../config/modernVectorStorageConfig';

// Mock VSCode API
jest.mock('vscode', () => ({
  window: {
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn()
    }))
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn((_key: string, defaultValue: any) => defaultValue)
    }))
  }
}));

describe('ModernVectorStorage Quick Validation', () => {
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
  });

  describe('Configuration System', () => {
    it('should create valid configuration', () => {
      const config = ModernVectorStorageConfigManager.createConfig('test-workspace');
      
      expect(config).toBeDefined();
      expect(config.chromaUrl).toBe('http://localhost:8000');
      expect(config.collectionName).toBe('cppseek-test-workspace');
      expect(config.defaultTopK).toBe(5);
    });

    it('should validate configuration correctly', () => {
      const config = ModernVectorStorageConfigManager.createConfig('test');
      const validation = ModernVectorStorageConfigManager.validateConfig(config);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid configuration', () => {
      const invalidConfig = {
        chromaUrl: 'invalid-url',
        collectionName: '',
        defaultTopK: -1,
        similarityFunction: 'cosine' as const,
        batchSize: 10,
        searchTimeout: 30000
      };
      
      const validation = ModernVectorStorageConfigManager.validateConfig(invalidConfig);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('NIM Adapter', () => {
    it('should create ModernVectorStorage successfully', () => {
      const storage = new ModernVectorStorage(
        mockNIMService,
        'test-collection',
        'http://localhost:8000'
      );
      
      expect(storage).toBeDefined();
      expect(storage.getStats().collectionName).toBe('test-collection');
    });

    it('should handle mock NIM service calls', async () => {
      const embedding = await mockNIMService.generateEmbedding('test');
      expect(embedding.embedding).toHaveLength(768);
      
      const batchEmbeddings = await mockNIMService.generateBatchEmbeddings(['test1', 'test2']);
      expect(batchEmbeddings).toHaveLength(1);
    });
  });

  describe('Code Chunk Interface', () => {
    it('should work with CodeChunk interface', () => {
      const testChunk: CodeChunk = {
        id: 'test-1',
        content: 'void test() { /* test function */ }',
        filename: 'test.cpp',
        lineStart: 1,
        lineEnd: 3,
        functionName: 'test'
      };
      
      expect(testChunk.id).toBe('test-1');
      expect(testChunk.functionName).toBe('test');
      expect(testChunk.filename).toBe('test.cpp');
    });

    it('should handle optional fields', () => {
      const minimalChunk: CodeChunk = {
        id: 'minimal',
        content: 'int x = 5;',
        filename: 'minimal.cpp',
        lineStart: 1,
        lineEnd: 1
      };
      
      expect(minimalChunk.functionName).toBeUndefined();
      expect(minimalChunk.className).toBeUndefined();
      expect(minimalChunk.namespace).toBeUndefined();
    });
  });

  describe('Imports and Dependencies', () => {
    it('should import all required modules', () => {
      expect(ModernVectorStorage).toBeDefined();
      expect(ModernVectorStorageConfigManager).toBeDefined();
      expect(typeof ModernVectorStorage).toBe('function');
      expect(typeof ModernVectorStorageConfigManager.createConfig).toBe('function');
    });

    it('should provide all required interfaces', () => {
      const storage = new ModernVectorStorage(mockNIMService, 'test');
      
      expect(storage.getStats).toBeDefined();
      expect(storage.dispose).toBeDefined();
      expect(storage.getVectorStore).toBeDefined();
      expect(storage.asRetriever).toBeDefined();
    });
  });

  describe('Settings Integration', () => {
    it('should provide search configuration', () => {
      const searchConfig = ModernVectorStorageConfigManager.getSearchConfig();
      
      expect(searchConfig).toHaveProperty('maxResults');
      expect(searchConfig).toHaveProperty('minScore');
      expect(searchConfig).toHaveProperty('enableFilters');
    });

    it('should provide health check configuration', () => {
      const healthConfig = ModernVectorStorageConfigManager.getHealthCheckConfig();
      
      expect(healthConfig).toHaveProperty('enabled');
      expect(healthConfig).toHaveProperty('interval');
      expect(healthConfig).toHaveProperty('timeout');
    });

    it('should provide settings contribution', () => {
      const settings = ModernVectorStorageConfigManager.getSettingsContribution();
      
      expect(settings).toBeDefined();
      expect(settings).toBeInstanceOf(Object);
      expect(Object.keys(settings)).toContain('cppseek.modernVectorStorage.chromaUrl');
      expect(Object.keys(settings)).toContain('cppseek.modernVectorStorage.defaultTopK');
      
      // Verify the structure of the settings
      expect(settings['cppseek.modernVectorStorage.chromaUrl']).toEqual({
        type: 'string',
        default: 'http://localhost:8000',
        description: 'URL of the Chroma vector database server'
      });
    });
  });
}); 