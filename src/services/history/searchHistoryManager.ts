import * as vscode from 'vscode';
import { RankedSearchResult } from '../searchResultRanker';
import { HistoryStorage } from './historyStorage';
import {
  Bookmark,
  BookmarkMetadata,
  ExportFormat,
  HistoryQueryOptions,
  SearchCollection,
  SearchContext,
  SearchHistoryEntry,
  SearchResultSummary
} from './types';

export class SearchHistoryManager {
  private storage: HistoryStorage;
  private sessionId: string;

  constructor(context: vscode.ExtensionContext) {
    this.storage = new HistoryStorage(context.globalStoragePath);
    this.sessionId = this.generateId('session');
  }

  async recordSearch(
    query: string,
    results: RankedSearchResult[],
    context: SearchContext
  ): Promise<SearchHistoryEntry> {
    const entry: SearchHistoryEntry = {
      id: this.generateId('search'),
      query: query.trim(),
      timestamp: new Date().toISOString(),
      resultCount: results.length,
      searchDuration: context.searchDuration || 0,
      context,
      topResults: this.summarizeResults(results.slice(0, 5)),
      userInteractions: [],
      sessionId: this.sessionId
    };

    await this.storage.storeHistoryEntry(entry);
    return entry;
  }

  async getSearchHistory(_options: HistoryQueryOptions = {}): Promise<SearchHistoryEntry[]> {
    return this.storage.queryHistory();
  }

  async createBookmark(
    result: RankedSearchResult,
    metadata: BookmarkMetadata
  ): Promise<Bookmark> {
    const now = new Date().toISOString();
    const bookmark: Bookmark = {
      id: this.generateId('bm'),
      resultId: result.id,
      title: metadata.title || this.generateBookmarkTitle(result),
      description: metadata.description,
      tags: metadata.tags || [],
      collectionId: metadata.collectionId,
      createdAt: now,
      lastAccessed: now,
      accessCount: 0,
      result,
      metadata
    };

    await this.storage.storeBookmark(bookmark);
    return bookmark;
  }

  async createCollection(name: string, description?: string): Promise<SearchCollection> {
    const now = new Date().toISOString();
    const collection: SearchCollection = {
      id: this.generateId('col'),
      name: name.trim(),
      description: description?.trim(),
      color: '#4EC9B0',
      bookmarks: [],
      searches: [],
      createdAt: now,
      updatedAt: now,
      isShared: false
    };

    await this.storage.storeCollection(collection);
    return collection;
  }

  async exportHistory(format: ExportFormat): Promise<string> {
    const entries = await this.storage.queryHistory();
    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    }
    let md = '# CppSeek Search History\n\n';
    for (const e of entries.slice(0, 100)) {
      md += `- ${e.timestamp} — "${e.query}" (${e.resultCount} results, ${e.searchDuration}ms)\n`;
    }
    return md;
  }

  private summarizeResults(results: RankedSearchResult[]): SearchResultSummary[] {
    return results.map(r => ({
      resultId: r.id,
      filePath: r.filePath,
      startLine: r.startLine,
      similarity: r.similarity,
      finalScore: r.finalScore,
      functionName: r.functionName,
      preview: r.content.substring(0, 200)
    }));
  }

  private generateBookmarkTitle(result: RankedSearchResult): string {
    const base = result.functionName || 'Code Block';
    return `${base} - ${result.filePath}:${result.startLine}`;
  }

  private generateId(prefix: string): string {
    const rand = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${Date.now().toString(36)}_${rand}`;
  }
}


