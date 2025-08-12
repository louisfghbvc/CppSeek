/**
 * Integration test for SemanticSearchService within the extension
 */

import * as assert from 'assert';

// Mock vscode module first
jest.mock('vscode', () => ({
  window: {
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      dispose: jest.fn()
    }))
  }
}), { virtual: true });

import { SemanticSearchService, defaultSearchConfig } from '../../services/semanticSearchService';

// Mock NIMEmbeddingService for testing
class MockNIMEmbeddingService {
  async generateEmbedding(text: string): Promise<number[]> {
    // Return deterministic mock embedding based on text
    return new Array(768).fill(0).map((_, i) => 
      Math.sin(text.length * i * 0.1) * 0.5 + 0.5
    );
  }
}

// Mock VectorStorageService for testing
class MockVectorStorageService {
  private isInitialized = false;
  private mockData: any[] = [
    {
      id: 'test1',
      content: 'void initialize() { setup_system(); }',
      filePath: '/test/init.cpp',
      startLine: 10,
      endLine: 12,
      score: 0.95,
      functionName: 'initialize',
      namespace: 'system'
    },
    {
      id: 'test2', 
      content: 'class Config { public: void load(); };',
      filePath: '/test/config.hpp',
      startLine: 5,
      endLine: 7,
      score: 0.87,
      className: 'Config',
      namespace: 'config'
    }
  ];

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async searchSimilar(query: string, topK: number): Promise<any[]> {
    if (!this.isInitialized) {
      throw new Error('VectorStorageService not initialized');
    }
    
    // Simple relevance scoring based on query
    const results = this.mockData.map(item => ({
      ...item,
      score: query.toLowerCase().includes('init') && item.content.includes('initialize') ? 0.95 :
             query.toLowerCase().includes('config') && item.content.includes('Config') ? 0.87 :
             0.5
    }));
    
    return results.slice(0, topK);
  }
}

