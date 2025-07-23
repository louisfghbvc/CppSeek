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
- **FAISS**: Vector similarity search and indexing ⏳ **PENDING**
- **SQLite**: Metadata storage and caching ⏳ **PENDING**
- **Cosine Similarity**: Vector comparison algorithm ⏳ **PENDING**
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
1. **Extension Scaffold**: Use `yo code` generator
2. **Dependencies**: Install required npm packages
3. **Nvidia NIM Setup**: Configure local inference service
4. **clangd Setup**: Configure for Phase 2 AST parsing
5. **Testing**: Configure Jest and test environment

### Key Dependencies
```json
{
  "dependencies": {
    "vscode": "^1.102.0",
    "faiss-node": "^0.5.1",
    "sqlite3": "^5.1.7",
    "@xenova/transformers": "^2.17.2",
    "openai": "^4.0.0",
    "dotenv": "^16.0.0",
    "chardet": "^2.1.0",
    "iconv-lite": "^0.6.3"
  },
  "devDependencies": {
    "@types/vscode": "^1.102.0",
    "@types/node": "20.x",
    "@types/sqlite3": "^3.1.11",
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
- **Search Latency**: Return results within 500ms
- **Memory Usage**: Stay under 200MB for vector storage
- **Incremental Updates**: Process file changes in <1 second

### Platform Constraints
- **VSCode API Limitations**: Must work within extension sandbox
- **Node.js Limitations**: Single-threaded event loop considerations
- **File System Access**: Limited to workspace folder
- **Network Requests**: Rate limiting for external API calls

### Security Requirements
- **API Key Management**: Secure storage of OpenAI credentials
- **Local Data**: No sensitive code sent to external services
- **Sandboxing**: Respect VSCode security model
- **Privacy**: Option for fully local operation

## Architecture Decisions

### **🔧 Tokenization Strategy** (Updated 2025-07-15)
**Decision**: Use @xenova/transformers for Llama-compatible tokenization
- **Previous**: tiktoken (designed for OpenAI models)
- **Current**: @xenova/transformers (supports Nvidia llama-3.2-nv-embedqa-1b-v2)
- **Benefits**: 
  - Proper tokenization alignment with our embedding model
  - Accurate 500-token chunk boundaries
  - Better embedding quality
  - Model-specific tokenizer support

### Embedding Strategy
**Decision**: Cloud-hosted Nvidia NIM API with secure configuration
- **Primary**: Nvidia llama-3.2-nv-embedqa-1b-v2 (cloud-hosted NIM API) ✅ **IMPLEMENTED & VALIDATED**
- **Configuration**: .env file → environment variables → VSCode settings priority
- **Performance**: 361ms average response time, 2048-dimensional embeddings
- **Security**: Secure API key management with .gitignore protection
- **Benefits**: No local GPU requirements, managed infrastructure, instant deployment
- **Tokenization**: @xenova/transformers for accurate token counting ✅ **IMPLEMENTED**

### Storage Strategy
**Decision**: Local-first with cloud backup option
- **Vector Storage**: FAISS for fast similarity search
- **Metadata**: SQLite for file paths and context
- **Cache**: In-memory LRU for frequently accessed data
- **Backup**: Optional cloud sync for teams

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
│   ├── embedding/      # Embedding generation
│   ├── search/         # Search engine
│   └── storage/        # Data persistence
├── parsers/            # AST parsing logic
├── ui/                 # User interface components
├── utils/              # Utility functions
└── test/               # Test files
```

### Error Handling Strategy
- **Graceful Degradation**: Fallback to text search if semantic fails
- **User Feedback**: Clear error messages and recovery suggestions
- **Logging**: Comprehensive debug information
- **Retry Logic**: Exponential backoff for API failures

### Testing Strategy
- **Unit Tests**: Core functionality and algorithms
- **Integration Tests**: End-to-end search scenarios
- **Performance Tests**: Large codebase benchmarks
- **Mock Services**: Simulate external API responses

## Integration Points

### VSCode API Integration
- **Commands**: Register custom commands in command palette
- **Providers**: Implement search and completion providers
- **Views**: Custom tree view for search results
- **Webview**: Chat interface for LLM interaction
- **File Watcher**: Monitor file changes for index updates

### External Service Integration
- **OpenAI API**: Embedding generation and chat completion
- **Rate Limiting**: Respect API rate limits and quotas
- **Authentication**: Secure API key management
- **Error Handling**: Graceful handling of service failures

## Deployment Considerations

### Extension Packaging
- **Bundle Size**: Keep extension bundle under 50MB
- **Dependencies**: Bundle necessary native dependencies
- **Platform Support**: Windows, macOS, Linux compatibility
- **Versioning**: Semantic versioning for releases

### Distribution Strategy
- **VS Code Marketplace**: Primary distribution channel
- **GitHub Releases**: Direct download option
- **Enterprise**: Private marketplace for corporate users
- **Beta Channel**: Early access for testing

## Future Technical Considerations

### Scalability
- **Distributed Indexing**: Support for large codebases
- **Cloud Storage**: Remote vector storage options
- **Team Collaboration**: Shared index and search results
- **Performance Monitoring**: Telemetry and analytics

### Extensibility
- **Plugin System**: Support for additional languages
- **Custom Models**: User-provided embedding models
- **API Integration**: External tool integration
- **Configuration**: Extensive customization options 