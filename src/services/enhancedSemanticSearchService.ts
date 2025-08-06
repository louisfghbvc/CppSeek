/**
 * Enhanced Semantic Search Service
 * 
 * Extends the basic SemanticSearchService with intelligent ranking capabilities
 * using the SearchResultRanker for multi-factor result scoring and optimization.
 */

import * as vscode from 'vscode';
import { SemanticSearchService, SearchOptions, EnhancedSearchResult, SearchConfig } from './semanticSearchService';
import { VectorStorageService } from './vectorStorageService';
import { NIMEmbeddingService } from './nimEmbeddingService';
import { 
  SearchResultRanker, 
  RankedSearchResult, 
  SearchContext, 
  UserFeedback,
  RankingConfig,
  defaultRankingConfig
} from './searchResultRanker';

export interface EnhancedSearchOptions extends SearchOptions {
  enableRanking?: boolean;
  searchContext?: SearchContext;
  includeRankingExplanation?: boolean;
}

export interface EnhancedSearchStats {
  totalSearches: number;
  rankedSearches: number;
  cacheHitRate: number;
  averageLatency: number;
  averageRankingLatency: number;
  userInteractions: number;
  averageUserRating: number;
  mostFrequentQueries: Array<{ query: string; count: number; }>;
}

/**
 * Enhanced semantic search service with intelligent ranking
 */
export class EnhancedSemanticSearchService {
  private baseSearchService: SemanticSearchService;
  private ranker: SearchResultRanker;
  private outputChannel: vscode.OutputChannel;
  private searchStats = {
    totalEnhancedSearches: 0,
    rankedSearches: 0,
    totalRankingTime: 0
  };

  constructor(
    vectorStorageService: VectorStorageService,
    embeddingService: NIMEmbeddingService,
    searchConfig?: Partial<SearchConfig>,
    rankingConfig?: Partial<RankingConfig>
  ) {
    this.baseSearchService = new SemanticSearchService(
      vectorStorageService,
      embeddingService,
      searchConfig
    );
    
    this.ranker = new SearchResultRanker(rankingConfig || defaultRankingConfig);
    this.outputChannel = vscode.window.createOutputChannel('CppSeek Enhanced Search');
    
    this.outputChannel.appendLine('🚀 Enhanced Semantic Search Service initialized');
    this.outputChannel.appendLine('   Base search: ✅ SemanticSearchService');
    this.outputChannel.appendLine('   Ranking: ✅ SearchResultRanker');
  }

  /**
   * Enhanced search with intelligent ranking
   */
  async search(
    query: string, 
    options: EnhancedSearchOptions = {}
  ): Promise<RankedSearchResult[]> {
    const startTime = Date.now();
    this.searchStats.totalEnhancedSearches++;

    try {
      this.outputChannel.appendLine(`🔍 Enhanced search: "${query}"`);
      
      // Apply default options
      const enhancedOptions: EnhancedSearchOptions = {
        enableRanking: true,
        includeRankingExplanation: false,
        ...options
      };

      // Perform base semantic search
      const baseResults = await this.baseSearchService.search(query, enhancedOptions);
      
      if (baseResults.length === 0) {
        this.outputChannel.appendLine('📭 No base results found');
        return [];
      }

      // Apply ranking if enabled
      if (enhancedOptions.enableRanking) {
        const rankingStartTime = Date.now();
        
        const rankedResults = await this.ranker.rankResults(
          baseResults,
          query,
          enhancedOptions.searchContext || this.buildDefaultContext(query)
        );

        const rankingTime = Date.now() - rankingStartTime;
        this.searchStats.rankedSearches++;
        this.searchStats.totalRankingTime += rankingTime;

        this.outputChannel.appendLine(
          `🏆 Ranking completed in ${rankingTime}ms. ` +
          `Top result: ${rankedResults[0]?.filePath} (final score: ${rankedResults[0]?.finalScore.toFixed(3)})`
        );

        // Add ranking explanations if requested
        if (enhancedOptions.includeRankingExplanation) {
          rankedResults.forEach(result => {
            const explanation = this.ranker.getRankingExplanation(result);
            result.explanation = explanation.reasoning;
          });
        }

        const totalTime = Date.now() - startTime;
        this.outputChannel.appendLine(`✅ Enhanced search completed in ${totalTime}ms`);

        return rankedResults;
      } else {
        // Return base results without ranking
        this.outputChannel.appendLine('🔄 Ranking disabled, returning base results');
        return baseResults.map((result, index) => ({
          ...result,
          finalScore: result.similarity || result.score || 0,
          rankingFactors: {
            semanticSimilarity: result.similarity || result.score || 0,
            structuralRelevance: 0.5,
            recencyScore: 0.5,
            userPreferenceScore: 0.5,
            complexityScore: 0.5,
            diversityPenalty: 0
          },
          rankPosition: index + 1,
          confidenceScore: 0.5,
          explanation: 'Ranking disabled'
        }));
      }
    } catch (error) {
      this.outputChannel.appendLine(`❌ Enhanced search failed: ${error}`);
      throw error;
    }
  }

