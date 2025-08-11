---
id: 15
title: 'Add search history and bookmarks'
status: inprogress
priority: medium
feature: Enhanced Search & UI
dependencies:
  - 14
assigned_agent: agent
created_at: "2025-08-04T07:42:57Z"
started_at: "2025-08-08T07:45:55Z"
completed_at: null
error_log: null
---

## Description

Implement a comprehensive search history and bookmarks system that allows users to track, revisit, and organize their semantic search queries and results, enhancing productivity through persistent search context and quick access to important code discoveries.

## Details

### Core Functionality Requirements
- **Search History Tracking**: Automatic logging of all search queries and results
- **Smart Bookmarks**: Save and organize important search results with metadata
- **Query Suggestions**: Auto-complete based on search history
- **Result Collections**: Group related searches and bookmarks into collections
- **History Analytics**: Insights into search patterns and frequently accessed code
- **Cross-Session Persistence**: Maintain history and bookmarks across VSCode sessions
- **Export/Import**: Backup and share search history and bookmarks

### Implementation Steps
1. **History Storage Architecture**
   - Create persistent storage system for search data
   - Implement search history data models and schemas
   - Set up bookmarks management with metadata
   - Add collection and tagging system

2. **History Tracking Logic**
   - Automatic search query and result logging
   - Smart deduplication and history optimization
   - User interaction tracking and analytics
   - Search session management and context preservation

3. **User Interface Integration**
   - History panel integration with search results
   - Bookmark management interface
   - Quick access toolbar and shortcuts
   - Search suggestions and auto-completion

### Search History Interface
```typescript
interface SearchHistoryManager {
  recordSearch(query: string, results: RankedSearchResult[], context: SearchContext): Promise<SearchHistoryEntry>;
  getSearchHistory(options?: HistoryQueryOptions): Promise<SearchHistoryEntry[]>;
  createBookmark(result: RankedSearchResult, metadata: BookmarkMetadata): Promise<Bookmark>;
  getBookmarks(filters?: BookmarkFilters): Promise<Bookmark[]>;
  createCollection(name: string, description?: string): Promise<SearchCollection>;
  exportHistory(format: ExportFormat, options?: ExportOptions): Promise<string>;
}

interface SearchHistoryEntry {
  id: string;
  query: string;
  timestamp: Date;
  resultCount: number;
  searchDuration: number;
  context: SearchContext;
  topResults: SearchResultSummary[];
  userInteractions: UserInteraction[];
  sessionId: string;
}

interface Bookmark {
  id: string;
  resultId: string;
  title: string;
  description?: string;
  tags: string[];
  collectionId?: string;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  result: RankedSearchResult;
  metadata: BookmarkMetadata;
}

interface SearchCollection {
  id: string;
  name: string;
  description?: string;
  color?: string;
  bookmarks: string[];
  searches: string[];
  createdAt: Date;
  updatedAt: Date;
  isShared: boolean;
}
```

