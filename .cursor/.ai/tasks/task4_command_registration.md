---
id: 4
title: 'Implement basic command registration in command palette'
status: pending
priority: high
feature: Foundation Setup
dependencies:
  - 3
assigned_agent: null
created_at: "2025-07-15T06:43:21Z"
started_at: null
completed_at: null
error_log: null
---

## Description

Register the core CppSeek commands in VSCode command palette and verify the extension activation and command execution works correctly. This establishes the basic user interface entry points for the semantic search functionality.

## Details

- Configure extension activation in `package.json`:
  - Set `activationEvents` to `["onLanguage:cpp", "onLanguage:c", "onCommand:cppseek.semanticSearch"]`
  - Add `main` entry point to compiled extension
  - Set minimum VSCode engine version
- Define commands in `package.json` contributes section:
  - `cppseek.semanticSearch`: Main semantic search command
  - `cppseek.indexWorkspace`: Index current workspace command
  - `cppseek.clearIndex`: Clear search index command
  - `cppseek.showSettings`: Show extension settings command
- Implement command handlers in `src/extension.ts`:
  - Create `activate()` function that registers all commands
  - Implement command callback functions with proper error handling
  - Add basic status bar integration for indexing progress
  - Set up output channel for extension logging
- Create command implementations:
  - `semanticSearch`: Show input box for search query and placeholder results
  - `indexWorkspace`: Scan workspace for C/C++ files and show count
  - `clearIndex`: Clear any existing index data with confirmation
  - `showSettings`: Open extension settings in VSCode preferences
- Add keyboard shortcuts in `package.json`:
  - `Ctrl+Shift+S` (Cmd+Shift+S on Mac) for semantic search
  - Configure when clauses for C/C++ file contexts
- Implement basic extension state management:
  - Track activation state
  - Store workspace-specific settings
  - Handle extension deactivation cleanup
- Add extension configuration schema:
  - Basic settings for search behavior
  - File inclusion/exclusion patterns
  - Performance tuning options

## Test Strategy

- Load extension in Development Host and verify no activation errors
- Test each command appears in Command Palette (`Ctrl+Shift+P`)
- Verify keyboard shortcuts work when editing C/C++ files
- Execute each command and verify basic functionality:
  - Search command shows input box
  - Index command scans workspace files
  - Clear command shows confirmation dialog
  - Settings command opens correct preferences page
- Test extension activation on opening C/C++ files
- Verify status bar integration shows proper states
- Check output channel shows extension logging
- Confirm extension deactivates cleanly when VSCode closes 