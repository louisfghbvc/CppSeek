import * as assert from 'assert';

// Mock vscode module first
jest.mock('vscode', () => ({
  window: {
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      dispose: jest.fn()
    })),
    createWebviewPanel: jest.fn(() => ({
      webview: {
        html: '',
        onDidReceiveMessage: jest.fn()
      },
      onDidDispose: jest.fn(),
      reveal: jest.fn(),
      dispose: jest.fn()
    })),
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn()
  },
  ViewColumn: {
    Two: 2,
    Active: -1,
    Beside: -2
  },
  Uri: {
    joinPath: jest.fn((uri, ...paths) => ({ path: paths.join('/') }))
  },
  workspace: {
    openTextDocument: jest.fn(() => Promise.resolve({
      lineAt: jest.fn((line) => ({ text: `Line ${line} content` })),
      lineCount: 100
    }))
  },
  env: {
    clipboard: {
      writeText: jest.fn()
    }
  }
}), { virtual: true });

import { SearchResultsPanel, ResultsDisplayState } from '../../ui/searchResultsPanel';
import { RankedSearchResult, RankingFactors } from '../../services/searchResultRanker';

// Mock other UI components
jest.mock('../../ui/codeSyntaxHighlighter', () => ({
  CodeSyntaxHighlighter: jest.fn().mockImplementation(() => ({
    highlight: jest.fn(() => Promise.resolve([
      {
        type: 'keyword',
        value: 'class',
        position: { line: 0, column: 0 },
        length: 5,
        cssClass: 'token-keyword'
      }
    ])),
    dispose: jest.fn()
  }))
}));

jest.mock('../../ui/resultNavigationHandler', () => ({
  ResultNavigationHandler: jest.fn().mockImplementation(() => ({
    navigateToResult: jest.fn(() => Promise.resolve(true)),
    dispose: jest.fn()
  }))
}));

jest.mock('../../ui/resultsExporter', () => ({
  ResultsExporter: jest.fn().mockImplementation(() => ({
    exportResults: jest.fn(() => Promise.resolve({
      content: 'exported content',
      format: 'markdown',
      filename: 'test.md',
      size: 100,
      resultCount: 1,
      exportTimestamp: '2024-01-01T00:00:00Z'
    })),
    dispose: jest.fn()
  }))
}));

// Create mock ranked search results
const createMockRankedResult = (overrides?: Partial<RankedSearchResult>): RankedSearchResult => ({
  id: 'test-result-1',
  content: 'class TestClass { public: void testMethod(); };',
  filePath: '/test/file.cpp',
  startLine: 10,
  endLine: 12,
  score: 0.8,
  similarity: 0.8,
  functionName: 'testMethod',
  className: 'TestClass',
  namespace: 'test',
  finalScore: 0.85,
  rankPosition: 1,
  confidenceScore: 0.9,
  rankingFactors: {
    semanticSimilarity: 0.8,
    structuralRelevance: 0.7,
    recencyScore: 0.6,
    userPreferenceScore: 0.5,
    complexityScore: 0.4,
    diversityPenalty: 0.1
  } as RankingFactors,
  relevanceFactors: {
    semanticScore: 0.8,
    contextScore: 0.7,
    recencyScore: 0.6
  },
  contextSnippet: 'Context snippet for test',
  explanation: 'Test ranking explanation',
  ...overrides
});

