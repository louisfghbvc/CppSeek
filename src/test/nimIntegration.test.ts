import { NIMEmbeddingService } from '../services/nimEmbeddingService';
import { getNIMConfig } from '../config/nimConfig';

// Mock vscode module
jest.mock('vscode', () => ({
  window: {
    createOutputChannel: jest.fn().mockReturnValue({
      appendLine: jest.fn(),
      dispose: jest.fn()
    })
  },
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue(undefined)
    })
  }
}));

describe('NIM API Integration Tests', () => {
  let service: NIMEmbeddingService;

  beforeAll(() => {
    // Skip integration tests if no API key is available
    if (!process.env.NIM_API_KEY) {
      console.log('Skipping integration tests - no NIM_API_KEY found');
      return;
    }
  });

  afterEach(() => {
    if (service) {
      service.dispose();
    }
  });

  describe('Real API Integration', () => {
    it('should connect to NIM API successfully', async () => {
      if (!process.env.NIM_API_KEY) {
        console.log('Skipping test - no NIM_API_KEY');
        return;
      }

      try {
        const config = getNIMConfig();
        service = new NIMEmbeddingService(config);
        
        const isConnected = await service.testConnection();
        expect(isConnected).toBe(true);
      } catch (error) {
        console.error('Connection test failed:', error);
        throw error;
      }
    }, 30000); // 30 second timeout for API calls

    it('should generate real embeddings for C++ code', async () => {
      if (!process.env.NIM_API_KEY) {
        console.log('Skipping test - no NIM_API_KEY');
        return;
      }

      try {
        const config = getNIMConfig();
        service = new NIMEmbeddingService(config);
        
        const cppCode = `
        class Vector3D {
        private:
            float x, y, z;
        public:
            Vector3D(float x, float y, float z) : x(x), y(y), z(z) {}
            
            Vector3D operator+(const Vector3D& other) const {
                return Vector3D(x + other.x, y + other.y, z + other.z);
            }
            
            float magnitude() const {
                return std::sqrt(x*x + y*y + z*z);
            }
        };
        `;

        const result = await service.generateEmbedding(cppCode);
        
        expect(result.embedding).toBeDefined();
        expect(Array.isArray(result.embedding)).toBe(true);
        expect(result.embedding.length).toBeGreaterThan(0);
        expect(result.usage.total_tokens).toBeGreaterThan(0);
        
        // Verify embeddings are valid numbers
        expect(result.embedding.every(num => typeof num === 'number' && !isNaN(num))).toBe(true);
        
        console.log(`Generated embedding with ${result.embedding.length} dimensions for ${result.usage.total_tokens} tokens`);
      } catch (error) {
        console.error('Embedding generation failed:', error);
        throw error;
      }
    }, 30000);

    it('should handle batch embedding generation', async () => {
      if (!process.env.NIM_API_KEY) {
        console.log('Skipping test - no NIM_API_KEY');
        return;
      }

      try {
        const config = getNIMConfig();
        service = new NIMEmbeddingService(config);
        
        const codeSnippets = [
          'int main() { return 0; }',
          'void printHello() { std::cout << "Hello World" << std::endl; }',
          'class MyClass { public: int value; };'
        ];

        const results = await service.generateBatchEmbeddings(codeSnippets);
        
        expect(results).toHaveLength(3);
        expect(results.every(r => r.embedding.length > 0)).toBe(true);
        
        console.log(`Generated ${results.length} embeddings successfully`);
      } catch (error) {
        console.error('Batch embedding generation failed:', error);
        throw error;
      }
    }, 30000);

    it('should provide service health information', async () => {
      if (!process.env.NIM_API_KEY) {
        console.log('Skipping test - no NIM_API_KEY');
        return;
      }

      try {
        const config = getNIMConfig();
        service = new NIMEmbeddingService(config);
        
        const info = await service.getServiceInfo();
        
        expect(info.model).toBe(config.model);
        expect(info.status).toMatch(/healthy|degraded|unhealthy/);
        expect(info.responseTime).toBeGreaterThan(0);
        
        console.log(`Service status: ${info.status}, Response time: ${info.responseTime}ms`);
      } catch (error) {
        console.error('Service info failed:', error);
        throw error;
      }
    }, 30000);
  });
}); 