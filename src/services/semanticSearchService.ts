/**
 * Semantic Search Service
 * 
 * Advanced semantic search service that provides intelligent query processing,
 * caching, filtering, and result optimization for the CppSeek extension.
 * 
 * Integrates with ModernVectorStorage (LangChain + Chroma) from Task 11.
 */

import * as vscode from 'vscode';
import { VectorStorageService, SearchResult } from './vectorStorageService';
import { NIMEmbeddingService } from './nimEmbeddingService';

export interface SearchOptions {
  topK?: number;
  similarityThreshold?: number;
  includeContext?: boolean;
  filters?: SearchFilter[];
  cacheResults?: boolean;
  searchTimeout?: number;
  enableQueryExpansion?: boolean;
}

export interface SearchFilter {
  type: 'file' | 'function' | 'class' | 'namespace' | 'fileType';
  value: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'regex';
}

export interface EnhancedSearchResult extends SearchResult {
  similarity: number;
  contextSnippet?: string;
  relevanceFactors?: {
    semanticScore: number;
    contextScore: number;
    recencyScore: number;
  };
}

export interface SearchStatistics {
  totalSearches: number;
  cacheHitRate: number;
  averageLatency: number;
  mostFrequentQueries: Array<{ query: string; count: number; }>;
}

export interface SearchConfig {
  defaultTopK: number;
  defaultThreshold: number;
  maxResults: number;
  cacheSize: number;
  cacheTTL: number;
  searchTimeout: number;
  queryExpansion: boolean;
  contextSnippets: boolean;
}

interface CachedSearchResult {
  results: EnhancedSearchResult[];
  timestamp: number;
  options: SearchOptions;
}

interface SearchCacheEntry {
  data: CachedSearchResult;
  lastAccessed: number;
}

export class SearchError extends Error {
  constructor(
    message: string,
    public query: string,
    public options: SearchOptions,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'SearchError';
  }
}

/**
 * Advanced semantic search service with caching, preprocessing, and filtering
 */
export class SemanticSearchService {
  private vectorStorageService: VectorStorageService;
  private embeddingService: NIMEmbeddingService;
  private outputChannel: vscode.OutputChannel;
  private config: SearchConfig;
  
  // Search cache with LRU eviction
  private searchCache = new Map<string, SearchCacheEntry>();
  private cacheAccessOrder: string[] = [];
  
  // Search statistics
  private stats: SearchStatistics = {
    totalSearches: 0,
    cacheHitRate: 0,
    averageLatency: 0,
    mostFrequentQueries: []
  };
  
  private queryFrequency = new Map<string, number>();
  private latencyHistory: number[] = [];
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(
    vectorStorageService: VectorStorageService,
    embeddingService: NIMEmbeddingService,
    config?: Partial<SearchConfig>
  ) {
    this.vectorStorageService = vectorStorageService;
    this.embeddingService = embeddingService;
    this.outputChannel = vscode.window.createOutputChannel('CppSeek Semantic Search');
    
    this.config = {
      defaultTopK: 10,
      defaultThreshold: 0.3,
      maxResults: 50,
      cacheSize: 1000,
      cacheTTL: 300000, // 5 minutes
      searchTimeout: 5000, // 5 seconds
      queryExpansion: true,
      contextSnippets: true,
      ...config
    };
    
    this.outputChannel.appendLine('🔍 SemanticSearchService initialized');
  }

  /**
   * Main search method with advanced processing and caching
   */
  async search(query: string, options: SearchOptions = {}): Promise<EnhancedSearchResult[]> {
    const startTime = Date.now();
    this.stats.totalSearches++;
    
    try {
      // Validate input
      if (!query || query.trim().length === 0) {
        throw new SearchError('Query cannot be empty', query, options);
      }
      
      // Apply defaults to options
      const searchOptions: SearchOptions = {
        topK: this.config.defaultTopK,
        similarityThreshold: this.config.defaultThreshold,
        includeContext: this.config.contextSnippets,
        cacheResults: true,
        searchTimeout: this.config.searchTimeout,
        enableQueryExpansion: this.config.queryExpansion,
        ...options
      };
      
      this.outputChannel.appendLine(`🔍 Searching: "${query}" (topK: ${searchOptions.topK})`);
      
      // Update query frequency for all searches (cache hit or miss)
      this.updateQueryFrequency(query);
      
      // Check cache first
      const cacheKey = this.generateCacheKey(query, searchOptions);
      if (searchOptions.cacheResults !== false) {
        const cachedResults = this.getFromCache(cacheKey);
        if (cachedResults) {
          this.outputChannel.appendLine(`✅ Cache hit for query: "${query}"`);
          this.cacheHits++;
          const searchTime = Date.now() - startTime;
          this.updateLatencyStats(searchTime);
          return cachedResults.results;
        }
      }
      
      // Cache miss
      this.cacheMisses++;
      
      // Preprocess query
      const processedQuery = this.preprocessQuery(query, searchOptions);
      
      // Execute search with timeout
      const searchPromise = this.executeSearch(processedQuery, searchOptions);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Search timeout')), searchOptions.searchTimeout!);
      });
      
