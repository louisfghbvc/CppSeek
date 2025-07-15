# CppSeek - Semantic Search VSCode Extension

## Project Overview
CppSeek is a VSCode extension that provides intelligent semantic search capabilities for C/C++ codebases. It combines advanced language processing with vector similarity search to help developers find relevant code using natural language queries.

## Core Problem
Traditional code search relies on exact text matching, making it difficult to find relevant code when you don't know the exact variable names, function names, or implementation details. Developers often struggle to:
- Find initialization logic across large codebases
- Locate related functionality when refactoring
- Understand code relationships and dependencies
- Navigate unfamiliar codebases efficiently

## Solution Vision
CppSeek transforms code search from exact text matching to semantic understanding, enabling developers to:
- Ask natural language questions like "Where is the init logic?"
- Find code based on functionality rather than exact names
- Get contextual understanding of code relationships
- Navigate codebases more intuitively

## Project Goals
1. **Phase 1**: Basic semantic search functionality
2. **Phase 2**: AST-aware chunking and production-ready extension

## Success Metrics
- Developers can find relevant code using natural language queries
- Search accuracy improves over traditional text search
- Seamless integration with VSCode workflow
- Extensible architecture for future enhancements

## Technical Approach
- **Code Chunking**: Fixed-size chunking (Phase 1) → clangd AST parsing (Phase 2)
- **Embeddings**: Nvidia NIM (Nvidia Inference Microservices) with llama-3.2-nv-embedqa-1b-v2
- **Vector Search**: FAISS for efficient similarity matching
- **VSCode Integration**: Extension API for seamless user experience 