  /**
   * Search with explicit context information
   */
  async searchWithContext(
    query: string,
    context: SearchContext,
    options: EnhancedSearchOptions = {}
  ): Promise<RankedSearchResult[]> {
    return this.search(query, {
      ...options,
      searchContext: context,
      enableRanking: true
    });
  }

  /**
   * Record user feedback for learning
   */
  async recordUserFeedback(
    resultId: string,
    feedback: UserFeedback,
    queryText: string
  ): Promise<void> {
    try {
      await this.ranker.updateUserFeedback(resultId, feedback, queryText);
      this.outputChannel.appendLine(
        `📝 Recorded user feedback for result ${resultId}: ` +
        `rating=${feedback.rating}, helpful=${feedback.wasHelpful}`
      );
    } catch (error) {
      this.outputChannel.appendLine(`❌ Failed to record user feedback: ${error}`);
      throw error;
    }
  }

  /**
   * Get enhanced search statistics
   */
  getEnhancedSearchStats(): EnhancedSearchStats {
    const baseStats = this.baseSearchService.getSearchStats();
    const userStats = this.ranker.getUserBehaviorStats();
    
    const averageRankingLatency = this.searchStats.rankedSearches > 0 ?
      this.searchStats.totalRankingTime / this.searchStats.rankedSearches : 0;

    return {
      totalSearches: baseStats.totalSearches,
      rankedSearches: this.searchStats.rankedSearches,
      cacheHitRate: baseStats.cacheHitRate,
      averageLatency: baseStats.averageLatency,
      averageRankingLatency: averageRankingLatency,
      userInteractions: userStats.totalInteractions,
      averageUserRating: userStats.averageRating,
      mostFrequentQueries: baseStats.mostFrequentQueries
    };
  }

  /**
   * Search for similar results to a given chunk
   */
  async searchSimilarToChunk(
    chunkId: string,
    options: EnhancedSearchOptions = {}
  ): Promise<RankedSearchResult[]> {
    // This would use the base service method when it's implemented
    return this.baseSearchService.searchSimilarToChunk(chunkId, options) as Promise<RankedSearchResult[]>;
  }

  /**
   * Invalidate search cache
   */
  async invalidateCache(pattern?: string): Promise<void> {
    await this.baseSearchService.invalidateCache(pattern);
    this.outputChannel.appendLine('🗑️ Search cache invalidated');
  }

  /**
   * Update ranking configuration
   */
  updateRankingWeights(weights: Partial<import('./searchResultRanker').RankingWeights>): void {
    this.ranker.updateRankingWeights(weights);
    this.outputChannel.appendLine('🎛️ Ranking weights updated');
  }

  /**
   * Get detailed ranking explanation for a result
   */
  getRankingExplanation(result: RankedSearchResult): import('./searchResultRanker').RankingExplanation {
    return this.ranker.getRankingExplanation(result);
  }

