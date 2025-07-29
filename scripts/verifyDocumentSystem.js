/**
 * Simple verification script for Document Management System
 * 
 * This script tests the basic functionality of the document management
 * components to ensure they work correctly.
 */

const path = require('path');

// Mock vscode module for testing
global.vscode = {
  window: {
    createOutputChannel: (name) => ({
      appendLine: (message) => console.log(`[${name}] ${message}`),
      dispose: () => {}
    })
  }
};

// Test the DocumentConverter
async function testDocumentConverter() {
  console.log('\n=== Testing DocumentConverter ===');
  
  try {
    const { DocumentConverter } = require('../out/services/documents/documentConverter');
    const converter = new DocumentConverter();
    
    // Test chunk conversion
    const testChunk = {
      id: 'test-chunk-1',
      content: 'int main() { return 0; }',
      filename: 'main.cpp',
      lineStart: 1,
      lineEnd: 1,
      functionName: 'main'
    };
    
    const document = converter.convertCodeChunkToDocument(testChunk);
    
    console.log('✅ Document conversion successful');
    console.log(`   - Content: ${document.pageContent}`);
    console.log(`   - File type: ${document.metadata.fileType}`);
    console.log(`   - Code type: ${document.metadata.contextInfo.codeType}`);
    console.log(`   - Importance: ${document.metadata.contextInfo.importance}`);
    console.log(`   - Hash: ${document.metadata.hash.substring(0, 8)}...`);
    
    // Test hash consistency
    const hash1 = converter.generateContentHash('test content');
    const hash2 = converter.generateContentHash('test content');
    
    if (hash1 === hash2) {
      console.log('✅ Hash consistency test passed');
    } else {
      console.log('❌ Hash consistency test failed');
    }
    
    // Test bidirectional conversion
    const convertedBack = converter.convertDocumentToCodeChunk(document);
    
    if (convertedBack.id === testChunk.id && convertedBack.content === testChunk.content) {
      console.log('✅ Bidirectional conversion test passed');
    } else {
      console.log('❌ Bidirectional conversion test failed');
    }
    
    converter.dispose();
    
  } catch (error) {
    console.log(`❌ DocumentConverter test failed: ${error.message}`);
  }
}

// Test batch conversion
async function testBatchConversion() {
  console.log('\n=== Testing Batch Conversion ===');
  
  try {
    const { DocumentConverter } = require('../out/services/documents/documentConverter');
    const converter = new DocumentConverter();
    
    const testChunks = [
      {
        id: 'batch-1',
        content: 'class TestClass {};',
        filename: 'test.h',
        lineStart: 1,
        lineEnd: 1,
        className: 'TestClass'
      },
      {
        id: 'batch-2',
        content: 'void TestClass::method() {}',
        filename: 'test.cpp',
        lineStart: 5,
        lineEnd: 5,
        functionName: 'method',
        className: 'TestClass'
      }
    ];
    
    const documents = await converter.batchConvert(testChunks);
    const stats = converter.getStats();
    
    console.log(`✅ Batch conversion successful: ${documents.length} documents`);
    console.log(`   - Success rate: ${stats.successfulConversions}/${stats.totalProcessed}`);
    console.log(`   - Processing time: ${stats.processingTime}ms`);
    
    converter.dispose();
    
  } catch (error) {
    console.log(`❌ Batch conversion test failed: ${error.message}`);
  }
}

// Test context analysis
async function testContextAnalysis() {
  console.log('\n=== Testing Context Analysis ===');
  
  try {
    const { DocumentConverter } = require('../out/services/documents/documentConverter');
    const converter = new DocumentConverter();
    
    const testCases = [
      {
        name: 'Function',
        chunk: {
          id: 'func-test',
          content: 'void testFunction() { return; }',
          filename: 'test.cpp',
          lineStart: 1,
          lineEnd: 1,
          functionName: 'testFunction'
        },
        expectedCodeType: 'function'
      },
      {
        name: 'Class',
        chunk: {
          id: 'class-test',
          content: 'class MyClass { public: int value; };',
          filename: 'test.h',
          lineStart: 1,
          lineEnd: 3,
          className: 'MyClass'
        },
        expectedCodeType: 'class'
      },
      {
        name: 'Comment',
        chunk: {
          id: 'comment-test',
          content: '// This is a comment\n/* Block comment */',
          filename: 'test.cpp',
          lineStart: 1,
          lineEnd: 2
        },
        expectedCodeType: 'comment'
      }
    ];
    
    for (const testCase of testCases) {
      const document = converter.convertCodeChunkToDocument(testCase.chunk);
      
      if (document.metadata.contextInfo.codeType === testCase.expectedCodeType) {
        console.log(`✅ ${testCase.name} context analysis passed`);
      } else {
        console.log(`❌ ${testCase.name} context analysis failed: expected ${testCase.expectedCodeType}, got ${document.metadata.contextInfo.codeType}`);
      }
    }
    
    converter.dispose();
    
  } catch (error) {
    console.log(`❌ Context analysis test failed: ${error.message}`);
  }
}

// Run all tests
async function runVerification() {
  console.log('🚀 Starting Document Management System Verification');
  console.log('================================================');
  
  await testDocumentConverter();
  await testBatchConversion();
  await testContextAnalysis();
  
  console.log('\n================================================');
  console.log('✅ Document Management System Verification Complete');
}

// Run if called directly
if (require.main === module) {
  runVerification().catch(error => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
}

module.exports = { runVerification }; 