### Search History Storage Implementation
```typescript
class SearchHistoryManager {
  private storage: HistoryStorage;
  private indexer: HistoryIndexer;
  private analytics: SearchAnalytics;
  
  constructor(context: vscode.ExtensionContext) {
    this.storage = new HistoryStorage(context.globalStoragePath);
    this.indexer = new HistoryIndexer();
    this.analytics = new SearchAnalytics();
  }
  
  async recordSearch(
    query: string, 
    results: RankedSearchResult[], 
    context: SearchContext
  ): Promise<SearchHistoryEntry> {
    
    // Check for duplicate recent searches
    const isDuplicate = await this.checkForDuplicate(query, context);
    if (isDuplicate) {
      return this.updateExistingEntry(query, results, context);
    }
    
    // Create new history entry
    const historyEntry: SearchHistoryEntry = {
      id: this.generateEntryId(),
      query: this.normalizeQuery(query),
      timestamp: new Date(),
      resultCount: results.length,
      searchDuration: context.searchDuration || 0,
      context: this.sanitizeContext(context),
      topResults: this.summarizeResults(results.slice(0, 5)),
      userInteractions: [],
      sessionId: this.getCurrentSessionId()
    };
    
    // Store and index the entry
    await this.storage.storeHistoryEntry(historyEntry);
    await this.indexer.indexEntry(historyEntry);
    
    // Update analytics
    this.analytics.recordSearch(historyEntry);
    
    // Clean up old entries if needed
    await this.cleanupOldEntries();
    
    return historyEntry;
  }
  
  async getSearchHistory(options: HistoryQueryOptions = {}): Promise<SearchHistoryEntry[]> {
    const filters = this.buildHistoryFilters(options);
    const entries = await this.storage.queryHistory(filters);
    
    // Apply sorting and pagination
    const sortedEntries = this.sortHistoryEntries(entries, options.sortBy);
    return this.paginateResults(sortedEntries, options.page, options.pageSize);
  }
  
  async createBookmark(
    result: RankedSearchResult, 
    metadata: BookmarkMetadata
  ): Promise<Bookmark> {
    
    const bookmark: Bookmark = {
      id: this.generateBookmarkId(),
      resultId: result.chunkId,
      title: metadata.title || this.generateBookmarkTitle(result),
      description: metadata.description,
      tags: metadata.tags || [],
      collectionId: metadata.collectionId,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0,
      result: this.sanitizeResult(result),
      metadata: metadata
    };
    
    // Store bookmark
    await this.storage.storeBookmark(bookmark);
    await this.indexer.indexBookmark(bookmark);
    
    // Update collection if specified
    if (bookmark.collectionId) {
      await this.addBookmarkToCollection(bookmark.id, bookmark.collectionId);
    }
    
    return bookmark;
  }
  
  private async checkForDuplicate(
    query: string, 
    context: SearchContext
  ): Promise<boolean> {
    
    const recentEntries = await this.storage.getRecentEntries(10);
    const normalizedQuery = this.normalizeQuery(query);
    
    return recentEntries.some(entry => {
      const queryMatch = entry.query === normalizedQuery;
      const timeMatch = (Date.now() - entry.timestamp.getTime()) < 30000; // 30 seconds
      const contextMatch = this.isContextSimilar(entry.context, context);
      
      return queryMatch && timeMatch && contextMatch;
    });
  }
  
  private summarizeResults(results: RankedSearchResult[]): SearchResultSummary[] {
    return results.map(result => ({
      resultId: result.chunkId,
      filePath: result.filePath,
      startLine: result.startLine,
      similarity: result.similarity,
      finalScore: result.finalScore,
      functionName: result.metadata.functionName,
      preview: result.content.substring(0, 200)
    }));
  }
}
```

