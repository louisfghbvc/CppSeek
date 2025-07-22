---
id: 9
title: 'Set up Nvidia NIM API integration'
status: pending
priority: critical
feature: Embedding & Search Infrastructure
dependencies:
  - 8
assigned_agent: null
created_at: "2025-07-17T12:00:00Z"
started_at: null
completed_at: null
error_log: null
---

## Description

Set up Nvidia NIM API integration to provide embedding generation capabilities for the CppSeek semantic search engine using cloud-hosted inference. This task establishes the foundational AI service integration that will power semantic understanding of C/C++ code through Nvidia's hosted NIM service.

## Details

### Core Functionality Requirements
- **NIM API Integration**: Configure access to Nvidia's cloud-hosted NIM API service
- **Authentication Setup**: Secure API key management and authentication
- **Client Configuration**: Set up OpenAI-compatible client for NIM API access
- **Error Handling**: Implement robust API error handling and retry mechanisms
- **Performance Optimization**: Optimize API calls and response handling
- **Documentation**: Create setup guides and API usage documentation

### Implementation Steps
1. **API Client Setup and Configuration**
   - Install OpenAI client library for NIM API compatibility
   - Configure API authentication with NV token
   - Set up base URL and endpoint configuration
   - Implement secure credential management

2. **Service Integration and Configuration**
   - Create NIM service wrapper class for embedding generation
   - Configure API client with proper headers and parameters
   - Set up request/response handling and validation
   - Implement connection pooling and optimization

3. **API Testing and Validation**
   - Test API connectivity and authentication
   - Validate embedding generation with sample inputs
   - Implement error handling for API failures
   - Set up monitoring and logging for API usage

### API Client Configuration
```typescript
import OpenAI from 'openai';

interface NIMServiceConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeout: number;
  retryAttempts: number;
  maxConcurrentRequests: number;
}

const defaultConfig: NIMServiceConfig = {
  apiKey: process.env.NIM_API_KEY || '',
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  model: 'nvidia/llama-3.2-nv-embedqa-1b-v2',
  timeout: 30000,
  retryAttempts: 3,
  maxConcurrentRequests: 10
};

class NIMEmbeddingService {
  private client: OpenAI;
  private config: NIMServiceConfig;
  
  constructor(config: NIMServiceConfig = defaultConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl
    });
  }
  
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      input: [text],
      model: this.config.model,
      encoding_format: "float",
      extra_body: { 
        input_type: "query", 
        truncate: "NONE" 
      }
    });
    
    return response.data[0].embedding;
  }
  
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      input: texts,
      model: this.config.model,
      encoding_format: "float",
      extra_body: { 
        input_type: "query", 
        truncate: "NONE" 
      }
    });
    
    return response.data.map(item => item.embedding);
  }
}
```

### Environment Configuration
```bash
# .env file
NIM_API_KEY=your_nvidia_api_key_here

# Optional configuration
NIM_BASE_URL=https://integrate.api.nvidia.com/v1
NIM_MODEL=nvidia/llama-3.2-nv-embedqa-1b-v2
NIM_TIMEOUT=30000
```

### Package Dependencies
```json
{
  "dependencies": {
    "openai": "^4.0.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0"
  }
}
```

## Testing Strategy

### Unit Tests
- [ ] API client initialization and configuration
- [ ] Authentication validation with API key
- [ ] Single embedding generation with known inputs
- [ ] Batch embedding generation functionality
- [ ] Error handling for invalid API responses
- [ ] Retry logic for transient failures

### Integration Tests
- [ ] End-to-end API connectivity testing
- [ ] Large batch processing validation
- [ ] API rate limiting and throttling behavior
- [ ] Network failure recovery scenarios
- [ ] Performance under concurrent requests

### API Validation Tests
- [ ] Verify embedding vector dimensions and format
- [ ] Test different input text sizes and formats
- [ ] Validate response structure and metadata
- [ ] Error handling for malformed requests
- [ ] Authentication failure scenarios

## Acceptance Criteria

### Primary Requirements
- [ ] OpenAI client successfully configured for NIM API
- [ ] API authentication working with provided NV token
- [ ] Single embedding generation functional
- [ ] Batch embedding generation operational
- [ ] Error handling robust for API failures
- [ ] Environment configuration properly set up
- [ ] Service ready for integration with Task 10

### Performance Requirements
- [ ] API response time < 2 seconds for single embeddings
- [ ] Batch processing efficiency for 10+ inputs
- [ ] Proper error recovery within 5 seconds
- [ ] Memory usage optimized for API responses
- [ ] Rate limiting compliance with API constraints

## Success Metrics
- API integration success rate: 100%
- Average response time: < 2 seconds
- Batch processing efficiency: > 80% of theoretical maximum
- Error recovery time: < 5 seconds
- Authentication reliability: 100%

## Definition of Done
- [ ] OpenAI client library installed and configured
- [ ] NIM API authentication working with NV token
- [ ] NIMEmbeddingService class implemented and tested
- [ ] Single and batch embedding generation functional
- [ ] Comprehensive error handling implemented
- [ ] Environment configuration documented
- [ ] API usage examples and documentation complete
- [ ] Service integration ready for Task 10
- [ ] Performance baseline established

## Next Steps
Upon completion, this task enables:
- **Task 10**: Enhanced NIM embedding API integration layer
- **Embedding Pipeline**: Foundation for code chunk vectorization
- **Semantic Search**: Core AI service for semantic understanding
- **Development Workflow**: Reliable cloud-based AI service
