/**
 * Code Syntax Highlighter
 * 
 * Provides language-aware syntax highlighting for code snippets in search results.
 * Supports C/C++ and related languages with extensible architecture for additional languages.
 */

import * as path from 'path';
import * as vscode from 'vscode';

export interface SyntaxToken {
  type: TokenType;
  value: string;
  position: TokenPosition;
  length: number;
  cssClass?: string;
}

export interface TokenPosition {
  line: number;
  column: number;
}

export type TokenType = 
  | 'keyword' 
  | 'type' 
  | 'string' 
  | 'character'
  | 'number' 
  | 'comment' 
  | 'identifier' 
  | 'operator' 
  | 'punctuation'
  | 'preprocessor'
  | 'constant'
  | 'function'
  | 'class'
  | 'namespace'
  | 'variable'
  | 'text'
  | 'whitespace';

export interface SyntaxHighlighter {
  tokenize(code: string): SyntaxToken[];
  getLanguageId(): string;
  getSupportedExtensions(): string[];
}

export interface HighlightedLine {
  lineNumber: number;
  tokens: SyntaxToken[];
  rawText: string;
}

export interface HighlightOptions {
  enableSemanticHighlighting: boolean;
  preserveWhitespace: boolean;
  maxLineLength: number;
  showLineNumbers: boolean;
}

/**
 * Main syntax highlighter class
 */
export class CodeSyntaxHighlighter {
  private highlighters: Map<string, SyntaxHighlighter>;
  private languageCache: Map<string, string>;
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.highlighters = new Map();
    this.languageCache = new Map();
    this.outputChannel = vscode.window.createOutputChannel('CppSeek Syntax Highlighter');
    
