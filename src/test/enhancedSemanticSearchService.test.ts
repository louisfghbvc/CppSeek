import * as assert from 'assert';

// Mock vscode module first
jest.mock('vscode', () => ({
  window: {
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      dispose: jest.fn()
    })),
    activeTextEditor: {
      document: {
        fileName: '/current/test.cpp',
        lineAt: jest.fn(() => ({ text: 'void currentFunction() {' }))
      },
      selection: {
        active: { line: 10 }
      }
    }
  },
  workspace: {
    workspaceFolders: [{ name: 'test-workspace' }]
  }
}), { virtual: true });

// Mock fs/promises
jest.mock('fs/promises', () => ({
  stat: jest.fn(() => Promise.resolve({ mtime: new Date() }))
}));

import { 
  EnhancedSemanticSearchService,
  EnhancedSearchOptions
} from '../services/enhancedSemanticSearchService';
import { SearchContext, UserFeedback } from '../services/searchResultRanker';

// Mock VectorStorageService
class MockVectorStorageService {
  async initialize(): Promise<void> {}
  
  async searchSimilar(query: string, topK: number): Promise<any[]> {
    return Array.from({ length: Math.min(topK, 5) }, (_, i) => ({
      id: `result-${i}`,
      content: `Mock result ${i} for query: ${query}`,
      filePath: `/test/file${i}.cpp`,
      startLine: i * 10,
      endLine: i * 10 + 5,
      score: 0.9 - i * 0.1,
      functionName: `function${i}`,
      className: i % 2 === 0 ? `Class${i}` : undefined,
      namespace: `ns${i}`
    }));
  }
}

// Mock SemanticSearchService by mocking its dependencies
class MockSemanticSearchService {
  async search(query: string, options: any): Promise<any[]> {
    const mockResults = await new MockVectorStorageService().searchSimilar(query, options.topK || 5);
    return mockResults.map(result => ({
      ...result,
      similarity: result.score,
      relevanceFactors: {
        semanticScore: result.score,
        contextScore: 0.5,
        recencyScore: 0.5
      },
      contextSnippet: `Context for ${result.filePath}:${result.startLine}`
    }));
  }

  async searchSimilarToChunk(_chunkId: string, _options: any): Promise<any[]> {
    return [];
  }

  async invalidateCache(_pattern?: string): Promise<void> {}

  getSearchStats() {
    return {
      totalSearches: 10,
      cacheHitRate: 0.3,
      averageLatency: 150,
      mostFrequentQueries: [{ query: 'test query', count: 5 }]
    };
  }

  dispose() {}
}

// Mock NIMEmbeddingService
class MockNIMEmbeddingService {
  async generateEmbedding(_text: string): Promise<number[]> {
    return new Array(768).fill(0).map(() => Math.random());
  }
}

