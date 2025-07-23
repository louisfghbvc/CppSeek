import { NIMEmbeddingService, NIMServiceConfig, NIMServiceError } from '../services/nimEmbeddingService';
import OpenAI from 'openai';

// Mock OpenAI module
jest.mock('openai');
const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

// Mock vscode module
jest.mock('vscode', () => ({
  window: {
    createOutputChannel: jest.fn().mockReturnValue({
      appendLine: jest.fn(),
      dispose: jest.fn()
    })
  }
}));

describe('NIMEmbeddingService', () => {
  let mockClient: jest.Mocked<OpenAI>;
  let service: NIMEmbeddingService;
  let config: NIMServiceConfig;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock OpenAI client
    mockClient = {
      embeddings: {
        create: jest.fn()
      }
    } as any;
    
    MockedOpenAI.mockImplementation(() => mockClient);

    config = {
      apiKey: 'test-api-key',
      baseUrl: 'https://test.api.com/v1',
      model: 'test-model',
      timeout: 30000,
      retryAttempts: 3,
      maxConcurrentRequests: 10,
      batchSize: 50
    };
  });

  afterEach(() => {
    if (service) {
      service.dispose();
    }
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with valid configuration', () => {
      expect(() => {
        service = new NIMEmbeddingService(config);
      }).not.toThrow();
      
      expect(MockedOpenAI).toHaveBeenCalledWith({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
        timeout: config.timeout
      });
    });

    it('should throw error when API key is missing', () => {
      const invalidConfig = { ...config, apiKey: '' };
      
      expect(() => {
        service = new NIMEmbeddingService(invalidConfig);
      }).toThrow('NIM API key is required');
    });

    it('should throw error when base URL is missing', () => {
      const invalidConfig = { ...config, baseUrl: '' };
      
      expect(() => {
        service = new NIMEmbeddingService(invalidConfig);
      }).toThrow('NIM base URL is required');
    });

    it('should throw error when model is missing', () => {
      const invalidConfig = { ...config, model: '' };
      
      expect(() => {
        service = new NIMEmbeddingService(invalidConfig);
      }).toThrow('NIM model name is required');
    });

    it('should use default configuration values', () => {
      const partialConfig = { apiKey: 'test-key' };
      service = new NIMEmbeddingService(partialConfig);
      
      expect(MockedOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-key',
        baseURL: 'https://integrate.api.nvidia.com/v1',
        timeout: 30000
      });
    });
  });

  describe('Single Embedding Generation', () => {
    beforeEach(() => {
      service = new NIMEmbeddingService(config);
    });

    it('should generate embedding successfully', async () => {
      const mockResponse = {
        data: [{
          embedding: [0.1, 0.2, 0.3]
        }],
        usage: {
          prompt_tokens: 10,
          total_tokens: 10
        }
      };

      mockClient.embeddings.create.mockResolvedValueOnce(mockResponse);

      const result = await service.generateEmbedding('test input');

      expect(result).toEqual({
        embedding: [0.1, 0.2, 0.3],
        usage: {
          prompt_tokens: 10,
          total_tokens: 10
        }
      });

      expect(mockClient.embeddings.create).toHaveBeenCalledWith({
        input: ['test input'],
        model: config.model,
        encoding_format: "float",
        input_type: "query",
        truncate: "NONE"
      });
    });

    it('should throw error for empty input', async () => {
      await expect(service.generateEmbedding('')).rejects.toThrow('Text input cannot be empty');
      await expect(service.generateEmbedding('   ')).rejects.toThrow('Text input cannot be empty');
    });

    it('should handle API authentication errors', async () => {
      const apiError = { status: 401, message: 'Unauthorized' };
      mockClient.embeddings.create.mockRejectedValueOnce(apiError);

      await expect(service.generateEmbedding('test')).rejects.toMatchObject({
        type: 'authentication',
        retryable: false
      });
    });

    it('should handle API rate limiting errors', async () => {
      const apiError = { status: 429, message: 'Rate limit exceeded' };
      mockClient.embeddings.create.mockRejectedValueOnce(apiError);

      await expect(service.generateEmbedding('test')).rejects.toMatchObject({
        type: 'rate_limit',
        retryable: true
      });
    });

    it('should handle network errors', async () => {
      const networkError = { code: 'ECONNREFUSED', message: 'Connection refused' };
      mockClient.embeddings.create.mockRejectedValueOnce(networkError);

      await expect(service.generateEmbedding('test')).rejects.toMatchObject({
        type: 'network',
        retryable: true
      });
    });

    it('should handle server errors', async () => {
      const serverError = { status: 500, message: 'Internal server error' };
      mockClient.embeddings.create.mockRejectedValueOnce(serverError);

      await expect(service.generateEmbedding('test')).rejects.toMatchObject({
        type: 'server',
        retryable: true
      });
    });
  });

  describe('Batch Embedding Generation', () => {
    beforeEach(() => {
      service = new NIMEmbeddingService(config);
    });

    it('should generate batch embeddings successfully', async () => {
      const mockResponse = {
        data: [
          { embedding: [0.1, 0.2, 0.3] },
          { embedding: [0.4, 0.5, 0.6] }
        ],
        usage: {
          prompt_tokens: 20,
          total_tokens: 20
        }
      };

      mockClient.embeddings.create.mockResolvedValueOnce(mockResponse);

      const result = await service.generateBatchEmbeddings(['input1', 'input2']);

      expect(result).toHaveLength(2);
      expect(result[0].embedding).toEqual([0.1, 0.2, 0.3]);
      expect(result[1].embedding).toEqual([0.4, 0.5, 0.6]);
    });

    it('should handle large batches with chunking', async () => {
      const largeInput = Array(150).fill('test input'); // Exceeds batch size of 50
      
      const mockResponse = {
        data: Array(50).fill({ embedding: [0.1, 0.2, 0.3] }),
        usage: { prompt_tokens: 500, total_tokens: 500 }
      };

      mockClient.embeddings.create.mockResolvedValue(mockResponse);

      const result = await service.generateBatchEmbeddings(largeInput);

      expect(result).toHaveLength(150);
      expect(mockClient.embeddings.create).toHaveBeenCalledTimes(3); // 150/50 = 3 batches
    });

    it('should filter out empty strings', async () => {
      const mockResponse = {
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        usage: { prompt_tokens: 10, total_tokens: 10 }
      };

      mockClient.embeddings.create.mockResolvedValueOnce(mockResponse);

      const result = await service.generateBatchEmbeddings(['valid input', '', '   ', 'another valid']);

      expect(mockClient.embeddings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          input: ['valid input', 'another valid']
        })
      );
    });

    it('should throw error for empty array', async () => {
      await expect(service.generateBatchEmbeddings([])).rejects.toThrow('Text array cannot be empty');
    });

    it('should throw error when all inputs are empty', async () => {
      await expect(service.generateBatchEmbeddings(['', '   ', ''])).rejects.toThrow('No valid text inputs provided');
    });
  });

  describe('Retry Logic', () => {
    beforeEach(() => {
      service = new NIMEmbeddingService({ ...config, retryAttempts: 2 });
    });

    it('should retry on retryable errors', async () => {
      const networkError = { code: 'ECONNREFUSED', message: 'Connection refused' };
      const mockResponse = {
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        usage: { prompt_tokens: 10, total_tokens: 10 }
      };

      mockClient.embeddings.create
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockResponse);

      const result = await service.generateEmbedding('test');

      expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
      expect(mockClient.embeddings.create).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      const authError = { status: 401, message: 'Unauthorized' };
      mockClient.embeddings.create.mockRejectedValueOnce(authError);

      await expect(service.generateEmbedding('test')).rejects.toMatchObject({
        type: 'authentication'
      });

      expect(mockClient.embeddings.create).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retry attempts', async () => {
      const networkError = { code: 'ECONNREFUSED', message: 'Connection refused' };
      mockClient.embeddings.create.mockRejectedValue(networkError);

      await expect(service.generateEmbedding('test')).rejects.toMatchObject({
        type: 'network'
      });

      expect(mockClient.embeddings.create).toHaveBeenCalledTimes(2); // Original + 1 retry
    });
  });

  describe('Connection Testing', () => {
    beforeEach(() => {
      service = new NIMEmbeddingService(config);
    });

    it('should return true for successful connection test', async () => {
      const mockResponse = {
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        usage: { prompt_tokens: 10, total_tokens: 10 }
      };

      mockClient.embeddings.create.mockResolvedValueOnce(mockResponse);

      const result = await service.testConnection();

      expect(result).toBe(true);
    });

    it('should return false for failed connection test', async () => {
      const apiError = { status: 401, message: 'Unauthorized' };
      mockClient.embeddings.create.mockRejectedValueOnce(apiError);

      const result = await service.testConnection();

      expect(result).toBe(false);
    });

    it('should return false for invalid response', async () => {
      const mockResponse = {
        data: [{ embedding: [] }], // Empty embedding
        usage: { prompt_tokens: 10, total_tokens: 10 }
      };

      mockClient.embeddings.create.mockResolvedValueOnce(mockResponse);

      const result = await service.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('Service Info', () => {
    beforeEach(() => {
      service = new NIMEmbeddingService(config);
    });

    it('should return healthy status for fast response', async () => {
      const mockResponse = {
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        usage: { prompt_tokens: 10, total_tokens: 10 }
      };

      mockClient.embeddings.create.mockResolvedValueOnce(mockResponse);

      const info = await service.getServiceInfo();

      expect(info.status).toBe('healthy');
      expect(info.model).toBe(config.model);
      expect(info.responseTime).toBeLessThan(5000);
    });

    it('should return unhealthy status for API errors', async () => {
      const apiError = { status: 500, message: 'Server error' };
      mockClient.embeddings.create.mockRejectedValueOnce(apiError);

      const info = await service.getServiceInfo();

      expect(info.status).toBe('unhealthy');
      expect(info.lastError).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      service = new NIMEmbeddingService({ ...config, maxConcurrentRequests: 2 });
    });

    it('should handle concurrent requests within limit', async () => {
      const mockResponse = {
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        usage: { prompt_tokens: 10, total_tokens: 10 }
      };

      mockClient.embeddings.create.mockResolvedValue(mockResponse);

      const promises = [
        service.generateEmbedding('test1'),
        service.generateEmbedding('test2')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(2);
      expect(mockClient.embeddings.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('Resource Cleanup', () => {
    it('should dispose resources properly', () => {
      service = new NIMEmbeddingService(config);
      
      expect(() => service.dispose()).not.toThrow();
    });
  });
}); 