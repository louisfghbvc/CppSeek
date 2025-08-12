# Technical Context - CppSeek Extension

## Technology Stack

### Core Technologies
- **VSCode Extension API**: Core platform for extension development
- **TypeScript**: Primary development language for extension
- **Node.js**: Runtime environment for extension execution
- **Text Processing**: Fixed-size chunking with token counting (Phase 1)
- **clangd**: Advanced AST parsing and semantic analysis (Phase 2+)

### AI/ML Technologies
- **Nvidia NIM API**: Cloud-hosted embedding service (llama-3.2-nv-embedqa-1b-v2) ✅ **IMPLEMENTED**
- **OpenAI SDK**: API client for NIM compatibility ✅ **IMPLEMENTED** 
- **LangChain**: Modern RAG framework for document-based vector storage ✅ **IMPLEMENTED**
- **ChromaDB**: AI-native embedding database for vector similarity search ✅ **IMPLEMENTED**
- **Cosine Similarity**: Vector comparison algorithm ✅ **INTEGRATED WITH CHROMA**
- **@xenova/transformers**: Llama-compatible tokenization ✅ **IMPLEMENTED**
- **dotenv**: Secure environment configuration ✅ **IMPLEMENTED**

### Development Environment
- **VS Code**: Development IDE
- **Node.js 18+**: Runtime requirement
- **npm/yarn**: Package management
- **TypeScript Compiler**: Build system
- **ESLint**: Code quality
- **Jest**: Testing framework

## Development Setup

### Prerequisites
```bash
# Required tools
node --version  # v18.0.0 or higher
npm --version   # v8.0.0 or higher
code --version  # VS Code 1.74.0 or higher
```

### Installation Steps
1. **Extension Scaffold**: Use `yo code` generator ✅ **COMPLETED**
2. **Dependencies**: Install required npm packages ✅ **COMPLETED**
3. **Nvidia NIM Setup**: Configure cloud-hosted NIM API ✅ **COMPLETED**
4. **LangChain Integration**: Configure vector storage with ChromaDB ✅ **COMPLETED**
5. **Testing**: Configure Jest and test environment ✅ **COMPLETED**

### Key Dependencies
```json
{
  "dependencies": {
    "vscode": "^1.102.0",
    "@langchain/community": "^0.3.22",
    "@langchain/core": "^0.3.21",
    "@xenova/transformers": "^2.17.2",
    "openai": "^4.0.0",
    "dotenv": "^16.0.0",
    "chardet": "^2.1.0",
    "iconv-lite": "^0.6.3"
  },
  "devDependencies": {
    "@types/vscode": "^1.102.0",
    "@types/node": "20.x",
    "typescript": "^5.8.3",
    "jest": "^29.7.0",
    "@types/jest": "^30.0.0",
    "eslint": "^9.25.1",
    "prettier": "^3.6.2",
    "webpack": "^5.99.7",
    "ts-loader": "^9.5.2"
  }
}
```

## Technical Constraints

### Performance Requirements
- **Indexing Speed**: Complete medium codebase (~100k LOC) in <5 minutes
- **Search Latency**: Return results within 200ms (target for LangChain + Chroma)
- **Memory Usage**: Stay under 200MB for vector storage
- **Incremental Updates**: Process file changes in <1 second

### Platform Constraints
- **VSCode API Limitations**: Must work within extension sandbox
- **Node.js Limitations**: Single-threaded event loop considerations
- **File System Access**: Limited to workspace folder
- **Network Requests**: Rate limiting for external API calls

### Security Requirements
- **API Key Management**: Secure storage of NIM API credentials ✅ **IMPLEMENTED**
- **Local Data**: No sensitive code sent to external services
- **Sandboxing**: Respect VSCode security model
- **Privacy**: Option for fully local operation

## Architecture Decisions

### **🔧 Tokenization Strategy** (Implemented 2025-07-15)
**Decision**: Use @xenova/transformers for Llama-compatible tokenization
- **Implementation**: @xenova/transformers (supports Nvidia llama-3.2-nv-embedqa-1b-v2) ✅ **COMPLETED**
- **Benefits**: 
  - Proper tokenization alignment with our embedding model
  - Accurate 500-token chunk boundaries
  - Better embedding quality
  - Model-specific tokenizer support

### Embedding Strategy
**Decision**: Cloud-hosted Nvidia NIM API with secure configuration
- **Primary**: Nvidia llama-3.2-nv-embedqa-1b-v2 (cloud-hosted NIM API) ✅ **IMPLEMENTED & VALIDATED**
- **Configuration**: .env file → environment variables → VSCode settings priority ✅ **IMPLEMENTED**
- **Performance**: 361ms average response time, 2048-dimensional embeddings ✅ **VALIDATED**
- **Security**: Secure API key management with .gitignore protection ✅ **IMPLEMENTED**
- **Benefits**: No local GPU requirements, managed infrastructure, instant deployment
- **Tokenization**: @xenova/transformers for accurate token counting ✅ **IMPLEMENTED**

