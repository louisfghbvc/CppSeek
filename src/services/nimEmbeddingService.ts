import OpenAI from 'openai';
import * as vscode from 'vscode';

/**
 * Configuration interface for NIM Embedding Service
 */
export interface NIMServiceConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeout: number;
  retryAttempts: number;
  maxConcurrentRequests: number;
  batchSize: number;
}

/**
 * Response interface for embedding generation
 */
export interface EmbeddingResponse {
  embedding: number[];
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Error interface for API failures
 */
export interface NIMServiceError {
  code: string;
  message: string;
  type: 'authentication' | 'rate_limit' | 'network' | 'server' | 'unknown';
  retryable: boolean;
}

/**
 * Nvidia NIM Embedding Service
 * 
 * Provides semantic embedding generation using Nvidia's cloud-hosted NIM API.
 * Features include batch processing, retry logic, and comprehensive error handling.
 */
export class NIMEmbeddingService {
  private client!: OpenAI; // Will be initialized in constructor
  private config: NIMServiceConfig;
  private outputChannel: vscode.OutputChannel;
  private requestQueue: Array<() => Promise<any>> = [];
  private activeRequests = 0;

  /**
   * Default configuration for NIM service
   */
  private static readonly DEFAULT_CONFIG: Partial<NIMServiceConfig> = {
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    model: 'nvidia/llama-3.2-nv-embedqa-1b-v2',
    timeout: 30000,
    retryAttempts: 3,
    maxConcurrentRequests: 10,
    batchSize: 50
  };

  constructor(config: Partial<NIMServiceConfig>) {
    this.config = {
      ...NIMEmbeddingService.DEFAULT_CONFIG,
      ...config
    } as NIMServiceConfig;

    this.outputChannel = vscode.window.createOutputChannel('CppSeek NIM Service');
    
    this.validateConfig();
    this.initializeClient();
  }

  /**
   * Validates the service configuration
   */
  private validateConfig(): void {
    if (!this.config.apiKey) {
      throw new Error('NIM API key is required. Please set NIM_API_KEY environment variable.');
    }
    
    if (!this.config.baseUrl) {
      throw new Error('NIM base URL is required.');
    }
    
    if (!this.config.model) {
      throw new Error('NIM model name is required.');
    }

    this.outputChannel.appendLine(`NIM Service configured with model: ${this.config.model}`);
  }

  /**
   * Initializes the OpenAI client for NIM API
   */
  private initializeClient(): void {
    try {
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl,
        timeout: this.config.timeout
      });
      
      this.outputChannel.appendLine('NIM client initialized successfully');
    } catch (error) {
      const errorMessage = `Failed to initialize NIM client: ${error}`;
      this.outputChannel.appendLine(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Generates embeddings for a single text input
   */
  async generateEmbedding(text: string): Promise<EmbeddingResponse> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text input cannot be empty');
    }

    const startTime = Date.now();
    
    const response = await this.executeWithRetry(async () => {
      this.outputChannel.appendLine(`Generating embedding for text: ${text.substring(0, 100)}...`);
      
      const result = await this.executeWithRateLimit(async () => {
        return await this.client.embeddings.create({
          input: text,
          model: this.config.model,
          encoding_format: "float",
          input_type: "query",
          truncate: "NONE"
        } as any); // Type assertion for NIM-specific parameters
      });

      const duration = Date.now() - startTime;
      this.outputChannel.appendLine(`Generated embedding in ${duration}ms`);

      // Ensure result is defined before accessing its properties
      if (!result || !result.data || !result.data[0]) {
        throw new Error('Invalid response from embeddings API');
      }

      return {
        embedding: result.data[0].embedding,
        usage: {
          prompt_tokens: result.usage?.prompt_tokens || 0,
          total_tokens: result.usage?.total_tokens || 0
        }
      };
    });

    return response;
  }

  /**
   * Generates embeddings for multiple texts in batches
   */
  async generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResponse[]> {
    if (!texts || texts.length === 0) {
      throw new Error('Text array cannot be empty');
    }

    // Filter out empty strings
    const validTexts = texts.filter(text => text && text.trim().length > 0);
    if (validTexts.length === 0) {
      throw new Error('No valid text inputs provided');
    }

    const startTime = Date.now();
    const results: EmbeddingResponse[] = [];
    
    // Process in batches to respect API limits
    for (let i = 0; i < validTexts.length; i += this.config.batchSize) {
      const batch = validTexts.slice(i, i + this.config.batchSize);
      
      try {
        const batchResults = await this.processBatch(batch);
        results.push(...batchResults);
        
        this.outputChannel.appendLine(
          `Processed batch ${Math.floor(i / this.config.batchSize) + 1}/${Math.ceil(validTexts.length / this.config.batchSize)}`
        );
      } catch (error) {
        const nimError = this.parseError(error);
        this.outputChannel.appendLine(`Batch processing failed: ${nimError.message}`);
        throw nimError;
      }
    }

    const duration = Date.now() - startTime;
    this.outputChannel.appendLine(
      `Generated ${results.length} embeddings in ${duration}ms (${(duration / results.length).toFixed(2)}ms per embedding)`
    );

    return results;
  }

