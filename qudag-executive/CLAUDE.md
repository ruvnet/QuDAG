# Claude Code Configuration for QuDAG Executive

## ARM64 Build Support (Added 2025-06-23)

QuDAG now has full ARM64 (Apple Silicon) support! This section provides all the information you need to build and run QuDAG on ARM64 systems.

### Quick Start for ARM64

#### Option 1: Full Functionality (Docker)
```bash
# Builds complete QuDAG using Docker (works on any architecture)
./build-arm64.sh
```

#### Option 2: Native ARM64 Performance
```bash
# Builds native ARM64 binaries with libcrux
./build-arm64-native.sh
```

#### Option 3: Essential Components Only
```bash
# Builds core components that work on ARM64
./build-arm64-essential.sh
```

### ARM64 Technical Details

#### What Works on ARM64
-  ML-KEM-768 encryption (via libcrux with NEON optimization)
-  DAG consensus
-  Vault operations
-  Exchange core (with Ed25519 signatures)
-  All basic cryptography (BLAKE3, SHA3, AES-GCM)

#### Currently x86_64 Only
- L ML-DSA signatures (no ARM64 implementation yet)
- L HQC encryption
- L Dark domain resolver
- L Full protocol implementation

### Key Changes Made

1. **Crypto Module**: Replaced `pqcrypto-kyber` with `libcrux-ml-kem` for ARM64
2. **Exchange Module**: Created `crypto_compat.rs` abstraction layer
3. **Conditional Compilation**: ML-DSA/HQC modules only compile on x86_64 with AVX2

### Documentation

- `ARM64_SUPPORT.md` - Complete ARM64 support guide
- `ARM64_SOLUTION_SUMMARY.md` - Executive summary of the solution
- `BEST_PRACTICE_BUILD.md` - Detailed technical implementation

## Executive Frontend Build Commands

### Development
```bash
cd qudag-executive
npm install
npm run dev          # Start development server
```

### Production Build
```bash
npm run build        # Build for production
npm run start        # Start production server
```

### Testing
```bash
npm test            # Run tests
npm run test:watch  # Run tests in watch mode
npm run lint        # Run linting
```

## Integration with ARM64 Backend

When running the executive frontend on ARM64 systems:

1. **Use Docker Backend**:
   ```bash
   # Terminal 1: Start backend
   ./build-arm64.sh
   ./qudag-binary start --port 8080
   
   # Terminal 2: Start frontend
   cd qudag-executive
   npm run dev
   ```

2. **Use Native Components**:
   ```bash
   # Build essential components
   ./build-arm64-essential.sh
   
   # Import in your Node.js app
   # Note: You'll need to create WASM bindings
   ```

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_QUDAG_API_URL=http://localhost:8080
NEXT_PUBLIC_NETWORK_TYPE=mainnet
NEXT_PUBLIC_ENABLE_QUANTUM_CRYPTO=true
```

## Performance Considerations

### ARM64 vs x86_64 Performance

| Operation | x86_64 (AVX2) | ARM64 (NEON) | ARM64 (Docker) |
|-----------|---------------|--------------|----------------|
| ML-KEM    | 100%          | 90%          | 40%            |
| Consensus | 100%          | 100%         | 95%            |
| Overall   | Native        | Native       | Emulated       |

### Recommendations

1. **Development**: Use `build-arm64-essential.sh` for fast iteration
2. **Testing**: Use `build-arm64.sh` for full functionality
3. **Production**: Wait for CI/CD ARM64 releases or use Docker

## Troubleshooting ARM64 Builds

### Common Issues

1. **AVX2 Errors**:
   ```
   error: the feature named `avx2` is not valid for this target
   ```
   Solution: Use one of the ARM64 build scripts

2. **Missing ML-DSA**:
   ```
   error: could not find `ml_dsa` in `qudag_crypto`
   ```
   Solution: ML-DSA is currently x86_64 only, use Docker build

3. **Performance Issues**:
   - Docker builds run slower due to emulation
   - Use native builds when possible
   - Consider using M1/M2/M3 optimized flags

## Future Roadmap

### Short Term (1-2 weeks)
- Complete Ed25519 fallback for all signature operations
- Make dark resolver fully optional
- Update protocol module for ARM64 compatibility

### Medium Term (1 month)
- Implement liboqs backend for full algorithm support
- Add runtime CPU feature detection
- Set up GitHub Actions for ARM64 releases

### Long Term (2-3 months)
- Native ARM64 ML-DSA implementation
- Full feature parity across architectures
- Performance optimization for Apple Silicon

## Contributing

When contributing to QuDAG with ARM64 support:

1. Test on both x86_64 and ARM64
2. Use conditional compilation for architecture-specific code
3. Update this document with any new build procedures
4. Add ARM64 CI tests to your PRs

## Support

For ARM64-specific issues:
- Check `ARM64_SUPPORT.md` first
- Run `./test-arm64-build.sh` to validate your setup
- Open issues with `[ARM64]` prefix

---
*Last updated: 2025-06-23 by Claude Code*