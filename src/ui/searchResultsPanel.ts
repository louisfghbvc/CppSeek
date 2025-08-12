/**
 * Search Results Panel
 * 
 * Implements a comprehensive search result presentation system with rich previews,
 * syntax highlighting, interactive navigation, and result organization capabilities
 * within VSCode webview interface.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { RankedSearchResult } from '../services/searchResultRanker';
import { CodeSyntaxHighlighter, SyntaxToken } from './codeSyntaxHighlighter';
import { ResultNavigationHandler } from './resultNavigationHandler';
import { ResultsExporter, ExportFormat, ExportOptions } from './resultsExporter';
import { SearchHistoryManager } from '../services/history/searchHistoryManager';

export interface ResultsDisplayState {
  groupBy: 'file' | 'relevance' | 'type' | 'none';
  sortBy: 'rank' | 'file' | 'recency' | 'similarity';
  showContext: boolean;
  contextLines: number;
  highlightMatches: boolean;
  compactView: boolean;
  expandedResults: Set<string>;
}

export interface SearchResultItem {
  result: RankedSearchResult;
  isExpanded: boolean;
  contextLines: CodeLine[];
  syntaxHighlighting: SyntaxToken[];
  navigationTarget: NavigationTarget;
  displayIndex: number;
}

export interface CodeLine {
  lineNumber: number;
  content: string;
  isMatch: boolean;
  highlightRanges: TextRange[];
}

export interface NavigationTarget {
  file: string;
  line: number;
  column: number;
}

export interface TextRange {
  start: number;
  end: number;
}

export interface OrganizedResults {
  groups: ResultGroup[];
  totalResults: number;
  metadata: {
    groupBy: string;
    sortBy: string;
    searchTime?: number;
    qualityScore?: number;
  };
}

export interface ResultGroup {
  title: string;
  description?: string;
  items: SearchResultItem[];
  isCollapsed: boolean;
  metadata?: {
    fileCount?: number;
    averageScore?: number;
    resultType?: string;
  };
}

export interface SearchResultsHeader {
  queryDisplay: string;
  resultsCount: number;
  searchTime: number;
  qualityIndicator: 'excellent' | 'good' | 'fair' | 'poor';
  rankingEnabled: boolean;
}

/**
 * Main search results panel with webview-based interface
 */
export class SearchResultsPanel {
  private webviewPanel: vscode.WebviewPanel | undefined;
  private resultsData: RankedSearchResult[] = [];
  private displayState: ResultsDisplayState;
  private syntaxHighlighter: CodeSyntaxHighlighter;
  private navigationHandler: ResultNavigationHandler;
  private exporter: ResultsExporter;
  private context: vscode.ExtensionContext;
  private outputChannel: vscode.OutputChannel;
  private historyManager?: SearchHistoryManager;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.syntaxHighlighter = new CodeSyntaxHighlighter();
    this.navigationHandler = new ResultNavigationHandler();
    this.exporter = new ResultsExporter();
    this.outputChannel = vscode.window.createOutputChannel('CppSeek Search Results Panel');
    
    this.displayState = {
      groupBy: 'relevance',
      sortBy: 'rank',
      showContext: true,
      contextLines: 3,
      highlightMatches: true,
      compactView: false,
      expandedResults: new Set<string>()
    };

