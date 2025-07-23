# Using Compatible CentOS7 Tools for Native Bindings

## 🔍 **Problem Summary**

The native bindings (`faiss-node`, `sqlite3`) fail on this system because:
- **System**: GLIBC 2.17 (2012) + CXXABI_1.3.5 
- **Required**: CXXABI_1.3.8+ (much newer)
- **Root Cause**: Application Binary Interface (ABI) incompatibility

## ✅ **Solution: Use CentOS7 Compatible Tools**

The system provides compatible tools in `/home/utils/` that have the required ABI versions:

```bash
# Available Compatible Tools:
/home/utils/gcc-10.3.0/        # GCC 10.3.0 with CXXABI_1.3.8+
/home/utils/sqlite-3.42.0/     # SQLite 3.42.0 (newer version)
```

## 🛠️ **How to Use (Step by Step)**

### 1. **Set Up Environment**

Use the provided setup script:

```bash
# Source the environment setup
source setup_native_env.sh
```

This configures:
- **GCC 10.3.0**: Compiler with compatible C++ runtime
- **SQLite 3.42.0**: Compatible SQLite library  
- **Build Tools**: Proper paths for linking and compilation
- **Environment Variables**: All necessary paths and flags

### 2. **Rebuild Native Bindings**

With the environment active, rebuild the problematic packages:

```bash
# Rebuild SQLite3 (CONFIRMED WORKING ✅)
npm rebuild sqlite3

# Rebuild FAISS if installed
npm rebuild faiss-node

# Or install fresh
npm install faiss-node --no-save
```

### 3. **Verify Success**

Test that the native bindings work:

```bash
# Test SQLite3
node -e "const sqlite3 = require('sqlite3'); console.log('✅ SQLite3 version:', sqlite3.VERSION);"

# Test FAISS  
node -e "const faiss = require('faiss-node'); console.log('✅ FAISS available:', typeof faiss);"
```

## 📋 **What the Setup Script Does**

```bash
# Core paths
export GCC_ROOT="/home/utils/gcc-10.3.0"
export SQLITE_ROOT="/home/utils/sqlite-3.42.0"

# Compiler setup
export CC="$GCC_ROOT/bin/gcc"           # GCC 10.3.0
export CXX="$GCC_ROOT/bin/g++"          # G++ 10.3.0

# Library paths
export LD_LIBRARY_PATH="$GCC_ROOT/lib64:$SQLITE_ROOT/lib:$LD_LIBRARY_PATH"
export LIBRARY_PATH="$GCC_ROOT/lib64:$SQLITE_ROOT/lib:$LIBRARY_PATH"

# Include paths
export CPLUS_INCLUDE_PATH="$GCC_ROOT/include/c++/10.3.0:$SQLITE_ROOT/include:$CPLUS_INCLUDE_PATH"

# Build flags
export CXXFLAGS="-I$SQLITE_ROOT/include"
export LDFLAGS="-L$SQLITE_ROOT/lib -L$GCC_ROOT/lib64"
```

## 🎯 **Results**

### ✅ **SQLite3: WORKING**
```
✅ SQLite3 native binding works!
   Version: 3.44.2
   Status: Fully functional
```

### 🔄 **FAISS: Test in Progress**
- Environment configured for FAISS build
- Compatible CXXABI_1.3.8+ available
- Ready for testing

## 🔄 **Alternative: Use JavaScript Fallbacks**

If native bindings still have issues, we have working pure JavaScript implementations:

- **Vector Storage**: `JSVectorStorage` (cosine similarity)
- **Metadata Store**: `MemoryMetadataStore` (JSON persistence)
- **Benefits**: No native dependencies, cross-platform compatibility

## 📚 **Background: Why This Works**

### **ABI Compatibility Issue**
```bash
# System ABI (insufficient)
$ strings /lib64/libstdc++.so.6 | grep CXXABI
CXXABI_1.3.5   # ❌ Too old

# CentOS7 GCC ABI (compatible)  
$ strings /home/utils/gcc-10.3.0/lib64/libstdc++.so.6 | grep CXXABI
CXXABI_1.3.8   # ✅ Required version available
CXXABI_1.3.9   # ✅ Even newer versions available
```

### **Why Node.js Works vs Native Addons Fail**
- **Node.js binary**: Pre-compiled for this system ✅
- **Native addons**: Require compatible runtime libraries ❌
- **Solution**: Use compatible runtime from CentOS7 tools ✅

## 🚀 **Recommendations**

### **For Development**
1. **Use compatible tools** when native performance is critical
2. **Use JavaScript fallbacks** for maximum compatibility
3. **Hybrid approach**: Try native first, fallback to JS

### **For Production**
1. **Test both approaches** thoroughly
2. **Document environment requirements**
3. **Consider containerization** for consistent environments

## 📞 **Usage Examples**

### **Switching Between Native and JS**

```typescript
// Conditional import based on availability
let VectorStorage, MetadataStore;

try {
  // Try native implementations first
  const faiss = require('faiss-node');
  const sqlite3 = require('sqlite3');
  VectorStorage = require('./nativeFaissStorage');
  MetadataStore = require('./sqliteMetadataStore');
  console.log('Using native implementations');
} catch (error) {
  // Fallback to JavaScript implementations
  VectorStorage = require('./jsVectorStorage');
  MetadataStore = require('./memoryMetadataStore');
  console.log('Using JavaScript fallbacks');
}
```

This approach provides the best of both worlds: performance when possible, compatibility always. 