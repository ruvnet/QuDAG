/**
 * @description CRUD tools for PostgreSQL MCP Server - Simplified for Slonik v30.4.4 compatibility
 * @author QuDAG-PostgreSQL-MCP-Agent
 * @created 2025-01-27
 * @lastModified 2025-01-27 by QuDAG-PostgreSQL-MCP-Agent - Simplified for API compatibility
 */

import { z } from "zod";
import { db } from "../database";
import { appConfig } from "../config";

// Simplified schemas that just validate input structure
const insertSchema = z.object({
  table: z.string(),
  schema: z.string().default("executive"),
  data: z.record(z.any()),
  returnRecord: z.boolean().default(false),
});

const updateSchema = z.object({
  table: z.string(),
  schema: z.string().default("executive"),
  where: z.record(z.any()),
  data: z.record(z.any()),
  limit: z.number().optional(),
});

const deleteSchema = z.object({
  table: z.string(),
  schema: z.string().default("executive"),
  where: z.record(z.any()),
  limit: z.number().optional(),
  confirm: z.boolean().default(false),
});

const selectSchema = z.object({
  table: z.string(),
  schema: z.string().default("executive"),
  columns: z.array(z.string()).optional(),
  where: z.record(z.any()).optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0),
  orderBy: z.string().optional(),
});

const upsertSchema = z.object({
  table: z.string(),
  schema: z.string().default("executive"),
  data: z.record(z.any()),
  conflictTarget: z.array(z.string()),
  updateData: z.record(z.any()).optional(),
});

/**
 * Insert records into a table
 */
export async function insertRecord(params: any) {
  const { table, schema, data } = insertSchema.parse(params);

  // Security checks
  if (!db.isSchemaAllowed(schema)) {
    throw new Error(`Schema '${schema}' is not allowed`);
  }

  if (!db.isOperationAllowed("write")) {
    throw new Error("Write operations not allowed in current access mode");
  }

  throw new Error(
    `Dynamic INSERT operations not supported with current Slonik version. ` +
      `Please use the Business Intelligence API endpoints for data modifications. ` +
      `Target: ${schema}.${table}, Columns: ${Object.keys(data).join(", ")}`
  );
}

/**
 * Update records in a table
 */
export async function updateRecord(params: any) {
  const { table, schema, where, data } = updateSchema.parse(params);

  // Security checks
  if (!db.isSchemaAllowed(schema)) {
    throw new Error(`Schema '${schema}' is not allowed`);
  }

  if (!db.isOperationAllowed("write")) {
    throw new Error("Write operations not allowed in current access mode");
  }

  throw new Error(
    `Dynamic UPDATE operations not supported with current Slonik version. ` +
      `Please use the Business Intelligence API endpoints for data modifications. ` +
      `Target: ${schema}.${table}, Where: ${Object.keys(where).join(", ")}, Update: ${Object.keys(data).join(", ")}`
  );
}

/**
 * Delete records from a table
 */
export async function deleteRecord(params: any) {
  const { table, schema, where, confirm } = deleteSchema.parse(params);

  // Security checks
  if (!db.isSchemaAllowed(schema)) {
    throw new Error(`Schema '${schema}' is not allowed`);
  }

  if (!db.isOperationAllowed("delete")) {
    throw new Error("Delete operations not allowed in current access mode");
  }

  if (appConfig.security.requireConfirmationDelete && !confirm) {
    throw new Error(
      "Delete operations require explicit confirmation. Set confirm: true"
    );
  }

  throw new Error(
    `Dynamic DELETE operations not supported with current Slonik version. ` +
      `Please use the Business Intelligence API endpoints for data modifications. ` +
      `Target: ${schema}.${table}, Where: ${Object.keys(where).join(", ")}`
  );
}

/**
 * Select records from a table
 */
export async function selectRecords(params: any) {
  const { table, schema, columns, where, limit, offset, orderBy } =
    selectSchema.parse(params);

  // Security checks
  if (!db.isSchemaAllowed(schema)) {
    throw new Error(`Schema '${schema}' is not allowed`);
  }

  if (!db.isOperationAllowed("read")) {
    throw new Error("Read operations not allowed in current access mode");
  }

  throw new Error(
    `Dynamic SELECT operations not supported with current Slonik version. ` +
      `Please use the Business Intelligence API endpoints for data access. ` +
      `Target: ${schema}.${table}${columns ? `, Columns: ${columns.join(", ")}` : ""}`
  );
}

/**
 * Upsert records (insert or update)
 */
export async function upsertRecord(params: any) {
  const { table, schema, data, conflictTarget } = upsertSchema.parse(params);

  // Security checks
  if (!db.isSchemaAllowed(schema)) {
    throw new Error(`Schema '${schema}' is not allowed`);
  }

  if (!db.isOperationAllowed("write")) {
    throw new Error("Write operations not allowed in current access mode");
  }

  throw new Error(
    `Dynamic UPSERT operations not supported with current Slonik version. ` +
      `Please use the Business Intelligence API endpoints for data modifications. ` +
      `Target: ${schema}.${table}, Conflict on: ${conflictTarget.join(", ")}`
  );
}
