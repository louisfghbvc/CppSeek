#!/bin/bash

# CppSeek Native Environment Setup
# Uses compatible tools from CentOS7 environment for native bindings

echo "🔧 Setting up compatible environment for native bindings..."

# Define paths - use actual locations
export GCC_ROOT="/home/utils/gcc-10.3.0"
export SQLITE_ROOT="/home/utils/sqlite-3.42.0"

# Set up GCC 10.3.0 environment  
export PATH="$GCC_ROOT/bin:$PATH"
export LD_LIBRARY_PATH="$GCC_ROOT/lib64:$SQLITE_ROOT/lib:$LD_LIBRARY_PATH"
export LIBRARY_PATH="$GCC_ROOT/lib64:$SQLITE_ROOT/lib:$LIBRARY_PATH"
export C_INCLUDE_PATH="$GCC_ROOT/include:$SQLITE_ROOT/include:$C_INCLUDE_PATH"
export CPLUS_INCLUDE_PATH="$GCC_ROOT/include/c++/10.3.0:$GCC_ROOT/include:$SQLITE_ROOT/include:$CPLUS_INCLUDE_PATH"

# Set up SQLite environment
export PKG_CONFIG_PATH="$SQLITE_ROOT/lib/pkgconfig:$PKG_CONFIG_PATH"
export SQLITE3_INCLUDE_DIR="$SQLITE_ROOT/include"
export SQLITE3_LIB_DIR="$SQLITE_ROOT/lib"

# Set up build environment variables
export CC="$GCC_ROOT/bin/gcc"
export CXX="$GCC_ROOT/bin/g++"

# Use system tools for ar, ranlib, etc. if not available in GCC directory
if [ -f "$GCC_ROOT/bin/ar" ]; then
    export AR="$GCC_ROOT/bin/ar"
else
    export AR="$(which ar)"
fi

if [ -f "$GCC_ROOT/bin/ranlib" ]; then
    export RANLIB="$GCC_ROOT/bin/ranlib"
else
    export RANLIB="$(which ranlib)"
fi

if [ -f "$GCC_ROOT/bin/nm" ]; then
    export NM="$GCC_ROOT/bin/nm"
else
    export NM="$(which nm)"
fi

if [ -f "$GCC_ROOT/bin/strip" ]; then
    export STRIP="$GCC_ROOT/bin/strip"
else
    export STRIP="$(which strip)"
fi

# Node.js native build environment
export CXXFLAGS="-I$SQLITE_ROOT/include"
export LDFLAGS="-L$SQLITE_ROOT/lib -L$GCC_ROOT/lib64"
export npm_config_build_from_source=true
export npm_config_sqlite3_binary_host_mirror=""

echo "✅ Environment configured:"
echo "   🔧 GCC: $(which gcc) - $(gcc --version | head -1)"
echo "   📚 libstdc++: $GCC_ROOT/lib64/libstdc++.so.6"
echo "   🗄️ SQLite: $SQLITE_ROOT (version 3.42.0)"
echo "   🔗 CXXABI: 1.3.8+ available"
echo "   🛠️ Build tools: AR=$AR, RANLIB=$RANLIB"
echo ""
echo "🚀 Ready to rebuild native bindings!" 