    this.outputChannel.appendLine('🎨 SearchResultsPanel initialized');
  }

  // Enable history integration for bookmarking
  enableHistory(historyManager: SearchHistoryManager): void {
    this.historyManager = historyManager;
  }

  /**
   * Display search results in the webview panel
   */
  async displayResults(
    results: RankedSearchResult[], 
    query: string,
    searchMetadata?: { searchTime: number; rankingEnabled: boolean; }
  ): Promise<void> {
    try {
      this.resultsData = results;
      const startTime = Date.now();

      this.outputChannel.appendLine(`🔍 Displaying ${results.length} search results for query: "${query}"`);

      // Create or reveal webview panel
      if (!this.webviewPanel) {
        this.webviewPanel = this.createWebviewPanel();
      } else {
        this.webviewPanel.reveal();
      }

      // Prepare results for display
      const displayItems = await this.prepareDisplayItems(results, query);
      
      // Organize results based on current display state
      const organizedResults = this.organizeResults(displayItems);
      
      // Generate search header information
      const header = this.generateSearchHeader(query, results, searchMetadata);
      
      // Generate HTML content for the webview
      const htmlContent = this.generateResultsHTML(organizedResults, header, query);
      
      // Update webview content
      this.webviewPanel.webview.html = htmlContent;
      
      // Setup result interaction handlers
      this.setupResultHandlers(displayItems);

      const displayTime = Date.now() - startTime;
      this.outputChannel.appendLine(`✅ Results displayed in ${displayTime}ms`);

    } catch (error) {
      this.outputChannel.appendLine(`❌ Failed to display results: ${error}`);
      vscode.window.showErrorMessage(`Failed to display search results: ${error}`);
      throw error;
    }
  }

  /**
   * Update the display state and refresh the view
   */
  async updateDisplayState(newState: Partial<ResultsDisplayState>): Promise<void> {
    this.displayState = { ...this.displayState, ...newState };
    
    if (this.resultsData.length > 0) {
      // Re-display with current results but new state
      await this.displayResults(this.resultsData, this.displayState.groupBy); // Use groupBy as placeholder query
    }
  }

  /**
   * Export current results in specified format
   */
  async exportResults(format: ExportFormat, options?: Partial<ExportOptions>): Promise<void> {
    try {
      const exportOptions: ExportOptions = {
        query: 'Search Results', // Would be actual query in real usage
        includeContent: true,
        includeRankingFactors: true,
        includeMetadata: true,
        ...options
      };

      const exportedContent = await this.exporter.exportResults(
        this.resultsData,
        format,
        exportOptions
      );

      // Save to file or show in new document
      await this.handleExportedContent(exportedContent.content, format);

      this.outputChannel.appendLine(`📤 Exported ${this.resultsData.length} results to ${format} format`);

    } catch (error) {
      this.outputChannel.appendLine(`❌ Export failed: ${error}`);
      vscode.window.showErrorMessage(`Failed to export results: ${error}`);
    }
  }

  /**
   * Navigate to a specific search result
   */
  async navigateToResult(result: RankedSearchResult): Promise<void> {
    await this.navigationHandler.navigateToResult(result);
  }

  /**
   * Create the webview panel
   */
  private createWebviewPanel(): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      'cppseekSearchResults',
      'CppSeek Search Results',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'resources'),
          vscode.Uri.joinPath(this.context.extensionUri, 'out')
        ]
      }
    );

    // Handle panel disposal
    panel.onDidDispose(() => {
      this.webviewPanel = undefined;
    });

    return panel;
  }

  /**
   * Prepare search results for display
   */
  private async prepareDisplayItems(
    results: RankedSearchResult[],
    query: string
  ): Promise<SearchResultItem[]> {
    const startTime = Date.now();

    const items = await Promise.all(
      results.map(async (result, index) => {
        try {
          // Get code context around the result
          const contextLines = await this.getCodeContext(result);
          
          // Apply syntax highlighting
          const syntaxHighlighting = await this.syntaxHighlighter.highlight(
            result.content,
            result.filePath
          );
          
          // Highlight search matches in context
          const highlightedContext = this.highlightMatches(contextLines, query);
          
          return {
            result,
            isExpanded: this.displayState.expandedResults.has(result.id),
            contextLines: highlightedContext,
            syntaxHighlighting,
            navigationTarget: {
              file: result.filePath,
              line: result.startLine,
              column: 0
            },
            displayIndex: index
          } as SearchResultItem;

        } catch (error) {
          this.outputChannel.appendLine(`⚠️ Failed to prepare result ${result.id}: ${error}`);
          
          // Return basic item without enhanced features
          return {
            result,
            isExpanded: false,
            contextLines: [{
              lineNumber: result.startLine,
              content: result.content,
              isMatch: true,
              highlightRanges: []
            }],
            syntaxHighlighting: [],
            navigationTarget: {
              file: result.filePath,
              line: result.startLine,
              column: 0
            },
            displayIndex: index
          } as SearchResultItem;
        }
      })
    );

    const prepTime = Date.now() - startTime;
    this.outputChannel.appendLine(`📋 Prepared ${items.length} display items in ${prepTime}ms`);

    return items;
  }

  /**
   * Get code context around a search result
   */
  private async getCodeContext(result: RankedSearchResult): Promise<CodeLine[]> {
    try {
      const document = await vscode.workspace.openTextDocument(result.filePath);
      const lines: CodeLine[] = [];
      
      const startLine = Math.max(0, result.startLine - this.displayState.contextLines - 1);
      const endLine = Math.min(
        document.lineCount - 1, 
        result.endLine + this.displayState.contextLines - 1
      );

      for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
        const textLine = document.lineAt(lineNum);
        const isMatch = lineNum >= result.startLine - 1 && lineNum <= result.endLine - 1;
        
        lines.push({
          lineNumber: lineNum + 1,
          content: textLine.text,
          isMatch,
          highlightRanges: [] // Will be populated by highlightMatches
        });
      }

      return lines;

    } catch (error) {
      // Fallback to result content only
      return [{
        lineNumber: result.startLine,
        content: result.content,
        isMatch: true,
        highlightRanges: []
      }];
    }
  }

  /**
   * Highlight search matches in code lines
   */
  private highlightMatches(contextLines: CodeLine[], query: string): CodeLine[] {
    if (!this.displayState.highlightMatches || !query) {
      return contextLines;
    }

    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    
    return contextLines.map(line => {
      const highlightRanges: TextRange[] = [];
      const lowerContent = line.content.toLowerCase();

      queryWords.forEach(word => {
        let index = 0;
        while ((index = lowerContent.indexOf(word, index)) !== -1) {
          highlightRanges.push({
            start: index,
            end: index + word.length
          });
          index += word.length;
        }
      });

      return {
        ...line,
        highlightRanges: highlightRanges.sort((a, b) => a.start - b.start)
      };
    });
  }

  /**
   * Organize results based on display state
   */
  private organizeResults(items: SearchResultItem[]): OrganizedResults {
    const { groupBy, sortBy } = this.displayState;

    // First sort the items
    const sortedItems = this.sortResults([...items], sortBy);

    // Then group them
    const groups = this.groupResults(sortedItems, groupBy);

    return {
      groups,
      totalResults: items.length,
      metadata: {
        groupBy,
        sortBy,
        searchTime: 0, // Would be provided from search metadata
        qualityScore: this.calculateQualityScore(items)
      }
    };
  }

  /**
   * Sort results based on sort criteria
   */
  private sortResults(items: SearchResultItem[], sortBy: string): SearchResultItem[] {
    switch (sortBy) {
      case 'rank':
        return items.sort((a, b) => a.result.rankPosition - b.result.rankPosition);
      
      case 'file':
        return items.sort((a, b) => a.result.filePath.localeCompare(b.result.filePath));
      
      case 'recency':
        return items.sort((a, b) => 
          (b.result.rankingFactors?.recencyScore || 0) - (a.result.rankingFactors?.recencyScore || 0)
        );
      
      case 'similarity':
        return items.sort((a, b) => b.result.similarity - a.result.similarity);
      
      default:
        return items;
    }
  }

  /**
   * Group results based on grouping criteria
   */
  private groupResults(items: SearchResultItem[], groupBy: string): ResultGroup[] {
    switch (groupBy) {
      case 'file':
        return this.groupByFile(items);
      
      case 'type':
        return this.groupByType(items);
      
      case 'relevance':
        return this.groupByRelevance(items);
      
      case 'none':
      default:
        return [{
          title: 'All Results',
          items,
          isCollapsed: false,
          metadata: {
            resultType: 'mixed'
          }
        }];
    }
  }

  /**
   * Group results by file
   */
  private groupByFile(items: SearchResultItem[]): ResultGroup[] {
    const groups = new Map<string, SearchResultItem[]>();

    items.forEach(item => {
      const filePath = item.result.filePath;
      if (!groups.has(filePath)) {
        groups.set(filePath, []);
      }
      groups.get(filePath)!.push(item);
    });

    return Array.from(groups.entries()).map(([filePath, groupItems]) => ({
      title: path.basename(filePath),
      description: filePath,
      items: groupItems,
      isCollapsed: false,
      metadata: {
        fileCount: 1,
        averageScore: groupItems.reduce((sum, item) => sum + item.result.finalScore, 0) / groupItems.length
      }
    }));
  }

  /**
   * Group results by code type
   */
  private groupByType(items: SearchResultItem[]): ResultGroup[] {
    const groups: { [key: string]: SearchResultItem[] } = {
      classes: [],
      functions: [],
      namespaces: [],
      other: []
    };

    items.forEach(item => {
      const result = item.result;
      
      if (result.className) {
        groups.classes.push(item);
      } else if (result.functionName) {
        groups.functions.push(item);
      } else if (result.namespace) {
        groups.namespaces.push(item);
      } else {
        groups.other.push(item);
      }
    });

    return Object.entries(groups)
      .filter(([, groupItems]) => groupItems.length > 0)
      .map(([type, groupItems]) => ({
        title: type.charAt(0).toUpperCase() + type.slice(1),
        items: groupItems,
        isCollapsed: false,
        metadata: {
          resultType: type,
          averageScore: groupItems.reduce((sum, item) => sum + item.result.finalScore, 0) / groupItems.length
        }
      }));
  }

  /**
   * Group results by relevance score ranges
   */
  private groupByRelevance(items: SearchResultItem[]): ResultGroup[] {
    const groups: { [key: string]: SearchResultItem[] } = {
      excellent: [], // > 0.8
      good: [],      // 0.6 - 0.8
      fair: [],      // 0.4 - 0.6
      poor: []       // < 0.4
    };

    items.forEach(item => {
      const score = item.result.finalScore;
      
      if (score > 0.8) {
        groups.excellent.push(item);
      } else if (score > 0.6) {
        groups.good.push(item);
      } else if (score > 0.4) {
        groups.fair.push(item);
      } else {
        groups.poor.push(item);
      }
    });

    return Object.entries(groups)
      .filter(([, groupItems]) => groupItems.length > 0)
      .map(([relevance, groupItems]) => ({
        title: `${relevance.charAt(0).toUpperCase() + relevance.slice(1)} Matches`,
        items: groupItems,
        isCollapsed: relevance === 'poor', // Collapse poor matches by default
        metadata: {
          resultType: relevance,
          averageScore: groupItems.reduce((sum, item) => sum + item.result.finalScore, 0) / groupItems.length
        }
      }));
  }

  /**
   * Calculate overall quality score for the search results
   */
  private calculateQualityScore(items: SearchResultItem[]): number {
    if (items.length === 0) return 0;

    const averageScore = items.reduce((sum, item) => sum + item.result.finalScore, 0) / items.length;
    const scoreDistribution = this.calculateScoreDistribution(items);
    
    // Weight based on distribution - prefer results with good high-scoring items
    const qualityBonus = scoreDistribution.excellent * 0.4 + scoreDistribution.good * 0.2;
    
    return Math.min(1, averageScore + qualityBonus);
  }

  /**
   * Calculate score distribution for quality assessment
   */
  private calculateScoreDistribution(items: SearchResultItem[]): {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  } {
    const total = items.length;
    const distribution = { excellent: 0, good: 0, fair: 0, poor: 0 };

    items.forEach(item => {
      const score = item.result.finalScore;
      if (score > 0.8) distribution.excellent++;
      else if (score > 0.6) distribution.good++;
      else if (score > 0.4) distribution.fair++;
      else distribution.poor++;
    });

    return {
      excellent: distribution.excellent / total,
      good: distribution.good / total,
      fair: distribution.fair / total,
      poor: distribution.poor / total
    };
  }

  /**
   * Generate search header information
   */
  private generateSearchHeader(
    query: string,
    results: RankedSearchResult[],
    metadata?: { searchTime: number; rankingEnabled: boolean; }
  ): SearchResultsHeader {
    const qualityScore = this.calculateQualityScore(
      results.map((result, index) => ({
        result,
        isExpanded: false,
        contextLines: [],
        syntaxHighlighting: [],
        navigationTarget: { file: result.filePath, line: result.startLine, column: 0 },
        displayIndex: index
      }))
    );

    let qualityIndicator: 'excellent' | 'good' | 'fair' | 'poor';
    if (qualityScore > 0.8) qualityIndicator = 'excellent';
    else if (qualityScore > 0.6) qualityIndicator = 'good';
    else if (qualityScore > 0.4) qualityIndicator = 'fair';
    else qualityIndicator = 'poor';

    return {
      queryDisplay: query,
      resultsCount: results.length,
      searchTime: metadata?.searchTime || 0,
      qualityIndicator,
      rankingEnabled: metadata?.rankingEnabled || false
    };
  }

  /**
   * Generate HTML content for the webview
   */
  private generateResultsHTML(
    organizedResults: OrganizedResults,
    header: SearchResultsHeader,
    _query: string
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
        <title>CppSeek Search Results</title>
        <style>${this.getStylesheetContent()}</style>
      </head>
      <body>
        <div class="search-results-container">
          ${this.generateResultsHeader(header)}
          ${this.generateResultsToolbar()}
          ${this.generateResultsList(organizedResults)}
          ${this.generateResultsFooter(organizedResults)}
        </div>
        <script>${this.getJavaScriptContent()}</script>
      </body>
      </html>
    `;
  }

  /**
   * Generate results header HTML
   */
  private generateResultsHeader(header: SearchResultsHeader): string {
    const qualityIcon = {
      'excellent': '🟢',
      'good': '🔵', 
      'fair': '🟡',
      'poor': '🔴'
    }[header.qualityIndicator];

    return `
      <div class="results-header">
        <div class="query-info">
          <h2 class="query-display">"${this.escapeHtml(header.queryDisplay)}"</h2>
          <div class="search-metadata">
            <span class="results-count">${header.resultsCount} results</span>
            <span class="search-time">${header.searchTime}ms</span>
            <span class="quality-indicator" title="${header.qualityIndicator} quality">
              ${qualityIcon} ${header.qualityIndicator}
            </span>
            ${header.rankingEnabled ? '<span class="ranking-badge">🏆 Ranked</span>' : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generate results toolbar HTML
   */
  private generateResultsToolbar(): string {
    return `
      <div class="results-toolbar">
        <div class="toolbar-section">
          <label for="groupBy">Group by:</label>
          <select id="groupBy" onchange="updateDisplayState('groupBy', this.value)">
            <option value="relevance" ${this.displayState.groupBy === 'relevance' ? 'selected' : ''}>Relevance</option>
            <option value="file" ${this.displayState.groupBy === 'file' ? 'selected' : ''}>File</option>
            <option value="type" ${this.displayState.groupBy === 'type' ? 'selected' : ''}>Type</option>
            <option value="none" ${this.displayState.groupBy === 'none' ? 'selected' : ''}>None</option>
          </select>
        </div>
        
        <div class="toolbar-section">
          <label for="sortBy">Sort by:</label>
          <select id="sortBy" onchange="updateDisplayState('sortBy', this.value)">
            <option value="rank" ${this.displayState.sortBy === 'rank' ? 'selected' : ''}>Rank</option>
            <option value="file" ${this.displayState.sortBy === 'file' ? 'selected' : ''}>File</option>
            <option value="similarity" ${this.displayState.sortBy === 'similarity' ? 'selected' : ''}>Similarity</option>
            <option value="recency" ${this.displayState.sortBy === 'recency' ? 'selected' : ''}>Recency</option>
          </select>
        </div>

        <div class="toolbar-section">
          <label>
            <input type="checkbox" id="showContext" 
                   ${this.displayState.showContext ? 'checked' : ''}
                   onchange="updateDisplayState('showContext', this.checked)">
            Show Context
          </label>
        </div>

        <div class="toolbar-section">
          <label>
            <input type="checkbox" id="compactView" 
                   ${this.displayState.compactView ? 'checked' : ''}
                   onchange="updateDisplayState('compactView', this.checked)">
            Compact View
          </label>
        </div>

        <div class="toolbar-section">
          <button onclick="exportResults('markdown')" class="export-btn">Export MD</button>
          <button onclick="exportResults('json')" class="export-btn">Export JSON</button>
        </div>
      </div>
    `;
  }

  /**
   * Generate results list HTML
   */
  private generateResultsList(organizedResults: OrganizedResults): string {
    const groupsHtml = organizedResults.groups.map(group => 
      this.generateResultGroup(group)
    ).join('');

    return `
      <div class="results-list">
        ${groupsHtml}
      </div>
    `;
  }

  /**
   * Generate a result group HTML
   */
  private generateResultGroup(group: ResultGroup): string {
    const itemsHtml = group.items.map(item => 
      this.generateResultItem(item)
    ).join('');

    return `
      <div class="result-group ${group.isCollapsed ? 'collapsed' : ''}">
        <div class="group-header" onclick="toggleGroup(this)">
          <span class="group-title">${this.escapeHtml(group.title)}</span>
          ${group.description ? `<span class="group-description">${this.escapeHtml(group.description)}</span>` : ''}
          <span class="group-count">(${group.items.length})</span>
          <span class="group-toggle">${group.isCollapsed ? '▶' : '▼'}</span>
        </div>
        <div class="group-items">
          ${itemsHtml}
        </div>
      </div>
    `;
  }

  /**
   * Generate a single result item HTML
   */
  private generateResultItem(item: SearchResultItem): string {
    const result = item.result;
    const isCompact = this.displayState.compactView;
    
    const contextHtml = this.displayState.showContext && !isCompact ? 
      this.generateContextLines(item.contextLines) : '';

    const fileIcon = this.getFileIcon(result.filePath);
    const relevanceBar = this.generateRelevanceBar(result);

    return `
      <div class="result-item ${isCompact ? 'compact' : ''}" data-result-id="${result.id}">
        <div class="result-header" onclick="navigateToResult('${result.id}')">
          <span class="file-icon">${fileIcon}</span>
          <div class="result-info">
            <div class="result-title">
              ${result.functionName ? 
                `<span class="function-name">${this.escapeHtml(result.functionName)}</span>` : 
                '<span class="code-block">Code Block</span>'
              }
              ${result.className ? 
                `<span class="class-name">in ${this.escapeHtml(result.className)}</span>` : ''
              }
            </div>
            <div class="result-location">
              <span class="file-path">${this.escapeHtml(result.filePath)}</span>
              <span class="line-info">:${result.startLine}-${result.endLine}</span>
            </div>
          </div>
          <div class="result-scores">
            <div class="rank-position">#${result.rankPosition}</div>
            <div class="similarity-score">${(result.similarity * 100).toFixed(1)}%</div>
            ${relevanceBar}
          </div>
        </div>
        
        ${contextHtml}
        
        <div class="result-actions">
          <button onclick="toggleExpand('${result.id}')" class="action-btn">
            ${item.isExpanded ? 'Collapse' : 'Expand'}
          </button>
          <button onclick="copyResult('${result.id}')" class="action-btn">Copy</button>
          <button onclick="addBookmark('${result.id}')" class="action-btn">Bookmark</button>
        </div>
      </div>
    `;
  }

  /**
   * Generate context lines HTML
   */
  private generateContextLines(contextLines: CodeLine[]): string {
    const linesHtml = contextLines.map(line => {
      const highlightedContent = this.applyHighlights(line.content, line.highlightRanges);
      
      return `
        <div class="context-line ${line.isMatch ? 'match-line' : ''}">
          <span class="line-number">${line.lineNumber}</span>
          <span class="line-content">${highlightedContent}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="result-context">
        <pre class="context-code">${linesHtml}</pre>
      </div>
    `;
  }

  /**
   * Apply syntax highlighting to text with highlight ranges
   */
  private applyHighlights(text: string, ranges: TextRange[]): string {
    if (ranges.length === 0) {
      return this.escapeHtml(text);
    }

    let result = '';
    let lastIndex = 0;

    ranges.forEach(range => {
      // Add text before highlight
      result += this.escapeHtml(text.substring(lastIndex, range.start));
      
      // Add highlighted text
      result += `<mark class="search-highlight">${this.escapeHtml(text.substring(range.start, range.end))}</mark>`;
      
      lastIndex = range.end;
    });

    // Add remaining text
    result += this.escapeHtml(text.substring(lastIndex));

    return result;
  }

  /**
   * Generate relevance visualization bar
   */
  private generateRelevanceBar(result: RankedSearchResult): string {
    if (!result.rankingFactors) {
      return '';
    }

    const factors = result.rankingFactors;
    const totalHeight = 20;

    return `
      <div class="relevance-bar" title="Ranking Factors">
        <div class="factor semantic" style="height: ${factors.semanticSimilarity * totalHeight}px" title="Semantic: ${(factors.semanticSimilarity * 100).toFixed(1)}%"></div>
        <div class="factor structural" style="height: ${factors.structuralRelevance * totalHeight}px" title="Structural: ${(factors.structuralRelevance * 100).toFixed(1)}%"></div>
        <div class="factor recency" style="height: ${factors.recencyScore * totalHeight}px" title="Recency: ${(factors.recencyScore * 100).toFixed(1)}%"></div>
        <div class="factor user-pref" style="height: ${factors.userPreferenceScore * totalHeight}px" title="User Preference: ${(factors.userPreferenceScore * 100).toFixed(1)}%"></div>
      </div>
    `;
  }

  /**
   * Get file icon based on file extension
   */
  private getFileIcon(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.cpp':
      case '.cc':
      case '.cxx':
        return '🔵';
      case '.h':
      case '.hpp':
      case '.hxx':
        return '🟦';
      case '.c':
        return '🟨';
      default:
        return '📄';
    }
  }

  /**
   * Generate results footer HTML
   */
  private generateResultsFooter(organizedResults: OrganizedResults): string {
    return `
      <div class="results-footer">
        <div class="footer-info">
          Total: ${organizedResults.totalResults} results | 
          Quality: ${(organizedResults.metadata.qualityScore! * 100).toFixed(1)}%
        </div>
      </div>
    `;
  }

  /**
   * Setup result interaction handlers
   */
  private setupResultHandlers(items: SearchResultItem[]): void {
    if (!this.webviewPanel) return;

    this.webviewPanel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'navigateToResult':
            const result = items.find(item => item.result.id === message.resultId);
            if (result) {
              await this.navigateToResult(result.result);
            }
            break;

          case 'updateDisplayState':
            await this.updateDisplayState({ [message.key]: message.value });
            break;

          case 'exportResults':
            await this.exportResults(message.format);
            break;

          case 'toggleExpand':
            this.toggleResultExpansion(message.resultId);
            break;

          case 'copyResult':
            await this.copyResultToClipboard(message.resultId, items);
            break;

          case 'addBookmark':
            await this.addBookmark(message.resultId, items);
            break;
        }
      }
    );
  }

  /**
   * Toggle result expansion state
   */
  private toggleResultExpansion(resultId: string): void {
    if (this.displayState.expandedResults.has(resultId)) {
      this.displayState.expandedResults.delete(resultId);
    } else {
      this.displayState.expandedResults.add(resultId);
    }
  }

  /**
   * Copy result content to clipboard
   */
  private async copyResultToClipboard(resultId: string, items: SearchResultItem[]): Promise<void> {
    const item = items.find(item => item.result.id === resultId);
    if (!item) return;

    const result = item.result;
    const copyText = `// ${result.filePath}:${result.startLine}-${result.endLine}\n${result.content}`;
    
    await vscode.env.clipboard.writeText(copyText);
    vscode.window.showInformationMessage('Result copied to clipboard');
  }

  private async addBookmark(resultId: string, items: SearchResultItem[]): Promise<void> {
    if (!this.historyManager) {
      vscode.window.showWarningMessage('History system not available');
      return;
    }
    const item = items.find(i => i.result.id === resultId);
    if (!item) return;

    const title = await vscode.window.showInputBox({
      prompt: 'Bookmark title',
      value: item.result.functionName || 'Code Block'
    });
    if (title === undefined) return;

    await this.historyManager.createBookmark(item.result, { title });
    vscode.window.showInformationMessage('Bookmark created');
  }

  /**
   * Handle exported content
   */
  private async handleExportedContent(content: string, format: ExportFormat): Promise<void> {
    const document = await vscode.workspace.openTextDocument({
      content,
      language: format === 'markdown' ? 'markdown' : format === 'json' ? 'json' : 'text'
    });

    await vscode.window.showTextDocument(document);
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Get CSS stylesheet content
   */
  private getStylesheetContent(): string {
    return `
      body {
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        color: var(--vscode-foreground);
        background-color: var(--vscode-editor-background);
        margin: 0;
        padding: 16px;
      }

      .search-results-container {
        max-width: 100%;
      }

      /* Header Styles */
      .results-header {
        border-bottom: 1px solid var(--vscode-panel-border);
        padding-bottom: 16px;
        margin-bottom: 16px;
      }

      .query-display {
        margin: 0 0 8px 0;
        color: var(--vscode-textPreformat-foreground);
      }

      .search-metadata {
        display: flex;
        gap: 16px;
        font-size: 0.9em;
        color: var(--vscode-descriptionForeground);
      }

      .quality-indicator {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .ranking-badge {
        background-color: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 0.8em;
      }

      /* Toolbar Styles */
      .results-toolbar {
        display: flex;
        gap: 20px;
        align-items: center;
        padding: 12px;
        background-color: var(--vscode-panel-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 4px;
        margin-bottom: 16px;
      }

      .toolbar-section {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .toolbar-section label {
        font-size: 0.9em;
        color: var(--vscode-descriptionForeground);
      }

      .toolbar-section select, .export-btn {
        background-color: var(--vscode-dropdown-background);
        border: 1px solid var(--vscode-dropdown-border);
        color: var(--vscode-dropdown-foreground);
        padding: 4px 8px;
        border-radius: 3px;
      }

      .export-btn {
        cursor: pointer;
        font-size: 0.8em;
      }

      .export-btn:hover {
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
      }

      /* Results List Styles */
      .results-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .result-group {
        border: 1px solid var(--vscode-panel-border);
        border-radius: 6px;
        overflow: hidden;
      }

      .group-header {
        background-color: var(--vscode-list-hoverBackground);
        padding: 12px 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        border-bottom: 1px solid var(--vscode-panel-border);
      }

      .group-title {
        font-weight: bold;
        flex: 1;
      }

      .group-description {
        color: var(--vscode-descriptionForeground);
        font-size: 0.9em;
      }

      .group-count {
        color: var(--vscode-descriptionForeground);
        font-size: 0.8em;
      }

      .group-toggle {
        font-size: 0.8em;
      }

      .result-group.collapsed .group-items {
        display: none;
      }

      .group-items {
        display: flex;
        flex-direction: column;
      }

      /* Result Item Styles */
      .result-item {
        border-bottom: 1px solid var(--vscode-panel-border);
        transition: background-color 0.2s;
      }

      .result-item:last-child {
        border-bottom: none;
      }

      .result-item:hover {
        background-color: var(--vscode-list-hoverBackground);
      }

      .result-header {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        cursor: pointer;
        gap: 12px;
      }

      .file-icon {
        font-size: 1.2em;
      }

      .result-info {
        flex: 1;
        min-width: 0;
      }

      .result-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
      }

      .function-name {
        font-weight: bold;
        color: var(--vscode-symbolIcon-functionForeground, #DCDCAA);
      }

      .class-name {
        color: var(--vscode-symbolIcon-classForeground, #4EC9B0);
        font-size: 0.9em;
      }

      .code-block {
        color: var(--vscode-descriptionForeground);
        font-style: italic;
      }

      .result-location {
        font-size: 0.85em;
        color: var(--vscode-descriptionForeground);
        font-family: var(--vscode-editor-font-family);
      }

      .file-path {
        word-break: break-all;
      }

      .line-info {
        color: var(--vscode-textPreformat-foreground);
      }

      .result-scores {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .rank-position {
        background-color: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 0.8em;
        font-weight: bold;
      }

      .similarity-score {
        font-size: 0.9em;
        color: var(--vscode-charts-blue);
        font-weight: bold;
      }

      /* Relevance Bar */
      .relevance-bar {
        display: flex;
        align-items: end;
        gap: 2px;
        height: 20px;
      }

      .factor {
        width: 4px;
        border-radius: 2px 2px 0 0;
      }

      .factor.semantic { background-color: var(--vscode-charts-blue); }
      .factor.structural { background-color: var(--vscode-charts-green); }
      .factor.recency { background-color: var(--vscode-charts-orange); }
      .factor.user-pref { background-color: var(--vscode-charts-purple); }

      /* Context Styles */
      .result-context {
        padding: 0 16px 12px 16px;
      }

      .context-code {
        background-color: var(--vscode-textBlockQuote-background);
        border: 1px solid var(--vscode-textBlockQuote-border);
        border-radius: 4px;
        padding: 12px;
        font-family: var(--vscode-editor-font-family);
        font-size: 0.9em;
        overflow-x: auto;
        margin: 0;
      }

      .context-line {
        display: flex;
        gap: 12px;
        line-height: 1.4;
      }

      .line-number {
        color: var(--vscode-editorLineNumber-foreground);
        min-width: 3em;
        text-align: right;
        user-select: none;
      }

      .line-content {
        flex: 1;
      }

      .match-line {
        background-color: var(--vscode-editor-findMatchHighlightBackground);
      }

      .search-highlight {
        background-color: var(--vscode-editor-findMatchBackground);
        color: var(--vscode-editor-findMatchForeground);
        border-radius: 2px;
        padding: 0 2px;
      }

      /* Actions */
      .result-actions {
        padding: 0 16px 12px 16px;
        display: flex;
        gap: 8px;
      }

      .action-btn {
        background-color: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: 1px solid var(--vscode-button-border, transparent);
        padding: 4px 12px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 0.8em;
      }

      .action-btn:hover {
        background-color: var(--vscode-button-secondaryHoverBackground);
      }

      /* Compact View */
      .result-item.compact .result-context,
      .result-item.compact .result-actions {
        display: none;
      }

      .result-item.compact .result-header {
        padding: 8px 16px;
      }

      /* Footer */
      .results-footer {
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid var(--vscode-panel-border);
        text-align: center;
        color: var(--vscode-descriptionForeground);
        font-size: 0.9em;
      }

      /* Responsive Design */
      @media (max-width: 768px) {
        .results-toolbar {
          flex-direction: column;
          align-items: stretch;
          gap: 12px;
        }

        .toolbar-section {
          justify-content: space-between;
        }

        .result-header {
          flex-direction: column;
          align-items: stretch;
          gap: 8px;
        }

        .result-scores {
          justify-content: space-between;
        }
      }
    `;
  }

  /**
   * Get JavaScript content for webview interactions
   */
  private getJavaScriptContent(): string {
    return `
      const vscode = acquireVsCodeApi();

      function navigateToResult(resultId) {
        vscode.postMessage({
          command: 'navigateToResult',
          resultId: resultId
        });
      }

      function updateDisplayState(key, value) {
        vscode.postMessage({
          command: 'updateDisplayState',
          key: key,
          value: value
        });
      }

      function exportResults(format) {
        vscode.postMessage({
          command: 'exportResults',
          format: format
        });
      }

      function toggleExpand(resultId) {
        vscode.postMessage({
          command: 'toggleExpand',
          resultId: resultId
        });
      }

      function copyResult(resultId) {
        vscode.postMessage({
          command: 'copyResult',
          resultId: resultId
        });
      }

      function addBookmark(resultId) {
        vscode.postMessage({
          command: 'addBookmark',
          resultId: resultId
        });
      }

      function toggleGroup(headerElement) {
        const group = headerElement.parentElement;
        group.classList.toggle('collapsed');
        
        const toggle = headerElement.querySelector('.group-toggle');
        toggle.textContent = group.classList.contains('collapsed') ? '▶' : '▼';
      }

      // Keyboard shortcuts
      document.addEventListener('keydown', function(e) {
        if (e.ctrlKey || e.metaKey) {
          switch(e.key) {
            case 'e':
              e.preventDefault();
              exportResults('markdown');
              break;
            case 'j':
              e.preventDefault();
              exportResults('json');
              break;
          }
        }
      });

      // Auto-save state
      let stateTimeout;
      function debounceStateUpdate() {
        clearTimeout(stateTimeout);
        stateTimeout = setTimeout(() => {
          vscode.setState({
            scrollPosition: window.scrollY,
            timestamp: Date.now()
          });
        }, 500);
      }

      window.addEventListener('scroll', debounceStateUpdate);

      // Restore scroll position
      const previousState = vscode.getState();
      if (previousState && previousState.scrollPosition) {
        window.scrollTo(0, previousState.scrollPosition);
      }
    `;
  }

  /**
   * Dispose of the panel and resources
   */
  dispose(): void {
    this.webviewPanel?.dispose();
    this.syntaxHighlighter.dispose();
    this.navigationHandler.dispose();
    this.outputChannel.dispose();
  }
} 