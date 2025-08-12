import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
import { NIMServiceConfig } from '../services/nimEmbeddingService';

// Load environment variables from .env file
dotenv.config();

/**
 * Configuration management for NIM service
 */
export class NIMConfigManager {
  private static instance: NIMConfigManager;
  private config: NIMServiceConfig | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): NIMConfigManager {
    if (!NIMConfigManager.instance) {
      NIMConfigManager.instance = new NIMConfigManager();
    }
    return NIMConfigManager.instance;
  }

  /**
   * Load configuration from environment variables and VSCode settings
   */
  loadConfig(): NIMServiceConfig {
    if (this.config) {
      return this.config;
    }

    const vsCodeConfig = vscode.workspace.getConfiguration('cppseek.nim');
    
    // Get API key from environment or VSCode settings
    const apiKey = this.getApiKey(vsCodeConfig);
    if (!apiKey) {
      throw new Error(
        'NIM API key is required. Please:\n' +
        '1. Set NIM_API_KEY environment variable, or\n' +
        '2. Add it to your .env file, or\n' +
        '3. Configure it in VSCode settings (cppseek.nim.apiKey)\n\n' +
        'Get your API key from: https://catalog.ngc.nvidia.com/ai-foundation-models'
      );
    }

    this.config = {
      apiKey,
      baseUrl: this.getConfigValue('baseUrl', vsCodeConfig, 'https://integrate.api.nvidia.com/v1'),
      model: this.getConfigValue('model', vsCodeConfig, 'nvidia/llama-3.2-nv-embedqa-1b-v2'),
      timeout: this.getConfigValue('timeout', vsCodeConfig, 30000),
      retryAttempts: this.getConfigValue('retryAttempts', vsCodeConfig, 3),
      maxConcurrentRequests: this.getConfigValue('maxConcurrentRequests', vsCodeConfig, 10),
      batchSize: this.getConfigValue('batchSize', vsCodeConfig, 50)
    };

    return this.config;
  }

  /**
   * Get API key from various sources
   */
  private getApiKey(vsCodeConfig: vscode.WorkspaceConfiguration): string | undefined {
    // Priority order: VSCode settings > environment variable > .env file
    return vsCodeConfig.get('apiKey') || 
           process.env.NIM_API_KEY || 
           undefined;
  }

  /**
   * Get configuration value with fallback priority
   */
  private getConfigValue<T>(
    key: string, 
    vsCodeConfig: vscode.WorkspaceConfiguration, 
    defaultValue: T
  ): T {
    // Priority: VSCode settings > environment variable > default
    const envKey = `NIM_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
    
    const vsCodeValue = vsCodeConfig.get(key);
    const envValue = process.env[envKey];
    
    if (vsCodeValue !== undefined) {
      return vsCodeValue as T;
    }
    
    if (envValue !== undefined) {
      // Convert string environment variables to appropriate types
      if (typeof defaultValue === 'number') {
        const parsed = parseInt(envValue);
        return (isNaN(parsed) ? defaultValue : parsed) as T;
      }
      return envValue as T;
    }
    
    return defaultValue;
  }

  /**
   * Validate current configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!this.config) {
      try {
        this.loadConfig();
      } catch (error) {
        return { valid: false, errors: [error instanceof Error ? error.message : 'Configuration load failed'] };
      }
    }

    const config = this.config!; // Non-null assertion after loading

    if (!config.apiKey) {
      errors.push('API key is required');
    }

    if (!config.baseUrl) {
      errors.push('Base URL is required');
    }

    if (!config.model) {
      errors.push('Model name is required');
    }

    if (config.timeout <= 0) {
      errors.push('Timeout must be positive');
    }

    if (config.retryAttempts < 0) {
      errors.push('Retry attempts cannot be negative');
    }

    if (config.maxConcurrentRequests <= 0) {
      errors.push('Max concurrent requests must be positive');
    }

    if (config.batchSize <= 0) {
      errors.push('Batch size must be positive');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Reset configuration (force reload on next access)
   */
  resetConfig(): void {
    this.config = null;
  }

  /**
   * Get current configuration without loading
   */
  getCurrentConfig(): NIMServiceConfig | null {
    return this.config;
  }

  /**
   * Update VSCode configuration
   */
  async updateVSCodeConfig(key: string, value: any, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace): Promise<void> {
    const config = vscode.workspace.getConfiguration('cppseek.nim');
    await config.update(key, value, target);
    this.resetConfig(); // Force reload
  }

  /**
   * Get configuration summary for display
   */
  getConfigSummary(): { [key: string]: any } {
    if (!this.config) {
      return { status: 'Not loaded' };
    }

    return {
      model: this.config.model,
      baseUrl: this.config.baseUrl,
      timeout: `${this.config.timeout}ms`,
      retryAttempts: this.config.retryAttempts,
      maxConcurrentRequests: this.config.maxConcurrentRequests,
      batchSize: this.config.batchSize,
      hasApiKey: !!this.config.apiKey
    };
  }
}

/**
 * Convenience function to get NIM configuration
 */
export function getNIMConfig(): NIMServiceConfig {
  return NIMConfigManager.getInstance().loadConfig();
}

/**
 * Convenience function to validate NIM configuration
 */
export function validateNIMConfig(): { valid: boolean; errors: string[] } {
  return NIMConfigManager.getInstance().validateConfig();
} 