/**
 * Base Tool Interface and Utilities
 *
 * Defines the common interface for all MCP tools and provides
 * utility functions for tool execution and error handling.
 */

export interface ToolInputSchema {
  type: "object";
  properties: Record<string, any>;
  required?: string[];
  [key: string]: any;
}

export interface ToolResult {
  type: "text" | "image" | "file" | "resource";
  text?: string;
  data?: any;
  mimeType?: string;
}

export interface BaseTool {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  execute(args: Record<string, any>, context?: ToolContext): Promise<ToolResult>;
}

export interface ToolContext {
  user_id?: string;
  request_id?: string;
  roles?: string[];
  rbac?: any;
  [key: string]: any;
}

export interface ToolError {
  code: number;
  message: string;
  data?: {
    type: string;
    component: string;
    details: string;
    recovery_hints?: string[];
    request_id?: string;
  };
}

/**
 * Standard error codes for tools
 */
export const ToolErrorCodes = {
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  QUANTUM_ERROR: -32000,
  DAG_ERROR: -32001,
  CRYPTO_ERROR: -32002,
  NETWORK_ERROR: -32003,
  VAULT_ERROR: -32004,
  TIMEOUT_ERROR: -32005
};

/**
 * Validate input against schema
 */
export function validateInputSchema(input: any, schema: ToolInputSchema): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in input)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  // Validate field types and values
  for (const [fieldName, fieldSchema] of Object.entries(schema.properties || {})) {
    if (!(fieldName in input)) continue;

    const value = input[fieldName];

    // Type check
    if (fieldSchema.type && typeof value !== fieldSchema.type) {
      if (fieldSchema.type === "integer" && typeof value !== "number") {
        errors.push(`Field ${fieldName} must be an integer`);
        continue;
      }
      if (fieldSchema.type !== typeof value) {
        errors.push(`Field ${fieldName} must be of type ${fieldSchema.type}`);
        continue;
      }
    }

    // Min/max validation
    if (typeof value === "number") {
      if ("minimum" in fieldSchema && value < fieldSchema.minimum) {
        errors.push(`Field ${fieldName} must be >= ${fieldSchema.minimum}`);
      }
      if ("maximum" in fieldSchema && value > fieldSchema.maximum) {
        errors.push(`Field ${fieldName} must be <= ${fieldSchema.maximum}`);
      }
    }

    // String length validation
    if (typeof value === "string") {
      if ("minLength" in fieldSchema && value.length < fieldSchema.minLength) {
        errors.push(`Field ${fieldName} must be at least ${fieldSchema.minLength} characters`);
      }
      if ("maxLength" in fieldSchema && value.length > fieldSchema.maxLength) {
        errors.push(`Field ${fieldName} must be at most ${fieldSchema.maxLength} characters`);
      }
    }

    // Enum validation
    if ("enum" in fieldSchema && !fieldSchema.enum.includes(value)) {
      errors.push(`Field ${fieldName} must be one of: ${fieldSchema.enum.join(", ")}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create error response for tool execution
 */
export function createToolError(
  code: number,
  message: string,
  data?: Partial<ToolError["data"]>
): ToolError {
  return {
    code,
    message,
    data: {
      type: "TOOL_ERROR",
      component: "unknown",
      details: message,
      ...data
    }
  };
}

/**
 * Create successful tool result
 */
export function createToolResult(data: any, mimeType: string = "application/json"): ToolResult {
  return {
    type: "text",
    text: typeof data === "string" ? data : JSON.stringify(data),
    mimeType
  };
}

/**
 * Base class for implementing tools
 */
export abstract class AbstractTool implements BaseTool {
  abstract name: string;
  abstract description: string;
  abstract inputSchema: ToolInputSchema;

  async execute(args: Record<string, any>, context?: ToolContext): Promise<ToolResult> {
    // Validate input
    const validation = validateInputSchema(args, this.inputSchema);
    if (!validation.valid) {
      throw createToolError(
        ToolErrorCodes.INVALID_PARAMS,
        "Invalid parameters",
        {
          type: "INVALID_PARAMS",
          component: this.name,
          details: validation.errors.join(", ")
        }
      );
    }

    // Call implementation
    return this.executeImpl(args, context);
  }

  protected abstract executeImpl(args: Record<string, any>, context?: ToolContext): Promise<ToolResult>;

  /**
   * Check authorization for tool execution
   */
  protected checkAuthorization(context?: ToolContext, requiredRole?: string): boolean {
    if (!requiredRole) return true;
    if (!context || !context.roles) return false;

    return context.roles.includes(requiredRole);
  }
}
