import * as vscode from 'vscode';
import { NIMConfigManager } from '../config/nimConfig';
import { NIMEmbeddingService } from '../services/nimEmbeddingService';

/**
 * Configuration testing utilities
 */
export class ConfigurationTest {
  private readonly nimConfigManager = NIMConfigManager.getInstance();

  /**
   * Test the current configuration
   */
  async testConfiguration(): Promise<boolean> {
    return await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: '測試 CppSeek 配置中...',
      cancellable: false
    }, async (progress) => {
      try {
        progress.report({ increment: 20, message: '檢查配置...' });
        
        // Step 1: Validate configuration
        const validation = this.nimConfigManager.validateConfig();
        if (!validation.valid) {
          throw new Error(`配置驗證失敗: ${validation.errors.join(', ')}`);
        }
        
        progress.report({ increment: 40, message: '載入配置...' });
        
        // Step 2: Load configuration
        const config = this.nimConfigManager.loadConfig();
        
        progress.report({ increment: 60, message: '測試 API 連線...' });
        
        // Step 3: Test API connection
        const nimService = new NIMEmbeddingService(config);
        
        // Test with a simple embedding request
        const testText = "Hello, world!";
        const embedding = await nimService.generateEmbedding(testText);
        
        if (!embedding || !embedding.embedding || embedding.embedding.length === 0) {
          throw new Error('API 回應無效');
        }
        
        progress.report({ increment: 100, message: '測試完成' });
        
        // Show success message with configuration details
        const configSummary = this.nimConfigManager.getConfigSummary();
        const message = `✅ 配置測試成功！\n\n` +
          `模型: ${configSummary.model}\n` +
          `端點: ${configSummary.baseUrl}\n` +
          `超時: ${configSummary.timeout}\n` +
          `重試次數: ${configSummary.retryAttempts}`;
          
        vscode.window.showInformationMessage(
          message,
          { modal: true },
          '查看詳細資訊',
          '開始索引'
        ).then(choice => {
          if (choice === '查看詳細資訊') {
            this.showDetailedConfiguration();
          } else if (choice === '開始索引') {
            vscode.commands.executeCommand('cppseek.indexWorkspace');
          }
        });
        
        return true;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        vscode.window.showErrorMessage(
          `❌ 配置測試失敗: ${errorMessage}`,
          '查看幫助',
          '重新配置'
        ).then(choice => {
          if (choice === '查看幫助') {
            this.showConfigurationHelp();
          } else if (choice === '重新配置') {
            vscode.commands.executeCommand('cppseek.configurationWizard');
          }
        });
        
        return false;
      }
    });
  }

  /**
   * Show detailed configuration information
   */
  private async showDetailedConfiguration(): Promise<void> {
    const config = this.nimConfigManager.getCurrentConfig();
    const configSummary = this.nimConfigManager.getConfigSummary();
    
    if (!config) {
      vscode.window.showWarningMessage('無法載入配置資訊');
      return;
    }

    const detailsText = `
# CppSeek 配置詳細資訊

## API 設定
- **模型**: ${config.model}
- **端點**: ${config.baseUrl}
- **API 金鑰**: ${config.apiKey ? '已設定 (' + config.apiKey.substring(0, 8) + '...)' : '未設定'}

## 效能設定
- **請求超時**: ${config.timeout}ms
- **重試次數**: ${config.retryAttempts}
- **最大並發請求**: ${config.maxConcurrentRequests}
- **批次大小**: ${config.batchSize}

## 狀態
- **配置狀態**: ✅ 有效
- **API 連線**: ✅ 正常
- **服務狀態**: ✅ 可用

## 配置來源優先級
1. VS Code 設定 (最高)
2. 環境變數
3. .env 檔案 (最低)

## 相關命令
- \`CppSeek: Configuration Wizard\` - 重新配置
- \`CppSeek: Index Workspace\` - 開始索引
- \`CppSeek: Semantic Search\` - 開始搜尋
    `;

    const document = await vscode.workspace.openTextDocument({
      content: detailsText,
      language: 'markdown'
    });
    
    await vscode.window.showTextDocument(document);
  }

  /**
   * Show configuration help
   */
  private async showConfigurationHelp(): Promise<void> {
    const helpText = `
# CppSeek 配置疑難排解

## 常見問題

### 1. API 金鑰錯誤
**症狀**: "NIM_API_KEY environment variable is required"
**解決方案**:
- 確認 API 金鑰已正確設定
- 檢查 API 金鑰格式（應以 'nvapi-' 開頭）
- 重新啟動 VS Code

### 2. 網路連線問題
**症狀**: "Request timeout" 或 "Connection failed"
**解決方案**:
- 檢查網路連線
- 確認防火牆設定
- 嘗試增加超時時間

### 3. API 配額問題
**症狀**: "Quota exceeded" 或 "Rate limit"
**解決方案**:
- 檢查 NVIDIA NGC 帳號配額
- 等待配額重置
- 減少並發請求數

## 設定方式

### VS Code 設定 (推薦)
\`\`\`json
{
  "cppseek.nim.apiKey": "your-api-key-here",
  "cppseek.nim.timeout": 30000
}
\`\`\`

### 環境變數
\`\`\`bash
export NIM_API_KEY="your-api-key-here"
\`\`\`

### .env 檔案
\`\`\`
NIM_API_KEY=your-api-key-here
NIM_TIMEOUT=30000
\`\`\`

## 取得幫助

- [環境變數配置指南](docs/environment-setup.md)
- [NVIDIA NIM API 文件](https://docs.nvidia.com/nim/)
- [GitHub Issues](https://github.com/your-repo/issues)

## 測試步驟

1. 執行 \`CppSeek: Configuration Wizard\`
2. 按照指示輸入 API 金鑰
3. 執行 \`CppSeek: Test Configuration\`
4. 如果成功，執行 \`CppSeek: Index Workspace\`
    `;

    const document = await vscode.workspace.openTextDocument({
      content: helpText,
      language: 'markdown'
    });
    
    await vscode.window.showTextDocument(document);
  }

  /**
   * Quick diagnostic check
   */
  async quickDiagnostic(): Promise<{ [key: string]: boolean }> {
    const results: { [key: string]: boolean } = {};
    
    try {
      // Check if config can be loaded
      const config = this.nimConfigManager.loadConfig();
      results['配置載入'] = true;
      
      // Check API key
      results['API 金鑰'] = !!config.apiKey && config.apiKey.length > 10;
      
      // Check base URL
      results['API 端點'] = !!config.baseUrl && config.baseUrl.startsWith('http');
      
      // Check timeout
      results['超時設定'] = config.timeout > 0;
      
      // Check retry attempts
      results['重試設定'] = config.retryAttempts >= 0;
      
    } catch (error) {
      results['配置載入'] = false;
      results['API 金鑰'] = false;
      results['API 端點'] = false;
      results['超時設定'] = false;
      results['重試設定'] = false;
    }
    
    return results;
  }

  /**
   * Show diagnostic results
   */
  async showDiagnostic(): Promise<void> {
    const diagnostic = await this.quickDiagnostic();
    
    const items = Object.entries(diagnostic).map(([key, value]) => ({
      label: `${value ? '✅' : '❌'} ${key}`,
      description: value ? '正常' : '需要檢查'
    }));
    
    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: 'CppSeek 診斷結果',
      ignoreFocusOut: true
    });
    
    const hasErrors = Object.values(diagnostic).some(v => !v);
    
    if (hasErrors) {
      const action = await vscode.window.showWarningMessage(
        '發現配置問題，需要修復',
        '啟動配置精靈',
        '查看幫助'
      );
      
      if (action === '啟動配置精靈') {
        vscode.commands.executeCommand('cppseek.configurationWizard');
      } else if (action === '查看幫助') {
        this.showConfigurationHelp();
      }
    } else {
      vscode.window.showInformationMessage('✅ 所有配置檢查都正常！');
    }
  }
}
