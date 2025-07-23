/**
 * Vector Storage Module - Pure JavaScript Implementation
 * 
 * Provides vector storage for semantic search functionality using only JavaScript
 */

export * from './types';

// Import only the pure JavaScript implementations that don't require native bindings
import { JSVectorStorage } from './jsVectorStorage';
import { MemoryMetadataStore } from './memoryMetadataStore';

// Use only the safe JavaScript implementations
export const FAISSVectorStorage = JSVectorStorage;
export const MetadataStore = MemoryMetadataStore;

// Provide the selectOptimalIndex function for JS implementation
export const selectOptimalIndex = function(_vectorCount: number, dimension: number) {
  // For JS implementation, we always use "Flat" equivalent
  // _vectorCount is ignored since JS implementation doesn't have index type optimization
  return {
    indexType: 'Flat' as const,
    dimension,
    metric: 'COSINE' as const
  };
}; 