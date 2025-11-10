#!/usr/bin/env node

/**
 * QuDAG MCP STDIO Server Entry Point
 *
 * This executable provides Claude Desktop integration via STDIO transport.
 * It exposes QuDAG's quantum-resistant operations through the Model Context Protocol.
 */

import { QuDagMcpServer } from './server.js';

async function main() {
  try {
    const server = new QuDagMcpServer();
    await server.connect();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.error('Received SIGINT, shutting down gracefully...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.error('Received SIGTERM, shutting down gracefully...');
      process.exit(0);
    });
  } catch (error) {
    console.error('Fatal error starting QuDAG MCP server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
});