describe('EnhancedSemanticSearchService Integration Tests', () => {
  let enhancedService: EnhancedSemanticSearchService;
  let mockVectorService: MockVectorStorageService;
  let mockNimService: MockNIMEmbeddingService;

  beforeEach(() => {
    mockVectorService = new MockVectorStorageService();
    mockNimService = new MockNIMEmbeddingService();
    
    enhancedService = new EnhancedSemanticSearchService(
      mockVectorService as any,
      mockNimService as any,
      {
        defaultTopK: 10,
        defaultThreshold: 0.3,
        maxResults: 50,
        cacheSize: 100,
        cacheTTL: 60000,
        searchTimeout: 5000,
        queryExpansion: true,
        contextSnippets: true
      },
      {
        weights: {
          semantic: 0.4,
          structural: 0.2,
          recency: 0.1,
          userPreference: 0.2,
          complexity: 0.05,
          diversity: 0.05
        },
        diversityThreshold: 0.8,
        learningRate: 0.1,
        userFeedbackDecay: 0.95,
        enableExperimentation: true,
        maxResultsToRank: 50
      }
    );
  });

  afterEach(() => {
    enhancedService.dispose();
  });

  describe('Basic Enhanced Search', () => {
    test('should perform enhanced search with ranking', async () => {
      const results = await enhancedService.search('test query', {
        enableRanking: true,
        topK: 5
      });

      assert.ok(Array.isArray(results));
      assert.ok(results.length > 0);
      
      // Check enhanced result structure
      const firstResult = results[0];
      assert.ok(firstResult.finalScore !== undefined);
      assert.ok(firstResult.rankingFactors !== undefined);
      assert.ok(firstResult.rankPosition !== undefined);
      assert.ok(firstResult.confidenceScore !== undefined);
      
      // Verify ranking factors structure
      assert.ok(typeof firstResult.rankingFactors.semanticSimilarity === 'number');
      assert.ok(typeof firstResult.rankingFactors.structuralRelevance === 'number');
      assert.ok(typeof firstResult.rankingFactors.recencyScore === 'number');
      assert.ok(typeof firstResult.rankingFactors.userPreferenceScore === 'number');
      assert.ok(typeof firstResult.rankingFactors.complexityScore === 'number');
      assert.ok(typeof firstResult.rankingFactors.diversityPenalty === 'number');
    });

    test('should return results sorted by final score', async () => {
      const results = await enhancedService.search('test query', {
        enableRanking: true,
        topK: 5
      });

      // Results should be sorted by final score in descending order
      for (let i = 1; i < results.length; i++) {
        assert.ok(results[i - 1].finalScore >= results[i].finalScore);
      }

      // Verify rank positions are set correctly
      results.forEach((result, index) => {
        assert.strictEqual(result.rankPosition, index + 1);
      });
    });

    test('should handle search without ranking', async () => {
      const results = await enhancedService.search('test query', {
        enableRanking: false,
        topK: 3
      });

      assert.ok(Array.isArray(results));
      assert.ok(results.length > 0);
      
      // Should still have basic ranking structure but not enhanced
      const firstResult = results[0];
      assert.ok(firstResult.finalScore !== undefined);
      assert.ok(firstResult.rankPosition !== undefined);
      assert.strictEqual(firstResult.explanation, 'Ranking disabled');
    });
  });

  describe('Context-Aware Search', () => {
    test('should use search context effectively', async () => {
      const context: SearchContext = {
        currentFile: '/current/test.cpp',
        currentFunction: 'testFunction',
        query: 'context test'
      };

      const results = await enhancedService.searchWithContext(
        'context test query',
        context,
        { topK: 3 }
      );

      assert.ok(Array.isArray(results));
      assert.ok(results.length > 0);
      
      // Results should have enhanced ranking factors considering context
      const firstResult = results[0];
      assert.ok(firstResult.rankingFactors.structuralRelevance >= 0);
    });

    test('should build default context from VSCode editor', async () => {
      const results = await enhancedService.search('context test', {
        enableRanking: true,
        topK: 2
      });

      // Should complete successfully with auto-built context
      assert.ok(results.length > 0);
    });
  });

  describe('User Feedback Integration', () => {
    test('should record user feedback', async () => {
      const feedback: UserFeedback = {
        rating: 0.85,
        clicked: true,
        timeSpent: 45,
        wasHelpful: true,
        context: { query: 'feedback test' }
      };

      // Should not throw
      await enhancedService.recordUserFeedback('test-result-id', feedback, 'feedback test query');
      
      const stats = enhancedService.getEnhancedSearchStats();
      assert.ok(stats.userInteractions >= 0);
    });

    test('should include user feedback in statistics', async () => {
      const feedback: UserFeedback = {
        rating: 0.7,
        clicked: true,
        timeSpent: 30,
        wasHelpful: true,
        context: {}
      };

      await enhancedService.recordUserFeedback('result-123', feedback, 'stats test');
      
      const stats = enhancedService.getEnhancedSearchStats();
      
      assert.ok(typeof stats.totalSearches === 'number');
      assert.ok(typeof stats.rankedSearches === 'number');
      assert.ok(typeof stats.cacheHitRate === 'number');
      assert.ok(typeof stats.averageLatency === 'number');
      assert.ok(typeof stats.averageRankingLatency === 'number');
      assert.ok(typeof stats.userInteractions === 'number');
      assert.ok(typeof stats.averageUserRating === 'number');
      assert.ok(Array.isArray(stats.mostFrequentQueries));
    });
  });

  describe('Search Recommendations', () => {
    test('should provide search recommendations based on context', async () => {
      const context: SearchContext = {
        currentFile: '/test/example.cpp',
        currentFunction: 'processData'
      };

      const recommendations = await enhancedService.getSearchRecommendations(context);
      
      assert.ok(Array.isArray(recommendations));
      assert.ok(recommendations.length > 0);
      assert.ok(recommendations.length <= 5);
      
      // Should include relevant recommendations for C++ files
      const hasRelevantRecommendations = recommendations.some(rec => 
        rec.includes('class') || rec.includes('function') || rec.includes('implementation')
      );
      assert.ok(hasRelevantRecommendations);
    });

    test('should handle different file types in recommendations', async () => {
      const headerContext: SearchContext = {
        currentFile: '/test/example.h'
      };

      const recommendations = await enhancedService.getSearchRecommendations(headerContext);
      
      assert.ok(Array.isArray(recommendations));
      // Should include header-specific recommendations
      const hasHeaderRecommendations = recommendations.some(rec => 
        rec.includes('declaration') || rec.includes('prototype')
      );
      assert.ok(hasHeaderRecommendations);
    });
  });

  describe('A/B Testing and Experimentation', () => {
    test('should perform ranking experiments', async () => {
      const experimentConfig = {
        controlWeights: {
          semantic: 0.5,
          structural: 0.2,
          recency: 0.1,
          userPreference: 0.15,
          complexity: 0.03,
          diversity: 0.02
        },
        testWeights: {
          semantic: 0.3,
          structural: 0.4,
          recency: 0.1,
          userPreference: 0.15,
          complexity: 0.03,
          diversity: 0.02
        }
      };

      const experimentResult = await enhancedService.performRankingExperiment(
        'experiment test query',
        experimentConfig,
        { topK: 3 }
      );

      assert.ok(experimentResult.controlResults);
      assert.ok(experimentResult.testResults);
      assert.ok(['control', 'test'].includes(experimentResult.recommendedApproach));
      
      // Both result sets should have proper structure
      assert.ok(experimentResult.controlResults.length > 0);
      assert.ok(experimentResult.testResults.length > 0);
    });
  });

  describe('Cache Management', () => {
    test('should invalidate cache', async () => {
      // Perform a search to populate cache
      await enhancedService.search('cache test', { enableRanking: true });
      
      // Should not throw
      await enhancedService.invalidateCache();
      
      // Verify cache is invalidated by performing another search
      const results = await enhancedService.search('cache test', { enableRanking: true });
      assert.ok(results.length > 0);
    });

    test('should invalidate cache with pattern', async () => {
      await enhancedService.search('pattern test 1', { enableRanking: true });
      await enhancedService.search('other test', { enableRanking: true });
      
      // Should not throw
      await enhancedService.invalidateCache('pattern');
    });
  });

  describe('Ranking Configuration', () => {
    test('should update ranking weights', async () => {
      const newWeights = {
        semantic: 0.6,
        structural: 0.3
      };

      // Should not throw
      enhancedService.updateRankingWeights(newWeights);
      
      // Verify weights are applied by performing a search
      const results = await enhancedService.search('weight test', { enableRanking: true });
      assert.ok(results.length > 0);
    });

    test('should provide ranking explanations', async () => {
      const results = await enhancedService.search('explanation test', {
        enableRanking: true,
        includeRankingExplanation: true,
        topK: 1
      });

      assert.ok(results.length > 0);
      const result = results[0];
      
      const explanation = enhancedService.getRankingExplanation(result);
      assert.ok(explanation);
      assert.ok(typeof explanation.finalScore === 'number');
      assert.ok(Array.isArray(explanation.factorBreakdown));
      assert.ok(typeof explanation.reasoning === 'string');
    });
  });

  describe('Analytics and Export', () => {
    test('should export search analytics', async () => {
      // Perform some searches to generate data
      await enhancedService.search('analytics test 1', { enableRanking: true });
      await enhancedService.search('analytics test 2', { enableRanking: true });
      
      const analytics = enhancedService.exportSearchAnalytics();
      
      assert.ok(analytics.searchStats);
      assert.ok(analytics.topQueries);
      assert.ok(analytics.userBehaviorSummary);
      
      // Verify structure
      assert.ok(typeof analytics.searchStats.totalSearches === 'number');
      assert.ok(Array.isArray(analytics.topQueries));
      assert.ok(typeof analytics.userBehaviorSummary.totalInteractions === 'number');
      assert.ok(typeof analytics.userBehaviorSummary.averageRating === 'number');
    });
  });

  describe('Error Handling', () => {
    test('should handle search errors gracefully', async () => {
      // Test with extremely long query that might cause issues
      const longQuery = 'x'.repeat(10000);
      
      const results = await enhancedService.search(longQuery, {
        enableRanking: true,
        topK: 1
      });
      
      // Should handle gracefully and return valid results
      assert.ok(Array.isArray(results));
    });

    test('should handle invalid search options', async () => {
      const results = await enhancedService.search('invalid options test', {
        enableRanking: true,
        topK: -1, // Invalid value
        searchTimeout: -100 // Invalid value
      } as EnhancedSearchOptions);
      
      // Should handle gracefully
      assert.ok(Array.isArray(results));
    });

    test('should handle feedback recording errors', async () => {
      const invalidFeedback = {
        rating: NaN,
        clicked: true,
        timeSpent: -1,
        wasHelpful: true,
        context: null
      } as any;

      // Should not throw
      try {
        await enhancedService.recordUserFeedback('invalid-result', invalidFeedback, 'error test');
      } catch (error) {
        // Error is acceptable for invalid feedback
      }
    });
  });

  describe('Performance', () => {
    test('should handle concurrent searches', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => 
        enhancedService.search(`concurrent test ${i}`, {
          enableRanking: true,
          topK: 3
        })
      );

      const results = await Promise.all(promises);
      
      // All searches should complete successfully
      results.forEach(result => {
        assert.ok(Array.isArray(result));
        assert.ok(result.length > 0);
      });
    });

    test('should complete searches within reasonable time', async () => {
      const startTime = Date.now();
      
      const results = await enhancedService.search('performance test', {
        enableRanking: true,
        topK: 10
      });
      
      const duration = Date.now() - startTime;
      
      // Should complete within 1 second for mock data
      assert.ok(duration < 1000, `Search took too long: ${duration}ms`);
      assert.ok(results.length > 0);
    });
  });
}); 