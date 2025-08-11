import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  Bookmark, 
  HistoryStorageSchema, 
  SearchCollection, 
  SearchHistoryEntry, 
  defaultHistorySchema 
} from './types';

/**
 * File-backed history storage located under VSCode global storage path
 */
export class HistoryStorage {
  private storageFile: string;

  constructor(globalStoragePath: string) {
    this.storageFile = path.join(globalStoragePath, 'cppseek_history.json');
  }

  private async readSchema(): Promise<HistoryStorageSchema> {
    try {
      const buf = await fs.readFile(this.storageFile, 'utf8');
      return JSON.parse(buf) as HistoryStorageSchema;
    } catch {
      return { ...defaultHistorySchema };
    }
  }

  private async writeSchema(schema: HistoryStorageSchema): Promise<void> {
    await fs.mkdir(path.dirname(this.storageFile), { recursive: true });
    await fs.writeFile(this.storageFile, JSON.stringify(schema, null, 2), 'utf8');
  }

  async storeHistoryEntry(entry: SearchHistoryEntry): Promise<void> {
    const schema = await this.readSchema();
    schema.searches.unshift(entry);
    await this.writeSchema(schema);
  }

  async queryHistory(_filters?: unknown): Promise<SearchHistoryEntry[]> {
    const schema = await this.readSchema();
    return schema.searches;
  }

  async getRecentEntries(limit: number): Promise<SearchHistoryEntry[]> {
    const schema = await this.readSchema();
    return schema.searches.slice(0, limit);
  }

  async storeBookmark(bookmark: Bookmark): Promise<void> {
    const schema = await this.readSchema();
    schema.bookmarks.unshift(bookmark);
    await this.writeSchema(schema);
  }

  async getBookmarksByIds(ids: string[]): Promise<Bookmark[]> {
    const schema = await this.readSchema();
    const idSet = new Set(ids);
    return schema.bookmarks.filter(b => idSet.has(b.id));
  }

  async getAllBookmarks(): Promise<Bookmark[]> {
    const schema = await this.readSchema();
    return schema.bookmarks;
  }

  async storeCollection(collection: SearchCollection): Promise<void> {
    const schema = await this.readSchema();
    schema.collections.unshift(collection);
    await this.writeSchema(schema);
  }

  async updateCollection(collection: SearchCollection): Promise<void> {
    const schema = await this.readSchema();
    const idx = schema.collections.findIndex(c => c.id === collection.id);
    if (idx >= 0) {
      schema.collections[idx] = collection;
    } else {
      schema.collections.unshift(collection);
    }
    await this.writeSchema(schema);
  }
}


