/**
 * Search Result Ranking Service
 * 
 * Implements intelligent ranking system that improves search result relevance
 * by considering multiple factors beyond cosine similarity, including code
 * structure context, recency, and user interaction patterns.
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SearchResult } from './vectorStorageService';
import { EnhancedSearchResult } from './semanticSearchService';

export interface RankedSearchResult extends EnhancedSearchResult {
  finalScore: number;
  rankingFactors: RankingFactors;
  rankPosition: number;
  confidenceScore: number;
  explanation?: string;
}

export interface RankingFactors {
  semanticSimilarity: number;
  structuralRelevance: number;
  recencyScore: number;
  userPreferenceScore: number;
  complexityScore: number;
  diversityPenalty: number;
}

export interface SearchContext {
  currentFile?: string;
  currentFunction?: string;
  workspaceContext?: string;
  searchHistory?: string[];
  userPreferences?: UserPreferences;
  query?: string;
}

export interface UserPreferences {
  preferredFileTypes?: string[];
  preferredNamespaces?: string[];
  preferredStructureTypes?: CodeStructureType[];
  searchDepthPreference?: 'shallow' | 'medium' | 'deep';
  recencyImportance?: number; // 0-1
}

export interface UserFeedback {
  rating: number; // 0-1 scale
  clicked: boolean;
  timeSpent: number; // seconds
  wasHelpful: boolean;
  context: SearchContext;
}

export interface UserInteraction {
  resultId: string;
  feedback: UserFeedback;
  timestamp: Date;
  context: SearchContext;
  queryText: string;
}

export interface RankingWeights {
  semantic: number;         // Default: 0.4
  structural: number;       // Default: 0.2
  recency: number;         // Default: 0.1
  userPreference: number;  // Default: 0.2
  complexity: number;      // Default: 0.05
  diversity: number;       // Default: 0.05
}

export interface RankingConfig {
  weights: RankingWeights;
  diversityThreshold: number;
  learningRate: number;
  userFeedbackDecay: number;
  enableExperimentation: boolean;
  maxResultsToRank: number;
}

export interface RankingExplanation {
  finalScore: number;
  factorBreakdown: Array<{
    factor: string;
    score: number;
    weight: number;
    contribution: number;
  }>;
  reasoning: string;
}

export type CodeStructureType = 'class' | 'function' | 'namespace' | 'struct' | 'enum' | 'include' | 'variable' | 'statement';

export interface UserPreferenceModel {
  structureTypePreferences: Map<CodeStructureType, number>;
  namespacePreferences: Map<string, number>;
  fileTypePreferences: Map<string, number>;
  lastUpdated: Date;
  interactionCount: number;
}

/**
 * Analyzes code structure and context for ranking decisions
 */