  /**
   * Processes a single batch of texts
   */
  private async processBatch(texts: string[]): Promise<EmbeddingResponse[]> {
    return await this.executeWithRateLimit(async () => {
      const response = await this.executeWithRetry(async () => {
        return await this.client.embeddings.create({
          input: texts,
          model: this.config.model,
          encoding_format: "float",
          input_type: "query",
          truncate: "NONE"
        } as any); // Type assertion for NIM-specific parameters
      });

      return response.data.map(item => ({
        embedding: item.embedding,
        usage: {
          prompt_tokens: response.usage?.prompt_tokens || 0,
          total_tokens: response.usage?.total_tokens || 0
        }
      }));
    });
  }

  /**
   * Executes a function with retry logic
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: any;
    let lastParsedError: NIMServiceError | null = null;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const nimError = this.parseError(error);
        lastParsedError = nimError;
        
        if (!nimError.retryable || attempt === this.config.retryAttempts) {
          throw nimError;
        }
        
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff
        this.outputChannel.appendLine(`Attempt ${attempt} failed, retrying in ${delay}ms: ${nimError.message}`);
        await this.delay(delay);
      }
    }
    
    // Return the last parsed error instead of parsing again
    throw lastParsedError || this.parseError(lastError);
  }

  /**
   * Executes a function with rate limiting
   */
  private async executeWithRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        if (this.activeRequests >= this.config.maxConcurrentRequests) {
          // Queue the request
          this.requestQueue.push(() => execute());
          return;
        }
        
        this.activeRequests++;
        
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeRequests--;
          
          // Process next request in queue
          if (this.requestQueue.length > 0) {
            const nextRequest = this.requestQueue.shift();
            if (nextRequest) {
              nextRequest().catch(() => {}); // Handle async without blocking
            }
          }
        }
      };
      
      execute();
    });
  }

  /**
   * Parses and categorizes API errors
   */
  private parseError(error: any): NIMServiceError {
    // If error is already a parsed NIMServiceError, return it as-is
    if (error && typeof error === 'object' && error.type && error.retryable !== undefined) {
      return error as NIMServiceError;
    }
    

    
    // Handle network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return {
        code: error.code,
        message: 'Network connection failed. Please check your internet connection.',
        type: 'network',
        retryable: true
      };
    }
    
    // Handle HTTP status errors (from OpenAI SDK or direct status)
    const status = error.status || error.response?.status;
    if (status === 401 || status === 403) {
      return {
        code: `HTTP_${status}`,
        message: 'Authentication failed. Please check your NIM API key.',
        type: 'authentication',
        retryable: false
      };
    }
    
    if (status === 429) {
      return {
        code: 'HTTP_429',
        message: 'Rate limit exceeded. Please reduce request frequency.',
        type: 'rate_limit',
        retryable: true
      };
    }
    
    if (status && status >= 500) {
      return {
        code: `HTTP_${status}`,
        message: 'Server error. Please try again later.',
        type: 'server',
        retryable: true
      };
    }
    
    return {
      code: error.code || error.type || 'UNKNOWN',
      message: error.message || 'Unknown error occurred',
      type: 'unknown',
      retryable: false
    };
  }

  /**
   * Tests the service connectivity and authentication
   */
  async testConnection(): Promise<boolean> {
    try {
      this.outputChannel.appendLine('Testing NIM service connection...');
      
      const testEmbedding = await this.generateEmbedding('test connection');
      
      if (testEmbedding.embedding && testEmbedding.embedding.length > 0) {
        this.outputChannel.appendLine('NIM service connection test successful');
        return true;
      }
      
      this.outputChannel.appendLine('NIM service connection test failed: Invalid response');
      return false;
    } catch (error) {
      const nimError = this.parseError(error);
      this.outputChannel.appendLine(`NIM service connection test failed: ${nimError.message}`);
      return false;
    }
  }

  /**
   * Gets service health and status information
   */
  async getServiceInfo(): Promise<{
    model: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: number;
    lastError?: string;
  }> {
    const startTime = Date.now();
    
    try {
      await this.generateEmbedding('health check');
      const responseTime = Date.now() - startTime;
      
      return {
        model: this.config.model,
        status: responseTime < 5000 ? 'healthy' : 'degraded',
        responseTime
      };
    } catch (error) {
      const nimError = this.parseError(error);
      return {
        model: this.config.model,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastError: nimError.message
      };
    }
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Disposes of resources
   */
  dispose(): void {
    this.requestQueue = [];
    this.outputChannel.dispose();
  }
}

/**
 * Factory function to create NIM service from environment variables
 */
export function createNIMServiceFromEnv(): NIMEmbeddingService {
  const apiKey = process.env.NIM_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      'NIM_API_KEY environment variable is required. ' +
      'Please set it in your .env file or system environment.'
    );
  }
  
  return new NIMEmbeddingService({
    apiKey,
    baseUrl: process.env.NIM_BASE_URL,
    model: process.env.NIM_MODEL,
    timeout: process.env.NIM_TIMEOUT ? parseInt(process.env.NIM_TIMEOUT) : undefined,
    retryAttempts: process.env.NIM_RETRY_ATTEMPTS ? parseInt(process.env.NIM_RETRY_ATTEMPTS) : undefined,
    maxConcurrentRequests: process.env.NIM_MAX_CONCURRENT ? parseInt(process.env.NIM_MAX_CONCURRENT) : undefined,
    batchSize: process.env.NIM_BATCH_SIZE ? parseInt(process.env.NIM_BATCH_SIZE) : undefined
  });
} 