### Vector Storage Strategy
**Decision**: Modern RAG architecture with LangChain + ChromaDB ✅ **IMPLEMENTED**
- **Vector Storage**: ChromaDB with document-based architecture
- **LangChain Integration**: Complete RAG framework with retriever interface
- **Similarity Search**: Cosine similarity with configurable parameters
- **Metadata Handling**: Rich code context preservation in document format
- **Performance**: Optimized for development simplicity and search quality
- **Benefits**: Zero native dependencies, pure JavaScript/TypeScript implementation
- **Configuration**: Modern configuration management with VSCode settings integration

### Processing Pipeline
**Decision**: Asynchronous processing with worker threads
- **Main Thread**: UI interactions and file watching
- **Worker Threads**: AST parsing and embedding generation
- **Background Tasks**: Index updates and maintenance
- **Queue Management**: Prioritize user-initiated searches

## Development Patterns

### Code Organization
```
src/
├── extension.ts          # Main extension entry point
├── commands/            # Command handlers
├── providers/           # Search and completion providers
├── services/            # Core business logic
│   ├── indexing/       # Code indexing service
│   ├── nimEmbeddingService.ts  # Nvidia NIM integration
│   └── vectorStorage/  # Modern vector storage
│       ├── modernVectorStorage.ts  # LangChain + Chroma
│       ├── types.ts    # Core interfaces
│       └── index.ts    # Module exports
├── config/              # Configuration management
│   └── modernVectorStorageConfig.ts
├── ui/                 # User interface components
├── utils/              # Utility functions
└── test/               # Test files
    └── vectorStorage/  # Vector storage tests
```

### Error Handling Strategy
- **Graceful Degradation**: Fallback to text search if semantic fails
- **User Feedback**: Clear error messages and recovery suggestions
- **Logging**: Comprehensive debug information
- **Retry Logic**: Exponential backoff for API failures ✅ **IMPLEMENTED IN NIM SERVICE**

### Testing Strategy
- **Unit Tests**: Core functionality and algorithms ✅ **57/57 PASSING**
- **Integration Tests**: End-to-end search scenarios ✅ **IMPLEMENTED**
- **Performance Tests**: Large codebase benchmarks
- **Mock Services**: Simulate external API responses ✅ **COMPREHENSIVE MOCKING**

## Integration Points

### VSCode API Integration
- **Commands**: Register custom commands in command palette ✅ **IMPLEMENTED**
- **Providers**: Implement search and completion providers
- **Views**: Custom tree view for search results
- **Webview**: Chat interface for LLM interaction
- **File Watcher**: Monitor file changes for index updates

### External Service Integration
- **Nvidia NIM API**: Embedding generation with secure authentication ✅ **IMPLEMENTED**
- **ChromaDB**: Vector storage and similarity search ✅ **IMPLEMENTED**
- **Rate Limiting**: Respect API rate limits and quotas ✅ **IMPLEMENTED**
- **Authentication**: Secure API key management ✅ **IMPLEMENTED**
- **Error Handling**: Graceful handling of service failures ✅ **IMPLEMENTED**

## Deployment Considerations

### Extension Packaging
- **Bundle Size**: Keep extension bundle under 50MB (currently 86.8 KiB) ✅ **OPTIMIZED**
- **Dependencies**: Bundle necessary dependencies (LangChain, ChromaDB)
- **Platform Support**: Windows, macOS, Linux compatibility
- **Versioning**: Semantic versioning for releases

### Distribution Strategy
- **VS Code Marketplace**: Primary distribution channel
- **GitHub Releases**: Direct download option
- **Enterprise**: Private marketplace for corporate users
- **Beta Channel**: Early access for testing

## Implementation Status

### ✅ Completed Components
- **Modern Vector Storage**: Complete LangChain + ChromaDB implementation
- **NIM Embeddings Adapter**: Custom LangChain Embeddings bridge
- **Configuration System**: ModernVectorStorageConfigManager with validation
- **Testing Framework**: Comprehensive test coverage (31/31 vector storage tests passing)
- **Error Handling**: Robust error management and retry logic

### ✅ Validated Integrations
- **Nvidia NIM API**: Production-ready with 361ms response time
- **LangChain Framework**: Document-based vector storage working
- **ChromaDB**: Semantic search with cosine similarity operational
- **VSCode Extension**: Complete integration with settings and commands

### 🚀 Ready for Next Phase
- **Document Management**: Connect existing chunking pipeline with LangChain Documents
- **Performance Testing**: Establish benchmarking framework for <200ms search targets
- **System Integration**: Complete end-to-end functionality validation

## Future Technical Considerations

### Scalability
- **Distributed Indexing**: Support for large codebases
- **Cloud Storage**: Remote vector storage options via LangChain providers
- **Team Collaboration**: Shared index and search results
- **Performance Monitoring**: Telemetry and analytics

### Extensibility
- **Plugin System**: Support for additional languages
- **Custom Models**: User-provided embedding models via LangChain
- **Vector Store Flexibility**: Easy switching between ChromaDB, Pinecone, Weaviate
- **Configuration**: Extensive customization options ✅ **MODERN CONFIG SYSTEM** 