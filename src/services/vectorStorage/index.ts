/**
 * Vector Storage Module - Modern RAG Architecture
 * 
 * Features LangChain + Chroma document-based architecture with Nvidia NIM embeddings integration.
 */

export * from './types';
export * from './modernVectorStorage';

// Export document management system
export { 
  DocumentConverter,
  DocumentManager,
  IncrementalUpdater
} from '../documents';

export type {
  CodeChunk as LegacyCodeChunk,
  LangChainDocument,
  ConversionStats,
  DocumentResult,
  DocumentQueryOptions,
  FileChangeSet,
  IncrementalUpdateResult
} from '../documents';

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
      semanticSearch: true,
      documentManagement: true,
      incrementalUpdates: true
    }
  };
}; 