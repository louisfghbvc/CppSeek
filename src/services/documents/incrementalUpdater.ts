import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { DocumentManager } from './documentManager';
import { DocumentConverter, LangChainDocument } from './documentConverter';

/**
 * File change types
 */
export enum FileChangeType {
  CREATED = 'created',
  MODIFIED = 'modified',
  DELETED = 'deleted'
}

/**
 * File change information
 */
export interface FileChange {
  filename: string;
  type: FileChangeType;
  timestamp: string;
  previousHash?: string;
  currentHash?: string;
}

/**
 * File change detection result
 */
export interface FileChangeSet {
  changes: FileChange[];
  totalFiles: number;
  changedFiles: number;
  processingTime: number;
}

/**
 * Incremental update result
 */
export interface IncrementalUpdateResult {
  success: boolean;
  filesProcessed: number;
  documentsUpdated: number;
  errors: string[];
  processingTime: number;
  changesSummary: {
    created: number;
    modified: number;
    deleted: number;
  };
}

/**
 * File hash cache entry
 */
interface FileHashCache {
  filename: string;
  hash: string;
  lastModified: string;
  size: number;
}

/**
 * Update statistics
 */
export interface UpdateStats {
  totalUpdates: number;
  lastUpdate: string;
  averageUpdateTime: number;
  filesMonitored: number;
  changeDetectionTime: number;
}

/**
 * IncrementalUpdater handles real-time document updates based on file changes
 * 
 * Provides file change detection, hash-based comparison, and incremental update workflows
 * for maintaining document synchronization with the filesystem.
 */
export class IncrementalUpdater {
  private documentManager: DocumentManager;
  private converter: DocumentConverter;
  private outputChannel: vscode.OutputChannel;
  private fileHashCache: Map<string, FileHashCache>;
  private fileWatcher: vscode.FileSystemWatcher | null = null;
  private isMonitoring: boolean = false;
  private updateStats: UpdateStats;
  private pendingChanges: Map<string, FileChange>;
  private updateTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY_MS = 2000; // Batch changes for 2 seconds

  constructor(documentManager: DocumentManager) {
    this.documentManager = documentManager;
    this.converter = new DocumentConverter();
    this.outputChannel = vscode.window.createOutputChannel('CppSeek Incremental Updater');
    this.fileHashCache = new Map();
    this.pendingChanges = new Map();
    this.updateStats = {
      totalUpdates: 0,
      lastUpdate: new Date().toISOString(),
      averageUpdateTime: 0,
      filesMonitored: 0,
      changeDetectionTime: 0
    };
  }

