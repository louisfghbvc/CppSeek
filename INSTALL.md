# CppSeek Extension 安裝指南

## 📦 安裝 VSIX Extension

**檔案位置:** `cppseek-semantic-search-0.0.1.vsix`

### 方法 1: VS Code UI 安裝
1. 打開 VS Code
2. 按 `Ctrl+Shift+X` (或 `Cmd+Shift+X`) 開啟 Extensions 面板
3. 點擊右上角三點選單 (⋯)
4. 選擇 **"Install from VSIX..."**
5. 選擇 `cppseek-semantic-search-0.0.1.vsix` 檔案
6. 安裝完成後重新載入 VS Code

### 方法 2: 命令列安裝
```bash
code --install-extension cppseek-semantic-search-0.0.1.vsix
```

## 🔑 設定 NVIDIA API 金鑰

### 推薦方式: VS Code 設定
1. 安裝完成後，按 `Ctrl+,` (或 `Cmd+,`) 開啟設定
2. 搜尋 "cppseek nim"
3. 在 **"CppSeek › Modern Vector Storage: Nim Api Key"** 中填入你的 NVIDIA API 金鑰

### 替代方式: 環境變數
```bash
export NIM_API_KEY="your-nvidia-api-key-here"
code .
```

## 🚀 使用方式

安裝完成後，你可以使用：

1. **語意搜尋**: `Ctrl+Shift+P` → 輸入 "CppSeek: Semantic Search"
2. **查看搜尋歷史**: `Ctrl+Alt+H` (或 `Cmd+Alt+H`)
3. **匯出搜尋歷史**: `Ctrl+Shift+P` → "CppSeek: Export Search History"

## 📋 功能特色

- ✅ AI 驅動的語意搜尋
- ✅ 自動搜尋歷史記錄
- ✅ 書籤管理
- ✅ 搜尋結果排名
- ✅ 歷史匯出 (Markdown/JSON)
- ✅ 與 VS Code 1.90+ 相容

## 🔧 系統需求

- VS Code 1.90.0 或更新版本
- NVIDIA NIM API 金鑰
- 活躍的網路連線 (用於 embedding 服務)

## 🐛 疑難排解

如果安裝或使用時遇到問題，請檢查：
1. VS Code 版本是否符合要求
2. NVIDIA API 金鑰是否正確設定
3. 網路連線是否正常

## 📞 支援

如有問題，請查看控制台輸出 (`Ctrl+Shift+Y` → CppSeek) 獲取詳細錯誤資訊。
