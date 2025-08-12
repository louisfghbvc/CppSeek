import * as assert from 'assert';
import { DocumentConverter, CodeChunk } from '../../services/documents';

/**
 * Quick validation test for Document Management System
 */
describe('Document Management Quick Validation', () => {
  let documentConverter: DocumentConverter;

  beforeEach(() => {
    documentConverter = new DocumentConverter();
  });

  afterEach(() => {
    documentConverter.dispose();
  });

  it('should convert CodeChunk to LangChain Document successfully', () => {
    const testChunk: CodeChunk = {
      id: 'test-chunk-1',
      content: 'int main() { return 0; }',
      filename: 'main.cpp',
      lineStart: 1,
      lineEnd: 1,
      functionName: 'main'
    };

    const document = documentConverter.convertCodeChunkToDocument(testChunk);

    // Verify basic conversion
    assert.strictEqual(document.pageContent, testChunk.content);
    assert.strictEqual(document.metadata.id, testChunk.id);
    assert.strictEqual(document.metadata.filename, testChunk.filename);
    assert.strictEqual(document.metadata.functionName, testChunk.functionName);

    // Verify enhanced metadata
    assert.ok(document.metadata.hash, 'Should generate content hash');
    assert.strictEqual(document.metadata.fileType, '.cpp', 'Should detect file type');
    assert.strictEqual(document.metadata.contextInfo.codeType, 'function', 'Should detect code type');
    assert.strictEqual(document.metadata.contextInfo.importance, 'critical', 'main function should be critical');

    console.log('✅ DocumentConverter validation passed');
  });

  it('should generate consistent hashes for same content', () => {
    const content = 'void test() { return; }';
    
    const hash1 = documentConverter.generateContentHash(content);
    const hash2 = documentConverter.generateContentHash(content);
    
    assert.strictEqual(hash1, hash2, 'Same content should produce same hash');
    
    const differentContent = 'void different() { return; }';
    const hash3 = documentConverter.generateContentHash(differentContent);
    
    assert.notStrictEqual(hash1, hash3, 'Different content should produce different hash');

    console.log('✅ Content hash validation passed');
  });

  it('should analyze code context correctly', () => {
    const testCases = [
      {
        chunk: {
          id: 'class-chunk',
          content: 'class TestClass { public: void method(); };',
          filename: 'test.h',
          lineStart: 1,
          lineEnd: 3,
          className: 'TestClass'
        },
        expectedCodeType: 'class',
        expectedFileType: 'header',
        expectedImportance: 'high'
      },
      {
        chunk: {
          id: 'comment-chunk',
          content: '// This is a comment\n/* Block comment */',
          filename: 'test.cpp',
          lineStart: 1,
          lineEnd: 2
        },
        expectedCodeType: 'comment',
        expectedFileType: 'source',
        expectedImportance: 'low'
      }
    ];

    for (const testCase of testCases) {
      const document = documentConverter.convertCodeChunkToDocument(testCase.chunk);
      
      assert.strictEqual(
        document.metadata.contextInfo.codeType, 
        testCase.expectedCodeType,
        `Should detect ${testCase.expectedCodeType} code type`
      );
      
      assert.strictEqual(
        document.metadata.contextInfo.fileType,
        testCase.expectedFileType,
        `Should detect ${testCase.expectedFileType} file type`
      );
      
      assert.strictEqual(
        document.metadata.contextInfo.importance,
        testCase.expectedImportance,
        `Should assign ${testCase.expectedImportance} importance`
      );
    }

    console.log('✅ Code context analysis validation passed');
  });
}); 