### Bookmark Management System
```typescript
class BookmarkManager {
  private storage: HistoryStorage;
  private collections: Map<string, SearchCollection>;
  
  constructor(storage: HistoryStorage) {
    this.storage = storage;
    this.collections = new Map();
    this.loadCollections();
  }
  
  async createCollection(name: string, description?: string): Promise<SearchCollection> {
    const collection: SearchCollection = {
      id: this.generateCollectionId(),
      name: name.trim(),
      description: description?.trim(),
      color: this.generateCollectionColor(),
      bookmarks: [],
      searches: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isShared: false
    };
    
    await this.storage.storeCollection(collection);
    this.collections.set(collection.id, collection);
    
    return collection;
  }
  
  async addBookmarkToCollection(
    bookmarkId: string, 
    collectionId: string
  ): Promise<void> {
    
    const collection = this.collections.get(collectionId);
    if (!collection) {
      throw new Error(`Collection not found: ${collectionId}`);
    }
    
    if (!collection.bookmarks.includes(bookmarkId)) {
      collection.bookmarks.push(bookmarkId);
      collection.updatedAt = new Date();
      
      await this.storage.updateCollection(collection);
      this.collections.set(collectionId, collection);
    }
  }
  
  async organizeBookmarks(
    bookmarkIds: string[], 
    organizationStrategy: OrganizationStrategy
  ): Promise<SearchCollection[]> {
    
    const bookmarks = await this.storage.getBookmarksByIds(bookmarkIds);
    
    switch (organizationStrategy) {
      case 'by-file':
        return this.organizeByFile(bookmarks);
      case 'by-function':
        return this.organizeByFunction(bookmarks);
      case 'by-date':
        return this.organizeByDate(bookmarks);
      case 'by-tags':
        return this.organizeByTags(bookmarks);
      default:
        throw new Error(`Unknown organization strategy: ${organizationStrategy}`);
    }
  }
  
  private async organizeByFile(bookmarks: Bookmark[]): Promise<SearchCollection[]> {
    const fileGroups = new Map<string, Bookmark[]>();
    
    bookmarks.forEach(bookmark => {
      const filePath = bookmark.result.filePath;
      if (!fileGroups.has(filePath)) {
        fileGroups.set(filePath, []);
      }
      fileGroups.get(filePath)!.push(bookmark);
    });
    
    const collections: SearchCollection[] = [];
    for (const [filePath, bookmarkGroup] of fileGroups) {
      const fileName = path.basename(filePath);
      const collection = await this.createCollection(
        `Bookmarks: ${fileName}`,
        `Auto-generated collection for bookmarks in ${filePath}`
      );
      
      // Add bookmarks to collection
      for (const bookmark of bookmarkGroup) {
        await this.addBookmarkToCollection(bookmark.id, collection.id);
      }
      
      collections.push(collection);
    }
    
    return collections;
  }
}
```

### Search Suggestions and Auto-completion
```typescript
class SearchSuggestionEngine {
  private historyManager: SearchHistoryManager;
  private suggestionCache: Map<string, SearchSuggestion[]>;
  
  constructor(historyManager: SearchHistoryManager) {
    this.historyManager = historyManager;
    this.suggestionCache = new Map();
  }
  
  async getSuggestions(
    partialQuery: string, 
    context: SearchContext
  ): Promise<SearchSuggestion[]> {
    
    const cacheKey = this.generateCacheKey(partialQuery, context);
    if (this.suggestionCache.has(cacheKey)) {
      return this.suggestionCache.get(cacheKey)!;
    }
    
    const suggestions = await this.generateSuggestions(partialQuery, context);
    this.suggestionCache.set(cacheKey, suggestions);
    
    return suggestions;
  }
  
  private async generateSuggestions(
    partialQuery: string, 
    context: SearchContext
  ): Promise<SearchSuggestion[]> {
    
    const suggestions: SearchSuggestion[] = [];
    
    // Get recent and frequent queries
    const recentQueries = await this.getRecentQueries(partialQuery);
    const frequentQueries = await this.getFrequentQueries(partialQuery);
    
    // Add context-based suggestions
    const contextSuggestions = await this.getContextSuggestions(partialQuery, context);
    
    // Add pattern-based suggestions
    const patternSuggestions = this.generatePatternSuggestions(partialQuery);
    
    // Combine and rank suggestions
    suggestions.push(
      ...recentQueries,
      ...frequentQueries,
      ...contextSuggestions,
      ...patternSuggestions
    );
    
    return this.rankSuggestions(suggestions, partialQuery, context);
  }
  
  private async getRecentQueries(partialQuery: string): Promise<SearchSuggestion[]> {
    const recentHistory = await this.historyManager.getSearchHistory({
      sortBy: 'timestamp',
      limit: 50
    });
    
    return recentHistory
      .filter(entry => entry.query.toLowerCase().includes(partialQuery.toLowerCase()))
      .map(entry => ({
        type: 'recent',
        query: entry.query,
        description: `Recent search - ${entry.resultCount} results`,
        score: this.calculateRecencyScore(entry.timestamp),
        metadata: {
          lastUsed: entry.timestamp,
          resultCount: entry.resultCount,
          userInteractions: entry.userInteractions.length
        }
      }));
  }
  
  private async getContextSuggestions(
    partialQuery: string, 
    context: SearchContext
  ): Promise<SearchSuggestion[]> {
    
    const suggestions: SearchSuggestion[] = [];
    
    // File-based suggestions
    if (context.currentFile) {
      suggestions.push({
        type: 'context',
        query: `${partialQuery} in:${path.basename(context.currentFile)}`,
        description: `Search in current file`,
        score: 0.8,
        metadata: { contextType: 'file', contextValue: context.currentFile }
      });
    }
    
    // Function-based suggestions
    if (context.currentFunction) {
      suggestions.push({
        type: 'context',
        query: `${partialQuery} function:${context.currentFunction}`,
        description: `Search in current function`,
        score: 0.7,
        metadata: { contextType: 'function', contextValue: context.currentFunction }
      });
    }
    
    return suggestions;
  }
  
  private generatePatternSuggestions(partialQuery: string): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];
    const commonPatterns = [
      'where is',
      'how to',
      'what does',
      'find all',
      'error handling',
      'initialization',
      'constructor',
      'destructor',
      'memory management',
      'thread safety'
    ];
    
    commonPatterns.forEach(pattern => {
      if (pattern.toLowerCase().includes(partialQuery.toLowerCase()) ||
          partialQuery.toLowerCase().includes(pattern.toLowerCase())) {
        suggestions.push({
          type: 'pattern',
          query: pattern,
          description: `Common search pattern`,
          score: 0.5,
          metadata: { pattern: pattern }
        });
      }
    });
    
    return suggestions;
  }
}
```