    this.setupLanguageHighlighters();
    this.outputChannel.appendLine('🎨 CodeSyntaxHighlighter initialized');
  }

  /**
   * Highlight code snippet and return syntax tokens
   */
  async highlight(
    code: string, 
    filePath: string, 
    _options: Partial<HighlightOptions> = {}
  ): Promise<SyntaxToken[]> {
    try {
      const language = this.detectLanguage(filePath);
      const highlighter = this.highlighters.get(language);

      if (!highlighter) {
        this.outputChannel.appendLine(`⚠️ No highlighter found for language: ${language}`);
        return this.createPlainTokens(code);
      }

      const startTime = Date.now();
      const tokens = highlighter.tokenize(code);
      const highlightTime = Date.now() - startTime;

      this.outputChannel.appendLine(
        `✅ Highlighted ${code.length} chars in ${highlightTime}ms (${language})`
      );

      return tokens;

    } catch (error) {
      this.outputChannel.appendLine(`❌ Highlighting failed: ${error}`);
      return this.createPlainTokens(code);
    }
  }

  /**
   * Highlight code and organize by lines
   */
  async highlightByLines(
    code: string,
    filePath: string,
    options: Partial<HighlightOptions> = {}
  ): Promise<HighlightedLine[]> {
    const tokens = await this.highlight(code, filePath, options);
    return this.organizeTokensByLines(tokens, code);
  }

  /**
   * Generate HTML for highlighted code
   */
  async generateHTML(
    code: string,
    filePath: string,
    options: Partial<HighlightOptions> = {}
  ): Promise<string> {
    const lines = await this.highlightByLines(code, filePath, options);
    return this.generateHTMLFromLines(lines, options);
  }

  /**
   * Detect programming language from file path
   */
  private detectLanguage(filePath: string): string {
    if (this.languageCache.has(filePath)) {
      return this.languageCache.get(filePath)!;
    }

    const extension = path.extname(filePath).toLowerCase();
    let language: string;

    switch (extension) {
      case '.cpp':
      case '.cc':
      case '.cxx':
      case '.c++':
        language = 'cpp';
        break;
      case '.h':
      case '.hpp':
      case '.hxx':
      case '.h++':
        language = 'cpp-header';
        break;
      case '.c':
        language = 'c';
        break;
      case '.cmake':
        language = 'cmake';
        break;
      case '.make':
      case '.mk':
        language = 'makefile';
        break;
      default:
        language = 'text';
    }

    this.languageCache.set(filePath, language);
    return language;
  }

  /**
   * Setup language-specific highlighters
   */
  private setupLanguageHighlighters(): void {
    this.highlighters.set('cpp', new CppSyntaxHighlighter());
    this.highlighters.set('cpp-header', new CppHeaderSyntaxHighlighter());
    this.highlighters.set('c', new CSyntaxHighlighter());
    this.highlighters.set('cmake', new CMakeSyntaxHighlighter());
    this.highlighters.set('makefile', new MakefileSyntaxHighlighter());
    this.highlighters.set('text', new PlainTextHighlighter());

    this.outputChannel.appendLine(`📚 Loaded ${this.highlighters.size} syntax highlighters`);
  }

  /**
   * Create plain text tokens for unsupported languages
   */
  private createPlainTokens(code: string): SyntaxToken[] {
    const lines = code.split('\n');
    const tokens: SyntaxToken[] = [];

    lines.forEach((line, lineIndex) => {
      if (line.length > 0) {
        tokens.push({
          type: 'text',
          value: line,
          position: { line: lineIndex, column: 0 },
          length: line.length,
          cssClass: 'token-text'
        });
      }
    });

    return tokens;
  }

  /**
   * Organize tokens by lines
   */
  private organizeTokensByLines(tokens: SyntaxToken[], code: string): HighlightedLine[] {
    const lines: HighlightedLine[] = [];
    const codeLines = code.split('\n');
    
    // Group tokens by line
    const tokensByLine = new Map<number, SyntaxToken[]>();
    
    tokens.forEach(token => {
      const lineNum = token.position.line;
      if (!tokensByLine.has(lineNum)) {
        tokensByLine.set(lineNum, []);
      }
      tokensByLine.get(lineNum)!.push(token);
    });

    // Create highlighted lines
    codeLines.forEach((rawText, lineIndex) => {
      const lineTokens = tokensByLine.get(lineIndex) || [];
      
      lines.push({
        lineNumber: lineIndex + 1,
        tokens: lineTokens.sort((a, b) => a.position.column - b.position.column),
        rawText
      });
    });

    return lines;
  }

  /**
   * Generate HTML from highlighted lines
   */
  private generateHTMLFromLines(
    lines: HighlightedLine[],
    options: Partial<HighlightOptions> = {}
  ): string {
    const showLineNumbers = options.showLineNumbers !== false;
    const preserveWhitespace = options.preserveWhitespace !== false;
    
    let html = '<div class="syntax-highlighted-code">';
    
    lines.forEach(line => {
      html += '<div class="code-line">';
      
      if (showLineNumbers) {
        html += `<span class="line-number">${line.lineNumber}</span>`;
      }
      
      html += '<span class="line-content">';
      
      if (line.tokens.length === 0) {
        // No tokens, use plain text
        html += this.escapeHtml(line.rawText);
      } else {
        // Build line from tokens
        let position = 0;
        
        line.tokens.forEach(token => {
          // Add any text before this token
          if (token.position.column > position) {
            const beforeText = line.rawText.substring(position, token.position.column);
            html += this.escapeHtml(beforeText);
          }
          
          // Add the token
          const cssClass = token.cssClass || `token-${token.type}`;
          html += `<span class="${cssClass}" title="${token.type}">${this.escapeHtml(token.value)}</span>`;
          
          position = token.position.column + token.length;
        });
        
        // Add any remaining text
        if (position < line.rawText.length) {
          const remainingText = line.rawText.substring(position);
          html += this.escapeHtml(remainingText);
        }
      }
      
      html += '</span>';
      html += '</div>';
    });
    
    html += '</div>';
    
    if (preserveWhitespace) {
      html = `<pre class="preserve-whitespace">${html}</pre>`;
    }
    
    return html;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return Array.from(this.highlighters.keys());
  }

  /**
   * Clear language cache
   */
  clearCache(): void {
    this.languageCache.clear();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.languageCache.clear();
    this.outputChannel.dispose();
  }
}