describe('SemanticSearchService Integration Tests', () => {
  let searchService: SemanticSearchService;
  let mockVectorService: MockVectorStorageService;
  let mockNimService: MockNIMEmbeddingService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock services
    mockVectorService = new MockVectorStorageService();
    mockNimService = new MockNIMEmbeddingService();
    
    // Create search service
    searchService = new SemanticSearchService(
      mockVectorService as any,
      mockNimService as any,
      {
        ...defaultSearchConfig,
        cacheSize: 5,
        cacheTTL: 1000
      }
    );
  });

  afterEach(() => {
    searchService.dispose();
  });

  describe('Extension Integration', () => {
    test('should create SemanticSearchService successfully', () => {
      assert.ok(searchService);
      assert.strictEqual(typeof searchService.search, 'function');
      assert.strictEqual(typeof searchService.getSearchStats, 'function');
    });

    test('should handle search workflow end-to-end', async () => {
      // Initialize the mock vector service
      await mockVectorService.initialize();
      
      // Perform search
      const results = await searchService.search('initialization code', {
        topK: 5,
        includeContext: true,
        enableQueryExpansion: true
      });
      
      // Verify results structure
      assert.ok(Array.isArray(results));
      assert.ok(results.length > 0);
      
      const firstResult = results[0];
      assert.ok(firstResult.id);
      assert.ok(firstResult.content);
      assert.ok(firstResult.filePath);
      assert.ok(typeof firstResult.startLine === 'number');
      assert.ok(typeof firstResult.endLine === 'number');
      assert.ok(typeof firstResult.similarity === 'number');
      assert.ok(firstResult.relevanceFactors);
      assert.ok(firstResult.contextSnippet);
    });

    test('should handle caching correctly', async () => {
      await mockVectorService.initialize();
      
      const query = 'test caching';
      
      // First search (cache miss)
      const results1 = await searchService.search(query);
      
      // Second search (cache hit)
      const results2 = await searchService.search(query);
      
      // Results should be identical
      assert.deepStrictEqual(results1, results2);
      
      // Verify cache statistics
      const stats = searchService.getSearchStats();
      assert.strictEqual(stats.totalSearches, 2);
      assert.ok(stats.cacheHitRate > 0);
    });

    test('should handle search filtering', async () => {
      await mockVectorService.initialize();
      
      const results = await searchService.search('code', {
        filters: [{
          type: 'fileType',
          value: 'cpp',
          operator: 'equals'
        }]
      });
      
      // All results should be from .cpp files
      results.forEach(result => {
        assert.ok(result.filePath.endsWith('.cpp'));
      });
    });

    test('should handle search options correctly', async () => {
      await mockVectorService.initialize();
      
      const results = await searchService.search('test', {
        topK: 1,
        similarityThreshold: 0.8,
        includeContext: true,
        enableQueryExpansion: false
      });
      
      assert.ok(results.length <= 1);
      if (results.length > 0) {
        assert.ok(results[0].similarity >= 0.8);
        assert.ok(results[0].contextSnippet);
      }
    });

    test('should track search statistics', async () => {
      await mockVectorService.initialize();
      
      // Perform multiple searches
      await searchService.search('query 1');
      await searchService.search('query 2');
      await searchService.search('query 1'); // Duplicate for frequency tracking
      
      const stats = searchService.getSearchStats();
      
      assert.strictEqual(stats.totalSearches, 3);
      assert.ok(stats.averageLatency >= 0);
      assert.ok(stats.mostFrequentQueries.length > 0);
      
      // Check that 'query 1' is most frequent
      const topQuery = stats.mostFrequentQueries[0];
      assert.strictEqual(topQuery.query, 'query 1');
      assert.strictEqual(topQuery.count, 2);
    });
  });

  describe('Error Handling', () => {
    test('should handle uninitialized vector service', async () => {
      // Don't initialize the vector service
      try {
        await searchService.search('test query');
        assert.fail('Should have thrown error for uninitialized service');
      } catch (error: any) {
        assert.ok(error.message.includes('not initialized'));
      }
    });

    test('should handle search timeouts', async () => {
      await mockVectorService.initialize();
      
      // Test with very short timeout
      const results = await searchService.search('test', {
        searchTimeout: 1000 // 1 second should be enough for mock
      });
      
      // Should complete successfully within timeout
      assert.ok(Array.isArray(results));
    });

    test('should handle invalid search options gracefully', async () => {
      await mockVectorService.initialize();
      
      const results = await searchService.search('test', {
        topK: -1, // Invalid topK
        similarityThreshold: 1.5 // Invalid threshold
      });
      
      // Should handle gracefully and return results
      assert.ok(Array.isArray(results));
    });
  });

  describe('Cache Management', () => {
    test('should invalidate cache correctly', async () => {
      await mockVectorService.initialize();
      
      // Perform searches to populate cache
      await searchService.search('cache test 1');
      await searchService.search('cache test 2');
      
      // Verify cache has entries
      let stats = searchService.getSearchStats();
      const initialSearches = stats.totalSearches;
      
      // Clear cache
      await searchService.invalidateCache();
      
      // Perform same searches again
      await searchService.search('cache test 1');
      await searchService.search('cache test 2');
      
      // Should be cache misses after invalidation
      stats = searchService.getSearchStats();
      assert.strictEqual(stats.totalSearches, initialSearches + 2);
      assert.strictEqual(stats.cacheHitRate, 0);
    });

    test('should handle cache pattern invalidation', async () => {
      await mockVectorService.initialize();
      
      await searchService.search('pattern test 1');
      await searchService.search('pattern test 2');
      await searchService.search('other test');
      
      // Invalidate only pattern tests
      await searchService.invalidateCache('pattern');
      
      // Search again
      await searchService.search('pattern test 1'); // Should be cache miss
      await searchService.search('other test'); // Should be cache hit
      
      const stats = searchService.getSearchStats();
      assert.ok(stats.cacheHitRate > 0 && stats.cacheHitRate < 1);
    });
  });

  describe('Query Processing', () => {
    test('should preprocess queries correctly', async () => {
      await mockVectorService.initialize();
      
      // Test with various query formats
      const queries = [
        'Initialize System',
        'INITIALIZE SYSTEM',
        '  initialize   system  ',
        'How to initialize system?'
      ];
      
      const results = await Promise.all(
        queries.map(query => searchService.search(query))
      );
      
      // All should return similar results due to preprocessing
      assert.ok(results.every(result => result.length > 0));
    });

    test('should expand queries when enabled', async () => {
      await mockVectorService.initialize();
      
      // Search with query expansion
      const expandedResults = await searchService.search('init', {
        enableQueryExpansion: true
      });
      
      // Search without query expansion
      const normalResults = await searchService.search('init', {
        enableQueryExpansion: false
      });
      
      // Both should work, but expanded might find more relevant results
      assert.ok(Array.isArray(expandedResults));
      assert.ok(Array.isArray(normalResults));
    });
  });

  describe('Result Processing', () => {
    test('should provide enhanced search results', async () => {
      await mockVectorService.initialize();
      
      const results = await searchService.search('test search', {
        includeContext: true
      });
      
      assert.ok(results.length > 0);
      
      const result = results[0];
      
      // Verify enhanced result structure
      assert.ok(typeof result.similarity === 'number');
      assert.ok(result.contextSnippet);
      assert.ok(result.relevanceFactors);
      assert.ok(typeof result.relevanceFactors.semanticScore === 'number');
      assert.ok(typeof result.relevanceFactors.contextScore === 'number');
      assert.ok(typeof result.relevanceFactors.recencyScore === 'number');
    });

    test('should normalize similarity scores', async () => {
      await mockVectorService.initialize();
      
      const results = await searchService.search('normalize test');
      
      results.forEach(result => {
        assert.ok(result.similarity >= 0);
        assert.ok(result.similarity <= 1);
      });
    });
  });
}); 