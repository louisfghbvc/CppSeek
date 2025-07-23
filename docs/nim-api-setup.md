# Nvidia NIM API Integration Guide

This guide explains how to set up and use the Nvidia NIM API integration for CppSeek semantic search.

## Overview

CppSeek uses Nvidia's NIM (Nvidia Inference Microservices) API to generate embeddings for C/C++ code. The integration provides:

- **Cloud-hosted inference**: No local model deployment required
- **High-quality embeddings**: Using `llama-3.2-nv-embedqa-1b-v2` model
- **Batch processing**: Efficient handling of multiple code chunks
- **Robust error handling**: Automatic retries and comprehensive error categorization
- **Rate limiting**: Built-in concurrency control

## Prerequisites

1. **Nvidia NGC Account**: Sign up at [NGC Catalog](https://catalog.ngc.nvidia.com/)
2. **API Access**: Get access to NIM API services
3. **API Key**: Generate an API key from your NGC account

## Installation

The required dependencies are already included in the project:

```bash
npm install openai dotenv
```

## Configuration

### Method 1: Environment File (.env) - **Recommended**

Create a `.env` file in the project root:

```bash
# Nvidia NIM API Configuration
NIM_API_KEY=your_nvidia_api_key_here

# Optional configurations (uncomment to override defaults)
# NIM_BASE_URL=https://integrate.api.nvidia.com/v1
# NIM_MODEL=nvidia/llama-3.2-nv-embedqa-1b-v2
# NIM_TIMEOUT=30000
# NIM_RETRY_ATTEMPTS=3
# NIM_MAX_CONCURRENT=10
# NIM_BATCH_SIZE=50
```

### Method 2: System Environment Variables

```bash
export NIM_API_KEY=your_nvidia_api_key_here
```

### Method 3: VSCode Settings

Add to your VSCode settings (`.vscode/settings.json`):

```json
{
  "cppseek.nim.apiKey": "your_nvidia_api_key_here"
}
```

## API Configuration

The NIM service supports these configuration options:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `apiKey` | *required* | Your Nvidia NIM API key |
| `baseUrl` | `https://integrate.api.nvidia.com/v1` | NIM API endpoint |
| `model` | `nvidia/llama-3.2-nv-embedqa-1b-v2` | Embedding model |
| `timeout` | `30000` | Request timeout (ms) |
| `retryAttempts` | `3` | Number of retry attempts |
| `maxConcurrentRequests` | `10` | Max concurrent API calls |
| `batchSize` | `50` | Batch processing size |

## Usage Examples

### Basic Usage

```typescript
import { NIMEmbeddingService } from '../services/nimEmbeddingService';
import { getNIMConfig } from '../config/nimConfig';

// Initialize service
const config = getNIMConfig();
const nimService = new NIMEmbeddingService(config);

// Generate single embedding
const cppCode = `
class Vector3D {
    float x, y, z;
public:
    Vector3D(float x, float y, float z) : x(x), y(y), z(z) {}
    float magnitude() const { return std::sqrt(x*x + y*y + z*z); }
};
`;

const result = await nimService.generateEmbedding(cppCode);
console.log(`Generated ${result.embedding.length}-dimensional embedding`);
```

### Batch Processing

```typescript
const codeSnippets = [
    'int main() { return 0; }',
    'void printHello() { std::cout << "Hello" << std::endl; }',
    'class MyClass { public: int value; };'
];

const results = await nimService.generateBatchEmbeddings(codeSnippets);
console.log(`Generated ${results.length} embeddings`);
```

### Connection Testing

```typescript
// Test API connectivity
const isConnected = await nimService.testConnection();
if (isConnected) {
    console.log('NIM API is ready');
} else {
    console.log('NIM API connection failed');
}

// Get service health info
const info = await nimService.getServiceInfo();
console.log(`Status: ${info.status}, Response time: ${info.responseTime}ms`);
```

## Error Handling

The service provides comprehensive error categorization:

```typescript
try {
    const result = await nimService.generateEmbedding(code);
} catch (error) {
    switch (error.type) {
        case 'authentication':
            console.log('Check your API key');
            break;
        case 'rate_limit':
            console.log('Rate limit exceeded, backing off...');
            break;
        case 'network':
            console.log('Network issue, retrying...');
            break;
        case 'server':
            console.log('Server error, will retry');
            break;
        default:
            console.log('Unknown error:', error.message);
    }
}
```

## Performance Considerations

### Batch Size Optimization

- **Small batches (1-10)**: Lower latency per request
- **Medium batches (10-50)**: Balanced throughput and latency
- **Large batches (50+)**: Maximum throughput, higher latency

### Concurrency Control

The service automatically manages concurrent requests to respect API limits:

```typescript
const service = new NIMEmbeddingService({
    apiKey: 'your-key',
    maxConcurrentRequests: 5 // Limit concurrent requests
});
```

### Rate Limiting

Built-in retry logic with exponential backoff:

```typescript
const service = new NIMEmbeddingService({
    apiKey: 'your-key',
    retryAttempts: 3,
    timeout: 30000
});
```

## Testing

### Unit Tests

Run the comprehensive unit tests:

```bash
npm test -- --testPathPattern=nimEmbeddingService.test.ts
```

### Integration Tests

Test real API connectivity (requires valid API key):

```bash
npm test -- --testPathPattern=nimIntegration.test.ts
```

## Security Best Practices

1. **Never commit API keys**: Add `.env` to `.gitignore`
2. **Use environment variables**: Avoid hardcoding keys in source code
3. **Rotate keys regularly**: Update API keys periodically
4. **Monitor usage**: Track API consumption and costs
5. **Limit access**: Use least-privilege principle for API keys

## Troubleshooting

### Common Issues

**Authentication Error (401)**
```
Solution: Verify your API key is correct and has proper permissions
```

**Rate Limit Exceeded (429)**
```
Solution: Reduce batch size or increase retry delay
```

**Network Connection Failed**
```
Solution: Check internet connectivity and firewall settings
```

**Invalid Response Format**
```
Solution: Verify model name and API endpoint are correct
```

### Debug Mode

Enable detailed logging:

```typescript
// Set environment variable
process.env.LOG_LEVEL = 'debug';

// Or use VSCode output channel
// Check "CppSeek NIM Service" in Output panel
```

### API Limits

Current known limits:
- **Request rate**: ~60 requests/minute
- **Batch size**: Up to 100 inputs per request
- **Input length**: ~8192 tokens per input
- **Concurrent requests**: ~10 simultaneous

## Advanced Configuration

### Custom Model Configuration

```typescript
const customConfig = {
    apiKey: 'your-key',
    model: 'nvidia/custom-embedding-model',
    baseUrl: 'https://custom.api.endpoint/v1'
};

const service = new NIMEmbeddingService(customConfig);
```

### Monitoring and Metrics

```typescript
// Get detailed service information
const info = await service.getServiceInfo();
console.log({
    model: info.model,
    status: info.status,
    responseTime: info.responseTime,
    lastError: info.lastError
});
```

## Integration with CppSeek

The NIM service integrates seamlessly with CppSeek's indexing pipeline:

1. **File Discovery**: Scan workspace for C/C++ files
2. **Text Chunking**: Split files into 500-token chunks with overlap
3. **Embedding Generation**: Use NIM API to generate embeddings
4. **Vector Storage**: Store embeddings in FAISS index
5. **Semantic Search**: Query embeddings for relevant code

## Next Steps

After completing Task 9, you can proceed to:

- **Task 10**: Enhanced NIM embedding API integration layer
- **Task 11**: FAISS vector storage system setup
- **Task 12**: Cosine similarity search algorithm implementation

## Support

For issues or questions:

1. Check the [NIM API Documentation](https://docs.nvidia.com/nim/)
2. Review CppSeek logs in VSCode Output panel
3. Run integration tests to verify setup
4. Check NGC support resources 