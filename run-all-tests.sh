#!/bin/bash
# Run all tests with proper environment

echo "🧪 Running ALL QuDAG tests..."

# Set environment
export OPENSSL_DIR=/opt/homebrew/opt/openssl@3
export PKG_CONFIG_PATH=/opt/homebrew/opt/openssl@3/lib/pkgconfig
export RUSTFLAGS="-C target-cpu=native -L /opt/homebrew/opt/openssl@3/lib"

# Run tests package by package
packages=(
    "qudag-crypto"
    "qudag-dag"
    "qudag-network"
    "qudag-protocol"
    "qudag-exchange-core"
    "qudag-vault-core"
)

failed=0
passed=0

for pkg in "${packages[@]}"; do
    echo ""
    echo "Testing $pkg..."
    if cargo test --package "$pkg" --no-fail-fast 2>&1; then
        ((passed++))
        echo "✅ $pkg: ALL TESTS PASSED"
    else
        ((failed++))
        echo "❌ $pkg: Some tests failed"
    fi
done

echo ""
echo "📊 Final Results:"
echo "   Passed: $passed packages"
echo "   Failed: $failed packages"

if [ $failed -eq 0 ]; then
    echo ""
    echo "🎉 PRISTINE! All tests pass on ARM64!"
else
    echo ""
    echo "🔧 Still need to fix $failed packages"
fi