      const rawResults = await Promise.race([searchPromise, timeoutPromise]);
      
      // Post-process results
      const processedResults = await this.postProcessResults(rawResults, searchOptions);
      
      // Cache results if enabled
      if (searchOptions.cacheResults !== false) {
        this.addToCache(cacheKey, processedResults, searchOptions);
      }
      
      const searchTime = Date.now() - startTime;
      this.updateLatencyStats(searchTime);
      
      this.outputChannel.appendLine(
        `✅ Search completed in ${searchTime}ms, found ${processedResults.length} results`
      );
      
      return processedResults;
      
    } catch (error) {
      this.outputChannel.appendLine(`❌ Search failed: ${error}`);
      throw new SearchError(
        `Search failed: ${error instanceof Error ? error.message : error}`, 
        query, 
        options,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Search for chunks similar to a specific chunk
   */
  async searchSimilarToChunk(
    chunkId: string, 
    _options: SearchOptions = {}
  ): Promise<EnhancedSearchResult[]> {
    // This would require chunk retrieval functionality - for now, return empty
    this.outputChannel.appendLine(`🔍 Searching similar to chunk: ${chunkId}`);
    return [];
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  async invalidateCache(pattern?: string): Promise<void> {
    if (!pattern) {
      this.searchCache.clear();
      this.cacheAccessOrder.length = 0;
      this.outputChannel.appendLine('🗑️ All cache entries cleared');
      return;
    }
    
    const regex = new RegExp(pattern);
    let removedCount = 0;
    
    for (const [key, _] of this.searchCache) {
      if (regex.test(key)) {
        this.searchCache.delete(key);
        const index = this.cacheAccessOrder.indexOf(key);
        if (index > -1) {
          this.cacheAccessOrder.splice(index, 1);
        }
        removedCount++;
      }
    }
    
    this.outputChannel.appendLine(`🗑️ Removed ${removedCount} cache entries matching pattern: ${pattern}`);
  }

  /**
   * Get search statistics
   */
  getSearchStats(): SearchStatistics {
    const totalCacheOperations = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalCacheOperations > 0 ? 
      this.cacheHits / totalCacheOperations : 0;
    
    const avgLatency = this.latencyHistory.length > 0 ?
      this.latencyHistory.reduce((sum, lat) => sum + lat, 0) / this.latencyHistory.length : 0;
    
    const topQueries = Array.from(this.queryFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));
    
    return {
      totalSearches: this.stats.totalSearches,
      cacheHitRate: cacheHitRate,
      averageLatency: avgLatency,
      mostFrequentQueries: topQueries
    };
  }

  /**
   * Preprocess query with normalization and expansion
   */
  private preprocessQuery(query: string, options: SearchOptions): string {
    let processedQuery = query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s]/g, ' ') // Remove special characters except underscores
      .replace(/\b(where|what|how|when|why|is|are|the|a|an)\b/g, '') // Remove common words
      .trim();
    
    // Query expansion
    if (options.enableQueryExpansion) {
      processedQuery = this.expandQuery(processedQuery);
    }
    
    this.outputChannel.appendLine(`📝 Query preprocessed: "${query}" -> "${processedQuery}"`);
    return processedQuery;
  }

  /**
   * Expand query with programming synonyms and related terms
   */
  private expandQuery(query: string): string {
    const expansions: Record<string, string[]> = {
      'init': ['initialize', 'setup', 'create', 'construct'],
      'config': ['configuration', 'settings', 'options', 'parameters'],
      'handle': ['process', 'manage', 'deal', 'execute'],
      'error': ['exception', 'failure', 'bug', 'issue'],
      'function': ['method', 'procedure', 'routine'],
      'class': ['object', 'type', 'struct'],
      'variable': ['var', 'field', 'member', 'property'],
      'loop': ['iterate', 'for', 'while', 'foreach'],
      'condition': ['if', 'check', 'test', 'validate']
    };
    
    let expandedQuery = query;
    Object.entries(expansions).forEach(([term, synonyms]) => {
      if (expandedQuery.includes(term)) {
        expandedQuery += ' ' + synonyms.join(' ');
      }
    });
    
    return expandedQuery;
  }

  /**
   * Execute the actual search using VectorStorageService
   */
  private async executeSearch(
    query: string, 
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const topK = Math.min(options.topK! * 2, this.config.maxResults); // Get extra for filtering
    
    // Use the existing VectorStorageService for the actual search
    const rawResults = await this.vectorStorageService.searchSimilar(query, topK);
    
    // Apply similarity threshold filter
    const threshold = options.similarityThreshold!;
    const filteredResults = rawResults.filter(result => result.score >= threshold);
    
    // Apply custom filters
    let finalResults = filteredResults;
    if (options.filters && options.filters.length > 0) {
      finalResults = this.applyFilters(filteredResults, options.filters);
    }
    
    // Return top K after filtering
    return finalResults.slice(0, options.topK!);
  }

  /**
   * Apply custom filters to search results
   */
  private applyFilters(results: SearchResult[], filters: SearchFilter[]): SearchResult[] {
    return results.filter(result => {
      return filters.every(filter => this.matchesFilter(result, filter));
    });
  }

  /**
   * Check if a result matches a specific filter
   */
  private matchesFilter(result: SearchResult, filter: SearchFilter): boolean {
    let value: string;
    
    switch (filter.type) {
      case 'file':
        value = result.filePath;
        break;
      case 'function':
        value = result.functionName || '';
        break;
      case 'class':
        value = result.className || '';
        break;
      case 'namespace':
        value = result.namespace || '';
        break;
      case 'fileType':
        value = result.filePath.split('.').pop() || '';
        break;
      default:
        return true;
    }
    
    switch (filter.operator) {
      case 'equals':
        return value === filter.value;
      case 'contains':
        return value.includes(filter.value);
      case 'startsWith':
        return value.startsWith(filter.value);
      case 'regex':
        try {
          return new RegExp(filter.value).test(value);
        } catch {
          return false;
        }
      default:
        return true;
    }
  }

  /**
   * Post-process search results with scoring and context
   */
  private async postProcessResults(
    results: SearchResult[], 
    options: SearchOptions
  ): Promise<EnhancedSearchResult[]> {
    let enhancedResults: EnhancedSearchResult[] = results.map(result => ({
      ...result,
      similarity: result.score, // Map score to similarity for consistency
      relevanceFactors: {
        semanticScore: result.score,
        contextScore: this.calculateContextScore(result),
        recencyScore: this.calculateRecencyScore(result)
      }
    }));
    
    // Normalize similarity scores
    enhancedResults = this.normalizeScores(enhancedResults);
    
    // Add context snippets if requested
    if (options.includeContext) {
      enhancedResults = await this.addContextSnippets(enhancedResults);
    }
    
    // Sort by combined relevance score
    enhancedResults.sort((a, b) => {
      const aScore = this.calculateCombinedScore(a);
      const bScore = this.calculateCombinedScore(b);
      return bScore - aScore;
    });
    
    return enhancedResults;
  }

  /**
   * Calculate context score based on code structure
   */
  private calculateContextScore(result: SearchResult): number {
    let score = 0.5; // Base score
    
    // Higher score for results with function context
    if (result.functionName) score += 0.2;
    if (result.className) score += 0.2;
    if (result.namespace) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  /**
   * Calculate recency score (placeholder - would need file modification times)
   */
  private calculateRecencyScore(_result: SearchResult): number {
    // For now, return a neutral score
    // In a real implementation, this would consider file modification time
    return 0.5;
  }

  /**
   * Calculate combined relevance score
   */
  private calculateCombinedScore(result: EnhancedSearchResult): number {
    const factors = result.relevanceFactors!;
    return (
      factors.semanticScore * 0.7 +
      factors.contextScore * 0.2 +
      factors.recencyScore * 0.1
    );
  }

  /**
   * Normalize similarity scores to 0-1 range
   */
  private normalizeScores(results: EnhancedSearchResult[]): EnhancedSearchResult[] {
    if (results.length === 0) return results;
    
    const maxScore = Math.max(...results.map(r => r.similarity));
    const minScore = Math.min(...results.map(r => r.similarity));
    const range = maxScore - minScore;
    
    return results.map(result => ({
      ...result,
      similarity: range > 0 ? (result.similarity - minScore) / range : 1.0
    }));
  }

  /**
   * Add context snippets to results
   */
  private async addContextSnippets(results: EnhancedSearchResult[]): Promise<EnhancedSearchResult[]> {
    return Promise.all(results.map(async result => {
      const contextSnippet = await this.generateContextSnippet(result);
      return { ...result, contextSnippet };
    }));
  }

  /**
   * Generate context snippet for a search result
   */
  private async generateContextSnippet(result: EnhancedSearchResult): Promise<string> {
    // Basic context snippet generation
    const functionInfo = result.functionName ? `Function: ${result.functionName}` : '';
    const classInfo = result.className ? `Class: ${result.className}` : '';
    const namespaceInfo = result.namespace ? `Namespace: ${result.namespace}` : '';
    
    const contextParts = [functionInfo, classInfo, namespaceInfo].filter(part => part);
    const contextInfo = contextParts.length > 0 ? ` (${contextParts.join(', ')})` : '';
    
    return `${result.filePath}:${result.startLine}${contextInfo}`;
  }

  /**
   * Generate cache key for a query and options
   */
  private generateCacheKey(query: string, options: SearchOptions): string {
    const keyData = {
      query: query.toLowerCase().trim(),
      topK: options.topK,
      threshold: options.similarityThreshold,
      filters: options.filters,
      context: options.includeContext,
      expansion: options.enableQueryExpansion
    };
    
    return JSON.stringify(keyData);
  }

  /**
   * Get cached search results
   */
  private getFromCache(cacheKey: string): CachedSearchResult | null {
    const entry = this.searchCache.get(cacheKey);
    if (!entry) return null;
    
    // Check if cache entry is expired
    const now = Date.now();
    if (now - entry.data.timestamp > this.config.cacheTTL) {
      this.searchCache.delete(cacheKey);
      const index = this.cacheAccessOrder.indexOf(cacheKey);
      if (index > -1) {
        this.cacheAccessOrder.splice(index, 1);
      }
      return null;
    }
    
    // Update access order for LRU
    entry.lastAccessed = now;
    const index = this.cacheAccessOrder.indexOf(cacheKey);
    if (index > -1) {
      this.cacheAccessOrder.splice(index, 1);
    }
    this.cacheAccessOrder.push(cacheKey);
    
    return entry.data;
  }

  /**
   * Add search results to cache with LRU eviction
   */
  private addToCache(
    cacheKey: string, 
    results: EnhancedSearchResult[], 
    options: SearchOptions
  ): void {
    const now = Date.now();
    
    // Evict old entries if cache is full
    while (this.searchCache.size >= this.config.cacheSize && this.cacheAccessOrder.length > 0) {
      const oldestKey = this.cacheAccessOrder.shift()!;
      this.searchCache.delete(oldestKey);
    }
    
    // Add new entry
    this.searchCache.set(cacheKey, {
      data: {
        results,
        timestamp: now,
        options
      },
      lastAccessed: now
    });
    
    // Update access order
    this.cacheAccessOrder.push(cacheKey);
  }

  /**
   * Update query frequency tracking
   */
  private updateQueryFrequency(query: string): void {
    const normalizedQuery = query.toLowerCase().trim();
    const currentCount = this.queryFrequency.get(normalizedQuery) || 0;
    this.queryFrequency.set(normalizedQuery, currentCount + 1);
  }

  /**
   * Update latency statistics
   */
  private updateLatencyStats(latency: number): void {
    this.latencyHistory.push(latency);
    
    // Keep only recent latency measurements (last 100)
    if (this.latencyHistory.length > 100) {
      this.latencyHistory.shift();
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.searchCache.clear();
    this.cacheAccessOrder.length = 0;
    this.outputChannel.dispose();
  }
}

/**
 * Default search configuration
 */
export const defaultSearchConfig: SearchConfig = {
  defaultTopK: 10,
  defaultThreshold: 0.3,
  maxResults: 50,
  cacheSize: 1000,
  cacheTTL: 300000, // 5 minutes
  searchTimeout: 5000, // 5 seconds
  queryExpansion: true,
  contextSnippets: true
}; 