  /**
   * Perform A/B testing between different ranking approaches
   */
  async performRankingExperiment(
    query: string,
    experimentConfig: {
      controlWeights: import('./searchResultRanker').RankingWeights;
      testWeights: import('./searchResultRanker').RankingWeights;
    },
    options: EnhancedSearchOptions = {}
  ): Promise<{
    controlResults: RankedSearchResult[];
    testResults: RankedSearchResult[];
    recommendedApproach: 'control' | 'test';
  }> {
    this.outputChannel.appendLine(`🧪 Running ranking experiment for query: "${query}"`);
    
    // Get base results
    const baseResults = await this.baseSearchService.search(query, options);
    
    if (baseResults.length === 0) {
      return {
        controlResults: [],
        testResults: [],
        recommendedApproach: 'control'
      };
    }

    const context = options.searchContext || this.buildDefaultContext(query);

    // Test control approach
    this.ranker.updateRankingWeights(experimentConfig.controlWeights);
    const controlResults = await this.ranker.rankResults(baseResults, query, context);

    // Test experimental approach
    this.ranker.updateRankingWeights(experimentConfig.testWeights);
    const testResults = await this.ranker.rankResults(baseResults, query, context);

    // Simple recommendation logic (could be enhanced with ML)
    const controlTopScore = controlResults[0]?.finalScore || 0;
    const testTopScore = testResults[0]?.finalScore || 0;
    const recommendedApproach = testTopScore > controlTopScore ? 'test' : 'control';

    this.outputChannel.appendLine(
      `🧪 Experiment completed. Control: ${controlTopScore.toFixed(3)}, ` +
      `Test: ${testTopScore.toFixed(3)}, Recommended: ${recommendedApproach}`
    );

    return {
      controlResults,
      testResults,
      recommendedApproach
    };
  }

  /**
   * Get search recommendations based on user behavior
   */
  async getSearchRecommendations(context: SearchContext): Promise<string[]> {
    // This could be enhanced with ML-based recommendations
    const recommendations: string[] = [];

    // Simple recommendation logic based on context
    if (context.currentFile) {
      const fileExt = context.currentFile.split('.').pop();
      if (fileExt === 'cpp' || fileExt === 'cc') {
        recommendations.push('class implementation');
        recommendations.push('function definition');
      } else if (fileExt === 'h' || fileExt === 'hpp') {
        recommendations.push('class declaration');
        recommendations.push('function prototype');
      }
    }

    if (context.currentFunction) {
      recommendations.push(`similar to ${context.currentFunction}`);
      recommendations.push(`calls to ${context.currentFunction}`);
    }

    this.outputChannel.appendLine(`💡 Generated ${recommendations.length} search recommendations`);
    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }

  /**
   * Build default search context from available information
   */
  private buildDefaultContext(query: string): SearchContext {
    // Get current editor context if available
    const activeEditor = vscode.window.activeTextEditor;
    
    const context: SearchContext = {
      query: query
    };

    if (activeEditor) {
      context.currentFile = activeEditor.document.fileName;
      
      // Try to determine current function (basic implementation)
      const position = activeEditor.selection.active;
      const document = activeEditor.document;
      
      // Look backwards from current position to find function name
      for (let line = position.line; line >= Math.max(0, position.line - 20); line--) {
        const lineText = document.lineAt(line).text;
        const functionMatch = lineText.match(/(\w+)\s*\([^)]*\)\s*{?/);
        if (functionMatch) {
          context.currentFunction = functionMatch[1];
          break;
        }
      }
    }

    // Add workspace context
    if (vscode.workspace.workspaceFolders) {
      context.workspaceContext = vscode.workspace.workspaceFolders[0].name;
    }

    return context;
  }

  /**
   * Export search analytics data
   */
  exportSearchAnalytics(): {
    searchStats: EnhancedSearchStats;
    topQueries: Array<{ query: string; count: number; avgScore: number; }>;
    userBehaviorSummary: { totalInteractions: number; averageRating: number; };
  } {
    const stats = this.getEnhancedSearchStats();
    const userBehavior = this.ranker.getUserBehaviorStats();

    return {
      searchStats: stats,
      topQueries: stats.mostFrequentQueries.map(q => ({
        ...q,
        avgScore: 0.8 // Placeholder - would calculate from actual data
      })),
      userBehaviorSummary: userBehavior
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.baseSearchService.dispose();
    this.ranker.dispose();
    this.outputChannel.dispose();
  }
}

/**
 * Factory function to create an enhanced search service
 */
export function createEnhancedSemanticSearchService(
  vectorStorageService: VectorStorageService,
  embeddingService: NIMEmbeddingService,
  searchConfig?: Partial<SearchConfig>,
  rankingConfig?: Partial<RankingConfig>
): EnhancedSemanticSearchService {
  return new EnhancedSemanticSearchService(
    vectorStorageService,
    embeddingService,
    searchConfig,
    rankingConfig
  );
} 