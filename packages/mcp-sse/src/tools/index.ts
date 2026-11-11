/**
 * Tools Module - Main Index
 *
 * Exports all available MCP tools and provides tool registry/management.
 */

export * from "./base";
export * from "./quantum";
export * from "./crypto";

import { BaseTool, ToolContext, ToolResult } from "./base";
import { quantumTools } from "./quantum";
import { cryptoTools } from "./crypto";

/**
 * Tool Registry for managing all available tools
 */
export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();

  constructor() {
    this.registerTools([...quantumTools, ...cryptoTools]);
  }

  /**
   * Register tools
   */
  private registerTools(tools: BaseTool[]): void {
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  /**
   * Get tool by name
   */
  public getTool(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tools
   */
  public getAllTools(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * List all tool names
   */
  public getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Execute tool
   */
  public async executeTool(
    name: string,
    args: Record<string, any>,
    context?: ToolContext
  ): Promise<ToolResult> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    return tool.execute(args, context);
  }

  /**
   * Get tool schemas for MCP protocol
   */
  public getToolSchemas(): Array<{
    name: string;
    description: string;
    inputSchema: any;
  }> {
    return this.getAllTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  }
}

/**
 * Create and export default tool registry
 */
export const toolRegistry = new ToolRegistry();

/**
 * Helper function to create tool registry instance
 */
export const createToolRegistry = (): ToolRegistry => {
  return new ToolRegistry();
};
