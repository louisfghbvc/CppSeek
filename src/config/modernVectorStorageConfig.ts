import * as vscode from 'vscode';

/**
 * Modern Vector Storage Configuration for LangChain + Chroma
 * 
 * Replaces the old FAISS-based configuration with a simpler,
 * modern approach suitable for LangChain + Chroma architecture.
 */

/**
 * Configuration interface for modern vector storage
 */
export interface ModernVectorStorageConfig {
  // Chroma server configuration
  chromaUrl: string;
  
  // Collection settings
  collectionName: string;
  
  // Search settings
  defaultTopK: number;
  similarityFunction: 'cosine' | 'l2' | 'ip';
  
  // Performance settings
  batchSize: number;
  searchTimeout: number;
  
  // NIM integration settings
  nimApiKey?: string;
  nimBaseUrl?: string;
  nimModel?: string;
}

/**
 * Modern configuration manager for LangChain + Chroma vector storage
 */
export class ModernVectorStorageConfigManager {
  private static readonly CONFIG_SECTION = 'cppseek.modernVectorStorage';

  /**
   * Create modern vector storage configuration from VSCode settings
   */
  static createConfig(workspaceName?: string): ModernVectorStorageConfig {
    const config = vscode.workspace.getConfiguration();
    
    // Generate collection name based on workspace
    const collectionName = workspaceName 
      ? `cppseek-${workspaceName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`
      : 'cppseek-default';

    return {
      // Chroma server configuration
      chromaUrl: config.get<string>(`${this.CONFIG_SECTION}.chromaUrl`, 'http://localhost:8000'),
      
      // Collection settings
      collectionName,
      
      // Search settings
      defaultTopK: config.get<number>(`${this.CONFIG_SECTION}.defaultTopK`, 5),
      similarityFunction: config.get<'cosine' | 'l2' | 'ip'>(`${this.CONFIG_SECTION}.similarityFunction`, 'cosine'),
      
      // Performance settings
      batchSize: config.get<number>(`${this.CONFIG_SECTION}.batchSize`, 10),
      searchTimeout: config.get<number>(`${this.CONFIG_SECTION}.searchTimeout`, 30000),
      
      // NIM integration (from environment or settings)
      nimApiKey: process.env.NIM_API_KEY || config.get<string>(`${this.CONFIG_SECTION}.nimApiKey`),
      nimBaseUrl: process.env.NIM_BASE_URL || config.get<string>(`${this.CONFIG_SECTION}.nimBaseUrl`, 'https://integrate.api.nvidia.com/v1'),
      nimModel: process.env.NIM_MODEL || config.get<string>(`${this.CONFIG_SECTION}.nimModel`, 'nvidia/llama-3.2-nv-embedqa-1b-v2')
    };
  }

  /**
   * Get search-specific configuration
   */
  static getSearchConfig(): {
    maxResults: number;
    minScore: number;
    enableFilters: boolean;
  } {
    const config = vscode.workspace.getConfiguration();
    
    return {
      maxResults: config.get<number>('cppseek.search.maxResults', 20),
      minScore: config.get<number>('cppseek.search.minScore', 0.1),
      enableFilters: config.get<boolean>('cppseek.search.enableFilters', true)
    };
  }

  /**
   * Get Chroma server health check configuration
   */
  static getHealthCheckConfig(): {
    enabled: boolean;
    interval: number;
    timeout: number;
  } {
    const config = vscode.workspace.getConfiguration();
    
    return {
      enabled: config.get<boolean>(`${this.CONFIG_SECTION}.healthCheck.enabled`, true),
      interval: config.get<number>(`${this.CONFIG_SECTION}.healthCheck.interval`, 60000), // 1 minute
      timeout: config.get<number>(`${this.CONFIG_SECTION}.healthCheck.timeout`, 5000)     // 5 seconds
    };
  }

  /**
   * Validate modern vector storage configuration
   */
  static validateConfig(config: ModernVectorStorageConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate Chroma URL
    try {
      new URL(config.chromaUrl);
    } catch {
      errors.push('Invalid Chroma server URL');
    }
    
    // Validate collection name
    if (!config.collectionName || config.collectionName.length === 0) {
      errors.push('Collection name cannot be empty');
    }
    
    if (!/^[a-z0-9-]+$/.test(config.collectionName)) {
      errors.push('Collection name must contain only lowercase letters, numbers, and hyphens');
    }
    
    // Validate search settings
    if (config.defaultTopK <= 0 || config.defaultTopK > 100) {
      errors.push('Default top K must be between 1 and 100');
    }
    
    // Validate performance settings
    if (config.batchSize <= 0 || config.batchSize > 100) {
      errors.push('Batch size must be between 1 and 100');
    }
    
    if (config.searchTimeout < 1000 || config.searchTimeout > 120000) {
      errors.push('Search timeout must be between 1 second and 2 minutes');
    }
    
    // Validate NIM settings (optional)
    if (config.nimApiKey && config.nimApiKey.length < 10) {
      errors.push('NIM API key appears to be too short');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get default VSCode settings contribution for package.json
   */
  static getSettingsContribution() {
    return {
      [`${this.CONFIG_SECTION}.chromaUrl`]: {
        type: 'string',
        default: 'http://localhost:8000',
        description: 'URL of the Chroma vector database server'
      },
      [`${this.CONFIG_SECTION}.defaultTopK`]: {
        type: 'number',
        default: 5,
        minimum: 1,
        maximum: 100,
        description: 'Default number of search results to return'
      },
      [`${this.CONFIG_SECTION}.similarityFunction`]: {
        type: 'string',
        enum: ['cosine', 'l2', 'ip'],
        default: 'cosine',
        description: 'Similarity function for vector search'
      },
      [`${this.CONFIG_SECTION}.batchSize`]: {
        type: 'number',
        default: 10,
        minimum: 1,
        maximum: 100,
        description: 'Number of documents to process in each batch'
      },
      [`${this.CONFIG_SECTION}.searchTimeout`]: {
        type: 'number',
        default: 30000,
        minimum: 1000,
        maximum: 120000,
        description: 'Search timeout in milliseconds'
      },
      [`${this.CONFIG_SECTION}.healthCheck.enabled`]: {
        type: 'boolean',
        default: true,
        description: 'Enable periodic health checks for Chroma server'
      },
      [`${this.CONFIG_SECTION}.healthCheck.interval`]: {
        type: 'number',
        default: 60000,
        minimum: 10000,
        description: 'Health check interval in milliseconds'
      }
    };
  }
} 