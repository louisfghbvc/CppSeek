import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ChunkMetadata, MetadataFilter, SemanticContext } from './types';

/**
 * SQLite-based metadata storage for vector search chunks
 */
export class MetadataStore {
  private db!: sqlite3.Database;
  private dbPath: string;
  private isInitialized = false;

  constructor(persistencePath: string) {
    this.dbPath = path.join(persistencePath, 'metadata.db');
  }

  /**
   * Initialize the metadata database and create tables
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Ensure directory exists
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });

    return new Promise<void>((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(new Error(`Failed to open metadata database: ${err.message}`));
          return;
        }

        // Create tables
        this.createTables()
          .then(() => {
            this.isInitialized = true;
            resolve();
          })
          .catch(reject);
      });
    });
  }

  /**
   * Create database tables with proper schema
   */
  private async createTables(): Promise<void> {
    const createChunkMetadataTable = `
      CREATE TABLE IF NOT EXISTS chunk_metadata (
        id TEXT PRIMARY KEY,
        vector_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        start_char INTEGER NOT NULL,
        end_char INTEGER NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        function_name TEXT,
        class_name TEXT,
        namespace TEXT,
        file_type TEXT NOT NULL,
        code_type TEXT NOT NULL,
        complexity INTEGER DEFAULT 0,
        importance TEXT DEFAULT 'medium',
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(vector_id)
      )`;

    const createFileTrackingTable = `
      CREATE TABLE IF NOT EXISTS file_tracking (
        file_path TEXT PRIMARY KEY,
        file_hash TEXT NOT NULL,
        last_indexed DATETIME DEFAULT CURRENT_TIMESTAMP,
        chunk_count INTEGER DEFAULT 0
      )`;

    const createIndices = [
      'CREATE INDEX IF NOT EXISTS idx_chunk_file_path ON chunk_metadata(file_path)',
      'CREATE INDEX IF NOT EXISTS idx_chunk_vector_id ON chunk_metadata(vector_id)',
      'CREATE INDEX IF NOT EXISTS idx_chunk_context ON chunk_metadata(function_name, class_name, namespace)',
      'CREATE INDEX IF NOT EXISTS idx_chunk_type ON chunk_metadata(file_type, code_type)',
      'CREATE INDEX IF NOT EXISTS idx_chunk_importance ON chunk_metadata(importance)'
    ];

    return new Promise<void>((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(createChunkMetadataTable, (err) => {
          if (err) reject(new Error(`Failed to create chunk_metadata table: ${err.message}`));
        });

        this.db.run(createFileTrackingTable, (err) => {
          if (err) reject(new Error(`Failed to create file_tracking table: ${err.message}`));
        });

        // Create all indices
        let pendingIndices = createIndices.length;
        createIndices.forEach(indexQuery => {
          this.db.run(indexQuery, (err) => {
            if (err) reject(new Error(`Failed to create index: ${err.message}`));
            pendingIndices--;
            if (pendingIndices === 0) {
              resolve();
            }
          });
        });
      });
    });
  }

  /**
   * Add metadata for multiple chunks
   */
  async addChunkMetadata(metadataList: ChunkMetadata[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('MetadataStore not initialized');
    }

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO chunk_metadata (
        id, vector_id, file_path, file_name, start_line, end_line,
        start_char, end_char, chunk_index, content, content_hash,
        function_name, class_name, namespace, file_type, code_type,
        complexity, importance, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    return new Promise<void>((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        let pendingInserts = metadataList.length;
        let hasError = false;

        metadataList.forEach(metadata => {
          stmt.run([
            metadata.id,
            metadata.vectorId,
            metadata.filePath,
            metadata.fileName,
            metadata.startLine,
            metadata.endLine,
            metadata.startChar,
            metadata.endChar,
            metadata.chunkIndex,
            metadata.content,
            metadata.contentHash,
            metadata.contextInfo.functionName,
            metadata.contextInfo.className,
            metadata.contextInfo.namespace,
            metadata.contextInfo.fileType,
            metadata.contextInfo.codeType,
            metadata.contextInfo.complexity,
            metadata.contextInfo.importance
          ], (err) => {
            if (err && !hasError) {
              hasError = true;
              this.db.run('ROLLBACK');
              reject(new Error(`Failed to insert metadata: ${err.message}`));
              return;
            }

            pendingInserts--;
            if (pendingInserts === 0 && !hasError) {
              this.db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                  reject(new Error(`Failed to commit transaction: ${commitErr.message}`));
                } else {
                  resolve();
                }
              });
            }
          });
        });

        stmt.finalize();
      });
    });
  }

  /**
   * Get metadata by vector IDs
   */
  async getMetadataByVectorIds(vectorIds: number[]): Promise<ChunkMetadata[]> {
    if (!this.isInitialized) {
      throw new Error('MetadataStore not initialized');
    }

    if (vectorIds.length === 0) {
      return [];
    }

    const placeholders = vectorIds.map(() => '?').join(',');
    const query = `
      SELECT * FROM chunk_metadata 
      WHERE vector_id IN (${placeholders})
      ORDER BY vector_id
    `;

    return new Promise<ChunkMetadata[]>((resolve, reject) => {
      this.db.all(query, vectorIds, (err, rows: any[]) => {
        if (err) {
          reject(new Error(`Failed to fetch metadata: ${err.message}`));
          return;
        }

        const metadata = rows.map(row => this.rowToChunkMetadata(row));
        resolve(metadata);
      });
    });
  }

  /**
   * Query metadata with filters
   */
  async queryMetadata(filters: MetadataFilter[], limit?: number): Promise<ChunkMetadata[]> {
    if (!this.isInitialized) {
      throw new Error('MetadataStore not initialized');
    }

    let query = 'SELECT * FROM chunk_metadata';
    const params: any[] = [];

    if (filters.length > 0) {
      const whereClause = filters.map(filter => {
        params.push(filter.value);
        const column = this.mapFilterFieldToColumn(filter.field);
        return `${column} ${this.mapOperatorToSQL(filter.operator)} ?`;
      }).join(' AND ');

      query += ` WHERE ${whereClause}`;
    }

    query += ' ORDER BY last_updated DESC';

    if (limit) {
      query += ` LIMIT ${limit}`;
    }

    return new Promise<ChunkMetadata[]>((resolve, reject) => {
      this.db.all(query, params, (err, rows: any[]) => {
        if (err) {
          reject(new Error(`Failed to query metadata: ${err.message}`));
          return;
        }

        const metadata = rows.map(row => this.rowToChunkMetadata(row));
        resolve(metadata);
      });
    });
  }

  /**
   * Update file tracking information
   */
  async updateFileTracking(filePath: string, fileHash: string, chunkCount: number): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('MetadataStore not initialized');
    }

    const query = `
      INSERT OR REPLACE INTO file_tracking (file_path, file_hash, chunk_count, last_indexed)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `;

    return new Promise<void>((resolve, reject) => {
      this.db.run(query, [filePath, fileHash, chunkCount], (err) => {
        if (err) {
          reject(new Error(`Failed to update file tracking: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Remove metadata for a specific file
   */
  async removeFileMetadata(filePath: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('MetadataStore not initialized');
    }

    return new Promise<void>((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        this.db.run('DELETE FROM chunk_metadata WHERE file_path = ?', [filePath], (err) => {
          if (err) {
            this.db.run('ROLLBACK');
            reject(new Error(`Failed to remove chunk metadata: ${err.message}`));
            return;
          }

          this.db.run('DELETE FROM file_tracking WHERE file_path = ?', [filePath], (err) => {
            if (err) {
              this.db.run('ROLLBACK');
              reject(new Error(`Failed to remove file tracking: ${err.message}`));
            } else {
              this.db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                  reject(new Error(`Failed to commit transaction: ${commitErr.message}`));
                } else {
                  resolve();
                }
              });
            }
          });
        });
      });
    });
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{ totalChunks: number; totalFiles: number }> {
    if (!this.isInitialized) {
      throw new Error('MetadataStore not initialized');
    }

    return new Promise<{ totalChunks: number; totalFiles: number }>((resolve, reject) => {
      this.db.get('SELECT COUNT(*) as totalChunks FROM chunk_metadata', (err, chunkRow: any) => {
        if (err) {
          reject(new Error(`Failed to get chunk count: ${err.message}`));
          return;
        }

        this.db.get('SELECT COUNT(*) as totalFiles FROM file_tracking', (err, fileRow: any) => {
          if (err) {
            reject(new Error(`Failed to get file count: ${err.message}`));
          } else {
            resolve({
              totalChunks: chunkRow.totalChunks,
              totalFiles: fileRow.totalFiles
            });
          }
        });
      });
    });
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(new Error(`Failed to close database: ${err.message}`));
        } else {
          this.isInitialized = false;
          resolve();
        }
      });
    });
  }

  /**
   * Convert database row to ChunkMetadata object
   */
  private rowToChunkMetadata(row: any): ChunkMetadata {
    return {
      id: row.id,
      vectorId: row.vector_id,
      filePath: row.file_path,
      fileName: row.file_name,
      startLine: row.start_line,
      endLine: row.end_line,
      startChar: row.start_char,
      endChar: row.end_char,
      chunkIndex: row.chunk_index,
      content: row.content,
      contentHash: row.content_hash,
      contextInfo: {
        functionName: row.function_name,
        className: row.class_name,
        namespace: row.namespace,
        fileType: row.file_type,
        codeType: row.code_type,
        complexity: row.complexity,
        importance: row.importance
      },
      lastUpdated: new Date(row.last_updated)
    };
  }

  /**
   * Map filter field to database column
   */
  private mapFilterFieldToColumn(field: string): string {
    const fieldMap: Record<string, string> = {
      filePath: 'file_path',
      fileName: 'file_name',
      startLine: 'start_line',
      endLine: 'end_line',
      startChar: 'start_char',
      endChar: 'end_char',
      chunkIndex: 'chunk_index',
      contentHash: 'content_hash',
      functionName: 'function_name',
      className: 'class_name',
      fileType: 'file_type',
      codeType: 'code_type',
      lastUpdated: 'last_updated'
    };

    return fieldMap[field] || field;
  }

  /**
   * Map filter operator to SQL operator
   */
  private mapOperatorToSQL(operator: string): string {
    const operatorMap: Record<string, string> = {
      eq: '=',
      ne: '!=',
      gt: '>',
      lt: '<',
      gte: '>=',
      lte: '<=',
      like: 'LIKE',
      in: 'IN'
    };

    return operatorMap[operator] || '=';
  }
} 