/**
 * Vector Storage Module - Modern RAG Architecture
 * 
 * Features LangChain + Chroma document-based architecture with Nvidia NIM embeddings integration.
 */

export * from './types';
export * from './modernVectorStorage';

// Modern storage information
export const getStorageInfo = () => {
  return {
    vectorStorage: 'ModernVectorStorage (LangChain + Chroma)',
    status: 'Modern RAG architecture - LangChain + Chroma + Nvidia NIM',
    features: {
      langchain: true,
      chroma: true,
      nvidianim: true,
      documentBased: true,
      semanticSearch: true
    }
  };
}; 