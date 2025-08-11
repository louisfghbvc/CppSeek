import * as vscode from 'vscode';
import { SearchHistoryManager } from '../services/history/searchHistoryManager';
import { SearchHistoryEntry, Bookmark } from '../services/history/types';

export class HistoryPanel {
  private webviewPanel: vscode.WebviewPanel | undefined;
  private context: vscode.ExtensionContext;
  private history: SearchHistoryManager;
  private output: vscode.OutputChannel;

  constructor(context: vscode.ExtensionContext, historyManager: SearchHistoryManager) {
    this.context = context;
    this.history = historyManager;
    this.output = vscode.window.createOutputChannel('CppSeek History');
  }

  async show(): Promise<void> {
    if (!this.webviewPanel) {
      this.webviewPanel = vscode.window.createWebviewPanel(
        'cppseekHistory',
        'CppSeek Search History',
        vscode.ViewColumn.Two,
        { enableScripts: true, retainContextWhenHidden: true }
      );
      this.webviewPanel.onDidDispose(() => (this.webviewPanel = undefined));
    } else {
      this.webviewPanel.reveal();
    }

    const entries = await this.history.getSearchHistory({ limit: 100, sortBy: 'timestamp' });
    const content = await this.render(entries);
    this.webviewPanel!.webview.html = content;
  }

  private async render(entries: SearchHistoryEntry[]): Promise<string> {
    const list = entries
      .map(
        (e, idx) => `
          <div class="entry">
            <div class="entry-head">
              <span class="idx">#${idx + 1}</span>
              <span class="time">${e.timestamp}</span>
              <span class="query">${this.escape(e.query)}</span>
              <span class="meta">(${e.resultCount} results, ${e.searchDuration}ms)</span>
            </div>
            <div class="results">
              ${(e.topResults || [])
                .map(r => `<div class="r">${this.escape(r.filePath)}:${r.startLine} — ${this.escape(r.preview)}</div>`) 
                .join('')}
            </div>
          </div>`
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
        <style>
          body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); margin: 0; padding: 16px; }
          .entry { border: 1px solid var(--vscode-panel-border); border-radius: 6px; margin-bottom: 12px; }
          .entry-head { padding: 8px 12px; background: var(--vscode-panel-background); display: flex; gap: 8px; align-items: center; }
          .idx { color: var(--vscode-descriptionForeground); }
          .time { color: var(--vscode-descriptionForeground); font-size: 0.9em; }
          .query { font-weight: bold; }
          .meta { color: var(--vscode-descriptionForeground); }
          .results { padding: 8px 12px; }
          .r { font-family: var(--vscode-editor-font-family); font-size: 0.85em; color: var(--vscode-descriptionForeground); padding: 2px 0; }
        </style>
      </head>
      <body>
        <h2>Recent Searches</h2>
        ${list || '<div>No history yet.</div>'}
      </body>
      </html>
    `;
  }

  private escape(s: string): string {
    return (s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}



