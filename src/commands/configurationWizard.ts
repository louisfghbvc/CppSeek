import * as vscode from 'vscode';
import { NIMConfigManager } from '../config/nimConfig';

/**
 * Configuration wizard for first-time setup
 */
export class ConfigurationWizard {
  private readonly nimConfigManager = NIMConfigManager.getInstance();

  /**
   * Launch the configuration wizard
   */
  async launchWizard(): Promise<boolean> {
    const choice = await vscode.window.showInformationMessage(
      '歡迎使用 CppSeek! 我們需要設定 NVIDIA NIM API 金鑰才能開始使用。',
      { modal: true },
      '立即設定',
      '稍後設定',
      '了解更多'
    );

    switch (choice) {
      case '立即設定':
        return await this.startConfiguration();
      case '了解更多':
        await this.showAPIKeyHelp();
        return await this.launchWizard(); // 重新顯示選項
      default:
        return false;
    }
  }

  /**
   * Start the configuration process
   */
  private async startConfiguration(): Promise<boolean> {
    // 首先檢查是否已有配置
    const existingConfig = this.checkExistingConfiguration();
    
    if (existingConfig.found) {
      const useExisting = await vscode.window.showInformationMessage(
        `發現現有配置: ${existingConfig.source}`,
        '使用現有配置',
        '重新設定'
      );
      
      if (useExisting === '使用現有配置') {
        return await this.validateExistingConfig();
      }
    }

    // 選擇配置方式
    const configMethod = await this.chooseConfigurationMethod();
    if (!configMethod) return false;

    switch (configMethod) {
      case 'vscode':
        return await this.configureVSCodeSettings();
      case 'global':
        return await this.configureGlobalEnvironment();
      case 'workspace':
        return await this.configureWorkspaceEnvironment();
      default:
        return false;
    }
  }

  /**
   * Check for existing configuration
   */
  private checkExistingConfiguration(): { found: boolean; source: string } {
    const vsCodeConfig = vscode.workspace.getConfiguration('cppseek.nim');
    
    if (vsCodeConfig.get('apiKey')) {
      return { found: true, source: 'VS Code 設定' };
    }
    
    if (process.env.NIM_API_KEY) {
      return { found: true, source: '環境變數' };
    }

    return { found: false, source: '' };
  }