  /**
   * Detect file changes in the workspace
   */
  async detectFileChanges(): Promise<FileChangeSet> {
    const startTime = Date.now();
    const changes: FileChange[] = [];

    try {
      this.outputChannel.appendLine('[IncrementalUpdater] Detecting file changes...');

      // Get workspace folders
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        this.outputChannel.appendLine('[IncrementalUpdater] No workspace folders found');
        return {
          changes: [],
          totalFiles: 0,
          changedFiles: 0,
          processingTime: Date.now() - startTime
        };
      }

      let totalFiles = 0;
      const supportedExtensions = ['.cpp', '.cc', '.cxx', '.c', '.h', '.hpp', '.hxx'];

      for (const folder of workspaceFolders) {
        const files = await this.findFiles(folder.uri.fsPath, supportedExtensions);
        totalFiles += files.length;

        for (const file of files) {
          const change = await this.checkFileChange(file);
          if (change) {
            changes.push(change);
          }
        }
      }

      const processingTime = Date.now() - startTime;
      this.updateStats.changeDetectionTime = processingTime;

      this.outputChannel.appendLine(
        `[IncrementalUpdater] ✅ Change detection completed: ` +
        `${changes.length} changes in ${totalFiles} files (${processingTime}ms)`
      );

      return {
        changes,
        totalFiles,
        changedFiles: changes.length,
        processingTime
      };

    } catch (error) {
      this.outputChannel.appendLine(
        `[IncrementalUpdater] ❌ Failed to detect file changes: ${error}`
      );
      throw error;
    }
  }

  /**
   * Process incremental updates for detected changes
   */
  async processIncrementalUpdate(changes: FileChangeSet): Promise<IncrementalUpdateResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let filesProcessed = 0;
    let documentsUpdated = 0;

    const changesSummary = {
      created: 0,
      modified: 0,
      deleted: 0
    };

    try {
      this.outputChannel.appendLine(
        `[IncrementalUpdater] Processing incremental update for ${changes.changes.length} changes...`
      );

      // Group changes by type
      const createdFiles: string[] = [];
      const modifiedFiles: string[] = [];
      const deletedFiles: string[] = [];

      for (const change of changes.changes) {
        switch (change.type) {
          case FileChangeType.CREATED:
            createdFiles.push(change.filename);
            changesSummary.created++;
            break;
          case FileChangeType.MODIFIED:
            modifiedFiles.push(change.filename);
            changesSummary.modified++;
            break;
          case FileChangeType.DELETED:
            deletedFiles.push(change.filename);
            changesSummary.deleted++;
            break;
        }
      }

      // Process deletions first
      if (deletedFiles.length > 0) {
        try {
          const result = await this.documentManager.removeDocuments(deletedFiles);
          documentsUpdated += result.documentsProcessed;
          filesProcessed += deletedFiles.length;
          
          if (!result.success) {
            errors.push(...result.errors);
          }
        } catch (error) {
          const errorMsg = `Failed to remove documents for deleted files: ${error}`;
          errors.push(errorMsg);
          this.outputChannel.appendLine(`[IncrementalUpdater] ❌ ${errorMsg}`);
        }
      }

      // Process modifications
      if (modifiedFiles.length > 0) {
        try {
          const result = await this.documentManager.updateDocuments(modifiedFiles);
          documentsUpdated += result.documentsProcessed;
          filesProcessed += modifiedFiles.length;
          
          if (!result.success) {
            errors.push(...result.errors);
          }
        } catch (error) {
          const errorMsg = `Failed to update documents for modified files: ${error}`;
          errors.push(errorMsg);
          this.outputChannel.appendLine(`[IncrementalUpdater] ❌ ${errorMsg}`);
        }
      }

      // Process creations (similar to modifications for now)
      if (createdFiles.length > 0) {
        try {
          // Note: In a complete implementation, we would:
          // 1. Read the new file content
          // 2. Chunk it using TextChunker
          // 3. Add as new documents
          
          this.outputChannel.appendLine(
            `[IncrementalUpdater] ⚠️ Placeholder: Process ${createdFiles.length} created files`
          );
          
          filesProcessed += createdFiles.length;
        } catch (error) {
          const errorMsg = `Failed to process created files: ${error}`;
          errors.push(errorMsg);
          this.outputChannel.appendLine(`[IncrementalUpdater] ❌ ${errorMsg}`);
        }
      }

      // Update hash cache for processed files
      this.updateHashCache(changes.changes);

      // Update statistics
      const processingTime = Date.now() - startTime;
      this.updateStats.totalUpdates++;
      this.updateStats.lastUpdate = new Date().toISOString();
      this.updateStats.averageUpdateTime = 
        (this.updateStats.averageUpdateTime + processingTime) / 2;

      this.outputChannel.appendLine(
        `[IncrementalUpdater] ✅ Incremental update completed: ` +
        `${filesProcessed} files, ${documentsUpdated} documents updated in ${processingTime}ms`
      );

      return {
        success: errors.length === 0,
        filesProcessed,
        documentsUpdated,
        errors,
        processingTime,
        changesSummary
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);
      
      this.outputChannel.appendLine(
        `[IncrementalUpdater] ❌ Failed to process incremental update: ${errorMessage}`
      );

      return {
        success: false,
        filesProcessed,
        documentsUpdated,
        errors,
        processingTime: Date.now() - startTime,
        changesSummary
      };
    }
  }

  /**
   * Start monitoring files for changes
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      this.outputChannel.appendLine('[IncrementalUpdater] Already monitoring file changes');
      return;
    }

    try {
      this.outputChannel.appendLine('[IncrementalUpdater] Starting file monitoring...');

      // Create file watcher for supported file types
      const pattern = '**/*.{cpp,cc,cxx,c,h,hpp,hxx}';
      this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

      // Set up event handlers
      this.fileWatcher.onDidCreate(uri => {
        this.handleFileChange(uri.fsPath, FileChangeType.CREATED);
      });

      this.fileWatcher.onDidChange(uri => {
        this.handleFileChange(uri.fsPath, FileChangeType.MODIFIED);
      });

      this.fileWatcher.onDidDelete(uri => {
        this.handleFileChange(uri.fsPath, FileChangeType.DELETED);
      });

      this.isMonitoring = true;
      this.outputChannel.appendLine('[IncrementalUpdater] ✅ File monitoring started');

    } catch (error) {
      this.outputChannel.appendLine(
        `[IncrementalUpdater] ❌ Failed to start monitoring: ${error}`
      );
      throw error;
    }
  }

  /**
   * Stop monitoring files for changes
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    try {
      if (this.fileWatcher) {
        this.fileWatcher.dispose();
        this.fileWatcher = null;
      }

      if (this.updateTimeout) {
        clearTimeout(this.updateTimeout);
        this.updateTimeout = null;
      }

      this.isMonitoring = false;
      this.pendingChanges.clear();
      
      this.outputChannel.appendLine('[IncrementalUpdater] ✅ File monitoring stopped');
    } catch (error) {
      this.outputChannel.appendLine(
        `[IncrementalUpdater] ❌ Failed to stop monitoring: ${error}`
      );
    }
  }

  /**
   * Rebuild document index for specific files
   */
  async rebuildDocumentIndex(files: string[]): Promise<IncrementalUpdateResult> {
    const startTime = Date.now();
    
    try {
      this.outputChannel.appendLine(
        `[IncrementalUpdater] Rebuilding document index for ${files.length} files...`
      );

      // Remove existing documents for these files
      const removeResult = await this.documentManager.removeDocuments(files);
      
      // Clear cache entries for these files
      files.forEach(file => {
        this.fileHashCache.delete(file);
      });

      // Note: In a complete implementation, we would:
      // 1. Re-read file contents
      // 2. Re-chunk them
      // 3. Re-index as new documents

      this.outputChannel.appendLine(
        `[IncrementalUpdater] ⚠️ Placeholder: Re-chunk and re-index ${files.length} files`
      );

      const processingTime = Date.now() - startTime;
      
      return {
        success: removeResult.success,
        filesProcessed: files.length,
        documentsUpdated: removeResult.documentsProcessed,
        errors: removeResult.errors,
        processingTime,
        changesSummary: {
          created: 0,
          modified: files.length,
          deleted: 0
        }
      };

    } catch (error) {
      this.outputChannel.appendLine(
        `[IncrementalUpdater] ❌ Failed to rebuild index: ${error}`
      );
      throw error;
    }
  }

  /**
   * Get update statistics
   */
  getUpdateStats(): UpdateStats {
    this.updateStats.filesMonitored = this.fileHashCache.size;
    return { ...this.updateStats };
  }

  /**
   * Clear the file hash cache
   */
  clearCache(): void {
    this.fileHashCache.clear();
    this.outputChannel.appendLine('[IncrementalUpdater] File hash cache cleared');
  }

  /**
   * Compare file hashes to detect changes
   */
  private async compareFileHashes(file: string): Promise<boolean> {
    try {
      const currentHash = await this.generateFileHash(file);
      const cachedEntry = this.fileHashCache.get(file);
      
      if (!cachedEntry) {
        return true; // New file
      }
      
      return currentHash !== cachedEntry.hash;
    } catch (error) {
      this.outputChannel.appendLine(
        `[IncrementalUpdater] ❌ Failed to compare hashes for ${file}: ${error}`
      );
      return true; // Assume changed on error
    }
  }

  /**
   * Update document metadata
   */
  private updateDocumentMetadata(doc: LangChainDocument): void {
    doc.metadata.lastModified = new Date().toISOString();
    doc.metadata.hash = this.converter.generateContentHash(doc.pageContent);
  }

  /**
   * Generate file hash for change detection
   */
  private async generateFileHash(filepath: string): Promise<string> {
    try {
      const content = await fs.promises.readFile(filepath, 'utf-8');
      return crypto.createHash('md5').update(content).digest('hex');
    } catch (error) {
      throw new Error(`Failed to generate hash for ${filepath}: ${error}`);
    }
  }

  /**
   * Check if a file has changed
   */
  private async checkFileChange(filepath: string): Promise<FileChange | null> {
    try {
      // Check if file exists
      const stats = await fs.promises.stat(filepath);
      const currentHash = await this.generateFileHash(filepath);
      const cachedEntry = this.fileHashCache.get(filepath);

      if (!cachedEntry) {
        // New file
        this.fileHashCache.set(filepath, {
          filename: filepath,
          hash: currentHash,
          lastModified: stats.mtime.toISOString(),
          size: stats.size
        });

        return {
          filename: filepath,
          type: FileChangeType.CREATED,
          timestamp: new Date().toISOString(),
          currentHash
        };
      }

      if (currentHash !== cachedEntry.hash) {
        // Modified file
        const previousHash = cachedEntry.hash;
        
        this.fileHashCache.set(filepath, {
          filename: filepath,
          hash: currentHash,
          lastModified: stats.mtime.toISOString(),
          size: stats.size
        });

        return {
          filename: filepath,
          type: FileChangeType.MODIFIED,
          timestamp: new Date().toISOString(),
          previousHash,
          currentHash
        };
      }

      return null; // No change
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        // File deleted
        const cachedEntry = this.fileHashCache.get(filepath);
        if (cachedEntry) {
          this.fileHashCache.delete(filepath);
          return {
            filename: filepath,
            type: FileChangeType.DELETED,
            timestamp: new Date().toISOString(),
            previousHash: cachedEntry.hash
          };
        }
      }
      
      this.outputChannel.appendLine(
        `[IncrementalUpdater] ❌ Error checking file change for ${filepath}: ${error}`
      );
      return null;
    }
  }

  /**
   * Find files recursively
   */
  private async findFiles(dirPath: string, extensions: string[]): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip common directories that shouldn't be indexed
          if (!['node_modules', '.git', '.vscode', 'build', 'dist'].includes(entry.name)) {
            const subFiles = await this.findFiles(fullPath, extensions);
            files.push(...subFiles);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      this.outputChannel.appendLine(
        `[IncrementalUpdater] Warning: Cannot read directory ${dirPath}: ${error}`
      );
    }
    
    return files;
  }

  /**
   * Handle file change events
   */
  private handleFileChange(filepath: string, changeType: FileChangeType): void {
    const change: FileChange = {
      filename: filepath,
      type: changeType,
      timestamp: new Date().toISOString()
    };

    this.pendingChanges.set(filepath, change);
    
    // Batch changes to avoid too many updates
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    this.updateTimeout = setTimeout(() => {
      this.processPendingChanges();
    }, this.BATCH_DELAY_MS);
  }

  /**
   * Process pending changes in batch
   */
  private async processPendingChanges(): Promise<void> {
    if (this.pendingChanges.size === 0) {
      return;
    }

    const changes = Array.from(this.pendingChanges.values());
    this.pendingChanges.clear();

    try {
      this.outputChannel.appendLine(
        `[IncrementalUpdater] Processing ${changes.length} pending changes...`
      );

      const changeSet: FileChangeSet = {
        changes,
        totalFiles: changes.length,
        changedFiles: changes.length,
        processingTime: 0
      };

      await this.processIncrementalUpdate(changeSet);
    } catch (error) {
      this.outputChannel.appendLine(
        `[IncrementalUpdater] ❌ Failed to process pending changes: ${error}`
      );
    }
  }

  /**
   * Update hash cache with processed changes
   */
  private updateHashCache(changes: FileChange[]): void {
    for (const change of changes) {
      if (change.type === FileChangeType.DELETED) {
        this.fileHashCache.delete(change.filename);
      } else if (change.currentHash) {
        this.fileHashCache.set(change.filename, {
          filename: change.filename,
          hash: change.currentHash,
          lastModified: change.timestamp,
          size: 0 // We don't track size in changes
        });
      }
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stopMonitoring();
    this.converter.dispose();
    this.outputChannel.dispose();
    this.fileHashCache.clear();
    this.pendingChanges.clear();
  }
} 