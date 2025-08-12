import * as assert from 'assert';

// Mock vscode module first
jest.mock('vscode', () => ({
  window: {
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      dispose: jest.fn()
    })),
    activeTextEditor: null
  },
  workspace: {
    workspaceFolders: [{ name: 'test-workspace' }]
  }
}), { virtual: true });

// Mock fs/promises module
jest.mock('fs/promises', () => ({
  stat: jest.fn()
}));

import { 
  SearchResultRanker, 
  CodeContextAnalyzer, 
  UserBehaviorTracker,
  RankedSearchResult,
  SearchContext,
  UserFeedback,
  RankingFactors,
  defaultRankingConfig
} from '../services/searchResultRanker';
import { EnhancedSearchResult } from '../services/semanticSearchService';

// Mock results for testing
const createMockSearchResult = (overrides?: Partial<EnhancedSearchResult>): EnhancedSearchResult => ({
  id: 'test-id',
  content: 'void testFunction() { return; }',
  filePath: '/test/file.cpp',
  startLine: 10,
  endLine: 12,
  score: 0.8,
  similarity: 0.8,
  functionName: 'testFunction',
  className: undefined,
  namespace: 'test',
  relevanceFactors: {
    semanticScore: 0.8,
    contextScore: 0.5,
    recencyScore: 0.5
  },
  contextSnippet: 'Function at /test/file.cpp:10',
  ...overrides
});