### History Analytics and Insights
```typescript
class SearchAnalytics {
  private historyManager: SearchHistoryManager;
  private metricsStorage: MetricsStorage;
  
  constructor(historyManager: SearchHistoryManager) {
    this.historyManager = historyManager;
    this.metricsStorage = new MetricsStorage();
  }
  
  async generateInsights(timeRange: TimeRange): Promise<SearchInsights> {
    const history = await this.historyManager.getSearchHistory({
      startDate: timeRange.start,
      endDate: timeRange.end
    });
    
    return {
      searchFrequency: this.analyzeSearchFrequency(history),
      popularQueries: this.analyzePopularQueries(history),
      codeHotspots: this.analyzeCodeHotspots(history),
      searchPatterns: this.analyzeSearchPatterns(history),
      productivityMetrics: this.calculateProductivityMetrics(history),
      recommendations: this.generateRecommendations(history)
    };
  }
  
  private analyzeSearchFrequency(history: SearchHistoryEntry[]): SearchFrequencyAnalysis {
    const dailySearches = new Map<string, number>();
    const hourlyDistribution = new Array(24).fill(0);
    
    history.forEach(entry => {
      const date = entry.timestamp.toISOString().split('T')[0];
      const hour = entry.timestamp.getHours();
      
      dailySearches.set(date, (dailySearches.get(date) || 0) + 1);
      hourlyDistribution[hour]++;
    });
    
    return {
      dailySearches: Array.from(dailySearches.entries()),
      hourlyDistribution,
      averageSearchesPerDay: this.calculateAverage(Array.from(dailySearches.values())),
      peakSearchHours: this.findPeakHours(hourlyDistribution)
    };
  }
  
  private analyzeCodeHotspots(history: SearchHistoryEntry[]): CodeHotspot[] {
    const fileAccess = new Map<string, number>();
    const functionAccess = new Map<string, number>();
    
    history.forEach(entry => {
      entry.topResults.forEach(result => {
        // Count file access
        fileAccess.set(result.filePath, (fileAccess.get(result.filePath) || 0) + 1);
        
        // Count function access
        if (result.functionName) {
          functionAccess.set(result.functionName, (functionAccess.get(result.functionName) || 0) + 1);
        }
      });
    });
    
    const hotspots: CodeHotspot[] = [];
    
    // Add file hotspots
    Array.from(fileAccess.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([filePath, accessCount]) => {
        hotspots.push({
          type: 'file',
          location: filePath,
          accessCount,
          relativePath: this.getRelativePath(filePath),
          lastAccessed: this.findLastAccess(filePath, history)
        });
      });
    
    return hotspots;
  }
}
```