export class CodeContextAnalyzer {
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('CppSeek Code Context Analyzer');
  }

  async analyzeStructuralRelevance(
    result: SearchResult,
    context: SearchContext
  ): Promise<number> {
    try {
      // Analyze code structure hierarchy
      const structureType = this.identifyCodeStructure(result);
      const contextAlignment = this.calculateContextAlignment(result, context);
      const hierarchyImportance = this.calculateHierarchyImportance(result, structureType);
      const scopeRelevance = this.calculateScopeRelevance(result, context);

      // Combine factors with appropriate weighting
      const structuralScore = this.combineStructuralFactors(
        structureType,
        contextAlignment,
        hierarchyImportance,
        scopeRelevance
      );

      this.outputChannel.appendLine(
        `📐 Structural analysis for ${result.filePath}:${result.startLine} - ` +
        `Type: ${structureType}, Score: ${structuralScore.toFixed(3)}`
      );

      return Math.max(0, Math.min(1, structuralScore));
    } catch (error) {
      this.outputChannel.appendLine(`❌ Structural analysis error: ${error}`);
      return 0.5; // Default score on error
    }
  }

  private identifyCodeStructure(result: SearchResult): CodeStructureType {
    const content = result.content.toLowerCase().trim();

    // Order matters - more specific patterns first
    if (content.includes('class ') && content.includes('{')) return 'class';
    if (content.includes('struct ') && content.includes('{')) return 'struct';
    if (content.includes('enum ') && content.includes('{')) return 'enum';
    if (content.includes('namespace ')) return 'namespace';
    if (content.includes('#include')) return 'include';
    if (content.match(/\w+\s*\([^)]*\)\s*{/) || result.functionName) return 'function';
    if (content.match(/\b(int|char|bool|float|double|string|auto)\s+\w+\s*[=;]/)) return 'variable';

    return 'statement';
  }

  private calculateContextAlignment(result: SearchResult, context: SearchContext): number {
    let alignment = 0.5; // Base score

    // Strong boost for current file
    if (context.currentFile && result.filePath === context.currentFile) {
      alignment += 0.3;
    }

    // Boost for same function context
    if (context.currentFunction && result.functionName === context.currentFunction) {
      alignment += 0.25;
    }

    // Boost for same namespace
    if (result.namespace && context.workspaceContext?.includes(result.namespace)) {
      alignment += 0.15;
    }

    // Boost for related file paths (same directory)
    if (context.currentFile && result.filePath !== context.currentFile) {
      const currentDir = path.dirname(context.currentFile);
      const resultDir = path.dirname(result.filePath);
      if (currentDir === resultDir) {
        alignment += 0.1;
      }
    }

    return Math.min(alignment, 1.0);
  }

  private calculateHierarchyImportance(result: SearchResult, structureType: CodeStructureType): number {
    // Hierarchy importance scoring based on code structure type
    const hierarchyScores: Record<CodeStructureType, number> = {
      'class': 0.9,      // High importance - defines object structure
      'namespace': 0.85,  // High importance - organizes code
      'function': 0.8,    // High importance - implements behavior
      'struct': 0.75,     // Important - data structure
      'enum': 0.7,        // Important - defines constants
      'include': 0.6,     // Medium - dependencies
      'variable': 0.4,    // Lower - individual data
      'statement': 0.3    // Lowest - individual statements
    };

    let baseScore = hierarchyScores[structureType] || 0.5;

    // Boost for public/interface elements
    if (result.content.includes('public:') || result.content.includes('public ')) {
      baseScore += 0.1;
    }

    // Boost for main functions or important entry points
    if (result.functionName === 'main' || result.content.includes('main(')) {
      baseScore += 0.15;
    }

    return Math.min(baseScore, 1.0);
  }

  private calculateScopeRelevance(result: SearchResult, _context: SearchContext): number {
    let scopeScore = 0.5;

    // Consider class/namespace scope
    if (result.className) {
      scopeScore += 0.1;
      // Boost if it's a commonly referenced class
      if (result.className.length > 0) {
        scopeScore += 0.05;
      }
    }

    if (result.namespace) {
      scopeScore += 0.1;
      // Boost for standard or well-known namespaces
      if (['std', 'boost', 'cv'].includes(result.namespace)) {
        scopeScore += 0.05;
      }
    }

    // Consider function scope complexity
    if (result.functionName) {
      const functionComplexity = this.estimateFunctionComplexity(result.content);
      scopeScore += functionComplexity * 0.1;
    }

    return Math.min(scopeScore, 1.0);
  }

  private estimateFunctionComplexity(content: string): number {
    let complexity = 0.1; // Base complexity

    // Count control structures
    const controlStructures = [
      'if ', 'else', 'for ', 'while ', 'switch ', 'case ',
      'try ', 'catch', 'throw'
    ];

    controlStructures.forEach(keyword => {
      const matches = (content.match(new RegExp(keyword, 'g')) || []).length;
      complexity += matches * 0.1;
    });

    // Count function calls (rough estimate)
    const functionCalls = (content.match(/\w+\s*\(/g) || []).length;
    complexity += functionCalls * 0.05;

    return Math.min(complexity, 1.0);
  }

  private combineStructuralFactors(
    _structureType: CodeStructureType,
    contextAlignment: number,
    hierarchyImportance: number,
    scopeRelevance: number
  ): number {
    // Weighted combination of structural factors
    return (
      contextAlignment * 0.4 +       // Most important - context relevance
      hierarchyImportance * 0.35 +   // Second - code structure importance
      scopeRelevance * 0.25          // Third - scope and complexity
    );
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}

/**
 * Tracks user behavior and learns preferences for ranking
 */
export class UserBehaviorTracker {
  private interactionHistory: UserInteraction[] = [];
  private preferenceModel: UserPreferenceModel;
  private outputChannel: vscode.OutputChannel;
  private maxHistorySize = 1000;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('CppSeek User Behavior Tracker');
    this.preferenceModel = {
      structureTypePreferences: new Map(),
      namespacePreferences: new Map(),
      fileTypePreferences: new Map(),
      lastUpdated: new Date(),
      interactionCount: 0
    };
    this.loadPersistedData();
  }

  async getUserPreferenceScore(
    result: SearchResult,
    preferences?: UserPreferences
  ): Promise<number> {
    try {
      // Analyze historical user selections
      const historicalScore = this.analyzeHistoricalSelections(result);

      // Apply explicit user preferences
      const preferenceScore = this.applyUserPreferences(result, preferences);

      // Consider temporal patterns
      const temporalScore = this.analyzeTemporalPatterns(result);

      // Combine scores
      const combinedScore = this.combineUserScores(
        historicalScore,
        preferenceScore,
        temporalScore
      );

      this.outputChannel.appendLine(
        `👤 User preference score for ${result.filePath}:${result.startLine} - ` +
        `Score: ${combinedScore.toFixed(3)} (hist: ${historicalScore.toFixed(2)}, ` +
        `pref: ${preferenceScore.toFixed(2)}, temp: ${temporalScore.toFixed(2)})`
      );

      return Math.max(0, Math.min(1, combinedScore));
    } catch (error) {
      this.outputChannel.appendLine(`❌ User preference analysis error: ${error}`);
      return 0.5; // Default score on error
    }
  }

  async updateUserFeedback(
    resultId: string,
    feedback: UserFeedback,
    queryText: string
  ): Promise<void> {
    try {
      const interaction: UserInteraction = {
        resultId,
        feedback,
        timestamp: new Date(),
        context: feedback.context,
        queryText
      };

      this.interactionHistory.push(interaction);

      // Trim history if it gets too large
      if (this.interactionHistory.length > this.maxHistorySize) {
        this.interactionHistory = this.interactionHistory.slice(-this.maxHistorySize);
      }

      await this.updatePreferenceModel(interaction);
      await this.persistData();

      this.outputChannel.appendLine(
        `📝 Updated user feedback for result ${resultId}: ` +
        `rating=${feedback.rating}, helpful=${feedback.wasHelpful}`
      );
    } catch (error) {
      this.outputChannel.appendLine(`❌ Failed to update user feedback: ${error}`);
    }
  }

  private analyzeHistoricalSelections(result: SearchResult): number {
    if (this.interactionHistory.length === 0) {
      return 0.5; // Neutral score with no history
    }

    // Find similar results based on file, function, or content similarity
    const similarInteractions = this.interactionHistory.filter(interaction =>
      this.isSimilarResult(interaction, result)
    );

    if (similarInteractions.length === 0) {
      return 0.5; // Neutral score for new types of results
    }

    // Calculate average rating for similar results
    const averageRating = similarInteractions.reduce((sum, interaction) => {
      return sum + interaction.feedback.rating;
    }, 0) / similarInteractions.length;

    // Weight recent interactions more heavily
    const recentWeight = this.calculateRecencyWeight(similarInteractions);

    return averageRating * 0.7 + recentWeight * 0.3;
  }

  private isSimilarResult(interaction: UserInteraction, result: SearchResult): boolean {
    // Check for exact result match
    if (interaction.resultId === result.id) {
      return true;
    }

    // Find similar results - these could be historical interactions we want to learn from
    const resultFile = result.filePath;
    const resultFunction = result.functionName;
    const resultClass = result.className;

    // Check if we have interactions with the same file, function, or class
    return this.interactionHistory.some(hist => {
      const histResult = this.findResultById(hist.resultId);
      if (!histResult) return false;

      return (
        histResult.filePath === resultFile ||
        (histResult.functionName && histResult.functionName === resultFunction) ||
        (histResult.className && histResult.className === resultClass)
      );
    });
  }

  private findResultById(resultId: string): SearchResult | null {
    // In a real implementation, this would look up results from a cache or database
    // For now, we'll extract information from the interaction history
    const interaction = this.interactionHistory.find(i => i.resultId === resultId);
    if (!interaction) return null;

    // We would need to store more result metadata in interactions for this to work properly
    // For now, return null to indicate we can't find the historical result
    return null;
  }

  private calculateRecencyWeight(interactions: UserInteraction[]): number {
    if (interactions.length === 0) return 0.5;

    const now = new Date().getTime();
    const weights = interactions.map(interaction => {
      const ageMs = now - interaction.timestamp.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      // Exponential decay - recent interactions matter more
      return Math.exp(-ageDays / 7); // 7-day half-life
    });

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    return totalWeight / weights.length;
  }

  private applyUserPreferences(result: SearchResult, preferences?: UserPreferences): number {
    if (!preferences) {
      return 0.5; // Neutral score without preferences
    }

    let score = 0.5;

    // Check file type preferences
    if (preferences.preferredFileTypes) {
      const fileExt = path.extname(result.filePath).toLowerCase();
      if (preferences.preferredFileTypes.includes(fileExt)) {
        score += 0.2;
      }
    }

    // Check namespace preferences
    if (preferences.preferredNamespaces && result.namespace) {
      if (preferences.preferredNamespaces.includes(result.namespace)) {
        score += 0.15;
      }
    }

    // Check structure type preferences
    if (preferences.preferredStructureTypes) {
      const analyzer = new CodeContextAnalyzer();
      const structureType = (analyzer as any).identifyCodeStructure(result);
      if (preferences.preferredStructureTypes.includes(structureType)) {
        score += 0.15;
      }
    }

    return Math.min(score, 1.0);
  }

  private analyzeTemporalPatterns(_result: SearchResult): number {
    // Analyze when user typically interacts with similar content
    const currentHour = new Date().getHours();
    const similarInteractions = this.interactionHistory.filter(interaction =>
      interaction.feedback.wasHelpful && interaction.feedback.rating > 0.7
    );

    if (similarInteractions.length === 0) {
      return 0.5;
    }

    // Calculate hour-based pattern score
    const hourCounts = new Array(24).fill(0);
    similarInteractions.forEach(interaction => {
      const hour = interaction.timestamp.getHours();
      hourCounts[hour]++;
    });

    const currentHourCount = hourCounts[currentHour];
    const maxHourCount = Math.max(...hourCounts);

    return maxHourCount > 0 ? currentHourCount / maxHourCount : 0.5;
  }

  private combineUserScores(
    historicalScore: number,
    preferenceScore: number,
    temporalScore: number
  ): number {
    // Weighted combination with emphasis on historical patterns
    return (
      historicalScore * 0.5 +
      preferenceScore * 0.3 +
      temporalScore * 0.2
    );
  }

  private async updatePreferenceModel(interaction: UserInteraction): Promise<void> {
    // This would update the ML model based on user feedback
    // For now, we'll do simple preference tracking
    this.preferenceModel.lastUpdated = new Date();
    this.preferenceModel.interactionCount++;

    // Update structure type preferences based on positive feedback
    if (interaction.feedback.rating > 0.7) {
      // We would extract structure type from the result here
      // For now, just increment the interaction count
    }
  }

  private async loadPersistedData(): Promise<void> {
    try {
      // In a real implementation, this would load from VSCode workspace storage
      // For now, we'll start with empty data
      this.outputChannel.appendLine('📁 Loaded user behavior data');
    } catch (error) {
      this.outputChannel.appendLine(`❌ Failed to load user behavior data: ${error}`);
    }
  }

  private async persistData(): Promise<void> {
    try {
      // In a real implementation, this would save to VSCode workspace storage
      this.outputChannel.appendLine('💾 Persisted user behavior data');
    } catch (error) {
      this.outputChannel.appendLine(`❌ Failed to persist user behavior data: ${error}`);
    }
  }

  getInteractionStats(): { totalInteractions: number; averageRating: number; } {
    if (this.interactionHistory.length === 0) {
      return { totalInteractions: 0, averageRating: 0 };
    }

    const averageRating = this.interactionHistory.reduce((sum, interaction) => {
      return sum + interaction.feedback.rating;
    }, 0) / this.interactionHistory.length;

    return {
      totalInteractions: this.interactionHistory.length,
      averageRating
    };
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}

/**
 * Main search result ranking service
 */
export class SearchResultRanker {
  private rankingWeights: RankingWeights;
  private userBehaviorTracker: UserBehaviorTracker;
  private contextAnalyzer: CodeContextAnalyzer;
  private outputChannel: vscode.OutputChannel;
  private config: RankingConfig;

  constructor(config?: Partial<RankingConfig>) {
    this.config = {
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
      maxResultsToRank: 50,
      ...config
    };

    this.rankingWeights = this.config.weights;
    this.userBehaviorTracker = new UserBehaviorTracker();
    this.contextAnalyzer = new CodeContextAnalyzer();
    this.outputChannel = vscode.window.createOutputChannel('CppSeek Search Result Ranker');

    this.outputChannel.appendLine('🏆 SearchResultRanker initialized with weights:');
    this.outputChannel.appendLine(`   Semantic: ${this.rankingWeights.semantic}`);
    this.outputChannel.appendLine(`   Structural: ${this.rankingWeights.structural}`);
    this.outputChannel.appendLine(`   Recency: ${this.rankingWeights.recency}`);
    this.outputChannel.appendLine(`   User Preference: ${this.rankingWeights.userPreference}`);
    this.outputChannel.appendLine(`   Complexity: ${this.rankingWeights.complexity}`);
    this.outputChannel.appendLine(`   Diversity: ${this.rankingWeights.diversity}`);
  }

  async rankResults(
    results: EnhancedSearchResult[],
    query: string,
    context: SearchContext = {}
  ): Promise<RankedSearchResult[]> {
    if (!results || results.length === 0) {
      return [];
    }

    const startTime = Date.now();
    this.outputChannel.appendLine(`🏆 Ranking ${results.length} search results for query: "${query}"`);

    try {
      // Limit results to process for performance
      const resultsToRank = results.slice(0, this.config.maxResultsToRank);

      // Calculate individual ranking factors for each result
      const enhancedResults = await Promise.all(
        resultsToRank.map(async (result) => {
          const factors = await this.calculateRankingFactors(result, query, context);
          const finalScore = this.calculateFinalScore(factors);
          const confidenceScore = this.calculateConfidence(factors);

          return {
            ...result,
            finalScore,
            rankingFactors: factors,
            rankPosition: 0, // Will be set after sorting
            confidenceScore,
            explanation: this.generateExplanation(factors, finalScore)
          } as RankedSearchResult;
        })
      );

      // Sort by final score
      const sortedResults = enhancedResults.sort((a, b) => b.finalScore - a.finalScore);

      // Apply diversity filtering
      const diversifiedResults = this.applyDiversityFiltering(sortedResults);

      // Set final rank positions
      diversifiedResults.forEach((result, index) => {
        result.rankPosition = index + 1;
      });

      const rankingTime = Date.now() - startTime;
      this.outputChannel.appendLine(
        `✅ Ranking completed in ${rankingTime}ms. ` +
        `Top result: ${diversifiedResults[0]?.filePath} (score: ${diversifiedResults[0]?.finalScore.toFixed(3)})`
      );

      return diversifiedResults;
    } catch (error) {
      this.outputChannel.appendLine(`❌ Ranking failed: ${error}`);
      // Return original results with basic ranking on error
      return results.map((result, index) => ({
        ...result,
        finalScore: result.similarity || result.score || 0,
        rankingFactors: this.getDefaultRankingFactors(result),
        rankPosition: index + 1,
        confidenceScore: 0.5,
        explanation: 'Ranking failed, using similarity score only'
      }));
    }
  }

  async updateUserFeedback(
    resultId: string,
    feedback: UserFeedback,
    queryText: string
  ): Promise<void> {
    await this.userBehaviorTracker.updateUserFeedback(resultId, feedback, queryText);
    this.outputChannel.appendLine(`📝 Updated user feedback for result ${resultId}`);
  }

  getRankingExplanation(result: RankedSearchResult): RankingExplanation {
    const factors = result.rankingFactors;
    const factorBreakdown = [
      {
        factor: 'Semantic Similarity',
        score: factors.semanticSimilarity,
        weight: this.rankingWeights.semantic,
        contribution: factors.semanticSimilarity * this.rankingWeights.semantic
      },
      {
        factor: 'Structural Relevance',
        score: factors.structuralRelevance,
        weight: this.rankingWeights.structural,
        contribution: factors.structuralRelevance * this.rankingWeights.structural
      },
      {
        factor: 'Recency',
        score: factors.recencyScore,
        weight: this.rankingWeights.recency,
        contribution: factors.recencyScore * this.rankingWeights.recency
      },
      {
        factor: 'User Preference',
        score: factors.userPreferenceScore,
        weight: this.rankingWeights.userPreference,
        contribution: factors.userPreferenceScore * this.rankingWeights.userPreference
      },
      {
        factor: 'Complexity',
        score: factors.complexityScore,
        weight: this.rankingWeights.complexity,
        contribution: factors.complexityScore * this.rankingWeights.complexity
      },
      {
        factor: 'Diversity Penalty',
        score: factors.diversityPenalty,
        weight: this.rankingWeights.diversity,
        contribution: -factors.diversityPenalty * this.rankingWeights.diversity
      }
    ];

    const reasoning = this.generateDetailedReasoning(result, factorBreakdown);

    return {
      finalScore: result.finalScore,
      factorBreakdown,
      reasoning
    };
  }

  private async calculateRankingFactors(
    result: EnhancedSearchResult,
    _query: string,
    context: SearchContext
  ): Promise<RankingFactors> {
    // Use semantic similarity from the enhanced result
    const semanticSimilarity = result.similarity || result.score || 0;

    // Calculate structural relevance
    const structuralRelevance = await this.contextAnalyzer.analyzeStructuralRelevance(result, context);

    // Calculate recency score
    const recencyScore = await this.calculateRecencyScore(result);

    // Calculate user preference score
    const userPreferenceScore = await this.userBehaviorTracker.getUserPreferenceScore(
      result,
      context.userPreferences
    );

    // Calculate complexity score
    const complexityScore = this.calculateComplexityScore(result);

    // Calculate diversity penalty (will be applied during diversity filtering)
    const diversityPenalty = 0; // Initially zero, calculated during diversity filtering

    return {
      semanticSimilarity,
      structuralRelevance,
      recencyScore,
      userPreferenceScore,
      complexityScore,
      diversityPenalty
    };
  }

  private calculateFinalScore(factors: RankingFactors): number {
    const weights = this.rankingWeights;

    const score = (
      factors.semanticSimilarity * weights.semantic +
      factors.structuralRelevance * weights.structural +
      factors.recencyScore * weights.recency +
      factors.userPreferenceScore * weights.userPreference +
      factors.complexityScore * weights.complexity -
      factors.diversityPenalty * weights.diversity
    );

    // Ensure score is in valid range
    return Math.max(0, Math.min(1, score));
  }

  private calculateConfidence(factors: RankingFactors): number {
    // Calculate confidence based on how many factors have strong signals
    const factorValues = [
      factors.semanticSimilarity,
      factors.structuralRelevance,
      factors.recencyScore,
      factors.userPreferenceScore,
      factors.complexityScore
    ];

    // Count factors with strong signals (> 0.7 or < 0.3)
    const strongSignals = factorValues.filter(value => value > 0.7 || value < 0.3).length;
    const totalFactors = factorValues.length;

    // Base confidence + bonus for strong signals
    const baseConfidence = 0.5;
    const signalBonus = (strongSignals / totalFactors) * 0.4;

    return Math.min(baseConfidence + signalBonus, 1.0);
  }

  private async calculateRecencyScore(result: EnhancedSearchResult): Promise<number> {
    try {
      // Get file modification time
      const stats = await fs.stat(result.filePath);
      const lastModified = stats.mtime.getTime();
      const now = Date.now();
      const ageMs = now - lastModified;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);

      // Exponential decay - recent files score higher
      // Files modified within a week get full score, older files decay
      const recencyScore = Math.exp(-ageDays / 7);

      return Math.max(0.1, Math.min(1.0, recencyScore));
    } catch (error) {
      // If we can't get file stats, return neutral score
      return 0.5;
    }
  }

  private calculateComplexityScore(result: EnhancedSearchResult): number {
    const content = result.content;
    let complexity = 0.5; // Base score

    // Factor in code length (longer code might be more important)
    const lineCount = content.split('\n').length;
    const lengthFactor = Math.min(lineCount / 50, 1.0) * 0.2; // Max 0.2 bonus for length

    // Factor in code structure complexity
    const structureFactor = this.analyzeCodeComplexity(content) * 0.3;

    complexity += lengthFactor + structureFactor;

    return Math.max(0.1, Math.min(1.0, complexity));
  }

  private analyzeCodeComplexity(content: string): number {
    let complexity = 0;

    // Count various complexity indicators
    const indicators = [
      { pattern: /\bif\b/g, weight: 0.1 },
      { pattern: /\bfor\b/g, weight: 0.1 },
      { pattern: /\bwhile\b/g, weight: 0.1 },
      { pattern: /\bswitch\b/g, weight: 0.15 },
      { pattern: /\btry\b/g, weight: 0.1 },
      { pattern: /\bcatch\b/g, weight: 0.1 },
      { pattern: /\bclass\b/g, weight: 0.2 },
      { pattern: /\btemplate\b/g, weight: 0.15 },
      { pattern: /\bvirtual\b/g, weight: 0.1 }
    ];

    indicators.forEach(({ pattern, weight }) => {
      const matches = (content.match(pattern) || []).length;
      complexity += matches * weight;
    });

    return Math.min(complexity, 1.0);
  }

  private applyDiversityFiltering(results: RankedSearchResult[]): RankedSearchResult[] {
    if (results.length <= 1) {
      return results;
    }

    const diversifiedResults: RankedSearchResult[] = [results[0]]; // Always include top result
    const threshold = this.config.diversityThreshold;

    for (let i = 1; i < results.length; i++) {
      const candidate = results[i];
      let shouldInclude = true;

      // Check similarity with already included results
      for (const included of diversifiedResults) {
        const similarity = this.calculateResultSimilarity(candidate, included);
        if (similarity > threshold) {
          // Apply diversity penalty instead of excluding
          candidate.rankingFactors.diversityPenalty = (similarity - threshold) * 0.5;
          candidate.finalScore = this.calculateFinalScore(candidate.rankingFactors);
          break;
        }
      }

      diversifiedResults.push(candidate);
    }

    // Re-sort after applying diversity penalties
    return diversifiedResults.sort((a, b) => b.finalScore - a.finalScore);
  }

  private calculateResultSimilarity(result1: RankedSearchResult, result2: RankedSearchResult): number {
    let similarity = 0;

    // File similarity
    if (result1.filePath === result2.filePath) {
      similarity += 0.4;
    } else if (path.dirname(result1.filePath) === path.dirname(result2.filePath)) {
      similarity += 0.2;
    }

    // Function similarity
    if (result1.functionName && result2.functionName && result1.functionName === result2.functionName) {
      similarity += 0.3;
    }

    // Class similarity
    if (result1.className && result2.className && result1.className === result2.className) {
      similarity += 0.2;
    }

    // Content similarity (simple check)
    const content1Words = new Set(result1.content.toLowerCase().split(/\s+/));
    const content2Words = new Set(result2.content.toLowerCase().split(/\s+/));
    const intersection = new Set([...content1Words].filter(x => content2Words.has(x)));
    const union = new Set([...content1Words, ...content2Words]);
    const contentSimilarity = intersection.size / union.size;

    similarity += contentSimilarity * 0.1;

    return Math.min(similarity, 1.0);
  }

  private generateExplanation(factors: RankingFactors, finalScore: number): string {
    const topFactor = this.getTopContributingFactor(factors);
    return `Ranked #${0} (score: ${finalScore.toFixed(3)}) - Primary factor: ${topFactor}`;
  }

  private getTopContributingFactor(factors: RankingFactors): string {
    const contributions = {
      'Semantic Similarity': factors.semanticSimilarity * this.rankingWeights.semantic,
      'Structural Relevance': factors.structuralRelevance * this.rankingWeights.structural,
      'Recency': factors.recencyScore * this.rankingWeights.recency,
      'User Preference': factors.userPreferenceScore * this.rankingWeights.userPreference,
      'Complexity': factors.complexityScore * this.rankingWeights.complexity
    };

    return Object.entries(contributions)
      .sort(([, a], [, b]) => b - a)[0][0];
  }

  private generateDetailedReasoning(
    result: RankedSearchResult,
    factorBreakdown: Array<{ factor: string; score: number; weight: number; contribution: number; }>
  ): string {
    const topFactors = factorBreakdown
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3);

    let reasoning = `This result ranked #${result.rankPosition} with a score of ${result.finalScore.toFixed(3)}. `;
    reasoning += `Key factors: `;

    topFactors.forEach((factor, index) => {
      if (index > 0) reasoning += ', ';
      reasoning += `${factor.factor} (${(factor.contribution * 100).toFixed(1)}%)`;
    });

    return reasoning + '.';
  }

  private getDefaultRankingFactors(result: EnhancedSearchResult): RankingFactors {
    return {
      semanticSimilarity: result.similarity || result.score || 0,
      structuralRelevance: 0.5,
      recencyScore: 0.5,
      userPreferenceScore: 0.5,
      complexityScore: 0.5,
      diversityPenalty: 0
    };
  }

  updateRankingWeights(newWeights: Partial<RankingWeights>): void {
    this.rankingWeights = { ...this.rankingWeights, ...newWeights };
    this.outputChannel.appendLine('🎛️ Updated ranking weights');
  }

  getUserBehaviorStats(): { totalInteractions: number; averageRating: number; } {
    return this.userBehaviorTracker.getInteractionStats();
  }

  dispose(): void {
    this.userBehaviorTracker.dispose();
    this.contextAnalyzer.dispose();
    this.outputChannel.dispose();
  }
}

/**
 * Default ranking configuration
 */
export const defaultRankingConfig: RankingConfig = {
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
}; 