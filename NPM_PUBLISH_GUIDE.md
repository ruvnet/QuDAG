# QuDAG N-API - NPM Publishing Guide

This guide walks you through publishing all QuDAG N-API packages to npm.

## 📋 Pre-Publication Checklist

### 1. Prerequisites

- [ ] npm account created ([https://www.npmjs.com/signup](https://www.npmjs.com/signup))
- [ ] npm logged in (`npm login`)
- [ ] npm 2FA enabled (recommended)
- [ ] GitHub Actions secrets configured (`NPM_TOKEN`)
- [ ] All tests passing (`npm test`)
- [ ] All packages built (`npm run build`)

### 2. Version Management

- [ ] Update version numbers in all `package.json` files
- [ ] Follow semantic versioning (MAJOR.MINOR.PATCH)
- [ ] Update CHANGELOG.md files
- [ ] Tag release in git (`git tag v1.0.0`)

### 3. Package Validation

- [ ] All package.json files have correct metadata
- [ ] README files are complete and accurate
- [ ] LICENSE files are present
- [ ] .npmignore files exclude unnecessary files
- [ ] All dependencies are correctly specified
- [ ] Peer dependencies are documented

### 4. Build Artifacts

- [ ] Rust N-API bindings compiled for all platforms
- [ ] TypeScript compiled to JavaScript
- [ ] Type definitions generated
- [ ] Source maps generated (if needed)
- [ ] Binary artifacts uploaded to GitHub releases

---

## 📦 Package Overview

### Packages to Publish

1. **@qudag/napi-core** - Core N-API bindings
2. **@qudag/cli** - CLI tools
3. **@qudag/mcp-stdio** - MCP STDIO server
4. **@qudag/mcp-sse** - MCP HTTP server
5. **Platform-specific packages** (auto-published by CI)

---

## 🚀 Publishing Process

### Option 1: Manual Publishing (Development)

#### Step 1: Verify Package Content

```bash
# Navigate to package directory
cd packages/napi-core

# Check what will be published
npm pack --dry-run

# Review the output - should NOT include:
# - src/ (Rust source, except for necessary files)
# - target/
# - node_modules/
# - Test files
# - .git files
```

#### Step 2: Test Installation Locally

```bash
# Create a tarball
npm pack

# Install in a test project
mkdir /tmp/test-qudag
cd /tmp/test-qudag
npm init -y
npm install /path/to/qudag-napi-core-1.0.0.tgz

# Test the package
node -e "const { MlDsaKeyPair } = require('@qudag/napi-core'); console.log(MlDsaKeyPair.generate())"
```

#### Step 3: Publish to npm

```bash
# Publish with public access
npm publish --access public

# Or publish a pre-release
npm publish --access public --tag beta
```

#### Step 4: Verify Publication

```bash
# Check npm registry
npm view @qudag/napi-core

# Install from npm
npm install @qudag/napi-core

# Test installation
npx @qudag/cli --version
```

---

### Option 2: Automated Publishing (Production)

#### Using GitHub Actions (Recommended)

**Trigger:**
- Push a tag matching `v*.*.*` (e.g., `v1.0.0`)

**Process:**
1. Creates git tag
2. Pushes tag to GitHub
3. GitHub Actions builds all platforms
4. Runs all tests
5. Publishes to npm automatically

**Commands:**

```bash
# 1. Update version in all package.json files
npm version patch -w @qudag/napi-core
npm version patch -w @qudag/cli
npm version patch -w @qudag/mcp-stdio
npm version patch -w @qudag/mcp-sse

# 2. Commit changes
git add .
git commit -m "chore: bump version to 1.0.0"

# 3. Create and push tag
git tag v1.0.0
git push origin main --tags

# 4. Monitor GitHub Actions
# Visit: https://github.com/ruvnet/QuDAG/actions
```

---

## 📝 Package-Specific Instructions

### @qudag/napi-core

**Pre-publish checks:**

```bash
cd packages/napi-core

# Build for all platforms (requires CI or manual cross-compilation)
npm run build

# Verify binary exists
ls -lh *.node

# Test import
node -e "console.log(require('./').MlDsaKeyPair)"

# Publish
npm publish --access public
```

**Important:**
- Must include platform-specific `.node` binaries
- Or publish platform-specific packages separately
- TypeScript definitions must be accurate

---

### @qudag/cli

**Pre-publish checks:**

```bash
cd packages/cli

# Build TypeScript
npm run build

# Verify bin exists and is executable
ls -lh dist/cli.js
node dist/cli.js --help

# Test via npx (local)
npm link
qudag --help

# Publish
npm publish --access public
```

**Important:**
- Binary script must have shebang (`#!/usr/bin/env node`)
- Must be executable on Unix systems
- Test on multiple platforms

---

### @qudag/mcp-stdio

**Pre-publish checks:**

```bash
cd packages/mcp-stdio

# Build TypeScript
npm run build

# Verify main entry point
node dist/index.js --help

# Test with MCP client
# (requires MCP client or Claude Desktop)

# Publish
npm publish --access public
```

**Important:**
- Must work with Claude Desktop
- STDIO transport must function correctly
- Error handling must be robust

---

### @qudag/mcp-sse

**Pre-publish checks:**

```bash
cd packages/mcp-sse

# Build TypeScript
npm run build

# Verify server starts
node dist/server.js &
curl http://localhost:3000/health
killall node

# Publish
npm publish --access public
```

**Important:**
- HTTP server must start correctly
- OAuth2 authentication must work
- Security middleware must be enabled

---

## 🔒 Security Considerations

### 1. npm 2FA

Enable 2FA for all package publications:

```bash
npm profile enable-2fa auth-and-writes
```

### 2. Package Access

Restrict package management to authorized users:

```bash
# Add maintainer
npm owner add username @qudag/napi-core

# Remove maintainer
npm owner rm username @qudag/napi-core
```

### 3. npm Provenance

Enable provenance for transparency:

```bash
npm publish --provenance --access public
```

This creates a signed attestation linking the package to the source code.

---

## 🐛 Troubleshooting

### Problem: "npm ERR! 403 Forbidden"

**Solution:**
- Verify you're logged in: `npm whoami`
- Check package name isn't taken: `npm view @qudag/napi-core`
- Ensure you have publish rights: `npm owner ls @qudag/napi-core`

### Problem: "Missing binary for platform"

**Solution:**
- Build for all platforms using GitHub Actions
- Or publish platform-specific packages separately
- Use `napi artifacts` to manage binaries

### Problem: "Cannot find module '@qudag/napi-core'"

**Solution:**
- Verify package.json has correct `main` and `types` fields
- Check `.npmignore` doesn't exclude necessary files
- Test with `npm pack` and install the tarball

### Problem: "Binary incompatible with current system"

**Solution:**
- Ensure platform detection is working
- Verify optional dependencies are correct
- Check Node.js version compatibility

---

## 📊 Post-Publication Tasks

### 1. Verify Installation

```bash
# Clean install in new directory
mkdir /tmp/test-install
cd /tmp/test-install
npm init -y
npm install @qudag/napi-core
npm install -g @qudag/cli

# Test functionality
node -e "const { MlDsaKeyPair } = require('@qudag/napi-core'); console.log('✓ Works')"
qudag --version
```

### 2. Update Documentation

- [ ] Update npm badges in README.md
- [ ] Update version numbers in docs
- [ ] Create GitHub release with changelog
- [ ] Update website (if applicable)

### 3. Announce Release

- [ ] Post on GitHub Discussions
- [ ] Tweet/social media announcement
- [ ] Update Discord/community channels
- [ ] Send to mailing list (if applicable)

---

## 🔄 Version Strategy

### Semantic Versioning

- **MAJOR (1.0.0)**: Breaking changes
- **MINOR (0.1.0)**: New features (backwards compatible)
- **PATCH (0.0.1)**: Bug fixes (backwards compatible)

### Pre-releases

- **Alpha (1.0.0-alpha.1)**: Early development
- **Beta (1.0.0-beta.1)**: Feature complete, testing
- **RC (1.0.0-rc.1)**: Release candidate

### Publishing Pre-releases

```bash
# Publish beta
npm publish --tag beta --access public

# Users install with
npm install @qudag/napi-core@beta

# Promote to latest
npm dist-tag add @qudag/napi-core@1.0.0 latest
```

---

## 📅 Release Schedule

### Recommended Schedule

- **Patch releases**: As needed (bug fixes)
- **Minor releases**: Monthly (new features)
- **Major releases**: Quarterly (breaking changes)

### Release Process Timeline

1. **Week 1**: Development
2. **Week 2-3**: Testing and bug fixes
3. **Week 4**: Beta release
4. **Week 5**: Release candidate
5. **Week 6**: Stable release

---

## 🎯 Success Metrics

### Track These Metrics

- **Downloads**: npm downloads per week
- **Issues**: Bug reports and feature requests
- **Stars**: GitHub stars and watchers
- **Dependents**: Packages using QuDAG
- **Community**: Discord/forum activity

### npm Statistics

```bash
# View download stats
npm view @qudag/napi-core

# Or visit
https://www.npmjs.com/package/@qudag/napi-core
```

---

## 📚 Additional Resources

### Official Documentation

- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Semantic Versioning](https://semver.org/)
- [npm Provenance](https://docs.npmjs.com/generating-provenance-statements)

### Tools

- [npm-check-updates](https://www.npmjs.com/package/npm-check-updates) - Update dependencies
- [semantic-release](https://github.com/semantic-release/semantic-release) - Automated versioning
- [np](https://github.com/sindresorhus/np) - Better npm publish

---

## 🚨 Emergency Procedures

### Unpublish Package (Within 72 hours)

```bash
# Unpublish specific version
npm unpublish @qudag/napi-core@1.0.0

# Unpublish entire package (use with caution!)
npm unpublish @qudag/napi-core --force
```

**Note:** Unpublishing is discouraged. Use `npm deprecate` instead.

### Deprecate Package

```bash
# Deprecate a version
npm deprecate @qudag/napi-core@1.0.0 "Security vulnerability, upgrade to 1.0.1"

# Deprecate entire package
npm deprecate @qudag/napi-core "Package no longer maintained"
```

### Security Vulnerability

1. **Report to GitHub Security**: Create private security advisory
2. **Fix issue**: Develop patch in private
3. **Publish fix**: Release new version immediately
4. **Deprecate old**: Deprecate vulnerable versions
5. **Notify users**: Send security advisory

---

## ✅ Final Checklist

Before publishing to npm, ensure:

- [ ] All tests pass (`npm test`)
- [ ] All builds succeed (`npm run build`)
- [ ] Documentation is complete and accurate
- [ ] Version numbers are updated
- [ ] CHANGELOG is updated
- [ ] LICENSE is present
- [ ] README has correct badges and links
- [ ] Package.json has correct metadata
- [ ] .npmignore excludes unnecessary files
- [ ] Security audit passes (`npm audit`)
- [ ] No sensitive data in package
- [ ] Tested installation locally
- [ ] Reviewed `npm pack` output
- [ ] Tagged git release
- [ ] GitHub Actions configured (for automated publishing)
- [ ] npm 2FA enabled
- [ ] npm provenance enabled

---

## 📞 Support

If you encounter issues during publishing:

- **GitHub Issues**: [https://github.com/ruvnet/QuDAG/issues](https://github.com/ruvnet/QuDAG/issues)
- **npm Support**: [https://www.npmjs.com/support](https://www.npmjs.com/support)
- **Discord**: [Join our server](https://discord.gg/qudag) (coming soon)

---

**Last Updated:** 2025-11-10
**Version:** 1.0.0
