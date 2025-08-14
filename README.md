# CppSeek - AI-Powered Semantic Search for C/C++

CppSeek is a production-ready Visual Studio Code extension that brings intelligent semantic search capabilities to C and C++ codebases. Using advanced NVIDIA NIM AI embeddings and modern vector similarity search, CppSeek helps developers quickly find relevant code segments based on natural language queries rather than exact text matches.

**🎯 Version 0.0.1 - Production Ready** | **🤖 Powered by NVIDIA NIM** | **🗄️ LangChain + Chroma Architecture**

## 🚀 Features

### ✅ Core Features (Production Ready)

- **🎯 Semantic Search Engine**: AI-powered natural language search with NVIDIA NIM embeddings
- **🤖 NVIDIA NIM Integration**: llama-3.2-nv-embedqa-1b-v2 embeddings for superior accuracy
- **🗄️ Modern Vector Storage**: LangChain + Chroma for efficient similarity search
- **📁 Intelligent Workspace Indexing**: Recursive C/C++ file discovery with smart patterns
- **📄 Advanced Code Processing**: Context-aware chunking with boundary detection
- **🎯 Multi-factor Ranking**: AI-powered relevance scoring with user behavior tracking

### 🎨 User Interface & Experience

- **⌨️ Rich Keyboard Shortcuts**: `Ctrl+Shift+S` and 11 additional navigation commands
- **🖥️ Advanced Search Results UI**: Webview with syntax highlighting and navigation
- **📚 Search History & Bookmarks**: Persistent history with export functionality
- **📊 Real-time Progress Tracking**: Live status updates during indexing
- **⚙️ Comprehensive Configuration**: 40+ settings for all components
- **🔧 Professional Logging**: Detailed debugging and monitoring channels

## 📦 Installation

### From Source (Development)

1. Clone the repository:
```bash
git clone <repository-url>
cd CppSeek
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run compile
```

4. Package for installation:
```bash
npx vsce package
```

5. Install in VS Code:
   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X)
   - Click "..." menu → "Install from VSIX"
   - Select the generated `.vsix` file

## 🔧 Usage

### Getting Started

1. **Open a C/C++ workspace** - CppSeek activates automatically when you open C/C++ files
2. **Configure API key** - CppSeek will automatically show the configuration wizard on first use
3. **Index your workspace** - Use `CppSeek: Index Workspace` command or the welcome prompt
4. **Start searching** - Use `Ctrl+Shift+S` or the `CppSeek: Semantic Search` command

### First-Time Setup

On first launch, CppSeek will guide you through the setup process:

1. **Configuration Wizard** - Automatically appears to help you set up your NVIDIA NIM API key
2. **Multiple Configuration Options** - Choose from VS Code settings, environment variables, or .env files
3. **Configuration Testing** - Verify your setup works correctly
4. **Ready to Use** - Start indexing and searching your codebase

**Manual Setup Commands:**
- `CppSeek: Configuration Wizard` - Set up or change your API configuration
- `CppSeek: Test Configuration` - Verify your current configuration
- `CppSeek: Show Diagnostic` - Quick diagnostic check

### Available Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `CppSeek: Semantic Search` | `Ctrl+Shift+S` | Start a semantic search query |
| `CppSeek: Index Workspace` | - | Index all C/C++ files in the workspace |
| `CppSeek: Clear Index` | - | Clear the current search index |
| `CppSeek: Configuration Wizard` | - | Set up or change API configuration |
| `CppSeek: Test Configuration` | - | Test current configuration |
| `CppSeek: Show Diagnostic` | - | Show configuration diagnostic |
| `CppSeek: Show Settings` | - | Open CppSeek configuration settings |
| `CppSeek: Search Statistics` | - | View search performance metrics |
| `CppSeek: Show Search History` | `Ctrl+Alt+H` | View and manage search history |
| `CppSeek: Export Search History` | - | Export search history to file |
| `CppSeek: Clear Search Cache` | - | Clear search cache and temporary data |
| `CppSeek: Navigate to Next Result` | `Ctrl+Shift+N` | Navigate to next search result |
| `CppSeek: Navigate to Previous Result` | `Ctrl+Shift+P` | Navigate to previous search result |
| `CppSeek: Show Navigation History` | `Ctrl+Shift+H` | View navigation history |
| `CppSeek: Jump to Line` | `Ctrl+G` | Jump to specific line in search results |

### Example Queries

```
"Where is the memory allocation logic?"
"Find functions that handle error conditions"
"Show me the initialization code"
"Where are the data structures defined?"
"How is the database connection managed?"
"Find all functions that use smart pointers"
"Show me the threading implementation"
"Where are the network protocols defined?"
```

## ⚙️ Configuration

CppSeek provides comprehensive configuration options accessible through VS Code settings:

