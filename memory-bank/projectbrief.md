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
1. **Phase 1**: Basic semantic search functionality ✅ **ACHIEVED**
2. **Phase 2**: AST-aware chunking and production-ready extension ⏳ **IN PROGRESS**

## Success Metrics
- Developers can find relevant code using natural language queries ✅ **ACHIEVED**
- Search accuracy improves over traditional text search ✅ **ARCHITECTURE READY**
- Seamless integration with VSCode workflow ✅ **ACHIEVED**
- Extensible architecture for future enhancements ✅ **ACHIEVED**

## Technical Approach
- **Code Chunking**: Fixed-size chunking (Phase 1) → clangd AST parsing (Phase 2) ✅ **Phase 1 Complete**
- **Embeddings**: Nvidia NIM (Nvidia Inference Microservices) with llama-3.2-nv-embedqa-1b-v2 ✅ **Operational**
- **Vector Search**: Modern RAG architecture with LangChain + ChromaDB ✅ **IMPLEMENTED**
- **VSCode Integration**: Extension API for seamless user experience ✅ **Complete** 