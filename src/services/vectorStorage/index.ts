/**
 * Vector Storage Module - Cleanup Phase
 * 
 * JSVectorStorage and MemoryMetadataStore have been removed.
 * FAISS implementation will be added in implementation phase.
 */

export * from './types';

// Import native SQLite3 metadata store (if available)
let MetadataStore: any;
let isNativeAvailable = false;

try {
  // Test SQLite3 availability
  const sqlite3 = require('sqlite3');
  const { MetadataStore: NativeMetadataStore } = require('./metadataStore');
  MetadataStore = NativeMetadataStore;
  isNativeAvailable = true;
  console.log('✅ SQLite3 native binding available');
} catch (error) {
  console.log('⚠️  SQLite3 native binding not available');
  console.log('   Error:', (error as Error).message);
  MetadataStore = null;
  isNativeAvailable = false;
}

// Export available components
export { MetadataStore };

// Export runtime information
export const isNativeSQLiteAvailable = isNativeAvailable;

// Note: Vector storage implementation (FAISS) will be added in implementation phase
export const getStorageInfo = () => {
  return {
    vectorStorage: 'Not implemented (JSVectorStorage removed)',
    metadataStorage: isNativeAvailable ? 'Native SQLite3' : 'Not available',
    status: 'Cleanup phase - FAISS implementation pending',
    nativeSupport: {
      sqlite3: isNativeAvailable,
      faiss: false // To be implemented
    }
  };
}; 