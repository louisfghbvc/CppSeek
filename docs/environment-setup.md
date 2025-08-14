# 環境變數配置指南

## 概述

CppSeek extension 需要 NVIDIA NIM API 金鑰才能運作。我們提供了三種配置方式，以滿足不同用戶的需求。

## 配置方式優先級

CppSeek 會按以下優先級尋找配置：

1. **VS Code 設定** (最高優先級) ⭐ 推薦
2. **系統環境變數** 
3. **.env 檔案** (最低優先級)

## 方式 1: VS Code 設定 (推薦) ⭐

### 優點
- ✅ 安全性最高
- ✅ 支援工作區域和全域設定
- ✅ 可視化設定介面
- ✅ 不會意外提交到版本控制

### 設定步驟

#### 透過設定 UI:
1. 按 `Ctrl+,` (或 `Cmd+,`) 開啟設定
2. 搜尋 "cppseek nim"
3. 在 **"Cppseek › Nim: Api Key"** 中填入 API 金鑰

#### 透過設定檔案:

**工作區域設定** (.vscode/settings.json):
```json
{
  "cppseek.nim.apiKey": "your_nvidia_api_key_here"
}
```

**使用者設定** (settings.json):
```json
{
  "cppseek.nim.apiKey": "your_nvidia_api_key_here",
  "cppseek.nim.baseUrl": "https://integrate.api.nvidia.com/v1",
  "cppseek.nim.model": "nvidia/llama-3.2-nv-embedqa-1b-v2"
}
```

## 方式 2: 系統環境變數

### 優點
- ✅ 全域可用
- ✅ 適合 CI/CD 環境
- ✅ 重開機後仍有效

### Windows 設定

**命令提示字元:**
```cmd
setx NIM_API_KEY "your_nvidia_api_key_here"
```

**PowerShell:**
```powershell
[Environment]::SetEnvironmentVariable("NIM_API_KEY", "your_nvidia_api_key_here", "User")
```

### macOS/Linux 設定

**臨時設定:**
```bash
export NIM_API_KEY="your_nvidia_api_key_here"
```

**永久設定** (加入到 shell 配置檔):

**Bash (~/.bashrc):**
```bash
echo 'export NIM_API_KEY="your_nvidia_api_key_here"' >> ~/.bashrc
source ~/.bashrc
```

**Zsh (~/.zshrc):**
```bash
echo 'export NIM_API_KEY="your_nvidia_api_key_here"' >> ~/.zshrc
source ~/.zshrc
```

## 方式 3: .env 檔案

### 優點
- ✅ 專案特定配置
- ✅ 適合團隊開發
- ✅ 易於管理和版本控制 (記得加入 .gitignore)

### 設定步驟

1. 在專案根目錄建立 `.env` 檔案
2. 加入以下內容:

```bash
# CppSeek - NVIDIA NIM API Configuration
NIM_API_KEY=your_nvidia_api_key_here

# 可選配置 (使用預設值)
NIM_BASE_URL=https://integrate.api.nvidia.com/v1
NIM_MODEL=nvidia/llama-3.2-nv-embedqa-1b-v2
NIM_TIMEOUT=30000
NIM_RETRY_ATTEMPTS=3
NIM_MAX_CONCURRENT_REQUESTS=10
NIM_BATCH_SIZE=50
```

### ⚠️ 安全注意事項

**重要:** 將 `.env` 加入 `.gitignore` 以避免意外提交 API 金鑰:

```gitignore
# 環境變數檔案
.env
.env.local
.env.production
```

## 完整配置選項

| 環境變數 | VS Code 設定 | 預設值 | 說明 |
|---------|-------------|--------|------|
| `NIM_API_KEY` | `cppseek.nim.apiKey` | *必需* | NVIDIA NIM API 金鑰 |
| `NIM_BASE_URL` | `cppseek.nim.baseUrl` | `https://integrate.api.nvidia.com/v1` | API 端點 URL |
| `NIM_MODEL` | `cppseek.nim.model` | `nvidia/llama-3.2-nv-embedqa-1b-v2` | Embedding 模型 |
| `NIM_TIMEOUT` | `cppseek.nim.timeout` | `30000` | 請求超時 (毫秒) |
| `NIM_RETRY_ATTEMPTS` | `cppseek.nim.retryAttempts` | `3` | 失敗重試次數 |
| `NIM_MAX_CONCURRENT_REQUESTS` | `cppseek.nim.maxConcurrentRequests` | `10` | 最大並發請求 |
| `NIM_BATCH_SIZE` | `cppseek.nim.batchSize` | `50` | 批次處理大小 |

## 取得 NVIDIA NIM API 金鑰

### 步驟
1. 前往 [NVIDIA NGC Catalog](https://catalog.ngc.nvidia.com/ai-foundation-models)
2. 註冊或登入 NVIDIA 帳號
3. 瀏覽 AI Foundation Models
4. 選擇 embedding 模型 (如 `llama-3.2-nv-embedqa-1b-v2`)
5. 點擊 "Get API Key" 或 "Generate API Key"
6. 複製生成的 API 金鑰

### API 金鑰格式
- 通常以 `nvapi-` 開頭
- 長度約 40-50 個字符
- 例如: `nvapi-1234567890abcdef...`

## 驗證配置

### 使用命令面板
1. 按 `Ctrl+Shift+P` (或 `Cmd+Shift+P`)
2. 輸入 "CppSeek: Test Configuration"
3. 查看測試結果

### 透過 VS Code 輸出面板
1. 按 `Ctrl+Shift+Y` (或 `Cmd+Shift+Y`) 開啟輸出面板
2. 選擇 "CppSeek" 頻道
3. 查看詳細日誌

## 疑難排解

### 常見錯誤

**錯誤: "NIM_API_KEY environment variable is required"**
- 檢查 API 金鑰是否正確設定
- 確認設定的配置方式 (VS Code 設定 vs 環境變數 vs .env)
- 重新啟動 VS Code

**錯誤: "API request failed"**
- 檢查網路連線
- 驗證 API 金鑰是否有效
- 確認 API 額度是否用完

### 除錯步驟
1. 檢查 VS Code 輸出面板的 CppSeek 頻道
2. 驗證配置優先級
3. 測試 API 連線
4. 清除快取並重新索引

## 範例配置檔案

### .env 範本
```bash
# 複製此範本並重新命名為 .env
NIM_API_KEY=your_nvidia_api_key_here
NIM_BASE_URL=https://integrate.api.nvidia.com/v1
NIM_MODEL=nvidia/llama-3.2-nv-embedqa-1b-v2
```

### VS Code 工作區域設定
```json
{
  "cppseek.nim.apiKey": "your_nvidia_api_key_here",
  "cppseek.searchBehavior.maxResults": 50,
  "cppseek.performance.enableCache": true
}
```

## 安全最佳實務

1. **使用 VS Code 設定** 儲存敏感資訊
2. **不要提交** API 金鑰到版本控制
3. **定期輪換** API 金鑰
4. **使用工作區域設定** 進行專案特定配置
5. **在 CI/CD 中使用** 環境變數或秘密管理

## 相關文件

- [NVIDIA NIM API 文件](https://docs.nvidia.com/nim/)
- [VS Code 設定指南](https://code.visualstudio.com/docs/getstarted/settings)
- [CppSeek 使用指南](./README.md)
