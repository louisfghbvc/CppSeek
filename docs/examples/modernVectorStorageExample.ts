import { ModernVectorStorage, CodeChunk } from './modernVectorStorage';
import { createNIMServiceFromEnv } from '../nimEmbeddingService';
import { ModernVectorStorageConfigManager, ModernVectorStorageConfig } from '../../config/modernVectorStorageConfig';

/**
 * Example usage of ModernVectorStorage with modern configuration
 * 
 * This example demonstrates how to use the new configuration system
 * instead of the old FAISS-based configuration.
 */
export class ModernVectorStorageExample {
  
  /**
   * Basic usage example with modern configuration
   */
  static async basicUsageWithConfig(): Promise<void> {
    try {
      console.log('🚀 ModernVectorStorage with Modern Configuration Example');
      
      // 1. Create configuration from VSCode settings
      console.log('⚙️ Loading configuration...');
      const config: ModernVectorStorageConfig = ModernVectorStorageConfigManager.createConfig('demo-workspace');
      
      // 2. Validate configuration
      const validation = ModernVectorStorageConfigManager.validateConfig(config);
      if (!validation.isValid) {
        console.error('❌ Configuration validation failed:', validation.errors);
        return;
      }
      
      console.log('✅ Configuration loaded:', {
        chromaUrl: config.chromaUrl,
        collectionName: config.collectionName,
        defaultTopK: config.defaultTopK
      });
      
      // 3. Create NIM service and storage with configuration
      console.log('📡 Initializing services...');
      const nimService = createNIMServiceFromEnv();
      const storage = new ModernVectorStorage(
        nimService, 
        config.collectionName,
        config.chromaUrl
      );
      
      // 4. Initialize the storage
      console.log('⚡ Initializing storage...');
      await storage.initialize();
      
      // Rest of the example stays the same...
      const codeChunks: CodeChunk[] = [
        {
          id: 'config-example-1',
          content: 'void initialize() {\n    // Initialize with modern config\n    loadConfiguration();\n}',
          filename: 'config.cpp',
          lineStart: 10,
          lineEnd: 15,
          functionName: 'initialize'
        }
      ];
      
      await storage.addCodeChunks(codeChunks);
      
      // Use configured search parameters
      const results = await storage.searchSimilar('configuration', config.defaultTopK);
      console.log(`🔍 Found ${results.length} results (using configured topK: ${config.defaultTopK})`);
      
      storage.dispose();
      console.log('\n✅ Modern configuration example completed!');
      
    } catch (error) {
      console.error('❌ Example failed:', error);
    }
  }

  /**
   * Configuration comparison example
   */
  static async configurationComparisonExample(): Promise<void> {
    console.log('📊 Configuration System Comparison\n');
    
    // Modern configuration (simple & clean)
    console.log('🆕 MODERN CONFIGURATION (LangChain + Chroma):');
    const modernConfig = ModernVectorStorageConfigManager.createConfig('test-workspace');
    console.log('✅ Simple and focused on actual needs:');
    console.log(JSON.stringify({
      chromaUrl: modernConfig.chromaUrl,
      collectionName: modernConfig.collectionName,
      similarityFunction: modernConfig.similarityFunction,
      defaultTopK: modernConfig.defaultTopK
    }, null, 2));
    
    console.log('\n❌ OLD FAISS CONFIGURATION (complex & unnecessary):');
    console.log('- indexType: "Flat" | "IVFFlat" | "HNSW"');
    console.log('- dimension: number (fixed)');  
    console.log('- nlist, nprobe, efConstruction, efSearch...');
    console.log('- persistencePath, autoSave, memoryLimit...');
    console.log('- Complex index optimization logic');
    
    console.log('\n🎯 Benefits of modern approach:');
    console.log('- ✅ Zero native dependencies');
    console.log('- ✅ Simpler configuration');
    console.log('- ✅ VSCode settings integration');
    console.log('- ✅ Automatic validation');
    console.log('- ✅ Workspace-based collection naming');
  }

  /**
   * Health check example
   */
  static async healthCheckExample(): Promise<void> {
    try {
      console.log('🏥 Health Check Configuration Example');
      
      const healthConfig = ModernVectorStorageConfigManager.getHealthCheckConfig();
      console.log('Health check settings:', healthConfig);
      
      // Simulate health check
      const config = ModernVectorStorageConfigManager.createConfig();
      console.log(`Checking Chroma server at: ${config.chromaUrl}`);
      
      // In real implementation, you would ping the Chroma server here
      console.log('✅ Health check configuration ready');
      
    } catch (error) {
      console.error('❌ Health check example failed:', error);
    }
  }
}

/**
 * Run modern configuration examples
 */
export async function runModernConfigExamples(): Promise<void> {
  console.log('🎯 Running Modern Configuration Examples...\n');
  
  await ModernVectorStorageExample.basicUsageWithConfig();
  console.log('\n' + '='.repeat(50) + '\n');
  
  await ModernVectorStorageExample.configurationComparisonExample();
  console.log('\n' + '='.repeat(50) + '\n');
  
  await ModernVectorStorageExample.healthCheckExample();
  
  console.log('\n🎉 All modern configuration examples completed!');
} 