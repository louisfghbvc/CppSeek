import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as vscode from 'vscode';
import { FileContentReader, FileContent, PreprocessingOptions } from '../../services/indexing/FileContentReader';

// Mock vscode module
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn()
  },
  CancellationTokenSource: jest.fn().mockImplementation(() => ({
    token: { isCancellationRequested: false },
    cancel: jest.fn(),
    dispose: jest.fn()
  }))
}));

describe('FileContentReader', () => {
  let fileContentReader: FileContentReader;
  let mockOutputChannel: vscode.OutputChannel;
  let tempDir: string;

  beforeEach(async () => {
    // Create mock output channel
    mockOutputChannel = {
      appendLine: jest.fn(),
      append: jest.fn(),
      clear: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
      name: 'test-channel',
      replace: jest.fn()
    };

    // Create temporary directory for test files
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'filecontentreader-test-'));

    // Setup default vscode configuration mock
    (vscode.workspace.getConfiguration as jest.Mock).mockImplementation((section: string) => {
      const configs: Record<string, any> = {
        'cppseek.fileReading': {
          get: jest.fn((key: string, defaultValue?: any) => {
            const values: Record<string, any> = {
              'maxFileSize': 50,
              'skipBinaryFiles': true,
              'preprocessWhitespace': true,
              'preserveComments': 'preserve'
            };
            return values[key] ?? defaultValue;
          })
        }
      };
      return configs[section] || { get: jest.fn() };
    });

    fileContentReader = new FileContentReader(mockOutputChannel);
  });

  afterEach(async () => {
    fileContentReader.dispose();
    // Clean up temporary directory
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('File Reading', () => {
    test('should read simple C++ file content', async () => {
      const testContent = '#include <iostream>\n\nint main() {\n    std::cout << "Hello World" << std::endl;\n    return 0;\n}';
      const testFile = path.join(tempDir, 'test.cpp');
      await fs.promises.writeFile(testFile, testContent, 'utf8');

      const result = await fileContentReader.readFile(testFile);

      assert.ok(result);
      assert.strictEqual(result.content, testContent);
      assert.strictEqual(result.encoding, 'utf8');
      assert.strictEqual(result.path, testFile);
      assert.strictEqual(result.lineCount, 6);
      assert.strictEqual(result.metadata.language, 'cpp');
      assert.strictEqual(result.metadata.lineEndings, 'lf');
    });

    test('should read header file content', async () => {
      const testContent = '#ifndef HEADER_H\n#define HEADER_H\n\nclass MyClass {\npublic:\n    void method();\n};\n\n#endif';
      const testFile = path.join(tempDir, 'test.h');
      await fs.promises.writeFile(testFile, testContent, 'utf8');

      const result = await fileContentReader.readFile(testFile);

      assert.ok(result);
      assert.strictEqual(result.content, testContent);
      assert.strictEqual(result.metadata.language, 'header');
    });

    test('should handle empty files', async () => {
      const testFile = path.join(tempDir, 'empty.cpp');
      await fs.promises.writeFile(testFile, '', 'utf8');

      const result = await fileContentReader.readFile(testFile);

      assert.ok(result);
      assert.strictEqual(result.content, '');
      assert.strictEqual(result.lineCount, 1); // Empty string split results in one empty element
    });

    test('should handle files with Unicode content', async () => {
      const testContent = '// Unicode comment: 你好世界\n// Emoji: 🚀\n\nint main() { return 0; }';
      const testFile = path.join(tempDir, 'unicode.cpp');
      await fs.promises.writeFile(testFile, testContent, 'utf8');

      const result = await fileContentReader.readFile(testFile);

      assert.ok(result);
      assert.strictEqual(result.content, testContent);
      assert.strictEqual(result.metadata.hasUnicode, true);
    });
  });

  describe('Encoding Detection', () => {
    test('should detect UTF-8 encoding', async () => {
      const testContent = 'UTF-8 content with special chars: àáâãäå';
      const testFile = path.join(tempDir, 'utf8.cpp');
      await fs.promises.writeFile(testFile, testContent, 'utf8');

      const result = await fileContentReader.readFile(testFile);

      assert.ok(result);
      assert.strictEqual(result.encoding, 'utf8');
      assert.strictEqual(result.content, testContent);
    });

    test('should detect UTF-8 BOM', async () => {
      const testContent = 'Content with BOM';
      const testFile = path.join(tempDir, 'utf8bom.cpp');
      const buffer = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(testContent, 'utf8')]);
      await fs.promises.writeFile(testFile, buffer);

      const result = await fileContentReader.readFile(testFile);

      assert.ok(result);
      assert.strictEqual(result.encoding, 'utf8');
      assert.strictEqual(result.content, testContent); // BOM should be removed
    });

    test('should handle Latin-1 encoding fallback', async () => {
      const testContent = 'Latin-1 content';
      const testFile = path.join(tempDir, 'latin1.cpp');
      // Create a file with some high-byte characters that aren't valid UTF-8
      const buffer = Buffer.from(testContent + String.fromCharCode(0xE9), 'latin1');
      await fs.promises.writeFile(testFile, buffer);

      const result = await fileContentReader.readFile(testFile);

      assert.ok(result);
      // The result should still be readable
      assert.ok(result.content.includes('Latin-1 content'));
    });
  });

  describe('Binary File Detection', () => {
    test('should skip binary files with null bytes', async () => {
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
      const testFile = path.join(tempDir, 'binary.bin');
      await fs.promises.writeFile(testFile, binaryContent);

      const result = await fileContentReader.readFile(testFile);

      assert.strictEqual(result, null);
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Skipping binary file')
      );
    });

    test('should skip binary files with high non-printable ratio', async () => {
      // Create content with >30% non-printable characters
      const binaryContent = Buffer.alloc(100);
      for (let i = 0; i < 100; i++) {
        binaryContent[i] = i < 40 ? 0xFF : 0x41; // 40% high-byte characters
      }
      const testFile = path.join(tempDir, 'binary2.bin');
      await fs.promises.writeFile(testFile, binaryContent);

      const result = await fileContentReader.readFile(testFile);

      assert.strictEqual(result, null);
    });

    test('should not skip text files with some Unicode', async () => {
      const textContent = 'Normal text with some Unicode: é ñ ü';
      const testFile = path.join(tempDir, 'unicode.cpp');
      await fs.promises.writeFile(testFile, textContent, 'utf8');

      const result = await fileContentReader.readFile(testFile);

      assert.ok(result);
      assert.strictEqual(result.content, textContent);
    });

    test('should respect skipBinaryFiles configuration', async () => {
      // Mock configuration to disable binary file skipping
      (vscode.workspace.getConfiguration as jest.Mock).mockImplementation(() => ({
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'skipBinaryFiles') return false;
          return defaultValue;
        })
      }));

      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      const testFile = path.join(tempDir, 'binary.bin');
      await fs.promises.writeFile(testFile, binaryContent);

      const result = await fileContentReader.readFile(testFile);

      // Should not skip binary file when configuration is disabled
      assert.ok(result);
    });
  });

  describe('File Size Limits', () => {
    test('should skip files exceeding size limit', async () => {
      // Mock configuration for small file size limit
      (vscode.workspace.getConfiguration as jest.Mock).mockImplementation(() => ({
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'maxFileSize') return 0.001; // 1KB limit
          return defaultValue;
        })
      }));

      const largeContent = 'x'.repeat(2000); // 2KB content
      const testFile = path.join(tempDir, 'large.cpp');
      await fs.promises.writeFile(testFile, largeContent, 'utf8');

      const result = await fileContentReader.readFile(testFile);

      assert.strictEqual(result, null);
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Skipping large file')
      );
    });
  });

  describe('Text Preprocessing', () => {
    test('should normalize whitespace', async () => {
      const testContent = 'line1\t\t\tindented\r\nline2\r\nline3  \n';
      const testFile = path.join(tempDir, 'whitespace.cpp');
      await fs.promises.writeFile(testFile, testContent, 'utf8');

      const options: Partial<PreprocessingOptions> = {
        normalizeWhitespace: true,
        stripTrailingWhitespace: true
      };

      const result = await fileContentReader.readFile(testFile, options);

      assert.ok(result);
      assert.ok(result.preprocessed);
      // Tabs should be converted to spaces, line endings normalized, trailing spaces removed
      const expectedContent = 'line1            indented\nline2\nline3\n';
      assert.strictEqual(result.content, expectedContent);
    });

    test('should remove excessive blank lines', async () => {
      const testContent = 'line1\n\n\n\n\nline2\n\n\nline3\n';
      const testFile = path.join(tempDir, 'blank-lines.cpp');
      await fs.promises.writeFile(testFile, testContent, 'utf8');

      const options: Partial<PreprocessingOptions> = {
        removeExcessiveBlankLines: true
      };

      const result = await fileContentReader.readFile(testFile, options);

      assert.ok(result);
      // Should limit to maximum 2 consecutive blank lines
      const expectedContent = 'line1\n\nline2\n\nline3\n';
      assert.strictEqual(result.content, expectedContent);
    });

    test('should remove comments when requested', async () => {
      const testContent = '// Single line comment\nint x = 5; // End of line comment\n/* Block comment */\nint y = 10;';
      const testFile = path.join(tempDir, 'comments.cpp');
      await fs.promises.writeFile(testFile, testContent, 'utf8');

      const options: Partial<PreprocessingOptions> = {
        handleComments: 'remove'
      };

      const result = await fileContentReader.readFile(testFile, options);

      assert.ok(result);
      // Comments should be removed but code preserved
      assert.ok(result.content.includes('int x = 5;'));
      assert.ok(result.content.includes('int y = 10;'));
      assert.ok(!result.content.includes('// Single line comment'));
      assert.ok(!result.content.includes('Block comment'));
    });

    test('should preserve license headers when removing comments', async () => {
      const testContent = '/* Copyright 2023 Company */\n// SPDX-License-Identifier: MIT\n\n// Regular comment\nint main() { return 0; }';
      const testFile = path.join(tempDir, 'license.cpp');
      await fs.promises.writeFile(testFile, testContent, 'utf8');

      const options: Partial<PreprocessingOptions> = {
        handleComments: 'remove'
      };

      const result = await fileContentReader.readFile(testFile, options);

      assert.ok(result);
      // License headers should be preserved
      assert.ok(result.content.includes('Copyright 2023 Company'));
      assert.ok(result.content.includes('SPDX-License-Identifier'));
      // Regular comments should be removed
      assert.ok(!result.content.includes('// Regular comment'));
    });

    test('should ensure newline at end of file', async () => {
      const testContent = 'int main() { return 0; }'; // No trailing newline
      const testFile = path.join(tempDir, 'no-newline.cpp');
      await fs.promises.writeFile(testFile, testContent, 'utf8');

      const options: Partial<PreprocessingOptions> = {
        ensureNewlineAtEof: true
      };

      const result = await fileContentReader.readFile(testFile, options);

      assert.ok(result);
      assert.ok(result.content.endsWith('\n'));
    });
  });

  describe('Metadata Analysis', () => {
    test('should detect indentation style - spaces', async () => {
      const testContent = 'int main() {\n    if (true) {\n        return 0;\n    }\n}';
      const testFile = path.join(tempDir, 'spaces.cpp');
      await fs.promises.writeFile(testFile, testContent, 'utf8');

      const result = await fileContentReader.readFile(testFile);

      assert.ok(result);
      assert.strictEqual(result.metadata.indentationStyle, 'spaces');
    });

    test('should detect indentation style - tabs', async () => {
      const testContent = 'int main() {\n\tif (true) {\n\t\treturn 0;\n\t}\n}';
      const testFile = path.join(tempDir, 'tabs.cpp');
      await fs.promises.writeFile(testFile, testContent, 'utf8');

      const result = await fileContentReader.readFile(testFile);

      assert.ok(result);
      assert.strictEqual(result.metadata.indentationStyle, 'tabs');
    });

    test('should detect mixed line endings', async () => {
      const testContent = 'line1\r\nline2\nline3\r\n';
      const testFile = path.join(tempDir, 'mixed-endings.cpp');
      await fs.promises.writeFile(testFile, testContent);

      const result = await fileContentReader.readFile(testFile);

      assert.ok(result);
      assert.strictEqual(result.metadata.lineEndings, 'mixed');
    });

    test('should detect CRLF line endings', async () => {
      const testContent = 'line1\r\nline2\r\nline3\r\n';
      const testFile = path.join(tempDir, 'crlf.cpp');
      await fs.promises.writeFile(testFile, testContent);

      const result = await fileContentReader.readFile(testFile);

      assert.ok(result);
      assert.strictEqual(result.metadata.lineEndings, 'crlf');
    });
  });

  describe('Batch File Reading', () => {
    test('should read multiple files concurrently', async () => {
      const files = ['test1.cpp', 'test2.h', 'test3.c'];
      const filePaths: string[] = [];

      // Create test files
      for (const filename of files) {
        const filePath = path.join(tempDir, filename);
        await fs.promises.writeFile(filePath, `// Content of ${filename}\nint x = 1;`, 'utf8');
        filePaths.push(filePath);
      }

      const progressCallback = jest.fn();
      const results = await fileContentReader.readFiles(filePaths, undefined, progressCallback);

      assert.strictEqual(results.length, 3);
      assert.ok(results.every(result => result.content.includes('int x = 1;')));
      expect(progressCallback).toHaveBeenCalledTimes(3);
    });

    test('should handle mixed valid and invalid files', async () => {
      const validFile = path.join(tempDir, 'valid.cpp');
      const binaryFile = path.join(tempDir, 'binary.bin');
      const nonExistentFile = path.join(tempDir, 'nonexistent.cpp');

      await fs.promises.writeFile(validFile, 'int main() { return 0; }', 'utf8');
      await fs.promises.writeFile(binaryFile, Buffer.from([0x00, 0x01, 0x02]));

      const results = await fileContentReader.readFiles([validFile, binaryFile, nonExistentFile]);

      // Should only return results for valid files
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].path, validFile);
    });
  });

  describe('Error Handling', () => {
    test('should handle permission errors gracefully', async () => {
      const testFile = path.join(tempDir, 'permission-error.cpp');
      await fs.promises.writeFile(testFile, 'test content', 'utf8');

      // Mock fs.promises.stat to throw permission error
      const originalStat = fs.promises.stat;
      jest.spyOn(fs.promises, 'stat').mockRejectedValueOnce(new Error('EACCES: permission denied'));

      const result = await fileContentReader.readFile(testFile);

      assert.strictEqual(result, null);
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Error reading file')
      );

      // Restore original function
      jest.spyOn(fs.promises, 'stat').mockImplementation(originalStat);
    });

    test('should handle corrupted files gracefully', async () => {
      const testFile = path.join(tempDir, 'corrupted.cpp');
      
      // Mock fs.promises.readFile to throw error
      jest.spyOn(fs.promises, 'readFile').mockRejectedValueOnce(new Error('File corrupted'));

      const result = await fileContentReader.readFile(testFile);

      assert.strictEqual(result, null);
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Error reading file')
      );
    });
  });

  describe('Resource Management', () => {
    test('should dispose resources properly', () => {
      const reader = new FileContentReader(mockOutputChannel);
      
      // Should not throw error
      reader.dispose();
      
      // Can be called multiple times safely
      reader.dispose();
    });
  });
}); 