### Search Behavior

```json
{
  "cppseek.searchBehavior.maxResults": 50,
  "cppseek.searchBehavior.chunkSize": 500,
  "cppseek.searchBehavior.chunkOverlap": 50
}
```

### File Patterns

```json
{
  "cppseek.files.include": [
    "**/*.cpp", "**/*.cxx", "**/*.cc", 
    "**/*.c", "**/*.h", "**/*.hpp", "**/*.hxx"
  ],
  "cppseek.files.exclude": [
    "**/node_modules/**", "**/build/**", 
    "**/out/**", "**/dist/**"
  ]
}
```

### Performance Tuning

```json
{
  "cppseek.performance.enableCache": true,
  "cppseek.performance.maxMemoryUsage": 200
}
```

## 🛠️ Development

### Prerequisites

- Node.js 16+
- VS Code 1.74.0+
- TypeScript 4.9+

### Development Setup

1. **Clone and install**:
```bash
git clone <repository-url>
cd CppSeek
npm install
```

2. **Development commands**:
```bash
npm run compile          # Compile TypeScript
npm run watch           # Watch mode for development
npm test               # Run Jest tests
npm run lint           # ESLint validation
npm run package        # Production build
```

3. **Testing**:
```bash
npm test               # Unit tests with Jest
npm run test:coverage  # Test coverage report
```

### Architecture

```
src/
├── extension.ts              # Main extension entry point
├── services/                 # Core service implementations
│   ├── SemanticSearchService.ts    # Main search orchestrator
│   ├── NIMEmbeddingService.ts      # NVIDIA NIM integration
│   ├── FileDiscoveryService.ts     # Workspace file scanning
│   ├── FileContentReader.ts        # File content processing
│   ├── TextChunker.ts              # Smart text chunking
│   ├── ChunkOverlapManager.ts      # Overlap logic
│   └── SearchResultsRanking.ts     # Result ranking system
├── ui/                       # User interface components
│   ├── SearchResultsPanel.ts      # Webview UI
│   └── NavigationManager.ts       # Result navigation
├── storage/                  # Data persistence
│   ├── ChromaVectorStore.ts        # Vector database
│   └── SearchHistoryManager.ts     # History tracking
└── test/                     # Comprehensive test suite
    ├── setup.ts              # Jest configuration
    └── suite/                # Test implementations

.ai/           # Task Magic system (project management)
├── tasks/            # Completed development tasks
├── plans/            # Project requirements and PRDs
└── memory/           # Development history archive

memory-bank/          # Memory Bank system (context)
├── activeContext.md  # Current development state
├── progress.md       # Project progress tracking
└── [other context]   # Technical documentation
```

## 📋 Requirements

### Runtime Dependencies

- **@langchain/community & @langchain/core**: Modern RAG architecture framework
- **chromadb**: Vector database for similarity search
- **@xenova/transformers**: AI model tokenization (Llama-compatible)
- **openai**: NVIDIA NIM API integration
- **sqlite3**: Local database for metadata storage
- **dotenv**: Environment variable management

### Development Dependencies

- **TypeScript**: Modern language features with strict typing
- **Jest**: Comprehensive testing framework
- **Webpack**: Module bundling and optimization
- **ESLint + Prettier**: Code quality and formatting

## 🐛 Known Issues

- Native dependencies (sqlite3, chromadb) may require compilation on first install
- Large codebases may require increased memory allocation for indexing
- Initial workspace indexing can take several minutes for very large projects

## 📈 Roadmap

### Phase 1: Foundation ✅ Complete
- [x] Extension scaffold and build system
- [x] TypeScript development environment
- [x] Testing framework with Jest
- [x] Command palette integration

### Phase 2: Core Implementation ✅ Complete
- [x] Modern RAG architecture (LangChain + Chroma)
- [x] NVIDIA NIM API integration
- [x] Advanced code parsing and chunking
- [x] Multi-factor search ranking system
- [x] Rich UI with syntax highlighting
- [x] Search history and bookmarking

### Phase 3: Advanced Features ✅ Complete
- [x] User behavior tracking
- [x] Performance optimization and caching
- [x] Comprehensive configuration system
- [x] Production-ready error handling
- [x] Navigation and result management
- [x] Export and statistics features

### Phase 4: Future Enhancements (Planned)
- [ ] Cross-reference analysis and dependency mapping
- [ ] Advanced code similarity detection
- [ ] Integration with debugging and refactoring tools
- [ ] Multi-language support expansion
- [ ] Cloud-based indexing options

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please see our contributing guidelines for details.

## 📞 Support

For issues and feature requests, please use the GitHub issue tracker.

---

**Powered by Nvidia NIM and built with ❤️ for the C/C++ developer community**
