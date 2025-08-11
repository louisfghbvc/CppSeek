import { RankedSearchResult } from '../searchResultRanker';

export type ExportFormat = 'markdown' | 'json';

export interface HistoryQueryOptions {
  startDate?: Date;
  endDate?: Date;
  sortBy?: 'timestamp' | 'resultCount';
  page?: number;
  pageSize?: number;
  limit?: number;
}

export interface SearchResultSummary {
  resultId: string;
  filePath: string;
  startLine: number;
  similarity: number;
  finalScore: number;
  functionName?: string;
  preview: string;
}

export interface SearchContext {
  currentFile?: string;
  currentFunction?: string;
  workspaceContext?: string;
  searchDuration?: number;
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  timestamp: string; // ISO
  resultCount: number;
  searchDuration: number;
  context: SearchContext;
  topResults: SearchResultSummary[];
  userInteractions: Array<{ rating?: number; helpful?: boolean }>; // lightweight for now
  sessionId: string;
}

export interface BookmarkMetadata {
  title?: string;
  description?: string;
  tags?: string[];
  collectionId?: string;
}

export interface Bookmark {
  id: string;
  resultId: string;
  title: string;
  description?: string;
  tags: string[];
  collectionId?: string;
  createdAt: string; // ISO
  lastAccessed: string; // ISO
  accessCount: number;
  result: RankedSearchResult;
  metadata: BookmarkMetadata;
}

export interface SearchCollection {
  id: string;
  name: string;
  description?: string;
  color?: string;
  bookmarks: string[];
  searches: string[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
  isShared: boolean;
}

export interface HistoryStorageSchema {
  version: number;
  searches: SearchHistoryEntry[];
  bookmarks: Bookmark[];
  collections: SearchCollection[];
}

export const defaultHistorySchema: HistoryStorageSchema = {
  version: 1,
  searches: [],
  bookmarks: [],
  collections: []
};


