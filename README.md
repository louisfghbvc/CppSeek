# CppSeek - AI-Powered Semantic Search for C/C++

CppSeek is a Visual Studio Code extension that brings intelligent semantic search capabilities to C and C++ codebases. Using advanced AI embeddings and vector similarity search, CppSeek helps developers quickly find relevant code segments based on natural language queries rather than exact text matches.

## 🚀 Features

### Current Features (Foundation Release)

- **🎯 Semantic Search Command**: Search your codebase using natural language queries
- **📁 Workspace Indexing**: Intelligent scanning and indexing of C/C++ files
- **⌨️ Keyboard Shortcuts**: Quick access with `Ctrl+Shift+S` (Cmd+Shift+S on Mac)
- **📊 Progress Tracking**: Real-time indexing progress in the status bar
- **⚙️ Flexible Configuration**: Comprehensive settings for search behavior and performance
- **🔧 Output Logging**: Detailed logging channel for debugging and monitoring

### Coming Soon (Core Implementation)

- **🤖 Nvidia NIM Integration**: Powered by llama-3.2-nv-embedqa-1b-v2 embeddings
- **🗄️ Vector Database**: Efficient similarity search using FAISS
- **📄 Smart Code Parsing**: Context-aware chunking and preprocessing
- **🎯 Intelligent Ranking**: AI-powered result relevance scoring

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
2. **Index your workspace** - Use `CppSeek: Index Workspace` command or the welcome prompt
3. **Start searching** - Use `Ctrl+Shift+S` or the `CppSeek: Semantic Search` command

### Available Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `CppSeek: Semantic Search` | `Ctrl+Shift+S` | Start a semantic search query |
| `CppSeek: Index Workspace` | - | Index all C/C++ files in the workspace |
| `CppSeek: Clear Index` | - | Clear the current search index |
| `CppSeek: Show Settings` | - | Open CppSeek configuration settings |

### Example Queries

```
"Where is the memory allocation logic?"
"Find functions that handle error conditions"
"Show me the initialization code"
"Where are the data structures defined?"
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
├── extension.ts        # Main extension entry point
├── test/
│   ├── setup.ts       # Jest test configuration
│   └── suite/
│       └── extension.test.ts  # Extension tests
└── [future modules]    # Semantic search implementation

.cursor/.ai/           # Task Magic system
├── tasks/            # Individual task files
├── plans/            # Project requirements
└── memory/           # Completed task archive

memory-bank/          # Memory Bank system
├── activeContext.md  # Current development state
├── progress.md       # Project progress tracking
└── [other context]   # Technical documentation
```

## 📋 Requirements

### Runtime Dependencies

- **@xenova/transformers**: AI model tokenization (Llama-compatible)
- **sqlite3**: Local database for metadata storage
- **faiss-node**: Vector similarity search engine

### Development Dependencies

- **TypeScript**: Modern language features with strict typing
- **Jest**: Comprehensive testing framework
- **Webpack**: Module bundling and optimization
- **ESLint + Prettier**: Code quality and formatting

## 🐛 Known Issues

- Extension packaging requires non-template README (resolved in this version)
- Native dependencies may require compilation on first install
- FAISS integration pending for semantic search functionality

## 📈 Roadmap

### Phase 1: Foundation ✅ Complete
- [x] Extension scaffold and build system
- [x] TypeScript development environment
- [x] Testing framework with Jest
- [x] Command palette integration

### Phase 2: Core Implementation (In Progress)
- [ ] Database schema and vector storage
- [ ] Nvidia NIM service integration
- [ ] Code parsing and chunking algorithms
- [ ] Semantic search and ranking

### Phase 3: Advanced Features (Planned)
- [ ] Cross-reference analysis
- [ ] Code similarity detection
- [ ] Integration with IDE features
- [ ] Performance optimization

## 📄 License

[License information to be added]

## 🤝 Contributing

Contributions are welcome! Please see our contributing guidelines for details.

## 📞 Support

For issues and feature requests, please use the GitHub issue tracker.

---

**Powered by Nvidia NIM and built with ❤️ for the C/C++ developer community**
