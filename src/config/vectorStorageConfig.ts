import * as vscode from 'vscode';
import * as path from 'path';
import { VectorStorageConfig, FAISSConfig, selectOptimalIndex } from '../services/vectorStorage';

/**
 * Configuration manager for vector storage settings
 */
export class VectorStorageConfigManager {
  private static readonly CONFIG_SECTION = 'cppseek.vectorStorage';

  /**
   * Create vector storage configuration from VSCode settings
   */
  static createVectorStorageConfig(workspacePath?: string): VectorStorageConfig {
    const config = vscode.workspace.getConfiguration();
    
    // Get vector storage specific settings
    const indexType = config.get<string>(`${this.CONFIG_SECTION}.indexType`, 'auto');
    const dimension = config.get<number>(`${this.CONFIG_SECTION}.dimension`, 2048);
    const batchSize = config.get<number>(`${this.CONFIG_SECTION}.batchSize`, 50);
    const autoSave = config.get<boolean>(`${this.CONFIG_SECTION}.autoSave`, true);
    const autoSaveInterval = config.get<number>(`${this.CONFIG_SECTION}.autoSaveInterval`, 300000); // 5 minutes
    const memoryLimit = config.get<number>(`${this.CONFIG_SECTION}.memoryLimit`, 500); // MB
    const metric = config.get<string>(`${this.CONFIG_SECTION}.metric`, 'COSINE');
    
    // Determine persistence path
    const persistencePath = this.getPersistencePath(workspacePath);
    
    // Create FAISS configuration
    let faissConfig: FAISSConfig;
    
    if (indexType === 'auto') {
      // Auto-select optimal index type (start with Flat, can be upgraded later)
      faissConfig = selectOptimalIndex(0, dimension);
    } else {
      faissConfig = {
        indexType: indexType as any,
        dimension,
        metric: metric as any,
        // Set default parameters for different index types
        nlist: indexType === 'IVFFlat' ? config.get<number>(`${this.CONFIG_SECTION}.nlist`, 100) : undefined,
        nprobe: indexType === 'IVFFlat' ? config.get<number>(`${this.CONFIG_SECTION}.nprobe`, 10) : undefined,
        efConstruction: indexType === 'HNSW' ? config.get<number>(`${this.CONFIG_SECTION}.efConstruction`, 200) : undefined,
        efSearch: indexType === 'HNSW' ? config.get<number>(`${this.CONFIG_SECTION}.efSearch`, 50) : undefined
      };
    }

    return {
      faiss: faissConfig,
      persistencePath,
      batchSize,
      autoSave,
      autoSaveInterval,
      memoryLimit: memoryLimit * 1024 * 1024 // Convert MB to bytes
    };
  }

  /**
   * Get the persistence path for vector storage
   */
  private static getPersistencePath(workspacePath?: string): string {
    if (workspacePath) {
      return path.join(workspacePath, '.cppseek', 'vectors');
    }
    
    // Fallback to extension storage path
    const extensionPath = vscode.extensions.getExtension('cppseek-semantic-search')?.extensionPath;
    if (extensionPath) {
      return path.join(extensionPath, 'storage', 'vectors');
    }
    
    // Last resort - use temp directory
    return path.join(require('os').tmpdir(), 'cppseek-vectors');
  }

  /**
   * Update FAISS configuration based on vector count (for auto-optimization)
   */
  static optimizeConfigForVectorCount(currentConfig: VectorStorageConfig, vectorCount: number): VectorStorageConfig {
    if (currentConfig.faiss.indexType === 'Flat' && vectorCount > 1000) {
      // Upgrade to IVFFlat for better performance
      return {
        ...currentConfig,
        faiss: selectOptimalIndex(vectorCount, currentConfig.faiss.dimension)
      };
    }
    
    if (currentConfig.faiss.indexType === 'IVFFlat' && vectorCount > 10000) {
      // Upgrade to HNSW for large datasets
      return {
        ...currentConfig,
        faiss: selectOptimalIndex(vectorCount, currentConfig.faiss.dimension)
      };
    }
    
    return currentConfig;
  }

  /**
   * Get search configuration from VSCode settings
   */
  static getSearchConfig() {
    const config = vscode.workspace.getConfiguration();
    
    return {
      maxResults: config.get<number>('cppseek.searchBehavior.maxResults', 50),
      minScore: config.get<number>(`${this.CONFIG_SECTION}.minScore`, 0.1),
      enableFilters: config.get<boolean>(`${this.CONFIG_SECTION}.enableFilters`, true),
      searchTimeout: config.get<number>(`${this.CONFIG_SECTION}.searchTimeout`, 30000)
    };
  }

  /**
   * Validate vector storage configuration
   */
  static validateConfig(config: VectorStorageConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate FAISS configuration
    if (config.faiss.dimension <= 0) {
      errors.push('Vector dimension must be positive');
    }
    
    if (config.faiss.dimension > 4096) {
      errors.push('Vector dimension is unusually large (>4096), this may cause performance issues');
    }
    
    // Validate batch size
    if (config.batchSize <= 0 || config.batchSize > 1000) {
      errors.push('Batch size must be between 1 and 1000');
    }
    
    // Validate memory limit
    if (config.memoryLimit < 50 * 1024 * 1024) { // 50MB minimum
      errors.push('Memory limit must be at least 50MB');
    }
    
    // Validate auto-save interval
    if (config.autoSave && config.autoSaveInterval < 30000) { // 30 seconds minimum
      errors.push('Auto-save interval must be at least 30 seconds');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
} 