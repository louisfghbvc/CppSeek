/**
 * Results Exporter
 * 
 * Handles exporting search results to various formats including Markdown, JSON,
 * CSV, and HTML with configurable options and formatting.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { RankedSearchResult } from '../services/searchResultRanker';

export type ExportFormat = 'markdown' | 'json' | 'csv' | 'html' | 'text';

export interface ExportOptions {
  query: string;
  includeContent: boolean;
  includeRankingFactors: boolean;
  includeMetadata: boolean;
  maxContentLength?: number;
  timestampFormat?: 'iso' | 'local' | 'unix';
  groupBy?: 'file' | 'rank' | 'none';
  sortBy?: 'rank' | 'file' | 'similarity';
  includeStatistics?: boolean;
  customHeaders?: { [key: string]: string };
}

export interface ExportResult {
  content: string;
  format: ExportFormat;
  filename: string;
  size: number;
  resultCount: number;
  exportTimestamp: string;
}

export interface ExportStatistics {
  totalResults: number;
  averageScore: number;
  topScore: number;
  bottomScore: number;
  fileCount: number;
  uniqueFunctions: number;
  uniqueClasses: number;
  uniqueNamespaces: number;
}

/**
 * Main results exporter class
 */
export class ResultsExporter {
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('CppSeek Results Exporter');
    this.outputChannel.appendLine('📤 ResultsExporter initialized');
  }

  /**
   * Export results to specified format
   */
  async exportResults(
    results: RankedSearchResult[],
    format: ExportFormat,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      const startTime = Date.now();
      
      this.outputChannel.appendLine(
        `📦 Exporting ${results.length} results to ${format} format`
      );

      let content: string;
      let filename: string;

      switch (format) {
        case 'markdown':
          content = this.exportToMarkdown(results, options);
          filename = this.generateFilename(options.query, 'md');
          break;
        case 'json':
          content = this.exportToJSON(results, options);
          filename = this.generateFilename(options.query, 'json');
          break;
        case 'csv':
          content = this.exportToCSV(results, options);
          filename = this.generateFilename(options.query, 'csv');
          break;
        case 'html':
          content = this.exportToHTML(results, options);
          filename = this.generateFilename(options.query, 'html');
          break;
        case 'text':
          content = this.exportToText(results, options);
          filename = this.generateFilename(options.query, 'txt');
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      const exportTime = Date.now() - startTime;
      const exportResult: ExportResult = {
        content,
        format,
        filename,
        size: content.length,
        resultCount: results.length,
        exportTimestamp: this.formatTimestamp(new Date(), options.timestampFormat)
      };

      this.outputChannel.appendLine(
        `✅ Export completed in ${exportTime}ms (${content.length} bytes)`
      );

      return exportResult;

    } catch (error) {
      this.outputChannel.appendLine(`❌ Export failed: ${error}`);
      throw new Error(`Export failed: ${error}`);
    }
  }

  /**
   * Export to Markdown format
   */
  private exportToMarkdown(results: RankedSearchResult[], options: ExportOptions): string {
    const timestamp = this.formatTimestamp(new Date(), options.timestampFormat);
    const statistics = this.calculateStatistics(results);
    
    let markdown = '';

    // Header
    markdown += `# CppSeek Search Results\n\n`;
    markdown += `**Query:** \`${this.escapeMarkdown(options.query)}\`\n`;
    markdown += `**Results:** ${results.length}\n`;
    markdown += `**Generated:** ${timestamp}\n\n`;

    // Add custom headers
    if (options.customHeaders) {
      Object.entries(options.customHeaders).forEach(([key, value]) => {
        markdown += `**${key}:** ${value}\n`;
      });
      markdown += '\n';
    }

    // Statistics
    if (options.includeStatistics) {
      markdown += this.generateMarkdownStatistics(statistics);
    }

    // Results
    markdown += `## Search Results\n\n`;

    // Group and sort results
    const organizedResults = this.organizeResults(results, options);

    organizedResults.forEach((result, index) => {
      markdown += `### ${index + 1}. `;
      
      if (result.functionName) {
        markdown += `${this.escapeMarkdown(result.functionName)}`;
        if (result.className) {
          markdown += ` (in ${this.escapeMarkdown(result.className)})`;
        }
      } else if (result.className) {
        markdown += `${this.escapeMarkdown(result.className)}`;
      } else {
        markdown += 'Code Block';
      }
      
      markdown += '\n\n';

      // File and location info
      markdown += `**File:** \`${this.escapeMarkdown(result.filePath)}\`\n`;
      markdown += `**Lines:** ${result.startLine}-${result.endLine}\n`;
      markdown += `**Rank:** #${result.rankPosition}\n`;
      markdown += `**Similarity:** ${(result.similarity * 100).toFixed(1)}%\n`;
      markdown += `**Final Score:** ${result.finalScore.toFixed(3)}\n`;

      // Metadata
      if (options.includeMetadata) {
        if (result.namespace) {
          markdown += `**Namespace:** \`${this.escapeMarkdown(result.namespace)}\`\n`;
        }
        if (result.relevanceFactors) {
          markdown += `**Semantic Score:** ${(result.relevanceFactors.semanticScore * 100).toFixed(1)}%\n`;
          markdown += `**Context Score:** ${(result.relevanceFactors.contextScore * 100).toFixed(1)}%\n`;
        }
      }

      // Ranking factors
      if (options.includeRankingFactors && result.rankingFactors) {
        markdown += '\n**Ranking Factors:**\n';
        markdown += `- Semantic Similarity: ${(result.rankingFactors.semanticSimilarity * 100).toFixed(1)}%\n`;
        markdown += `- Structural Relevance: ${(result.rankingFactors.structuralRelevance * 100).toFixed(1)}%\n`;
        markdown += `- Recency Score: ${(result.rankingFactors.recencyScore * 100).toFixed(1)}%\n`;
        markdown += `- User Preference: ${(result.rankingFactors.userPreferenceScore * 100).toFixed(1)}%\n`;
        markdown += `- Complexity Score: ${(result.rankingFactors.complexityScore * 100).toFixed(1)}%\n`;
      }

      // Code content
      if (options.includeContent) {
        markdown += '\n**Code:**\n\n';
        const language = this.detectLanguageFromPath(result.filePath);
        let content = result.content;
        
        if (options.maxContentLength && content.length > options.maxContentLength) {
          content = content.substring(0, options.maxContentLength) + '...';
        }
        
        markdown += `\`\`\`${language}\n${content}\n\`\`\`\n\n`;
      } else {
        markdown += '\n';
      }

      // Context snippet
      if (result.contextSnippet) {
        markdown += `*Context: ${this.escapeMarkdown(result.contextSnippet)}*\n\n`;
      }
    });

    return markdown;
  }

  /**
   * Export to JSON format
   */
  private exportToJSON(results: RankedSearchResult[], options: ExportOptions): string {
    const timestamp = this.formatTimestamp(new Date(), options.timestampFormat);
    const statistics = this.calculateStatistics(results);
    
    const exportData = {
      metadata: {
        query: options.query,
        timestamp,
        resultCount: results.length,
        exportFormat: 'json',
        options: {
          includeContent: options.includeContent,
          includeRankingFactors: options.includeRankingFactors,
          includeMetadata: options.includeMetadata,
          groupBy: options.groupBy,
          sortBy: options.sortBy
        },
        customHeaders: options.customHeaders || {}
      },
      statistics: options.includeStatistics ? statistics : undefined,
      results: this.organizeResults(results, options).map(result => ({
        rank: result.rankPosition,
        file: {
          path: result.filePath,
          startLine: result.startLine,
          endLine: result.endLine,
          language: this.detectLanguageFromPath(result.filePath)
        },
        scores: {
          similarity: result.similarity,
          finalScore: result.finalScore,
          confidenceScore: result.confidenceScore
        },
        rankingFactors: options.includeRankingFactors ? result.rankingFactors : undefined,
        codeStructure: options.includeMetadata ? {
          functionName: result.functionName,
          className: result.className,
          namespace: result.namespace
        } : undefined,
        content: options.includeContent ? {
          code: options.maxContentLength && result.content.length > options.maxContentLength
            ? result.content.substring(0, options.maxContentLength) + '...'
            : result.content,
          contextSnippet: result.contextSnippet
        } : undefined,
        relevanceFactors: options.includeMetadata ? result.relevanceFactors : undefined,
        explanation: result.explanation
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export to CSV format
   */
  private exportToCSV(results: RankedSearchResult[], options: ExportOptions): string {
    const organizedResults = this.organizeResults(results, options);
    
    // CSV headers
    const headers = [
      'Rank',
      'File',
      'StartLine',
      'EndLine',
      'FunctionName',
      'ClassName',
      'Namespace',
      'Similarity',
      'FinalScore',
      'ConfidenceScore'
    ];

    if (options.includeRankingFactors) {
      headers.push(
        'SemanticSimilarity',
        'StructuralRelevance', 
        'RecencyScore',
        'UserPreference',
        'ComplexityScore',
        'DiversityPenalty'
      );
    }

    if (options.includeContent) {
      headers.push('Content');
    }

    headers.push('ContextSnippet');

    let csv = headers.join(',') + '\n';

    // CSV data
    organizedResults.forEach(result => {
      const row = [
        result.rankPosition,
        this.escapeCSV(result.filePath),
        result.startLine,
        result.endLine,
        this.escapeCSV(result.functionName || ''),
        this.escapeCSV(result.className || ''),
        this.escapeCSV(result.namespace || ''),
        result.similarity.toFixed(3),
        result.finalScore.toFixed(3),
        result.confidenceScore.toFixed(3)
      ];

      if (options.includeRankingFactors && result.rankingFactors) {
        row.push(
          result.rankingFactors.semanticSimilarity.toFixed(3),
          result.rankingFactors.structuralRelevance.toFixed(3),
          result.rankingFactors.recencyScore.toFixed(3),
          result.rankingFactors.userPreferenceScore.toFixed(3),
          result.rankingFactors.complexityScore.toFixed(3),
          result.rankingFactors.diversityPenalty.toFixed(3)
        );
      }

      if (options.includeContent) {
        let content = result.content.replace(/\n/g, '\\n');
        if (options.maxContentLength && content.length > options.maxContentLength) {
          content = content.substring(0, options.maxContentLength) + '...';
        }
        row.push(this.escapeCSV(content));
      }

      row.push(this.escapeCSV(result.contextSnippet || ''));

      csv += row.join(',') + '\n';
    });

    return csv;
  }

  /**
   * Export to HTML format
   */
  private exportToHTML(results: RankedSearchResult[], options: ExportOptions): string {
    const timestamp = this.formatTimestamp(new Date(), options.timestampFormat);
    const statistics = this.calculateStatistics(results);
    const organizedResults = this.organizeResults(results, options);

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CppSeek Search Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #e0e0e0; padding-bottom: 20px; margin-bottom: 30px; }
        .query { font-size: 24px; color: #333; margin-bottom: 10px; }
        .metadata { color: #666; margin-bottom: 10px; }
        .statistics { background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 30px; }
        .result-item { border: 1px solid #e0e0e0; border-radius: 6px; margin-bottom: 20px; overflow: hidden; }
        .result-header { background: #f8f9fa; padding: 15px; border-bottom: 1px solid #e0e0e0; }
        .result-title { font-size: 18px; font-weight: bold; color: #0066cc; margin-bottom: 5px; }
        .result-location { color: #666; font-size: 14px; margin-bottom: 10px; }
        .result-scores { display: flex; gap: 15px; font-size: 14px; }
        .score-item { background: #e3f2fd; padding: 5px 10px; border-radius: 4px; }
        .result-content { padding: 15px; }
        .code-block { background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; padding: 10px; font-family: 'Courier New', monospace; font-size: 13px; overflow-x: auto; }
        .ranking-factors { margin-top: 10px; }
        .factor { background: #fff3e0; padding: 5px; margin: 2px; border-radius: 3px; display: inline-block; font-size: 12px; }
        .context-snippet { font-style: italic; color: #666; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="query">CppSeek Search Results</div>
            <div class="metadata">Query: <strong>"${this.escapeHtml(options.query)}"</strong></div>
            <div class="metadata">Results: ${results.length} | Generated: ${timestamp}</div>`;

    // Custom headers
    if (options.customHeaders) {
      Object.entries(options.customHeaders).forEach(([key, value]) => {
        html += `<div class="metadata">${this.escapeHtml(key)}: ${this.escapeHtml(value)}</div>`;
      });
    }

    html += `</div>`;

    // Statistics
    if (options.includeStatistics) {
      html += `
        <div class="statistics">
            <h3>Statistics</h3>
            <p>Total Results: ${statistics.totalResults}</p>
            <p>Average Score: ${statistics.averageScore.toFixed(3)}</p>
            <p>Score Range: ${statistics.topScore.toFixed(3)} - ${statistics.bottomScore.toFixed(3)}</p>
            <p>Files: ${statistics.fileCount} | Functions: ${statistics.uniqueFunctions} | Classes: ${statistics.uniqueClasses}</p>
        </div>`;
    }

    // Results
    organizedResults.forEach((result, index) => {
      html += `
        <div class="result-item">
            <div class="result-header">
                <div class="result-title">
                    ${index + 1}. ${result.functionName ? this.escapeHtml(result.functionName) : 'Code Block'}
                    ${result.className ? ` (in ${this.escapeHtml(result.className)})` : ''}
                </div>
                <div class="result-location">
                    ${this.escapeHtml(result.filePath)}:${result.startLine}-${result.endLine}
                </div>
                <div class="result-scores">
                    <div class="score-item">Rank: #${result.rankPosition}</div>
                    <div class="score-item">Similarity: ${(result.similarity * 100).toFixed(1)}%</div>
                    <div class="score-item">Final Score: ${result.finalScore.toFixed(3)}</div>
                    <div class="score-item">Confidence: ${result.confidenceScore.toFixed(3)}</div>
                </div>
            </div>
            <div class="result-content">`;

      // Ranking factors
      if (options.includeRankingFactors && result.rankingFactors) {
        html += `
          <div class="ranking-factors">
              <strong>Ranking Factors:</strong>
              <span class="factor">Semantic: ${(result.rankingFactors.semanticSimilarity * 100).toFixed(1)}%</span>
              <span class="factor">Structural: ${(result.rankingFactors.structuralRelevance * 100).toFixed(1)}%</span>
              <span class="factor">Recency: ${(result.rankingFactors.recencyScore * 100).toFixed(1)}%</span>
              <span class="factor">User Pref: ${(result.rankingFactors.userPreferenceScore * 100).toFixed(1)}%</span>
          </div>`;
      }

      // Content
      if (options.includeContent) {
        let content = result.content;
        if (options.maxContentLength && content.length > options.maxContentLength) {
          content = content.substring(0, options.maxContentLength) + '...';
        }
        html += `<div class="code-block">${this.escapeHtml(content)}</div>`;
      }

      // Context snippet
      if (result.contextSnippet) {
        html += `<div class="context-snippet">Context: ${this.escapeHtml(result.contextSnippet)}</div>`;
      }

      html += `</div></div>`;
    });

    html += `
    </div>
</body>
</html>`;

    return html;
  }

  /**
   * Export to plain text format
   */
  private exportToText(results: RankedSearchResult[], options: ExportOptions): string {
    const timestamp = this.formatTimestamp(new Date(), options.timestampFormat);
    const statistics = this.calculateStatistics(results);
    const organizedResults = this.organizeResults(results, options);
    
    let text = '';

    // Header
    text += '='.repeat(60) + '\n';
    text += 'CppSeek Search Results\n';
    text += '='.repeat(60) + '\n\n';
    text += `Query: "${options.query}"\n`;
    text += `Results: ${results.length}\n`;
    text += `Generated: ${timestamp}\n\n`;

    // Custom headers
    if (options.customHeaders) {
      Object.entries(options.customHeaders).forEach(([key, value]) => {
        text += `${key}: ${value}\n`;
      });
      text += '\n';
    }

    // Statistics
    if (options.includeStatistics) {
      text += 'STATISTICS\n';
      text += '-'.repeat(20) + '\n';
      text += `Total Results: ${statistics.totalResults}\n`;
      text += `Average Score: ${statistics.averageScore.toFixed(3)}\n`;
      text += `Score Range: ${statistics.topScore.toFixed(3)} - ${statistics.bottomScore.toFixed(3)}\n`;
      text += `Files: ${statistics.fileCount} | Functions: ${statistics.uniqueFunctions} | Classes: ${statistics.uniqueClasses}\n\n`;
    }

    // Results
    text += 'SEARCH RESULTS\n';
    text += '-'.repeat(30) + '\n\n';

    organizedResults.forEach((result, index) => {
      text += `${index + 1}. `;
      
      if (result.functionName) {
        text += result.functionName;
        if (result.className) {
          text += ` (in ${result.className})`;
        }
      } else if (result.className) {
        text += result.className;
      } else {
        text += 'Code Block';
      }
      
      text += '\n';
      text += `   File: ${result.filePath}:${result.startLine}-${result.endLine}\n`;
      text += `   Rank: #${result.rankPosition} | Similarity: ${(result.similarity * 100).toFixed(1)}% | Score: ${result.finalScore.toFixed(3)}\n`;

      if (options.includeMetadata) {
        if (result.namespace) {
          text += `   Namespace: ${result.namespace}\n`;
        }
      }

      if (options.includeRankingFactors && result.rankingFactors) {
        text += `   Ranking: Semantic=${(result.rankingFactors.semanticSimilarity * 100).toFixed(1)}% `;
        text += `Structural=${(result.rankingFactors.structuralRelevance * 100).toFixed(1)}% `;
        text += `Recency=${(result.rankingFactors.recencyScore * 100).toFixed(1)}%\n`;
      }

      if (options.includeContent) {
        text += '\n   Code:\n';
        let content = result.content;
        if (options.maxContentLength && content.length > options.maxContentLength) {
          content = content.substring(0, options.maxContentLength) + '...';
        }
        
        // Indent code content
        const indentedContent = content.split('\n').map(line => '   ' + line).join('\n');
        text += indentedContent + '\n';
      }

      if (result.contextSnippet) {
        text += `   Context: ${result.contextSnippet}\n`;
      }

      text += '\n';
    });

    return text;
  }

  /**
   * Calculate export statistics
   */
  private calculateStatistics(results: RankedSearchResult[]): ExportStatistics {
    if (results.length === 0) {
      return {
        totalResults: 0,
        averageScore: 0,
        topScore: 0,
        bottomScore: 0,
        fileCount: 0,
        uniqueFunctions: 0,
        uniqueClasses: 0,
        uniqueNamespaces: 0
      };
    }

    const scores = results.map(r => r.finalScore);
    const uniqueFiles = new Set(results.map(r => r.filePath));
    const uniqueFunctions = new Set(results.filter(r => r.functionName).map(r => r.functionName));
    const uniqueClasses = new Set(results.filter(r => r.className).map(r => r.className));
    const uniqueNamespaces = new Set(results.filter(r => r.namespace).map(r => r.namespace));

    return {
      totalResults: results.length,
      averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
      topScore: Math.max(...scores),
      bottomScore: Math.min(...scores),
      fileCount: uniqueFiles.size,
      uniqueFunctions: uniqueFunctions.size,
      uniqueClasses: uniqueClasses.size,
      uniqueNamespaces: uniqueNamespaces.size
    };
  }

  /**
   * Organize results based on options
   */
  private organizeResults(results: RankedSearchResult[], options: ExportOptions): RankedSearchResult[] {
    let organized = [...results];

    // Sort results
    switch (options.sortBy) {
      case 'rank':
        organized.sort((a, b) => a.rankPosition - b.rankPosition);
        break;
      case 'file':
        organized.sort((a, b) => a.filePath.localeCompare(b.filePath));
        break;
      case 'similarity':
        organized.sort((a, b) => b.similarity - a.similarity);
        break;
    }

    // Group by (for formats that support it)
    if (options.groupBy === 'file') {
      organized.sort((a, b) => {
        const fileCompare = a.filePath.localeCompare(b.filePath);
        if (fileCompare !== 0) return fileCompare;
        return a.startLine - b.startLine;
      });
    }

    return organized;
  }

  /**
   * Generate filename for export
   */
  private generateFilename(query: string, extension: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const sanitizedQuery = query.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').toLowerCase();
    const truncatedQuery = sanitizedQuery.substring(0, 30);
    
    return `cppseek_${truncatedQuery}_${timestamp}.${extension}`;
  }

  /**
   * Format timestamp according to options
   */
  private formatTimestamp(date: Date, format?: 'iso' | 'local' | 'unix'): string {
    switch (format) {
      case 'unix':
        return Math.floor(date.getTime() / 1000).toString();
      case 'local':
        return date.toLocaleString();
      case 'iso':
      default:
        return date.toISOString();
    }
  }

  /**
   * Detect programming language from file path
   */
  private detectLanguageFromPath(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();
    
    switch (extension) {
      case '.cpp':
      case '.cc':
      case '.cxx':
      case '.c++':
        return 'cpp';
      case '.h':
      case '.hpp':
      case '.hxx':
      case '.h++':
        return 'cpp';
      case '.c':
        return 'c';
      case '.js':
        return 'javascript';
      case '.ts':
        return 'typescript';
      case '.py':
        return 'python';
      default:
        return 'text';
    }
  }

  /**
   * Generate Markdown statistics section
   */
  private generateMarkdownStatistics(statistics: ExportStatistics): string {
    let md = '## Statistics\n\n';
    md += `- **Total Results:** ${statistics.totalResults}\n`;
    md += `- **Average Score:** ${statistics.averageScore.toFixed(3)}\n`;
    md += `- **Score Range:** ${statistics.topScore.toFixed(3)} - ${statistics.bottomScore.toFixed(3)}\n`;
    md += `- **Unique Files:** ${statistics.fileCount}\n`;
    md += `- **Unique Functions:** ${statistics.uniqueFunctions}\n`;
    md += `- **Unique Classes:** ${statistics.uniqueClasses}\n`;
    md += `- **Unique Namespaces:** ${statistics.uniqueNamespaces}\n\n`;
    return md;
  }

  /**
   * Escape text for Markdown
   */
  private escapeMarkdown(text: string): string {
    return text.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&');
  }

  /**
   * Escape text for CSV
   */
  private escapeCSV(text: string): string {
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  /**
   * Escape text for HTML
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
   * Get supported export formats
   */
  getSupportedFormats(): Array<{
    format: ExportFormat;
    name: string;
    description: string;
    extension: string;
  }> {
    return [
      {
        format: 'markdown',
        name: 'Markdown',
        description: 'Rich text format with syntax highlighting',
        extension: 'md'
      },
      {
        format: 'json',
        name: 'JSON',
        description: 'Structured data format for programmatic access',
        extension: 'json'
      },
      {
        format: 'csv',
        name: 'CSV',
        description: 'Comma-separated values for spreadsheet import',
        extension: 'csv'
      },
      {
        format: 'html',
        name: 'HTML',
        description: 'Web page format with styling',
        extension: 'html'
      },
      {
        format: 'text',
        name: 'Plain Text',
        description: 'Simple text format for basic viewing',
        extension: 'txt'
      }
    ];
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.outputChannel.dispose();
  }
} 