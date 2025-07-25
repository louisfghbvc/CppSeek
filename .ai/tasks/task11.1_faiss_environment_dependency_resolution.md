---
id: 11.1
title: 'FAISS Environment & Dependency Resolution'
status: pending
priority: critical
feature: 'FAISS Vector Storage - Environment Setup'
dependencies:
  - 11
assigned_agent: null
created_at: "2025-07-25T08:23:54Z"
started_at: null
completed_at: null
error_log: null
---

## Description

解決FAISS native binding的環境依賴問題，特別是GLIBC 2.27需求和faiss-node包的兼容性。建立可工作的FAISS環境。

## Details

### Environment Challenge Analysis
**Current System Limitations**:
- GLIBC 2.17 (2012) available vs GLIBC 2.27 (2018) required by faiss-node
- CXXABI_1.3.5 available vs CXXABI_1.3.8+ potentially needed
- Native binding compilation complexity

**Available Resources**:
- ✅ GCC 10.3.0 toolchain in `/home/utils/gcc-10.3.0/`
- ✅ SQLite 3.42.0 in `/home/utils/sqlite-3.42.0/`
- ✅ CXXABI_1.3.8+ confirmed available in GCC 10.3.0 libstdc++
- ✅ `setup_native_env.sh` script prepared

### Resolution Strategies

#### **Strategy 1: Direct faiss-node Installation** (Primary)
```bash
source setup_native_env.sh
npm install faiss-node
# Test compatibility with available GLIBC/CXXABI
```

#### **Strategy 2: Custom FAISS Build** (Fallback)
```bash
# If faiss-node fails, build custom FAISS with compatible toolchain
git clone https://github.com/facebookresearch/faiss.git
# Use GCC 10.3.0 to build compatible version
```

#### **Strategy 3: Precompiled Binary** (Alternative)
```bash
# Use precompiled FAISS binary compatible with CentOS 7
# Or build FAISS in compatible container environment
```

### Implementation Steps
- [ ] **Test Current Environment**: Verify faiss-node compatibility
  ```bash
  source setup_native_env.sh
  npm install faiss-node --save
  node -e "const faiss = require('faiss-node'); console.log('FAISS loaded:', !!faiss);"
  ```

- [ ] **Dependency Resolution**: Handle GLIBC/CXXABI issues if they arise
  - Document specific error messages
  - Apply appropriate resolution strategy
  - Verify successful FAISS module loading

- [ ] **Environment Validation**: Confirm stable FAISS operations
  ```javascript
  const faiss = require('faiss-node');
  const index = new faiss.IndexFlatIP(128);
  console.log('FAISS index created successfully');
  ```

- [ ] **Documentation**: Create environment setup guide
  - Document working environment configuration
  - List resolved dependency issues
  - Provide setup instructions for future deployments

### Expected Challenges
1. **GLIBC Version Mismatch**: faiss-node may require newer GLIBC
   - *Mitigation*: Use custom build with compatible toolchain
2. **Node.js Native Module Compilation**: Complex build process
   - *Mitigation*: Leverage GCC 10.3.0 environment setup
3. **Runtime Loading Issues**: Dynamic library dependencies
   - *Mitigation*: Proper LD_LIBRARY_PATH configuration

## Test Strategy

### Environment Verification Tests
1. **Basic FAISS Import Test**:
   ```javascript
   try {
     const faiss = require('faiss-node');
     console.log('✅ FAISS module loaded successfully');
     console.log('FAISS version info available:', !!faiss.version);
   } catch (error) {
     console.error('❌ FAISS import failed:', error.message);
   }
   ```

2. **Index Creation Test**:
   ```javascript
   const faiss = require('faiss-node');
   const dimension = 768;
   const index = new faiss.IndexFlatIP(dimension);
   console.log('✅ FAISS index created, dimension:', index.d);
   ```

3. **Basic Operations Test**:
   ```javascript
   // Test vector addition and search
   const testVectors = new Float32Array([0.1, 0.2, 0.3, ...]);
   index.add(testVectors);
   const searchResult = index.search(testVectors, 1);
   console.log('✅ FAISS operations working');
   ```

### Success Criteria
- [ ] faiss-node package successfully installed
- [ ] FAISS module imports without errors
- [ ] Basic index operations (create, add, search) working
- [ ] Stable environment configuration documented
- [ ] Clear setup instructions provided for deployment

## Notes

**Risk Assessment**: HIGH - Environment dependency issues can block entire FAISS implementation
**Mitigation**: Multiple fallback strategies prepared
**Dependencies**: Uses established GCC 10.3.0 environment setup
**Blockers**: This task blocks all subsequent FAISS implementation work 