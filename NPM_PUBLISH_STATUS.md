# QuDAG NPM Publication Status

**Publication Date:** 2025-11-10

## ✅ Published Packages

All QuDAG TypeScript/JavaScript packages have been successfully published to npm:

### 1. @qudag/cli@0.1.0
**Status:** ✅ Published
**NPM URL:** https://www.npmjs.com/package/@qudag/cli
**Size:** 35.1 kB (177.8 kB unpacked)
**Install:** `npm install -g @qudag/cli`
**Usage:** `qudag --help`

**Description:** Command-line interface for QuDAG quantum-resistant DAG operations. Provides commands for executing DAG operations, optimizing circuits, analyzing complexity, and benchmarking performance.

**Key Features:**
- Execute quantum DAG operations
- Optimize quantum circuits
- Analyze circuit complexity
- Benchmark performance
- Multiple output formats (JSON, YAML, table)

### 2. @qudag/mcp-stdio@0.1.0
**Status:** ✅ Published
**NPM URL:** https://www.npmjs.com/package/@qudag/mcp-stdio
**Size:** 44.1 kB (232.2 kB unpacked)
**Install:** `npm install @qudag/mcp-stdio`
**Usage:** `npx qudag-mcp-stdio`

**Description:** QuDAG MCP server with STDIO transport for Claude Desktop integration. Enables AI assistants to interact with quantum-resistant cryptographic operations.

**Key Features:**
- STDIO transport for Claude Desktop
- 10 quantum cryptography tools
- 6 resource providers
- Quantum key exchange
- Dark address resolution
- Vault integration

### 3. @qudag/mcp-sse@0.1.0
**Status:** ✅ Published
**NPM URL:** https://www.npmjs.com/package/@qudag/mcp-sse
**Size:** 31.7 kB (126.3 kB unpacked)
**Install:** `npm install @qudag/mcp-sse`
**Usage:** See deployment documentation

**Description:** QuDAG MCP Server with Streamable HTTP transport for web integration. Provides HTTP/SSE endpoint with OAuth2 authentication and RBAC.

**Key Features:**
- HTTP server with Streamable transport
- OAuth2 authentication
- 5-tier RBAC system
- Rate limiting and security middleware
- Redis session management
- Helmet security headers

---

## ⚠️ Not Published: @qudag/napi-core

### @qudag/napi-core (Rust N-API Bindings)
**Status:** ⚠️ Not Published
**Reason:** Requires Rust toolchain and cross-platform compilation

**Build Requirements:**
- Rust 1.70+ (`rustup install stable`)
- Node.js 18.0+
- napi-rs CLI (`npm install -g @napi-rs/cli`)
- Platform-specific build tools:
  - **Linux:** `build-essential`
  - **macOS:** Xcode Command Line Tools
  - **Windows:** Visual Studio Build Tools

**Building from Source:**
```bash
cd packages/napi-core
cargo build --release
npm run build
```

**Cross-Platform Compilation:**
```bash
# Build for all platforms using GitHub Actions
git tag v0.1.0
git push origin v0.1.0

# Or use napi-rs artifacts
napi artifacts -d packages/napi-core
```

**Platform-Specific Packages:**
To publish @qudag/napi-core, you need to create platform-specific packages:
- `@qudag/napi-linux-x64`
- `@qudag/napi-linux-arm64`
- `@qudag/napi-darwin-x64`
- `@qudag/napi-darwin-arm64`
- `@qudag/napi-win32-x64`

Each platform package contains pre-built `.node` binaries. The main `@qudag/napi-core` package uses `optionalDependencies` to install the correct platform package.

**Publishing Strategy:**
1. Set up GitHub Actions to build for all platforms (already configured in `.github/workflows/napi-ci.yml`)
2. Create git tag: `git tag v0.1.0 && git push origin v0.1.0`
3. GitHub Actions will:
   - Build binaries for 9 platforms
   - Publish platform-specific packages
   - Publish main @qudag/napi-core package with optionalDependencies
4. Users can then install: `npm install @qudag/napi-core`

---

## 📦 Installation Examples

### Using the CLI
```bash
# Install globally
npm install -g @qudag/cli

# Use the CLI
qudag --help
qudag exec --operation execute --input '{"vertices":[]}'
```

### Using MCP STDIO Server (Claude Desktop)
```bash
# Install the package
npm install -g @qudag/mcp-stdio

# Add to Claude Desktop config (~/.config/claude/claude_desktop_config.json)
{
  "mcpServers": {
    "qudag": {
      "command": "qudag-mcp-stdio"
    }
  }
}

# Restart Claude Desktop
```

### Using MCP SSE Server (Web)
```bash
# Install dependencies
npm install @qudag/mcp-sse

# Start the server
npx qudag-mcp-sse
# Server runs on http://localhost:3000
```

### Using with @qudag/napi-core (Once Published)
```bash
# Install the package
npm install @qudag/napi-core

# Use in Node.js
const { MlDsaKeyPair, MlKem, QuantumDAG } = require('@qudag/napi-core');

// Generate ML-DSA signing keys
const keypair = MlDsaKeyPair.generate();

// Sign a message
const message = Buffer.from('Hello, quantum world!');
const signature = keypair.sign(message);

// Verify signature
const publicKey = keypair.toPublicKey();
const isValid = publicKey.verify(message, signature);
console.log('Signature valid:', isValid);
```

---

## 🔗 Package Links

- **@qudag/cli:** https://www.npmjs.com/package/@qudag/cli
- **@qudag/mcp-stdio:** https://www.npmjs.com/package/@qudag/mcp-stdio
- **@qudag/mcp-sse:** https://www.npmjs.com/package/@qudag/mcp-sse
- **GitHub Repository:** https://github.com/ruvnet/QuDAG
- **npm Organization:** https://www.npmjs.com/org/qudag

---

## 📊 Package Statistics

| Package | Version | Size | Files | Downloads |
|---------|---------|------|-------|-----------|
| @qudag/cli | 0.1.0 | 35.1 kB | 46 | [npm stats](https://www.npmjs.com/package/@qudag/cli) |
| @qudag/mcp-stdio | 0.1.0 | 44.1 kB | 91 | [npm stats](https://www.npmjs.com/package/@qudag/mcp-stdio) |
| @qudag/mcp-sse | 0.1.0 | 31.7 kB | 22 | [npm stats](https://www.npmjs.com/package/@qudag/mcp-sse) |

---

## 🎯 Next Steps

1. **Build @qudag/napi-core binaries:**
   - Set up Rust cross-compilation environment
   - Use GitHub Actions to build for all platforms
   - Publish platform-specific packages

2. **Test installations:**
   - Test `npm install -g @qudag/cli` on different platforms
   - Test Claude Desktop integration with @qudag/mcp-stdio
   - Test HTTP server deployment with @qudag/mcp-sse

3. **Documentation:**
   - Add npm badges to README.md
   - Create usage tutorials
   - Document API endpoints for mcp-sse

4. **Monitoring:**
   - Track npm download statistics
   - Monitor GitHub issues
   - Collect user feedback

---

**Published by:** ruvnet
**Organization:** @qudag
**Date:** 2025-11-10