## Testing Strategy

### Unit Tests
- [ ] Search history recording and retrieval
- [ ] Bookmark creation and management
- [ ] Collection organization and grouping
- [ ] Search suggestion generation algorithms
- [ ] History analytics and insights calculation
- [ ] Export/import functionality validation

### Integration Tests
- [ ] End-to-end history tracking workflow
- [ ] Cross-session persistence validation
- [ ] UI integration with search results panel
- [ ] Auto-completion integration with search input
- [ ] Bookmark navigation and result restoration
- [ ] Collection management and sharing workflow

### Performance Tests
- [ ] History storage and retrieval performance with large datasets
- [ ] Search suggestion generation latency (target: <100ms)
- [ ] Analytics calculation performance for extensive history
- [ ] Memory usage with large history and bookmark collections
- [ ] Concurrent history operations handling

## Acceptance Criteria

### Primary Requirements
- [ ] Search history automatically tracked and stored persistently
- [ ] Bookmark system operational with metadata and organization
- [ ] Search suggestions and auto-completion functional
- [ ] Collections system for organizing bookmarks and searches
- [ ] History analytics and insights generation working
- [ ] Export/import functionality supports multiple formats
- [ ] Cross-session persistence maintained correctly

### Performance Requirements
- [ ] History recording overhead < 10ms per search
- [ ] Bookmark creation and access < 50ms response time
- [ ] Search suggestions generation < 100ms for typical queries
- [ ] History panel loading < 500ms for typical datasets
- [ ] Analytics generation < 2 seconds for month of data

### User Experience Requirements
- [ ] Intuitive history and bookmark management interface
- [ ] Seamless integration with existing search workflow
- [ ] Clear visual organization of history and collections
- [ ] Efficient keyboard shortcuts and quick access features
- [ ] Helpful search suggestions based on context and history

## Data Schema and Storage
```typescript
interface HistoryStorageSchema {
  searches: {
    version: number;
    entries: SearchHistoryEntry[];
    metadata: HistoryMetadata;
  };
  bookmarks: {
    version: number;
    bookmarks: Bookmark[];
    collections: SearchCollection[];
    metadata: BookmarkMetadata;
  };
  analytics: {
    version: number;
    metrics: SearchMetrics[];
    insights: SearchInsights[];
    metadata: AnalyticsMetadata;
  };
}

interface StorageConfig {
  maxHistoryEntries: number;        // 1000 default
  maxBookmarks: number;             // 500 default
  historyRetentionDays: number;     // 90 default
  analyticsRetentionDays: number;   // 365 default
  autoCleanupEnabled: boolean;      // true default
  compressionEnabled: boolean;      // true default
}
```

## Success Metrics
- History usage adoption: >60% of users actively use search history
- Bookmark creation rate: >20% of searches result in bookmarks
- Search suggestion utilization: >40% of searches use auto-completion
- Time savings: >30% reduction in repeat search time
- Collection organization: >50% of bookmarks organized into collections

## Definition of Done
- [ ] SearchHistoryManager class implemented and tested
- [ ] Persistent storage system operational across sessions
- [ ] Bookmark and collection management functional
- [ ] Search suggestions and auto-completion integrated
- [ ] History analytics and insights generation complete
- [ ] Export/import functionality supports multiple formats
- [ ] Comprehensive error handling implemented
- [ ] Performance optimization features active
- [ ] Documentation and usage examples complete

## Next Steps
Upon completion, this task enables:
- **Complete Phase 2**: Enhanced Search & UI phase fully implemented
- **User Productivity**: Comprehensive search workflow with persistent context
- **Extension Maturity**: Professional-grade semantic search solution
- **Future Features**: Foundation for advanced analytics and team collaboration

## Notes
- Ensure privacy compliance with history data storage
- Plan for future team collaboration features with shared collections
- Consider implementing search pattern recognition for advanced suggestions
- Document data migration strategies for future schema updates
- Prepare for cloud synchronization capabilities in future versions 