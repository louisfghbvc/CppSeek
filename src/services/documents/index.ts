/**
 * Document Management Services
 * 
 * Provides modern document management capabilities for the CppSeek extension.
 * Includes conversion between CodeChunk and LangChain Document formats,
 * document lifecycle management, and incremental updates.
 */

export { 
  DocumentConverter
} from './documentConverter';

export type { 
  CodeChunk,
  LangChainDocument,
  ConversionStats,
  ConversionError
} from './documentConverter';

export {
  DocumentManager
} from './documentManager';

export type {
  DocumentResult,
  DocumentQueryOptions,
  DocumentStats,
  BatchOperationResult
} from './documentManager';

export {
  IncrementalUpdater
} from './incrementalUpdater';

export type {
  FileChangeType,
  FileChange,
  FileChangeSet,
  IncrementalUpdateResult,
  UpdateStats
} from './incrementalUpdater'; 