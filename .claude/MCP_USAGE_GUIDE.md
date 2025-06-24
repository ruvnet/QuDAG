---
created: 2025-01-27T14:23:00Z
updated: 2025-01-27T14:23:00Z
updatedBy: AI-Assistant
version: 1.0.0
---

# QuDAG .claude Directory MCP Access Guide

## Overview

This guide explains how to access your QuDAG expert knowledge and command references through the Model Context Protocol (MCP) in Claude Code.

## MCP Server Setup ✅

Your `.claude` directory is now exposed as an MCP server with the following configuration:

- **Server Name**: `claude-directory` (local scope)
- **Shared Server**: `claude-directory-shared` (project scope)
- **Protocol**: stdio transport
- **Resources**: All `.claude` directory contents

## How to Access Resources

### 1. Using @ Mentions

Reference any resource from your `.claude` directory using @ mentions:

```
@claude://QUDAG_EXPERT_CONTEXT.md - Complete QuDAG system knowledge
@claude://settings.json - Claude Code configuration
@claude://config.json - Project configuration
@claude://commands/README.md - Command reference overview
@claude://commands/crypto/ml-dsa.txt - ML-DSA crypto commands
@claude://commands/network/peers.txt - Network peer commands
```

### 2. Example Queries

```
> Can you review @claude://QUDAG_EXPERT_CONTEXT.md and explain the quantum-resistant features?

> Use commands from @claude://commands/crypto/ml-kem.txt to implement key encapsulation

> Based on @claude://settings.json, what are my current Claude Code permissions?

> Compare the approach in @claude://commands/test/security.txt with our current testing
```

### 3. Command Integration

Your command files are now accessible as MCP resources:

```
> Execute the security audit workflow from @claude://commands/security-audit.md

> Use the TDD cycle from @claude://commands/tdd-cycle.md for the new feature

> Follow the deployment validation from @claude://commands/deploy-validate.md
```

## Available Resources

### Core Knowledge

- `@claude://QUDAG_EXPERT_CONTEXT.md` - Complete QuDAG system documentation
- `@claude://settings.json` - Claude Code configuration and permissions
- `@claude://config.json` - Project configuration for claude-flow

### Command Categories

- `@claude://commands/crypto/` - Cryptographic operations (ML-DSA, ML-KEM, HQC)
- `@claude://commands/network/` - P2P networking and routing
- `@claude://commands/dag/` - DAG consensus and validation
- `@claude://commands/dark/` - Dark domain addressing
- `@claude://commands/vault/` - Secret management
- `@claude://commands/test/` - Testing and benchmarking
- `@claude://commands/deploy/` - Deployment operations
- `@claude://commands/dev/` - Development utilities

### Workflow Commands

- `@claude://commands/tdd-cycle.md` - Test-Driven Development workflow
- `@claude://commands/security-audit.md` - Security analysis procedures
- `@claude://commands/performance-benchmark.md` - Performance testing
- `@claude://commands/integration-test.md` - Integration testing
- `@claude://commands/deploy-validate.md` - Deployment validation

## MCP Server Management

### Check Server Status

```bash
# List all MCP servers
claude mcp list

# Get server details
claude mcp get claude-directory

# Check connection status in Claude Code
/mcp
```

### Troubleshooting

If resources aren't accessible:

1. **Verify Server is Running**: Use `/mcp` command in Claude Code
2. **Check File Paths**: Ensure all referenced files exist in `.claude/`
3. **Restart Connection**: Remove and re-add the server if needed

```bash
# Remove server
claude mcp remove claude-directory

# Re-add server
claude mcp add claude-directory node .claude/mcp-server.js
```

## Team Sharing

The project-scoped server (`claude-directory-shared`) is configured in `.mcp.json` and can be shared with team members. They will need to:

1. Pull the latest code including `.mcp.json`
2. Approve the project MCP server when prompted
3. Access resources using the same @ mention syntax

## Security Notes

- **Local Scope**: `claude-directory` is private to you
- **Project Scope**: `claude-directory-shared` is shared via `.mcp.json`
- **File Access**: Server only reads files, no write operations
- **Path Restriction**: Server only accesses files within `.claude/` directory

## Integration Examples

### QuDAG Development Workflow

```
> I need to implement ML-KEM key encapsulation. Use @claude://QUDAG_EXPERT_CONTEXT.md for context and @claude://commands/crypto/ml-kem.txt for specific commands.

> Run the security audit workflow from @claude://commands/security-audit.md on the crypto module, considering the quantum-resistant requirements in @claude://QUDAG_EXPERT_CONTEXT.md.

> Follow the TDD cycle from @claude://commands/tdd-cycle.md to implement the dark addressing feature described in @claude://QUDAG_EXPERT_CONTEXT.md.
```

---

**Note**: This MCP server provides read-only access to your `.claude` directory contents, enabling Claude Code to leverage your specialized QuDAG knowledge and command references during development.

- AI-Assistant
