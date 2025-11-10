# QuDAG CI/CD Quick Reference

## Workflow Summary

| Workflow | Trigger | Time | Purpose |
|----------|---------|------|---------|
| **napi-ci.yml** | Push/PR | 50 min | Continuous integration tests |
| **napi-release.yml** | Tag v* | 60 min | Build, test, package, publish release |
| **napi-gpu.yml** | Push/schedule | 90 min | GPU builds (CUDA/ROCm) |
| **security-audit.yml** | Daily/schedule | 20 min | Security vulnerability scanning |
| **benchmark.yml** | Push main | 90 min | Performance benchmarking |
| **docs.yml** | Push main | 15 min | Generate documentation |

## Build Platforms

**Tier 1 (Full Support)**
```
Linux: x86_64-gnu, aarch64-gnu
macOS: x86_64, aarch64 (M1+)
Windows: x86_64
```

**Tier 2 (Build Only)**
```
Linux: x86_64-musl, aarch64-musl
Windows: aarch64
```

**Optional GPU**
```
CUDA: Linux x64, Windows x64
ROCm: Linux x64
```

## Common Tasks

### Run CI Locally
```bash
# Install act
brew install act

# Run CI workflow
act -j lint
act -j build-napi -P ubuntu-latest=ghcr.io/catthehacker/ubuntu:full-latest

# List available jobs
act -l
```

### Test Before Commit
```bash
# Format
cargo fmt --all
npm run lint

# Lint
cargo clippy --all-features -- -D warnings

# Test
cargo test --workspace
npm run test:integration

# Security
cargo audit
npm audit
```

### Create Release
```bash
# Update version
npm version patch  # or minor, major

# Commit
git add .
git commit -m "chore(release): v1.2.3"

# Tag
git tag v1.2.3

# Push (triggers release workflow)
git push origin main v1.2.3
```

### Monitor CI/CD
- **Actions tab**: https://github.com/ruvnet/QuDAG/actions
- **Latest runs**: Shows status of all workflows
- **Logs**: Click workflow → job → step for details
- **Artifacts**: Available for download after completion

## Secrets to Configure

1. **NPM_TOKEN** (required)
   - Generate on npmjs.com (Settings → Tokens)
   - Scope: `read:packages, write:packages`
   - Add to: Settings → Secrets and Variables → Actions

2. **CODECOV_TOKEN** (optional)
   - Generate on codecov.io
   - Add for code coverage tracking

3. **SLACK_WEBHOOK_URL** (optional)
   - For Slack notifications

## Artifact Locations

After workflow completion:
- **Actions Tab** → Choose Workflow → Choose Run
- **Artifacts section** → Download ZIP

Artifact retention:
- CI builds: 5 days
- Release builds: 7 days
- Benchmarks: 30 days
- Docs: Permanent (deployed)

## Build Status

### PR Checks Required
- ✓ lint
- ✓ security-audit
- ✓ test-rust
- ✓ test-node
- ✓ build-napi

### Release Checks
All of the above, plus:
- ✓ test-integration
- ✓ benchmark (if main)
- ✓ coverage

## Troubleshooting

### Build Failed
1. Check logs: Actions → Workflow → Job → Step
2. Common fixes:
   - Clear cache: Settings → Actions → Clear caches
   - Check for `Cargo.lock` changes
   - Verify platform dependencies installed

### Tests Failed
1. Run locally to reproduce
2. Check for timing-dependent tests
3. Review error messages in logs

### Release Failed
1. Verify git tag format: `v1.2.3`
2. Check NPM_TOKEN is valid
3. Review npm-publish step logs
4. Check GitHub release artifacts uploaded

## GitHub Actions Cost

**Monthly estimate**: ~$0.93
- Included: 2,000 minutes free
- Additional: $0.24 per 1,000 minutes
- Usage: ~5,900 minutes/month

**Cost optimization**:
- Disable GPU builds unless needed: Save $0.09/month
- Reduce benchmark frequency: Save $0.18/month
- Cache is already optimized (80%+ hit rate)

## Performance Tips

**Reduce build time**:
1. Cache hit rate > 90% (automatic)
2. Parallel execution (9 platforms)
3. Skip non-critical workflows if possible

**Monitor performance**:
- Check workflow duration trend
- Compare cache hit rates
- Monitor artifact sizes

## Documentation

- **CI-CD-GUIDE.md** - Complete detailed guide
- **IMPLEMENTATION_SUMMARY.md** - Implementation details
- **README.md** (in workflows dir) - Overview

## Quick Commands

```bash
# Format code
cargo fmt --all
npm run lint

# Run all tests
cargo test --workspace
npm run test:integration

# Security check
cargo audit
npm audit

# Build for release
cargo build --release

# Generate docs
cargo doc --no-deps

# Run benchmarks locally
cargo bench --workspace
npm run benchmark
```

## File Locations

```
.github/workflows/
├── napi-ci.yml              # CI workflow
├── napi-release.yml         # Release workflow
├── napi-gpu.yml             # GPU builds
├── security-audit.yml       # Security scanning
├── benchmark.yml            # Performance tests
├── docs.yml                 # Documentation
├── reusable/
│   ├── build-platform.yml   # Reusable build
│   └── test-platform.yml    # Reusable test
├── CI-CD-GUIDE.md           # Detailed guide
├── IMPLEMENTATION_SUMMARY.md # Implementation details
├── QUICK_REFERENCE.md       # This file
└── README.md                # Overview
```

## Contact

For CI/CD questions:
1. Check CI-CD-GUIDE.md
2. Review workflow logs
3. Open GitHub issue
4. Contact maintainers

## Checklist: Before Release

- [ ] All tests passing locally
- [ ] Version bumped in package.json/Cargo.toml
- [ ] CHANGELOG updated
- [ ] No uncommitted changes
- [ ] Create git tag: `git tag v1.2.3`
- [ ] Push tag: `git push origin v1.2.3`
- [ ] Monitor release workflow: Actions tab
- [ ] Verify npm package: npmjs.com/@qudag/napi
- [ ] Verify GitHub release: Releases page

## Useful Links

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [napi-rs Documentation](https://napi.rs)
- [Rust Documentation](https://doc.rust-lang.org)
- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules)

---

**Last Updated**: 2025-01-15
**Version**: 1.0.0
**Status**: Active