/**
 * C++ syntax highlighter
 */
export class CppSyntaxHighlighter implements SyntaxHighlighter {
  private keywords = new Set([
    // C++ keywords
    'alignas', 'alignof', 'and', 'and_eq', 'asm', 'atomic_cancel', 'atomic_commit',
    'atomic_noexcept', 'auto', 'bitand', 'bitor', 'bool', 'break', 'case', 'catch',
    'char', 'char8_t', 'char16_t', 'char32_t', 'class', 'compl', 'concept', 'const',
    'consteval', 'constexpr', 'constinit', 'const_cast', 'continue', 'co_await',
    'co_return', 'co_yield', 'decltype', 'default', 'delete', 'do', 'double',
    'dynamic_cast', 'else', 'enum', 'explicit', 'export', 'extern', 'false',
    'float', 'for', 'friend', 'goto', 'if', 'inline', 'int', 'long', 'mutable',
    'namespace', 'new', 'noexcept', 'not', 'not_eq', 'nullptr', 'operator', 'or',
    'or_eq', 'private', 'protected', 'public', 'reflexpr', 'register',
    'reinterpret_cast', 'requires', 'return', 'short', 'signed', 'sizeof', 'static',
    'static_assert', 'static_cast', 'struct', 'switch', 'synchronized', 'template',
    'this', 'thread_local', 'throw', 'true', 'try', 'typedef', 'typeid', 'typename',
    'union', 'unsigned', 'using', 'virtual', 'void', 'volatile', 'wchar_t', 'while',
    'xor', 'xor_eq'
  ]);

  private types = new Set([
    'std::string', 'std::vector', 'std::map', 'std::set', 'std::list', 'std::array',
    'std::unique_ptr', 'std::shared_ptr', 'std::weak_ptr', 'std::function',
    'string', 'vector', 'map', 'set', 'list', 'array', 'unique_ptr', 'shared_ptr',
    'size_t', 'ptrdiff_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t',
    'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t'
  ]);

  private constants = new Set([
    'true', 'false', 'nullptr', 'NULL', 'TRUE', 'FALSE'
  ]);

  getLanguageId(): string {
    return 'cpp';
  }

  getSupportedExtensions(): string[] {
    return ['.cpp', '.cc', '.cxx', '.c++'];
  }

  tokenize(code: string): SyntaxToken[] {
    const tokens: SyntaxToken[] = [];
    const lines = code.split('\n');

    lines.forEach((line, lineIndex) => {
      const lineTokens = this.tokenizeLine(line, lineIndex);
      tokens.push(...lineTokens);
    });

    return tokens;
  }

