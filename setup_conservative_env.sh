#!/bin/bash

# CppSeek Conservative Environment Setup
# Uses CMake 3.31.3 + GCC 10.3.0, avoids GLIBC conflicts

echo "🛠️ Setting up conservative environment for FAISS compilation..."

# Define paths (NO GLIBC override)
export CMAKE_ROOT="/home/utils/cmake-3.31.3"
export GCC_ROOT="/home/utils/gcc-10.3.0"
export SQLITE_ROOT="/home/utils/sqlite-3.42.0"

# PATH setup - add tools in front
export PATH="$CMAKE_ROOT/bin:$GCC_ROOT/bin:$PATH"

# Build environment with GCC 10.3.0 libraries
export CC="$GCC_ROOT/bin/gcc"
export CXX="$GCC_ROOT/bin/g++"

# Use GCC 10.3.0's newer libstdc++ which has CXXABI_1.3.8+
export LD_LIBRARY_PATH="$GCC_ROOT/lib64:$SQLITE_ROOT/lib:$LD_LIBRARY_PATH"

# Include paths
export C_INCLUDE_PATH="$GCC_ROOT/include:$SQLITE_ROOT/include:$C_INCLUDE_PATH"
export CPLUS_INCLUDE_PATH="$GCC_ROOT/include/c++/10.3.0:$GCC_ROOT/include:$SQLITE_ROOT/include:$CPLUS_INCLUDE_PATH"

# Node.js build flags
export CXXFLAGS="-I$SQLITE_ROOT/include -std=c++14"
export LDFLAGS="-L$SQLITE_ROOT/lib -L$GCC_ROOT/lib64"
export npm_config_build_from_source=true

echo "✅ Conservative environment ready:"
echo "   🔧 GCC: $(which gcc) - $(gcc --version 2>/dev/null | head -1)"
echo "   📦 CMake: $(which cmake) - $(cmake --version 2>/dev/null | head -1)" 
echo "   📚 libstdc++: Using GCC 10.3.0 (CXXABI_1.3.8+)"
echo "   🗄️ SQLite: $SQLITE_ROOT"
echo "   ⚠️ GLIBC: Using system default (avoiding conflicts)"
echo ""
echo "🎯 Attempting FAISS compilation with available tools..." 