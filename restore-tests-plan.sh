#!/bin/bash

# QuDAG Test Restoration Plan
# This script restores original test files while preserving ARM64 enhancements

set -e

CURRENT_DIR="/Users/god/_neucleos-1-all/QuDAG"
FRESH_DIR="/Users/god/_neucleos-1-all/QuDAG-fresh"
BACKUP_DIR="${CURRENT_DIR}/tests-backup-$(date +%Y%m%d-%H%M%S)"

echo "=== QuDAG Test Restoration Plan ==="
echo "Current: $CURRENT_DIR"
echo "Original: $FRESH_DIR"
echo "Backup: $BACKUP_DIR"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Phase 1: Backing up current enhanced tests..."

# Backup modified crypto tests
CRYPTO_MODIFIED_FILES=(
    "core/crypto/tests/basic_ml_dsa_test.rs"
    "core/crypto/tests/security/advanced_side_channel_tests.rs"
    "core/crypto/tests/security/ml_dsa_security_tests.rs"
    "core/crypto/tests/security/comprehensive_memory_safety_tests.rs"
    "core/crypto/tests/security/timing_attack_tests.rs"
    "core/crypto/tests/integration/system_integration_tests.rs"
    "core/crypto/tests/nist_test_vectors.rs"
    "core/crypto/tests/ml_dsa_tests.rs"
    "core/crypto/tests/ml_dsa_comprehensive_tests.rs"
    "core/crypto/tests/security_tests.rs"
)

for file in "${CRYPTO_MODIFIED_FILES[@]}"; do
    echo "Backing up: $file"
    mkdir -p "$BACKUP_DIR/$(dirname "$file")"
    cp "$CURRENT_DIR/$file" "$BACKUP_DIR/${file%.rs}_arm64_enhanced.rs"
done

# Backup new compatibility layer
echo "Backing up new compatibility layer..."
mkdir -p "$BACKUP_DIR/core/dag/src"
cp "$CURRENT_DIR/core/dag/src/test_compat.rs" "$BACKUP_DIR/core/dag/src/test_compat_arm64.rs"

echo "Phase 2: Restoring original test files..."

# Restore original crypto tests
for file in "${CRYPTO_MODIFIED_FILES[@]}"; do
    echo "Restoring original: $file"
    cp "$FRESH_DIR/$file" "$CURRENT_DIR/$file"
done

# Remove the compatibility layer (it's backed up)
echo "Removing compatibility layer (backed up as test_compat_arm64.rs)"
rm -f "$CURRENT_DIR/core/dag/src/test_compat.rs"

echo "Phase 3: Creating conditional ARM64 test variants..."

# Create ARM64-specific test variants that can coexist
echo "Creating ARM64-specific test variants..."

for file in "${CRYPTO_MODIFIED_FILES[@]}"; do
    base_name=$(basename "$file" .rs)
    dir_name=$(dirname "$file")
    
    # Create ARM64 variant
    arm64_file="$CURRENT_DIR/${dir_name}/${base_name}_arm64.rs"
    
    # Copy the enhanced version and modify for ARM64 only
    cp "$BACKUP_DIR/${file%.rs}_arm64_enhanced.rs" "$arm64_file"
    
    # Add ARM64 conditional compilation
    echo "// ARM64-specific test variant with enhanced crypto imports" > "$arm64_file.tmp"
    echo "#[cfg(target_arch = \"aarch64\")]" >> "$arm64_file.tmp"
    echo "mod ${base_name}_arm64_tests {" >> "$arm64_file.tmp"
    cat "$BACKUP_DIR/${file%.rs}_arm64_enhanced.rs" >> "$arm64_file.tmp"
    echo "}" >> "$arm64_file.tmp"
    
    mv "$arm64_file.tmp" "$arm64_file"
    
    echo "Created ARM64 variant: $arm64_file"
done

echo "Phase 4: Verification..."

# Verify restoration
echo "Verifying restored files match originals..."
for file in "${CRYPTO_MODIFIED_FILES[@]}"; do
    if ! cmp -s "$CURRENT_DIR/$file" "$FRESH_DIR/$file"; then
        echo "ERROR: $file was not properly restored!"
        exit 1
    else
        echo "✓ $file restored correctly"
    fi
done

echo ""
echo "=== RESTORATION COMPLETE ==="
echo ""
echo "Summary:"
echo "✓ Original tests restored from QuDAG-fresh"
echo "✓ ARM64 enhanced tests backed up to: $BACKUP_DIR"
echo "✓ ARM64 conditional variants created with _arm64.rs suffix"
echo "✓ Compatibility layer backed up as test_compat_arm64.rs"
echo ""
echo "Next steps:"
echo "1. Run 'cargo test' to verify original tests pass"
echo "2. Run 'cargo test --target aarch64-apple-darwin' to test ARM64 variants"
echo "3. Review ARM64 variants in core/crypto/tests/*_arm64.rs files"
echo "4. Update Cargo.toml test configurations if needed"
echo ""
echo "Architecture Strategy:"
echo "- Original tests run on x86_64 with original import paths"
echo "- ARM64 tests run on aarch64 with enhanced import paths"
echo "- Both can coexist using conditional compilation"