  private tokenizeLine(line: string, lineNumber: number): SyntaxToken[] {
    const tokens: SyntaxToken[] = [];
    
    // Combined regex for different token types
    const tokenRegex = /(\s+)|(\/\/.*$)|(\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*")|('(?:[^'\\]|\\.)*')|(\#\w+)|(\b(?:0x[0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?[fFdDlL]?)\b)|(\b[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*\b)|([+\-*/%=<>!&|^~?:;,.])|(\{|\}|\(|\)|\[|\])/g;

    let match;
    while ((match = tokenRegex.exec(line)) !== null) {
      const [fullMatch, whitespace, lineComment, blockComment, stringLiteral, charLiteral, preprocessor, number, identifier, operator, punctuation] = match;
      
      let tokenType: TokenType;
      let cssClass: string;

      if (whitespace) {
        tokenType = 'whitespace';
        cssClass = 'token-whitespace';
      } else if (lineComment || blockComment) {
        tokenType = 'comment';
        cssClass = 'token-comment';
      } else if (stringLiteral) {
        tokenType = 'string';
        cssClass = 'token-string';
      } else if (charLiteral) {
        tokenType = 'character';
        cssClass = 'token-character';
      } else if (preprocessor) {
        tokenType = 'preprocessor';
        cssClass = 'token-preprocessor';
      } else if (number) {
        tokenType = 'number';
        cssClass = 'token-number';
      } else if (identifier) {
        const cleanId = identifier.toLowerCase();
        
        if (this.keywords.has(cleanId)) {
          tokenType = 'keyword';
          cssClass = 'token-keyword';
        } else if (this.types.has(identifier)) {
          tokenType = 'type';
          cssClass = 'token-type';
        } else if (this.constants.has(identifier)) {
          tokenType = 'constant';
          cssClass = 'token-constant';
        } else if (this.isClassName(identifier)) {
          tokenType = 'class';
          cssClass = 'token-class';
        } else if (this.isFunctionName(identifier, line, match.index!)) {
          tokenType = 'function';
          cssClass = 'token-function';
        } else {
          tokenType = 'identifier';
          cssClass = 'token-identifier';
        }
      } else if (operator) {
        tokenType = 'operator';
        cssClass = 'token-operator';
      } else if (punctuation) {
        tokenType = 'punctuation';
        cssClass = 'token-punctuation';
      } else {
        tokenType = 'text';
        cssClass = 'token-text';
      }

      tokens.push({
        type: tokenType,
        value: fullMatch,
        position: { line: lineNumber, column: match.index! },
        length: fullMatch.length,
        cssClass
      });
    }

    return tokens;
  }

  private isClassName(identifier: string): boolean {
    // Simple heuristic: starts with uppercase letter
    return /^[A-Z]/.test(identifier) && identifier.length > 1;
  }

  private isFunctionName(identifier: string, line: string, position: number): boolean {
    // Look ahead for opening parenthesis
    const afterIdentifier = line.substring(position + identifier.length).trim();
    return afterIdentifier.startsWith('(');
  }
}

/**
 * C++ Header syntax highlighter (extends C++)
 */
export class CppHeaderSyntaxHighlighter extends CppSyntaxHighlighter {
  private headerKeywords = new Set([
    'pragma', 'include', 'define', 'undef', 'ifdef', 'ifndef', 'if', 'elif', 'else', 'endif'
  ]);

  getLanguageId(): string {
    return 'cpp-header';
  }

  getSupportedExtensions(): string[] {
    return ['.h', '.hpp', '.hxx', '.h++'];
  }

  tokenize(code: string): SyntaxToken[] {
    const tokens = super.tokenize(code);
    
    // Post-process to handle header-specific constructs
    return tokens.map(token => {
      if (token.type === 'preprocessor' && token.value.startsWith('#')) {
        const directive = token.value.substring(1);
        if (this.headerKeywords.has(directive)) {
          return {
            ...token,
            cssClass: 'token-preprocessor-directive'
          };
        }
      }
      return token;
    });
  }
}

/**
 * C syntax highlighter (subset of C++)
 */
export class CSyntaxHighlighter implements SyntaxHighlighter {
  private keywords = new Set([
    'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double',
    'else', 'enum', 'extern', 'float', 'for', 'goto', 'if', 'inline', 'int', 'long',
    'register', 'restrict', 'return', 'short', 'signed', 'sizeof', 'static', 'struct',
    'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while', '_Bool',
    '_Complex', '_Imaginary', '_Alignas', '_Alignof', '_Atomic', '_Static_assert',
    '_Noreturn', '_Thread_local', '_Generic'
  ]);

  getLanguageId(): string {
    return 'c';
  }

  getSupportedExtensions(): string[] {
    return ['.c'];
  }

  tokenize(code: string): SyntaxToken[] {
    // Similar to C++ but with more limited keyword set
    const tokens: SyntaxToken[] = [];
    const lines = code.split('\n');

    lines.forEach((line, lineIndex) => {
      const lineTokens = this.tokenizeLine(line, lineIndex);
      tokens.push(...lineTokens);
    });

    return tokens;
  }

