---
id: 5
title: 'Implement workspace file discovery for .cpp/.h files'
status: pending
priority: critical
feature: Code Processing Pipeline
dependencies:
  - 4
assigned_agent: null
created_at: "2025-07-17T05:15:22Z"
started_at: null
completed_at: null
error_log: null
---

## Description

Implement recursive file system scanning to discover all C/C++ source files (.cpp, .cc, .cxx) and header files (.h, .hpp, .hxx) within the VSCode workspace, with configurable file patterns and exclusion rules.

## Details

### Core Functionality Requirements
- **File Pattern Matching**: Support multiple C/C++ file extensions (.cpp, .cc, .cxx, .c, .h, .hpp, .hxx)
- **Recursive Directory Scanning**: Traverse all subdirectories within the workspace
- **Exclusion Rules**: Respect common exclusion patterns (node_modules, .git, build directories)
- **Configuration Integration**: Use VSCode settings for custom file patterns and exclusions
- **Performance Optimization**: Efficient scanning for large codebases (100k+ LOC)
- **Error Handling**: Graceful handling of permission errors and inaccessible directories

### Implementation Steps
1. **Create FileDiscoveryService class** in `src/services/indexing/FileDiscoveryService.ts`
2. **Implement recursive directory traversal** using Node.js fs.promises API
3. **Add file pattern matching logic** with configurable extensions and exclusions
4. **Integrate with VSCode workspace API** to get workspace folders and settings
5. **Add progress reporting** for large directory scans with status bar updates
6. **Implement caching mechanism** to avoid re-scanning unchanged directories
7. **Add comprehensive error handling** with user-friendly error messages

### Configuration Settings
- `cppseek.filePatterns.include`: Array of file patterns to include (default: ["**/*.{cpp,cc,cxx,c,h,hpp,hxx}"])
- `cppseek.filePatterns.exclude`: Array of patterns to exclude (default: ["**/node_modules/**", "**/.git/**", "**/build/**", "**/dist/**"])
- `cppseek.scanning.maxFiles`: Maximum number of files to scan (default: 10000)
- `cppseek.scanning.timeout`: Timeout for scanning operations in seconds (default: 60)

### Integration Points
- **VSCode Workspace API**: Use `vscode.workspace.workspaceFolders` and `vscode.workspace.findFiles`
- **Configuration Service**: Read user preferences for file patterns and exclusions
- **Status Bar Service**: Report scanning progress to users
- **Logging Service**: Log scanning results and performance metrics

### Expected Output
- **FileInfo Interface**: Standardized file metadata (path, size, lastModified, hash)
- **Scanning Results**: Array of discovered files with metadata
- **Performance Metrics**: Scanning time, file count, directory count
- **Error Reports**: Detailed error information for failed scans

## Test Strategy

### Unit Tests
1. **Pattern Matching Tests**: Verify correct file extension matching and exclusion rules
2. **Directory Traversal Tests**: Test recursive scanning with mock file system
3. **Configuration Tests**: Verify proper reading and application of user settings
4. **Error Handling Tests**: Test behavior with permission errors and invalid paths

### Integration Tests  
1. **Workspace Integration**: Test scanning real VSCode workspace folders
2. **Large Codebase Test**: Performance testing with simulated large directory structure
3. **Configuration Integration**: Test with various VSCode setting combinations
4. **Progress Reporting**: Verify status bar updates during long-running scans

### Manual Testing
1. **Open CppSeek workspace** and trigger file discovery via command palette
2. **Verify file count** matches expected C/C++ files in workspace
3. **Test exclusion rules** by adding build directories and verifying they're excluded
4. **Monitor performance** with large codebases and verify reasonable scan times

### Success Criteria
- Successfully discovers all C/C++ files in workspace within 30 seconds for medium codebases (~1000 files)
- Respects all configured inclusion and exclusion patterns
- Provides real-time progress feedback for scans longer than 2 seconds
- Handles file system errors gracefully without crashing
- Returns standardized FileInfo objects for all discovered files 