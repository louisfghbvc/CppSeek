# CppSeek - Project Tasks

## Phase 1: Basic Functionality (Weeks 1-3)

### 🔧 Foundation Setup
- [x] **ID 1: Create VSCode extension scaffold using yo code** (Priority: critical)
> Set up the basic VSCode extension structure using the official Yeoman generator, creating the foundation for the CppSeek semantic search extension.

- [x] **ID 2: Set up TypeScript development environment and dependencies** (Priority: critical)  
> Dependencies: 1
> Configure TypeScript compilation, install required npm packages, and set up the development build system for the extension.

- [x] **ID 3: Configure build system and testing framework (Jest)** (Priority: high)
> Dependencies: 2
> Set up Jest testing framework, configure build scripts, and establish development workflow with proper linting and code quality tools.

- [x] **ID 4: Implement basic command registration in command palette** (Priority: high)
> Dependencies: 3
> Register the core CppSeek commands in VSCode command palette and verify the extension activation and command execution works correctly.

### 📁 Code Processing Pipeline
- [x] **ID 5: Implement workspace file discovery for .cpp/.h files** (Priority: critical)
> Dependencies: 4
> Implement recursive file system scanning to discover all C/C++ source files (.cpp, .cc, .cxx) and header files (.h, .hpp, .hxx) within the VSCode workspace, with configurable file patterns and exclusion rules.

- [x] **ID 6: Create fixed-size text chunking logic (500 tokens with overlap)** (Priority: critical) 
> Dependencies: 5
> Implement text chunking algorithm that splits file content into fixed-size chunks of 500 tokens using @xenova/transformers for Llama-compatible tokenization, with configurable overlap between chunks for context continuity.

- [x] **ID 7: Implement file content reading and text processing** (Priority: high)
> Dependencies: 5
> Implement robust file reading system with encoding detection, preprocessing steps (comment handling, whitespace normalization), and error handling for corrupted or binary files.

- [x] **ID 8: Set up chunk overlap logic for context continuity** (Priority: high)
> Dependencies: 6, 7
> Implement intelligent chunk overlap logic that maintains semantic context across chunk boundaries, particularly preserving function signatures, class definitions, and comment blocks.

### 🔗 Embedding & Search Infrastructure
- [x] **Task 9**: Set up Nvidia NIM API integration
- [ ] **Task 10**: Integrate Nvidia NIM embedding API (llama-3.2-nv-embedqa-1b-v2)
- [ ] **Task 11**: Set up FAISS vector storage system
- [ ] **Task 12**: Implement cosine similarity search algorithm
- [ ] **Task 13**: Create basic result ranking and filtering

### 🎨 User Interface Development
- [ ] **Task 14**: Create simple query input interface
- [ ] **Task 15**: Implement search result display with code snippets
- [ ] **Task 16**: Add file navigation and jump-to-source functionality
- [ ] **Task 17**: Create basic preview system for search results

### ⚡ Core Integration
- [ ] **Task 18**: Implement incremental indexing system
- [ ] **Task 19**: Add file watcher for automatic index updates
- [ ] **Task 20**: Create error handling and fallback mechanisms
- [ ] **Task 21**: Add basic configuration and settings support

## Phase 2: Enhanced Search & Production (Weeks 4-6)

### 🌳 AST-Aware Chunking
- [ ] **Task 22**: Set up clangd integration for semantic parsing
- [ ] **Task 23**: Implement function and class boundary detection
- [ ] **Task 24**: Create context-aware chunking with clangd
- [ ] **Task 25**: Extract namespace and class hierarchy metadata

### 🎨 Enhanced User Interface
- [ ] **Task 26**: Implement side panel integration
- [ ] **Task 27**: Create enhanced search result preview with syntax highlighting
- [ ] **Task 28**: Add context display (class hierarchy, namespace info)
- [ ] **Task 29**: Improve result organization and categorization

### ⚡ Performance & Optimization
- [ ] **Task 30**: Implement caching strategies for embeddings
- [ ] **Task 31**: Optimize background processing and indexing
- [ ] **Task 32**: Add memory management and cleanup
- [ ] **Task 33**: Implement search result caching

### 🔧 Advanced Features
- [ ] **Task 34**: Add advanced configuration options
- [ ] **Task 35**: Implement index persistence across sessions
- [ ] **Task 36**: Create comprehensive error handling
- [ ] **Task 37**: Add logging and debugging support

### 🚀 Production Polish & Marketplace
- [ ] **Task 38**: Comprehensive testing and bug fixes
- [ ] **Task 39**: Performance optimization and profiling
- [ ] **Task 40**: Create documentation and README
- [ ] **Task 41**: Package extension for marketplace
- [ ] **Task 42**: Final validation and release preparation

---

## Project Overview

**Current Status**: Planning phase completed, simplified to 2-phase approach (6 weeks total)
**Next Action**: Start with Task 1 - Extension scaffold creation
**Scope**: Focus on semantic search functionality without LLM chat interface

### Key Technical Decisions
- **Phase 1**: Fixed-size chunking (500 tokens) for simplicity
- **Phase 2**: clangd integration for AST-aware semantic chunking
- **Embedding**: Nvidia NIM local deployment (llama-3.2-nv-embedqa-1b-v2)
- **Vector Storage**: FAISS for similarity search + SQLite for metadata
- **UI**: Command palette + side panel (no chat interface)

### Success Criteria
- **Phase 1**: Basic semantic search functional with fixed-size chunks
- **Phase 2**: Production-ready extension with clangd integration
- **Final**: Marketplace-ready VSCode extension for C/C++ semantic search