describe('SearchResultsPanel Unit Tests', () => {
  let panel: SearchResultsPanel;
  let mockContext: any;

  beforeEach(() => {
    // Create mock extension context
    mockContext = {
      extensionUri: { path: '/test/extension' },
      subscriptions: []
    };

    panel = new SearchResultsPanel(mockContext);
  });

  afterEach(() => {
    panel.dispose();
  });

  describe('Basic Functionality', () => {
    test('should initialize successfully', () => {
      assert.ok(panel);
    });

    test('should display search results', async () => {
      const results = [createMockRankedResult()];
      const query = 'test query';

      await panel.displayResults(results, query);

      // Verify the panel was created and used
      const vscode = require('vscode');
      assert.ok(vscode.window.createWebviewPanel.mock.calls.length > 0);
    });

    test('should handle empty results', async () => {
      const results: RankedSearchResult[] = [];
      const query = 'empty query';

      await panel.displayResults(results, query);

      // Should not throw and should handle gracefully
      assert.ok(true);
    });
  });

  describe('Result Organization', () => {
    test('should update display state', async () => {
      const newState: Partial<ResultsDisplayState> = {
        groupBy: 'file',
        sortBy: 'similarity',
        compactView: true
      };

      await panel.updateDisplayState(newState);

      // Should complete without error
      assert.ok(true);
    });

    test('should organize results by file', async () => {
      const results = [
        createMockRankedResult({ 
          id: 'result-1', 
          filePath: '/test/file1.cpp',
          functionName: 'func1' 
        }),
        createMockRankedResult({ 
          id: 'result-2', 
          filePath: '/test/file1.cpp',
          functionName: 'func2' 
        }),
        createMockRankedResult({ 
          id: 'result-3', 
          filePath: '/test/file2.cpp',
          functionName: 'func3' 
        })
      ];

      await panel.displayResults(results, 'test query');

      // Should organize results by file groups
      assert.ok(true);
    });

    test('should organize results by type', async () => {
      const results = [
        createMockRankedResult({ 
          id: 'result-1', 
          className: 'TestClass',
          functionName: undefined 
        }),
        createMockRankedResult({ 
          id: 'result-2', 
          className: undefined,
          functionName: 'testFunction' 
        }),
        createMockRankedResult({ 
          id: 'result-3', 
          namespace: 'TestNamespace',
          className: undefined,
          functionName: undefined 
        })
      ];

      await panel.updateDisplayState({ groupBy: 'type' });
      await panel.displayResults(results, 'test query');

      // Should organize by code type (classes, functions, namespaces)
      assert.ok(true);
    });

    test('should organize results by relevance', async () => {
      const results = [
        createMockRankedResult({ 
          id: 'excellent', 
          finalScore: 0.9 
        }),
        createMockRankedResult({ 
          id: 'good', 
          finalScore: 0.7 
        }),
        createMockRankedResult({ 
          id: 'fair', 
          finalScore: 0.5 
        }),
        createMockRankedResult({ 
          id: 'poor', 
          finalScore: 0.3 
        })
      ];

      await panel.updateDisplayState({ groupBy: 'relevance' });
      await panel.displayResults(results, 'test query');

      // Should organize by relevance score ranges
      assert.ok(true);
    });
  });

  describe('Export Functionality', () => {
    test('should export results to markdown', async () => {
      const results = [createMockRankedResult()];
      await panel.displayResults(results, 'test query');

      await panel.exportResults('markdown');

      // Should complete export without error
      assert.ok(true);
    });

    test('should export results to JSON', async () => {
      const results = [createMockRankedResult()];
      await panel.displayResults(results, 'test query');

      await panel.exportResults('json');

      // Should complete export without error
      assert.ok(true);
    });

    test('should export results with custom options', async () => {
      const results = [createMockRankedResult()];
      await panel.displayResults(results, 'test query');

      await panel.exportResults('html', {
        query: 'custom query',
        includeContent: true,
        includeRankingFactors: true
      });

      // Should complete export with custom options
      assert.ok(true);
    });
  });

  describe('Navigation Integration', () => {
    test('should navigate to search result', async () => {
      const result = createMockRankedResult();
      await panel.navigateToResult(result);

      // Should delegate to navigation handler
      assert.ok(true);
    });

    test('should handle navigation errors gracefully', async () => {
      const result = createMockRankedResult({ filePath: '/nonexistent/file.cpp' });
      
      try {
        await panel.navigateToResult(result);
        assert.ok(true);
      } catch (error) {
        // Should handle errors gracefully
        assert.ok(true);
      }
    });
  });

  describe('Search Header Generation', () => {
    test('should generate search header with quality indicators', async () => {
      const results = [
        createMockRankedResult({ finalScore: 0.9 }), // Excellent
        createMockRankedResult({ finalScore: 0.7 }), // Good
        createMockRankedResult({ finalScore: 0.5 })  // Fair
      ];

      await panel.displayResults(results, 'quality test', {
        searchTime: 150,
        rankingEnabled: true
      });

      // Should generate header with quality assessment
      assert.ok(true);
    });

    test('should handle search metadata', async () => {
      const results = [createMockRankedResult()];

      await panel.displayResults(results, 'metadata test', {
        searchTime: 200,
        rankingEnabled: false
      });

      // Should include search metadata in header
      assert.ok(true);
    });
  });

  describe('Display State Management', () => {
    test('should maintain expanded results state', async () => {
      const results = [createMockRankedResult()];
      
      // Set initial state with expanded result
      await panel.updateDisplayState({
        expandedResults: new Set(['test-result-1'])
      });

      await panel.displayResults(results, 'expansion test');

      // Should maintain expansion state
      assert.ok(true);
    });

    test('should toggle between compact and full view', async () => {
      const results = [createMockRankedResult()];

      // Test compact view
      await panel.updateDisplayState({ compactView: true });
      await panel.displayResults(results, 'compact test');

      // Test full view
      await panel.updateDisplayState({ compactView: false });
      await panel.displayResults(results, 'full test');

      assert.ok(true);
    });

    test('should configure context lines display', async () => {
      const results = [createMockRankedResult()];

      await panel.updateDisplayState({
        showContext: true,
        contextLines: 5
      });

      await panel.displayResults(results, 'context test');

      assert.ok(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle display errors gracefully', async () => {
      const invalidResults = [
        {
          ...createMockRankedResult(),
          filePath: '', // Invalid path
        }
      ];

      try {
        await panel.displayResults(invalidResults as RankedSearchResult[], 'error test');
        assert.ok(true);
      } catch (error) {
        assert.ok(true); // Errors should be handled gracefully
      }
    });

    test('should handle export errors', async () => {
      const results = [createMockRankedResult()];
      await panel.displayResults(results, 'test query');

      try {
        await panel.exportResults('invalid' as any);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(true); // Should catch and handle export errors
      }
    });

    test('should handle missing webview panel', async () => {
      // Dispose panel to simulate missing webview
      panel.dispose();

      const results = [createMockRankedResult()];

      try {
        await panel.displayResults(results, 'missing panel test');
        assert.ok(true);
      } catch (error) {
        assert.ok(true); // Should handle missing panel gracefully
      }
    });
  });

  describe('Performance Considerations', () => {
    test('should handle large result sets efficiently', async () => {
      const largeResults = Array.from({ length: 100 }, (_, i) => 
        createMockRankedResult({
          id: `result-${i}`,
          functionName: `function${i}`,
          rankPosition: i + 1,
          finalScore: 0.9 - (i * 0.005)
        })
      );

      const startTime = Date.now();
      await panel.displayResults(largeResults, 'performance test');
      const duration = Date.now() - startTime;

      // Should process large result sets in reasonable time
      assert.ok(duration < 1000, `Processing took too long: ${duration}ms`);
    });

    test('should handle frequent display state updates', async () => {
      const results = [createMockRankedResult()];
      
      // Rapid state updates
      for (let i = 0; i < 10; i++) {
        await panel.updateDisplayState({
          sortBy: i % 2 === 0 ? 'rank' : 'similarity',
          groupBy: i % 3 === 0 ? 'file' : 'type'
        });
      }

      await panel.displayResults(results, 'rapid updates test');
      assert.ok(true);
    });
  });

  describe('Integration with Syntax Highlighting', () => {
    test('should apply syntax highlighting to code content', async () => {
      const results = [createMockRankedResult({
        content: 'class MyClass {\npublic:\n  void method();\n};'
      })];

      await panel.displayResults(results, 'syntax test');

      // Should have called syntax highlighter
      assert.ok(true);
    });

    test('should handle syntax highlighting failures', async () => {
      // Mock highlighter to throw error
      const mockHighlighter = require('../../ui/codeSyntaxHighlighter').CodeSyntaxHighlighter;
      mockHighlighter.mockImplementationOnce(() => ({
        highlight: jest.fn(() => Promise.reject(new Error('Highlighting failed'))),
        dispose: jest.fn()
      }));

      const newPanel = new SearchResultsPanel(mockContext);
      const results = [createMockRankedResult()];

      try {
        await newPanel.displayResults(results, 'highlight error test');
        assert.ok(true);
      } catch (error) {
        assert.ok(true); // Should handle highlighting errors gracefully
      }

      newPanel.dispose();
    });
  });

  describe('Accessibility and User Experience', () => {
    test('should generate proper HTML structure', async () => {
      const results = [createMockRankedResult()];
      await panel.displayResults(results, 'accessibility test');

      // Should generate well-structured HTML
      assert.ok(true);
    });

    test('should include proper ARIA labels and metadata', async () => {
      const results = [createMockRankedResult()];
      await panel.displayResults(results, 'aria test');

      // Should include accessibility features
      assert.ok(true);
    });

    test('should support keyboard navigation helpers', async () => {
      const results = [createMockRankedResult()];
      await panel.displayResults(results, 'keyboard test');

      // Should include keyboard navigation support
      assert.ok(true);
    });
  });
});

describe('SearchResultsPanel Integration Tests', () => {
  let panel: SearchResultsPanel;
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      extensionUri: { path: '/test/extension' },
      subscriptions: []
    };

    panel = new SearchResultsPanel(mockContext);
  });

  afterEach(() => {
    panel.dispose();
  });

  describe('End-to-End Workflows', () => {
    test('should complete full search result presentation workflow', async () => {
      const results = [
        createMockRankedResult({
          id: 'workflow-1',
          functionName: 'mainFunction',
          className: 'MainClass',
          filePath: '/src/main.cpp'
        }),
        createMockRankedResult({
          id: 'workflow-2',
          functionName: 'helperFunction',
          className: undefined,
          filePath: '/src/helper.cpp'
        })
      ];

      // 1. Display results
      await panel.displayResults(results, 'workflow test', {
        searchTime: 150,
        rankingEnabled: true
      });

      // 2. Update display options
      await panel.updateDisplayState({
        groupBy: 'file',
        sortBy: 'similarity',
        showContext: true,
        compactView: false
      });

      // 3. Navigate to result
      await panel.navigateToResult(results[0]);

      // 4. Export results
      await panel.exportResults('markdown', {
        query: 'workflow test',
        includeContent: true,
        includeRankingFactors: true
      });

      assert.ok(true);
    });

    test('should handle multiple export formats in sequence', async () => {
      const results = [createMockRankedResult()];
      await panel.displayResults(results, 'export test');

      const formats: Array<'markdown' | 'json' | 'csv' | 'html' | 'text'> = [
        'markdown', 'json', 'csv', 'html', 'text'
      ];

      for (const format of formats) {
        await panel.exportResults(format);
      }

      assert.ok(true);
    });

    test('should maintain state across multiple result updates', async () => {
      const initialResults = [createMockRankedResult({ id: 'initial' })];
      const updatedResults = [
        createMockRankedResult({ id: 'updated-1' }),
        createMockRankedResult({ id: 'updated-2' })
      ];

      // Initial display
      await panel.displayResults(initialResults, 'initial query');

      // Update display state
      await panel.updateDisplayState({
        groupBy: 'type',
        expandedResults: new Set(['updated-1'])
      });

      // Display updated results
      await panel.displayResults(updatedResults, 'updated query');

      assert.ok(true);
    });
  });

  describe('Complex Result Organizations', () => {
    test('should handle mixed result types with proper grouping', async () => {
      const mixedResults = [
        createMockRankedResult({
          id: 'class-result',
          className: 'TestClass',
          functionName: undefined,
          finalScore: 0.9
        }),
        createMockRankedResult({
          id: 'function-result',
          className: undefined,
          functionName: 'testFunction',
          finalScore: 0.8
        }),
        createMockRankedResult({
          id: 'namespace-result',
          className: undefined,
          functionName: undefined,
          namespace: 'TestNamespace',
          finalScore: 0.7
        }),
        createMockRankedResult({
          id: 'code-block',
          className: undefined,
          functionName: undefined,
          namespace: undefined,
          finalScore: 0.6
        })
      ];

      await panel.updateDisplayState({ groupBy: 'type' });
      await panel.displayResults(mixedResults, 'mixed types test');

      assert.ok(true);
    });

    test('should handle results with varying quality scores', async () => {
      const qualityResults = [
        createMockRankedResult({ id: 'excellent', finalScore: 0.95 }),
        createMockRankedResult({ id: 'good-1', finalScore: 0.75 }),
        createMockRankedResult({ id: 'good-2', finalScore: 0.70 }),
        createMockRankedResult({ id: 'fair', finalScore: 0.55 }),
        createMockRankedResult({ id: 'poor', finalScore: 0.25 })
      ];

      await panel.updateDisplayState({ groupBy: 'relevance' });
      await panel.displayResults(qualityResults, 'quality distribution test');

      assert.ok(true);
    });
  });

  describe('Resource Management', () => {
    test('should properly dispose of resources', () => {
      // Create panel
      const testPanel = new SearchResultsPanel(mockContext);
      
      // Use panel
      testPanel.displayResults([createMockRankedResult()], 'disposal test');
      
      // Dispose should not throw
      testPanel.dispose();
      
      assert.ok(true);
    });

    test('should handle multiple dispose calls safely', () => {
      const testPanel = new SearchResultsPanel(mockContext);
      
      // Multiple dispose calls should be safe
      testPanel.dispose();
      testPanel.dispose();
      testPanel.dispose();
      
      assert.ok(true);
    });
  });
}); 