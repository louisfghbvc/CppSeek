/**
 * Vector Storage Module - Hybrid Implementation
 * 
 * Provides vector storage for semantic search functionality with native SQLite3 support
 * and JavaScript fallbacks for compatibility
 */

export * from './types';

// Import the JavaScript implementations for guaranteed compatibility
import { JSVectorStorage } from './jsVectorStorage';
import { MemoryMetadataStore } from './memoryMetadataStore';

// Try to load native SQLite3 implementation, fallback to memory store
let NativeMetadataStore: typeof MemoryMetadataStore;
let isNativeAvailable = false;

try {
  // Test SQLite3 availability
  const sqlite3 = require('sqlite3');
  const { MetadataStore } = require('./metadataStore');
  NativeMetadataStore = MetadataStore;
  isNativeAvailable = true;
  console.log('✅ SQLite3 native binding available - using high-performance metadata store');
} catch (error) {
  console.log('⚠️  SQLite3 native binding not available - falling back to memory store');
  console.log('   Error:', (error as Error).message);
  NativeMetadataStore = MemoryMetadataStore;
  isNativeAvailable = false;
}

// Export the appropriate implementations
export const FAISSVectorStorage = JSVectorStorage; // Always use JS vector storage (FAISS compatibility issues)
export const MetadataStore = NativeMetadataStore;  // Use native SQLite3 when available, fallback to memory

// Export runtime information
export const isNativeSQLiteAvailable = isNativeAvailable;

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

// Export configuration helper for hybrid mode
export const getStorageInfo = () => {
  return {
    vectorStorage: 'JavaScript (JSVectorStorage)',
    metadataStorage: isNativeAvailable ? 'Native SQLite3' : 'Memory (JavaScript)',
    isHybrid: true,
    nativeSupport: {
      sqlite3: isNativeAvailable,
      faiss: false // FAISS has GLIBC compatibility issues
    }
  };
}; 