#!/usr/bin/env node

/**
 * QuDAG .claude Directory MCP Server
 *
 * @description Exposes .claude directory contents as MCP resources for Claude Code
 * @since 2025-01-27
 * @author AI-Assistant
 */

const fs = require("fs").promises;
const path = require("path");

const CLAUDE_DIR = __dirname;

class ClaudeDirectoryMCPServer {
  constructor() {
    this.name = "claude-directory";
    this.version = "1.0.0";
  }

  async initialize() {
    // Send initialization response
    this.sendResponse({
      jsonrpc: "2.0",
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          resources: {
            subscribe: true,
            listChanged: true,
          },
          tools: {},
          prompts: {},
        },
        serverInfo: {
          name: this.name,
          version: this.version,
        },
      },
    });
  }

  async listResources() {
    const resources = [];

    try {
      // Add main context file
      resources.push({
        uri: "claude://QUDAG_EXPERT_CONTEXT.md",
        name: "QuDAG Expert Context",
        description:
          "Comprehensive QuDAG system knowledge and technical insights",
        mimeType: "text/markdown",
      });

      // Add settings and config
      resources.push({
        uri: "claude://settings.json",
        name: "Claude Settings",
        description: "Claude Code configuration and permissions",
        mimeType: "application/json",
      });

      resources.push({
        uri: "claude://config.json",
        name: "Project Config",
        description: "QuDAG project configuration for claude-flow",
        mimeType: "application/json",
      });

      // Add command files
      const commandsDir = path.join(CLAUDE_DIR, "commands");
      const commandFiles = await this.getCommandFiles(commandsDir);

      for (const file of commandFiles) {
        const relativePath = path.relative(CLAUDE_DIR, file);
        const name = path.basename(file, path.extname(file));
        resources.push({
          uri: `claude://commands/${relativePath}`,
          name: `Command: ${name}`,
          description: `QuDAG command reference for ${name}`,
          mimeType: file.endsWith(".md") ? "text/markdown" : "text/plain",
        });
      }
    } catch (error) {
      console.error("Error listing resources:", error);
    }

    return { resources };
  }

  async getCommandFiles(dir) {
    const files = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const subFiles = await this.getCommandFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.name.endsWith(".md") || entry.name.endsWith(".txt")) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory might not exist, continue
    }
    return files;
  }

  async readResource(uri) {
    const resourcePath = uri.replace("claude://", "");
    const fullPath = path.join(CLAUDE_DIR, resourcePath);

    try {
      const content = await fs.readFile(fullPath, "utf8");
      return {
        contents: [
          {
            uri: uri,
            mimeType:
              fullPath.endsWith(".json") ? "application/json" : "text/plain",
            text: content,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Resource not found: ${uri}`);
    }
  }

  async handleRequest(request) {
    const { method, params } = request;

    switch (method) {
      case "initialize":
        return await this.initialize();

      case "resources/list":
        return await this.listResources();

      case "resources/read":
        return await this.readResource(params.uri);

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  sendResponse(response) {
    console.log(JSON.stringify(response));
  }

  start() {
    process.stdin.on("data", async (data) => {
      try {
        const request = JSON.parse(data.toString());
        const result = await this.handleRequest(request);

        if (result) {
          this.sendResponse({
            jsonrpc: "2.0",
            id: request.id,
            result: result,
          });
        }
      } catch (error) {
        this.sendResponse({
          jsonrpc: "2.0",
          id: request.id || null,
          error: {
            code: -32603,
            message: error.message,
          },
        });
      }
    });
  }
}

// Start the server
const server = new ClaudeDirectoryMCPServer();
server.start();