describe('SearchResultRanker Tests', () => {
  let ranker: SearchResultRanker;

  beforeEach(() => {
    ranker = new SearchResultRanker(defaultRankingConfig);
  });

  afterEach(() => {
    ranker.dispose();
  });

  describe('Basic Ranking Functionality', () => {
    test('should rank results successfully', async () => {
      const results: EnhancedSearchResult[] = [
        createMockSearchResult({ id: 'result1', similarity: 0.9, filePath: '/test/high.cpp' }),
        createMockSearchResult({ id: 'result2', similarity: 0.7, filePath: '/test/medium.cpp' }),
        createMockSearchResult({ id: 'result3', similarity: 0.5, filePath: '/test/low.cpp' })
      ];

      const context: SearchContext = {
        currentFile: '/test/current.cpp',
        query: 'test query'
      };

      const rankedResults = await ranker.rankResults(results, 'test query', context);

      assert.strictEqual(rankedResults.length, 3);
      assert.ok(rankedResults[0].finalScore >= rankedResults[1].finalScore);
      assert.ok(rankedResults[1].finalScore >= rankedResults[2].finalScore);
      
      // Check ranking positions are set
      assert.strictEqual(rankedResults[0].rankPosition, 1);
      assert.strictEqual(rankedResults[1].rankPosition, 2);
      assert.strictEqual(rankedResults[2].rankPosition, 3);
    });

    test('should handle empty results', async () => {
      const rankedResults = await ranker.rankResults([], 'test query');
      assert.strictEqual(rankedResults.length, 0);
    });

    test('should include ranking factors', async () => {
      const results = [createMockSearchResult()];
      const rankedResults = await ranker.rankResults(results, 'test query');

      assert.strictEqual(rankedResults.length, 1);
      const result = rankedResults[0];
      
      assert.ok(result.rankingFactors);
      assert.ok(typeof result.rankingFactors.semanticSimilarity === 'number');
      assert.ok(typeof result.rankingFactors.structuralRelevance === 'number');
      assert.ok(typeof result.rankingFactors.recencyScore === 'number');
      assert.ok(typeof result.rankingFactors.userPreferenceScore === 'number');
      assert.ok(typeof result.rankingFactors.complexityScore === 'number');
      assert.ok(typeof result.rankingFactors.diversityPenalty === 'number');
    });

    test('should include confidence scores', async () => {
      const results = [createMockSearchResult()];
      const rankedResults = await ranker.rankResults(results, 'test query');

      assert.strictEqual(rankedResults.length, 1);
      const result = rankedResults[0];
      
      assert.ok(typeof result.confidenceScore === 'number');
      assert.ok(result.confidenceScore >= 0);
      assert.ok(result.confidenceScore <= 1);
    });
  });

  describe('Ranking Factor Calculations', () => {
    test('should calculate semantic similarity correctly', async () => {
      const highSimilarity = createMockSearchResult({ similarity: 0.95 });
      const lowSimilarity = createMockSearchResult({ similarity: 0.3 });

      const results = [highSimilarity, lowSimilarity];
      const rankedResults = await ranker.rankResults(results, 'test query');

      // High similarity should rank higher
      assert.ok(rankedResults[0].rankingFactors.semanticSimilarity > 
                rankedResults[1].rankingFactors.semanticSimilarity);
    });

    test('should calculate complexity scores', async () => {
      const complexCode = createMockSearchResult({
        content: 'class Complex { public: void method() { if (condition) { for (int i = 0; i < 10; i++) { process(); } } } };'
      });
      
      const simpleCode = createMockSearchResult({
        content: 'int x = 5;'
      });

      const results = [complexCode, simpleCode];
      const rankedResults = await ranker.rankResults(results, 'test query');

      // More complex code should have higher complexity score
      const complexResult = rankedResults.find(r => r.content.includes('class Complex'));
      const simpleResult = rankedResults.find(r => r.content.includes('int x = 5'));

      assert.ok(complexResult);
      assert.ok(simpleResult);
      assert.ok(complexResult.rankingFactors.complexityScore > 
                simpleResult.rankingFactors.complexityScore);
    });
  });

  describe('Context Awareness', () => {
    test('should boost results from current file', async () => {
      const currentFileResult = createMockSearchResult({ 
        filePath: '/current/file.cpp',
        id: 'current-file'
      });
      
      const otherFileResult = createMockSearchResult({ 
        filePath: '/other/file.cpp',
        id: 'other-file',
        similarity: 0.9 // Higher similarity but different file
      });

      const context: SearchContext = {
        currentFile: '/current/file.cpp'
      };

      const results = [otherFileResult, currentFileResult];
      const rankedResults = await ranker.rankResults(results, 'test query', context);

      // Current file result should have higher structural relevance
      const currentResult = rankedResults.find(r => r.id === 'current-file');
      const otherResult = rankedResults.find(r => r.id === 'other-file');

      assert.ok(currentResult);
      assert.ok(otherResult);
      assert.ok(currentResult.rankingFactors.structuralRelevance > 
                otherResult.rankingFactors.structuralRelevance);
    });

    test('should boost results from same function', async () => {
      const sameFunctionResult = createMockSearchResult({ 
        functionName: 'targetFunction',
        id: 'same-function'
      });
      
      const differentFunctionResult = createMockSearchResult({ 
        functionName: 'otherFunction',
        id: 'different-function'
      });

      const context: SearchContext = {
        currentFunction: 'targetFunction'
      };

      const results = [differentFunctionResult, sameFunctionResult];
      const rankedResults = await ranker.rankResults(results, 'test query', context);

      const sameResult = rankedResults.find(r => r.id === 'same-function');
      const differentResult = rankedResults.find(r => r.id === 'different-function');

      assert.ok(sameResult);
      assert.ok(differentResult);
      assert.ok(sameResult.rankingFactors.structuralRelevance > 
                differentResult.rankingFactors.structuralRelevance);
    });
  });

  describe('Diversity Filtering', () => {
    test('should apply diversity penalties to similar results', async () => {
      // Use a ranker with lower diversity threshold for testing
      const testRanker = new SearchResultRanker({
        ...defaultRankingConfig,
        diversityThreshold: 0.5 // Lower threshold to ensure penalty application
      });

      const result1 = createMockSearchResult({
        id: 'result1',
        filePath: '/test/same.cpp',
        functionName: 'sameFunction',
        similarity: 0.9
      });
      
      const result2 = createMockSearchResult({
        id: 'result2', 
        filePath: '/test/same.cpp',
        functionName: 'sameFunction',
        similarity: 0.85
      });
      
      const result3 = createMockSearchResult({
        id: 'result3',
        filePath: '/test/different.cpp',
        functionName: 'differentFunction',
        similarity: 0.8
      });

      const results = [result1, result2, result3];
      const rankedResults = await testRanker.rankResults(results, 'test query');

      // Similar results should have diversity penalties applied
      const similar1 = rankedResults.find(r => r.id === 'result1');
      const similar2 = rankedResults.find(r => r.id === 'result2');
      const different = rankedResults.find(r => r.id === 'result3');

      assert.ok(similar1);
      assert.ok(similar2);
      assert.ok(different);

      // At least one of the similar results should have a diversity penalty
      // (results with same file AND same function should exceed 0.5 threshold)
      assert.ok(similar1.rankingFactors.diversityPenalty > 0 || 
                similar2.rankingFactors.diversityPenalty > 0);

      testRanker.dispose();
    });
  });

  describe('User Feedback Integration', () => {
    test('should record user feedback', async () => {
      const feedback: UserFeedback = {
        rating: 0.8,
        clicked: true,
        timeSpent: 30,
        wasHelpful: true,
        context: { query: 'test query' }
      };

      // Should not throw
      await ranker.updateUserFeedback('test-result-id', feedback, 'test query');
      
      const stats = ranker.getUserBehaviorStats();
      assert.strictEqual(stats.totalInteractions, 1);
    });

    test('should track interaction statistics', async () => {
      const feedback1: UserFeedback = {
        rating: 0.8,
        clicked: true,
        timeSpent: 30,
        wasHelpful: true,
        context: { query: 'test query 1' }
      };

      const feedback2: UserFeedback = {
        rating: 0.6,
        clicked: false,
        timeSpent: 10,
        wasHelpful: false,
        context: { query: 'test query 2' }
      };

      await ranker.updateUserFeedback('result1', feedback1, 'test query 1');
      await ranker.updateUserFeedback('result2', feedback2, 'test query 2');

      const stats = ranker.getUserBehaviorStats();
      assert.strictEqual(stats.totalInteractions, 2);
      assert.strictEqual(stats.averageRating, 0.7);
    });
  });

  describe('Weight Configuration', () => {
    test('should use custom ranking weights', async () => {
      const customRanker = new SearchResultRanker({
        ...defaultRankingConfig,
        weights: {
          semantic: 1.0,
          structural: 0.0,
          recency: 0.0,
          userPreference: 0.0,
          complexity: 0.0,
          diversity: 0.0
        }
      });

      const results = [createMockSearchResult({ similarity: 0.9 })];
      const rankedResults = await customRanker.rankResults(results, 'test query');

      // With semantic weight = 1.0, final score should equal semantic similarity
      assert.ok(Math.abs(rankedResults[0].finalScore - 0.9) < 0.1);

      customRanker.dispose();
    });

    test('should update ranking weights', async () => {
      const initialResults = [createMockSearchResult()];
      const initialRanked = await ranker.rankResults(initialResults, 'test query');
      const initialScore = initialRanked[0].finalScore;

      // Update weights to prioritize structural relevance
      ranker.updateRankingWeights({
        semantic: 0.1,
        structural: 0.8
      });

      const updatedRanked = await ranker.rankResults(initialResults, 'test query');
      const updatedScore = updatedRanked[0].finalScore;

      // Score should change due to different weights
      assert.notStrictEqual(initialScore, updatedScore);
    });
  });

  describe('Ranking Explanations', () => {
    test('should provide ranking explanations', async () => {
      const results = [createMockSearchResult()];
      const rankedResults = await ranker.rankResults(results, 'test query');

      const explanation = ranker.getRankingExplanation(rankedResults[0]);

      assert.ok(explanation);
      assert.ok(typeof explanation.finalScore === 'number');
      assert.ok(Array.isArray(explanation.factorBreakdown));
      assert.ok(typeof explanation.reasoning === 'string');
      assert.ok(explanation.factorBreakdown.length > 0);
    });

    test('should include factor contributions in explanations', async () => {
      const results = [createMockSearchResult()];
      const rankedResults = await ranker.rankResults(results, 'test query');

      const explanation = ranker.getRankingExplanation(rankedResults[0]);

      explanation.factorBreakdown.forEach(factor => {
        assert.ok(typeof factor.factor === 'string');
        assert.ok(typeof factor.score === 'number');
        assert.ok(typeof factor.weight === 'number');
        assert.ok(typeof factor.contribution === 'number');
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle ranking errors gracefully', async () => {
      // Create a result with invalid file path to trigger recency calculation error
      const problematicResult = createMockSearchResult({
        filePath: '/nonexistent/file.cpp'
      });

      const results = [problematicResult];
      
      // Should not throw, should return results with default values
      const rankedResults = await ranker.rankResults(results, 'test query');
      
      assert.strictEqual(rankedResults.length, 1);
      assert.ok(rankedResults[0].finalScore >= 0);
    });

    test('should handle malformed feedback gracefully', async () => {
      const invalidFeedback = {
        rating: NaN,
        clicked: true,
        timeSpent: -1,
        wasHelpful: true,
        context: {}
      } as UserFeedback;

      // Should not throw
      await ranker.updateUserFeedback('test-id', invalidFeedback, 'test query');
    });
  });
});

describe('CodeContextAnalyzer Tests', () => {
  let analyzer: CodeContextAnalyzer;

  beforeEach(() => {
    analyzer = new CodeContextAnalyzer();
  });

  afterEach(() => {
    analyzer.dispose();
  });

  describe('Code Structure Analysis', () => {
    test('should identify class structures', async () => {
      const classResult = createMockSearchResult({
        content: 'class TestClass { public: void method(); };'
      });

      const score = await analyzer.analyzeStructuralRelevance(classResult, {});
      
      // Classes should get high structural relevance
      assert.ok(score > 0.5);
    });

    test('should identify function structures', async () => {
      const functionResult = createMockSearchResult({
        content: 'void myFunction(int param) { return; }',
        functionName: 'myFunction'
      });

      const score = await analyzer.analyzeStructuralRelevance(functionResult, {});
      
      // Functions should get good structural relevance
      assert.ok(score > 0.5);
    });

    test('should boost results with context alignment', async () => {
      const result = createMockSearchResult({
        filePath: '/current/file.cpp',
        functionName: 'currentFunction'
      });

      const context: SearchContext = {
        currentFile: '/current/file.cpp',
        currentFunction: 'currentFunction'
      };

      const score = await analyzer.analyzeStructuralRelevance(result, context);
      
      // Perfect context alignment should give high score
      assert.ok(score > 0.8);
    });
  });
});

describe('UserBehaviorTracker Tests', () => {
  let tracker: UserBehaviorTracker;

  beforeEach(() => {
    tracker = new UserBehaviorTracker();
  });

  afterEach(() => {
    tracker.dispose();
  });

  describe('Preference Learning', () => {
    test('should calculate user preference scores', async () => {
      const result = createMockSearchResult();
      
      const score = await tracker.getUserPreferenceScore(result);
      
      // Should return a valid score between 0 and 1
      assert.ok(score >= 0);
      assert.ok(score <= 1);
    });

    test('should track interaction history', async () => {
      const feedback: UserFeedback = {
        rating: 0.9,
        clicked: true,
        timeSpent: 45,
        wasHelpful: true,
        context: {}
      };

      await tracker.updateUserFeedback('test-result', feedback, 'test query');

      const stats = tracker.getInteractionStats();
      assert.strictEqual(stats.totalInteractions, 1);
      assert.strictEqual(stats.averageRating, 0.9);
    });

    test('should handle multiple interactions', async () => {
      const interactions = [
        { rating: 0.8, wasHelpful: true },
        { rating: 0.6, wasHelpful: false },
        { rating: 0.9, wasHelpful: true }
      ];

      for (let i = 0; i < interactions.length; i++) {
        const feedback: UserFeedback = {
          rating: interactions[i].rating,
          clicked: true,
          timeSpent: 30,
          wasHelpful: interactions[i].wasHelpful,
          context: {}
        };

        await tracker.updateUserFeedback(`result-${i}`, feedback, `query-${i}`);
      }

      const stats = tracker.getInteractionStats();
      assert.strictEqual(stats.totalInteractions, 3);
      
      // Average should be (0.8 + 0.6 + 0.9) / 3 = 0.77
      assert.ok(Math.abs(stats.averageRating - 0.7667) < 0.01);
    });
  });
});

describe('Integration Tests', () => {
  let ranker: SearchResultRanker;

  beforeEach(() => {
    ranker = new SearchResultRanker({
      ...defaultRankingConfig,
      maxResultsToRank: 100 // Allow testing with larger result sets
    });
  });

  afterEach(() => {
    ranker.dispose();
  });

  test('should handle realistic search results', async () => {
    const realisticResults: EnhancedSearchResult[] = [
      createMockSearchResult({
        id: 'header-class',
        content: 'class DatabaseManager { public: void connect(); private: string connectionString; };',
        filePath: '/src/database/DatabaseManager.h',
        functionName: undefined,
        className: 'DatabaseManager',
        namespace: 'db',
        similarity: 0.92
      }),
      createMockSearchResult({
        id: 'impl-function',
        content: 'void DatabaseManager::connect() { if (!connected) { establishConnection(); } }',
        filePath: '/src/database/DatabaseManager.cpp',
        functionName: 'connect',
        className: 'DatabaseManager',
        namespace: 'db',
        similarity: 0.88
      }),
      createMockSearchResult({
        id: 'usage-example',
        content: 'DatabaseManager dbMgr; dbMgr.connect(); // Connect to database',
        filePath: '/examples/database_example.cpp',
        functionName: 'main',
        className: undefined,
        namespace: undefined,
        similarity: 0.75
      })
    ];

    const context: SearchContext = {
      currentFile: '/src/database/DatabaseManager.cpp',
      currentFunction: 'connect',
      query: 'database connection'
    };

    const rankedResults = await ranker.rankResults(realisticResults, 'database connection', context);

    assert.strictEqual(rankedResults.length, 3);
    
    // All results should have proper ranking data
    rankedResults.forEach(result => {
      assert.ok(result.finalScore >= 0);
      assert.ok(result.finalScore <= 1);
      assert.ok(result.rankPosition > 0);
      assert.ok(result.confidenceScore >= 0);
      assert.ok(result.confidenceScore <= 1);
      assert.ok(result.rankingFactors);
    });

    // Implementation in current file should rank high due to context
    const implResult = rankedResults.find(r => r.id === 'impl-function');
    assert.ok(implResult);
    assert.ok(implResult.rankingFactors.structuralRelevance > 0.8);
  });

  test('should maintain ranking consistency', async () => {
    const results = [
      createMockSearchResult({ id: 'result1', similarity: 0.9 }),
      createMockSearchResult({ id: 'result2', similarity: 0.8 }),
      createMockSearchResult({ id: 'result3', similarity: 0.7 })
    ];

    // Run ranking multiple times with same input
    const ranking1 = await ranker.rankResults([...results], 'consistent test');
    const ranking2 = await ranker.rankResults([...results], 'consistent test');

    // Rankings should be consistent
    assert.strictEqual(ranking1.length, ranking2.length);
    
    for (let i = 0; i < ranking1.length; i++) {
      assert.strictEqual(ranking1[i].id, ranking2[i].id);
      assert.ok(Math.abs(ranking1[i].finalScore - ranking2[i].finalScore) < 0.001);
    }
  });

  test('should handle large result sets efficiently', async () => {
    // Create 50 results
    const largeResultSet = Array.from({ length: 50 }, (_, i) => 
      createMockSearchResult({
        id: `result-${i}`,
        similarity: Math.random(),
        filePath: `/test/file${i}.cpp`,
        functionName: `function${i}`
      })
    );

    const startTime = Date.now();
    const rankedResults = await ranker.rankResults(largeResultSet, 'performance test');
    const endTime = Date.now();

    // Should complete within reasonable time (< 500ms for 50 results)
    const rankingTime = endTime - startTime;
    assert.ok(rankingTime < 500, `Ranking took too long: ${rankingTime}ms`);

    // Should return all results with proper ranking
    assert.strictEqual(rankedResults.length, 50);
    rankedResults.forEach((result, index) => {
      assert.strictEqual(result.rankPosition, index + 1);
    });
  });
}); 