  private tokenizeLine(line: string, lineNumber: number): SyntaxToken[] {
    // Simplified version of C++ tokenizer
    const tokens: SyntaxToken[] = [];
    const words = line.split(/(\s+)/);
    let column = 0;

    words.forEach(word => {
      if (word.trim().length > 0) {
        let tokenType: TokenType = 'identifier';
        
        if (this.keywords.has(word.toLowerCase())) {
          tokenType = 'keyword';
        } else if (/^\d+/.test(word)) {
          tokenType = 'number';
        } else if (/^".*"$/.test(word)) {
          tokenType = 'string';
        } else if (/^\/\//.test(word)) {
          tokenType = 'comment';
        }

        tokens.push({
          type: tokenType,
          value: word,
          position: { line: lineNumber, column },
          length: word.length,
          cssClass: `token-${tokenType}`
        });
      }
      
      column += word.length;
    });

    return tokens;
  }
}

/**
 * CMake syntax highlighter
 */
export class CMakeSyntaxHighlighter implements SyntaxHighlighter {
  private commands = new Set([
    'cmake_minimum_required', 'project', 'add_executable', 'add_library', 'target_link_libraries',
    'find_package', 'set', 'option', 'configure_file', 'install', 'add_subdirectory',
    'include', 'if', 'else', 'elseif', 'endif', 'foreach', 'endforeach', 'while', 'endwhile',
    'function', 'endfunction', 'macro', 'endmacro'
  ]);

  getLanguageId(): string {
    return 'cmake';
  }

  getSupportedExtensions(): string[] {
    return ['.cmake'];
  }

  tokenize(code: string): SyntaxToken[] {
    const tokens: SyntaxToken[] = [];
    const lines = code.split('\n');

    lines.forEach((line, lineIndex) => {
      if (line.trim().startsWith('#')) {
        tokens.push({
          type: 'comment',
          value: line,
          position: { line: lineIndex, column: 0 },
          length: line.length,
          cssClass: 'token-comment'
        });
      } else {
        const words = line.split(/(\s+)/);
        let column = 0;

        words.forEach(word => {
          if (word.trim().length > 0) {
            const tokenType = this.commands.has(word.toLowerCase()) ? 'keyword' : 'identifier';
            
            tokens.push({
              type: tokenType,
              value: word,
              position: { line: lineIndex, column },
              length: word.length,
              cssClass: `token-${tokenType}`
            });
          }
          column += word.length;
        });
      }
    });

    return tokens;
  }
}

/**
 * Makefile syntax highlighter
 */
export class MakefileSyntaxHighlighter implements SyntaxHighlighter {
  getLanguageId(): string {
    return 'makefile';
  }

  getSupportedExtensions(): string[] {
    return ['.make', '.mk'];
  }

  tokenize(code: string): SyntaxToken[] {
    const tokens: SyntaxToken[] = [];
    const lines = code.split('\n');

    lines.forEach((line, lineIndex) => {
      if (line.includes(':')) {
        // Target line
        const colonIndex = line.indexOf(':');
        tokens.push({
          type: 'function',
          value: line.substring(0, colonIndex),
          position: { line: lineIndex, column: 0 },
          length: colonIndex,
          cssClass: 'token-target'
        });
      } else if (line.trim().startsWith('#')) {
        // Comment
        tokens.push({
          type: 'comment',
          value: line,
          position: { line: lineIndex, column: 0 },
          length: line.length,
          cssClass: 'token-comment'
        });
      } else {
        // Regular text
        tokens.push({
          type: 'text',
          value: line,
          position: { line: lineIndex, column: 0 },
          length: line.length,
          cssClass: 'token-text'
        });
      }
    });

    return tokens;
  }
}

/**
 * Plain text highlighter (fallback)
 */
export class PlainTextHighlighter implements SyntaxHighlighter {
  getLanguageId(): string {
    return 'text';
  }

  getSupportedExtensions(): string[] {
    return ['*'];
  }

  tokenize(code: string): SyntaxToken[] {
    const tokens: SyntaxToken[] = [];
    const lines = code.split('\n');

    lines.forEach((line, lineIndex) => {
      if (line.length > 0) {
        tokens.push({
          type: 'text',
          value: line,
          position: { line: lineIndex, column: 0 },
          length: line.length,
          cssClass: 'token-text'
        });
      }
    });

    return tokens;
  }
} 