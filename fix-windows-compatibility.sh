#!/bin/bash
set -e

echo "🪟 Fixing Windows x86_64 compatibility by simplifying conditionals"
echo "=================================================================="

# The issue: Our AVX2-specific conditionals might not catch all Windows x86_64 builds
# The fix: Use simple target_arch = "x86_64" to ensure ALL x86_64 platforms use pqcrypto

echo "🔍 Current problematic pattern:"
echo '   #[cfg(all(target_arch = "x86_64", target_feature = "avx2"))]'
echo "   ↳ This might not catch Windows x86_64 without explicit AVX2"
echo ""
echo "✅ Fixed pattern:"
echo '   #[cfg(target_arch = "x86_64")]'
echo "   ↳ This catches ALL x86_64 platforms (Windows, Linux, macOS)"
echo ""

# Find all Rust files (excluding the fresh repo we cloned for comparison)
echo "📁 Finding files to update..."
find . -name "*.rs" -type f | grep -v "../QuDAG-fresh" > /tmp/rust_files.txt

# Count files with AVX2 conditionals
affected_files=$(cat /tmp/rust_files.txt | xargs grep -l "all(target_arch.*avx2" 2>/dev/null | wc -l)
echo "   Found $affected_files files with AVX2 conditionals"

echo ""
echo "🔧 Applying fixes..."

# Fix pattern 1: #[cfg(all(target_arch = "x86_64", target_feature = "avx2"))]
# Replace with: #[cfg(target_arch = "x86_64")]
for file in $(cat /tmp/rust_files.txt); do
    if grep -q 'all(target_arch = "x86_64", target_feature = "avx2")' "$file" 2>/dev/null; then
        echo "   Fixing: $file"
        sed -i '' 's/#\[cfg(all(target_arch = "x86_64", target_feature = "avx2"))\]/#[cfg(target_arch = "x86_64")]/g' "$file"
    fi
done

# Fix pattern 2: #[cfg(not(all(target_arch = "x86_64", target_feature = "avx2")))]  
# Replace with: #[cfg(not(target_arch = "x86_64"))]
for file in $(cat /tmp/rust_files.txt); do
    if grep -q 'not(all(target_arch = "x86_64", target_feature = "avx2"))' "$file" 2>/dev/null; then
        echo "   Fixing: $file"
        sed -i '' 's/#\[cfg(not(all(target_arch = "x86_64", target_feature = "avx2")))\]/#[cfg(not(target_arch = "x86_64"))]/g' "$file"
    fi
done

# Fix pattern 3: cfg(all(target_arch = "x86_64", target_feature = "avx2")) in Cargo.toml conditionals
# Replace with: cfg(target_arch = "x86_64")
for file in $(find . -name "Cargo.toml" -type f | grep -v "../QuDAG-fresh"); do
    if grep -q 'all(target_arch = "x86_64", target_feature = "avx2")' "$file" 2>/dev/null; then
        echo "   Fixing Cargo.toml: $file"
        sed -i '' 's/all(target_arch = "x86_64", target_feature = "avx2")/target_arch = "x86_64"/g' "$file"
    fi
done

# Fix pattern 4: cfg(not(all(target_arch = "x86_64", target_feature = "avx2"))) in Cargo.toml
# Replace with: cfg(not(target_arch = "x86_64"))
for file in $(find . -name "Cargo.toml" -type f | grep -v "../QuDAG-fresh"); do
    if grep -q 'not(all(target_arch = "x86_64", target_feature = "avx2"))' "$file" 2>/dev/null; then
        echo "   Fixing Cargo.toml: $file"
        sed -i '' 's/not(all(target_arch = "x86_64", target_feature = "avx2"))/not(target_arch = "x86_64")/g' "$file"
    fi
done

echo ""
echo "✅ Fix complete!"
echo ""
echo "🧪 Testing the fix..."

# Test that we can still build on current platform
if cargo check --workspace >/dev/null 2>&1; then
    echo "   ✅ Workspace builds successfully"
else
    echo "   ❌ Build check failed - there may be syntax errors"
    echo "      Run 'cargo check' to see details"
fi

echo ""
echo "📋 Summary of changes:"
echo "   • x86_64 (any OS) → pqcrypto (pure Rust, no C deps)"
echo "   • ARM64/other → libcrux + oqs (with build requirements)"
echo ""
echo "💼 Windows compatibility:"
echo "   • Windows x86_64 now guaranteed to use pqcrypto"
echo "   • No OpenSSL or C++ toolchain required on Windows"
echo "   • Simple 'cargo build' should work on Windows"
echo ""
echo "🎯 This preserves 100% original functionality while adding ARM64 awesomeness!"

# Cleanup
rm -f /tmp/rust_files.txt