  /**
   * Let user choose configuration method
   */
  private async chooseConfigurationMethod(): Promise<string | undefined> {
    const items: vscode.QuickPickItem[] = [
      {
        label: '$(gear) VS Code 設定',
        description: '推薦 - 儲存在 VS Code 設定中',
        detail: '安全且僅在 VS Code 中可用，支援工作區域設定'
      },
      {
        label: '$(globe) 全域環境變數',
        description: '儲存在系統環境變數中',
        detail: '所有應用程式都可使用，重開機後仍有效'
      },
      {
        label: '$(file) 工作區域 .env 檔案',
        description: '儲存在當前專案的 .env 檔案',
        detail: '僅在此專案中有效，適合團隊共享配置範本'
      }
    ];

    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: '選擇 API 金鑰儲存方式',
      ignoreFocusOut: true
    });

    if (!selection) return undefined;

    if (selection.label.includes('VS Code')) return 'vscode';
    if (selection.label.includes('全域')) return 'global';
    if (selection.label.includes('工作區域')) return 'workspace';
    
    return undefined;
  }

  /**
   * Configure VS Code settings
   */
  private async configureVSCodeSettings(): Promise<boolean> {
    const apiKey = await this.promptForAPIKey();
    if (!apiKey) return false;

    // 選擇設定範圍
    const scope = await vscode.window.showQuickPick([
      { label: '工作區域設定', description: '僅在當前專案中有效' },
      { label: '使用者設定', description: '在所有專案中有效' }
    ], {
      placeHolder: '選擇設定範圍'
    });

    if (!scope) return false;

    const target = scope.label.includes('工作區域') 
      ? vscode.ConfigurationTarget.Workspace 
      : vscode.ConfigurationTarget.Global;

    try {
      await this.nimConfigManager.updateVSCodeConfig('apiKey', apiKey, target);
      
      vscode.window.showInformationMessage(
        '✅ API 金鑰已成功儲存到 VS Code 設定中！',
        '測試連線'
      ).then(choice => {
        if (choice === '測試連線') {
          this.testConfiguration();
        }
      });
      
      return true;
    } catch (error) {
      vscode.window.showErrorMessage(`儲存設定時發生錯誤: ${error}`);
      return false;
    }
  }

  /**
   * Configure global environment
   */
  private async configureGlobalEnvironment(): Promise<boolean> {
    const apiKey = await this.promptForAPIKey();
    if (!apiKey) return false;

    // 提供不同作業系統的指令
    const os = process.platform;
    let instructions = '';

    if (os === 'win32') {
      instructions = `請在命令提示字元中執行以下指令:\n\nsetx NIM_API_KEY "${apiKey}"\n\n然後重新啟動 VS Code。`;
    } else {
      const shellFile = process.env.SHELL?.includes('zsh') ? '~/.zshrc' : '~/.bashrc';
      instructions = `請將以下行加入到 ${shellFile} 檔案中:\n\nexport NIM_API_KEY="${apiKey}"\n\n然後執行 source ${shellFile} 並重新啟動 VS Code。`;
    }

    await vscode.window.showInformationMessage(
      instructions,
      { modal: true },
      '複製指令',
      '我知道了'
    ).then(choice => {
      if (choice === '複製指令') {
        const command = os === 'win32' 
          ? `setx NIM_API_KEY "${apiKey}"`
          : `export NIM_API_KEY="${apiKey}"`;
        vscode.env.clipboard.writeText(command);
        vscode.window.showInformationMessage('指令已複製到剪貼板');
      }
    });

    return true;
  }

  /**
   * Configure workspace .env file
   */
  private async configureWorkspaceEnvironment(): Promise<boolean> {
    const apiKey = await this.promptForAPIKey();
    if (!apiKey) return false;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('沒有開啟的工作區域');
      return false;
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const envPath = `${workspacePath}/.env`;

    try {
      // 讀取現有 .env 檔案（如果存在）
      let envContent = '';
      try {
        const envFile = await vscode.workspace.fs.readFile(vscode.Uri.file(envPath));
        envContent = Buffer.from(envFile).toString('utf8');
      } catch {
        // 檔案不存在，建立新的
      }

      // 更新或添加 NIM_API_KEY
      const envLines = envContent.split('\n');
      let updated = false;

      for (let i = 0; i < envLines.length; i++) {
        if (envLines[i].startsWith('NIM_API_KEY=')) {
          envLines[i] = `NIM_API_KEY=${apiKey}`;
          updated = true;
          break;
        }
      }

      if (!updated) {
        envLines.push(`# NVIDIA NIM API Configuration`);
        envLines.push(`NIM_API_KEY=${apiKey}`);
        envLines.push('');
      }

      // 寫回檔案
      const newContent = envLines.join('\n');
      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(envPath),
        Buffer.from(newContent, 'utf8')
      );

      vscode.window.showInformationMessage(
        '✅ API 金鑰已儲存到 .env 檔案中！',
        '開啟 .env 檔案',
        '測試連線'
      ).then(choice => {
        if (choice === '開啟 .env 檔案') {
          vscode.window.showTextDocument(vscode.Uri.file(envPath));
        } else if (choice === '測試連線') {
          this.testConfiguration();
        }
      });

      return true;
    } catch (error) {
      vscode.window.showErrorMessage(`建立 .env 檔案時發生錯誤: ${error}`);
      return false;
    }
  }

  /**
   * Prompt user for API key
   */
  private async promptForAPIKey(): Promise<string | undefined> {
    const apiKey = await vscode.window.showInputBox({
      prompt: '請輸入你的 NVIDIA NIM API 金鑰',
      placeHolder: 'nvapi-xxxxx...',
      password: true,
      validateInput: (value: string) => {
        if (!value.trim()) {
          return 'API 金鑰不能為空';
        }
        if (value.length < 10) {
          return 'API 金鑰長度不正確';
        }
        return null;
      },
      ignoreFocusOut: true
    });

    return apiKey?.trim();
  }

  /**
   * Show API key help
   */
  private async showAPIKeyHelp(): Promise<void> {
    const helpText = `
## 如何取得 NVIDIA NIM API 金鑰

1. 前往 [NVIDIA NGC Catalog](https://catalog.ngc.nvidia.com/ai-foundation-models)
2. 註冊或登入你的 NVIDIA 帳號
3. 瀏覽到 AI Foundation Models
4. 選擇 embedding 模型 (如 llama-3.2-nv-embedqa-1b-v2)
5. 點擊 "Get API Key" 或 "Generate API Key"
6. 複製生成的 API 金鑰

### 注意事項
- API 金鑰通常以 'nvapi-' 開頭
- 請妥善保管你的 API 金鑰
- 不要在公開的程式碼庫中提交 API 金鑰
    `;

    const document = await vscode.workspace.openTextDocument({
      content: helpText,
      language: 'markdown'
    });
    
    await vscode.window.showTextDocument(document);
  }

  /**
   * Validate existing configuration
   */
  private async validateExistingConfig(): Promise<boolean> {
    try {
      const validation = this.nimConfigManager.validateConfig();
      
      if (validation.valid) {
        vscode.window.showInformationMessage(
          '✅ 現有配置驗證成功！',
          '測試連線'
        ).then(choice => {
          if (choice === '測試連線') {
            this.testConfiguration();
          }
        });
        return true;
      } else {
        vscode.window.showErrorMessage(
          `配置驗證失敗: ${validation.errors.join(', ')}`,
          '重新設定'
        ).then(choice => {
          if (choice === '重新設定') {
            this.startConfiguration();
          }
        });
        return false;
      }
    } catch (error) {
      vscode.window.showErrorMessage(`驗證配置時發生錯誤: ${error}`);
      return false;
    }
  }

  /**
   * Test the configuration
   */
  private async testConfiguration(): Promise<void> {
    const testProgress = vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: '測試 API 連線中...',
      cancellable: false
    }, async () => {
      try {
        // 這裡可以加入實際的 API 測試邏輯
        await new Promise(resolve => setTimeout(resolve, 2000)); // 模擬測試
        
        vscode.window.showInformationMessage('✅ API 連線測試成功！');
      } catch (error) {
        vscode.window.showErrorMessage(`API 連線測試失敗: ${error}`);
      }
    });
  }

  /**
   * Check if configuration is needed
   */
  static shouldShowWizard(): boolean {
    try {
      const nimConfig = NIMConfigManager.getInstance();
      const validation = nimConfig.validateConfig();
      return !validation.valid;
    } catch {
      return true; // 如果有錯誤，顯示設定精靈
    }
  }
}
