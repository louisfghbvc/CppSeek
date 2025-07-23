---
id: 11.1
title: 'Environment Setup & Toolchain Configuration'
status: pending
priority: critical
feature: 'FAISS Vector Storage - Native Environment'
dependencies:
  - 11
assigned_agent: null
created_at: "2025-07-23T10:30:43Z"
started_at: null
completed_at: null
error_log: null
---

## Description

Configure CentOS7 compatible toolchain to support native binding compilation for FAISS and SQLite3, enabling enhanced performance while maintaining JavaScript fallbacks.

## Details

### Environment Analysis Completed ✅
- **System**: GLIBC 2.17 (2012) + CXXABI_1.3.5
- **Available**: CentOS7 GCC 10.3.0 + SQLite 3.42.0 in `/home/utils/`
- **Compatibility**: GCC 10.3.0 provides CXXABI_1.3.8+ (required for bindings)

### Setup Requirements
- [ ] **Environment Script**: Create and validate `setup_native_env.sh`
  - Configure GCC 10.3.0 toolchain paths
  - Set up library paths (LD_LIBRARY_PATH, LIBRARY_PATH)
  - Configure include paths (C_INCLUDE_PATH, CPLUS_INCLUDE_PATH)
  - Set build environment variables (CC, CXX, CXXFLAGS, LDFLAGS)

- [ ] **Toolchain Validation**: 
  - Verify GCC 10.3.0 accessibility: `/home/utils/gcc-10.3.0/bin/gcc --version`
  - Confirm CXXABI_1.3.8+ availability in libstdc++
  - Test SQLite library paths: `/home/utils/sqlite-3.42.0/lib/`
  - Validate build tools: ar, ranlib, nm, strip

- [ ] **Environment Testing**:
  - Test basic compilation with new toolchain
  - Verify library linking works correctly
  - Confirm environment persistence across shell sessions

### Key Paths Configuration
```bash
export GCC_ROOT="/home/utils/gcc-10.3.0"
export SQLITE_ROOT="/home/utils/sqlite-3.42.0"
export LD_LIBRARY_PATH="$GCC_ROOT/lib64:$SQLITE_ROOT/lib:$LD_LIBRARY_PATH"
```

### Success Criteria
- Environment script creates all necessary paths and variables
- GCC 10.3.0 compilation works with CXXABI_1.3.8+
- SQLite headers and libraries accessible
- Build environment ready for native binding compilation

## Test Strategy

1. **Script Validation**:
   ```bash
   source setup_native_env.sh
   gcc --version  # Should show GCC 10.3.0
   which gcc      # Should point to /home/utils/gcc-10.3.0/bin/gcc
   ```

2. **Library Verification**:
   ```bash
   strings $GCC_ROOT/lib64/libstdc++.so.6 | grep CXXABI | grep 1.3.8
   ls $SQLITE_ROOT/lib/libsqlite3.so
   ```

3. **Build Test**:
   ```bash
   echo 'int main(){return 0;}' | gcc -x c - -o test_compile
   ./test_compile && echo "✅ Compilation works"
   ``` 