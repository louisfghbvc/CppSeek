# Technical Context - CppSeek Extension

## Technology Stack

### Core Technologies
- **VSCode Extension API**: Core platform for extension development
- **TypeScript**: Primary development language for extension
- **Node.js**: Runtime environment for extension execution
- **Text Processing**: Fixed-size chunking with token counting (Phase 1)
- **clangd**: Advanced AST parsing and semantic analysis (Phase 2+)

### AI/ML Technologies
- **Nvidia Models**: Local embedding service (llama-3.2-nv-embedqa-1b-v2)
- **FAISS**: Vector similarity search and indexing
- **SQLite**: Metadata storage and caching
- **Cosine Similarity**: Vector comparison algorithm

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
    "vscode": "^1.74.0",
    "faiss-node": "^0.5.0",
    "sqlite3": "^5.1.0",
    "crypto": "^1.0.1"
  },
  "devDependencies": {
    "@types/vscode": "^1.74.0",
    "typescript": "^4.9.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "eslint": "^8.0.0"
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

### Embedding Strategy
**Decision**: Local-first approach with Nvidia models
- **Primary**: Nvidia llama-3.2-nv-embedqa-1b-v2 (local)
- **Benefits**: No API costs, full privacy, offline capability
- **Future**: HuggingFace transformers.js for browser support

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