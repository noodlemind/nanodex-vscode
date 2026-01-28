/**
 * Shared utilities for Language Model Tools
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';

/**
 * Maximum allowed length for query strings to prevent DoS
 */
export const MAX_QUERY_LENGTH = 1000;

/**
 * Maximum allowed length for symbol names
 */
export const MAX_SYMBOL_NAME_LENGTH = 500;

/**
 * Maximum allowed length for file paths
 */
export const MAX_FILE_PATH_LENGTH = 1000;

/**
 * Maximum allowed length for issue/todo IDs
 */
export const MAX_ID_LENGTH = 50;

/**
 * Pattern for valid issue/todo IDs - alphanumeric, underscore, hyphen only
 */
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * Validate issue/todo ID format and return error if invalid
 * Defense-in-depth validation for LM tools layer
 */
export function validateId(
  id: string,
  idType: 'Issue' | 'Todo'
): vscode.LanguageModelToolResult | null {
  if (!id || typeof id !== 'string') {
    return createErrorResult(`Error: ${idType} ID is required.`);
  }
  if (id.length > MAX_ID_LENGTH) {
    return createErrorResult(
      `Error: ${idType} ID exceeds maximum length of ${MAX_ID_LENGTH} characters.`
    );
  }
  if (!ID_PATTERN.test(id)) {
    return createErrorResult(
      `Error: ${idType} ID contains invalid characters. Only alphanumeric, underscore, and hyphen are allowed.`
    );
  }
  if (id.includes('..')) {
    return createErrorResult(
      `Error: ${idType} ID contains invalid path sequence.`
    );
  }
  return null;
}

/**
 * Workspace context for tool operations
 */
export interface WorkspaceContext {
  workspaceFolder: vscode.WorkspaceFolder;
  workspaceRoot: string;
}

/**
 * Database context extending workspace context
 */
export interface DatabaseContext extends WorkspaceContext {
  dbPath: string;
}

/**
 * Create an error result for Language Model Tools
 */
export function createErrorResult(message: string): vscode.LanguageModelToolResult {
  return new vscode.LanguageModelToolResult([
    new vscode.LanguageModelTextPart(message)
  ]);
}

/**
 * Create a success result for Language Model Tools
 */
export function createSuccessResult(content: string): vscode.LanguageModelToolResult {
  return new vscode.LanguageModelToolResult([
    new vscode.LanguageModelTextPart(content)
  ]);
}

/**
 * Get workspace context or return an error result
 */
export function getWorkspaceContext(): WorkspaceContext | vscode.LanguageModelToolResult {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return createErrorResult('Error: No workspace folder is open.');
  }
  return {
    workspaceFolder,
    workspaceRoot: workspaceFolder.uri.fsPath
  };
}

/**
 * Get database context or return an error result
 */
export function getDatabaseContext(): DatabaseContext | vscode.LanguageModelToolResult {
  const wsContext = getWorkspaceContext();
  if (wsContext instanceof vscode.LanguageModelToolResult) {
    return wsContext;
  }

  const dbPath = path.join(wsContext.workspaceRoot, '.nanodex', 'graph.sqlite');
  if (!fs.existsSync(dbPath)) {
    return createErrorResult(
      'Error: Knowledge graph database not found. Please run "Nanodex: Index Workspace" (nanodex.index) first.'
    );
  }

  return { ...wsContext, dbPath };
}

/**
 * Check if a result is an error (LanguageModelToolResult)
 */
export function isErrorResult(result: unknown): result is vscode.LanguageModelToolResult {
  return result instanceof vscode.LanguageModelToolResult;
}

/**
 * Format an error for tool output
 */
export function formatToolError(operation: string, error: unknown): vscode.LanguageModelToolResult {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`Failed to ${operation}:`, error);
  return createErrorResult(`Error ${operation}: ${errorMessage}`);
}

/**
 * Escape SQL LIKE wildcards to prevent injection
 */
export function escapeSqlLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Validate input length and return error if too long
 */
export function validateInputLength(
  value: string,
  maxLength: number,
  fieldName: string
): vscode.LanguageModelToolResult | null {
  if (value.length > maxLength) {
    return createErrorResult(
      `Error: ${fieldName} exceeds maximum length of ${maxLength} characters.`
    );
  }
  return null;
}

/**
 * Check cancellation token and return error if cancelled
 */
export function checkCancellation(token: vscode.CancellationToken): vscode.LanguageModelToolResult | null {
  if (token.isCancellationRequested) {
    return createErrorResult('Operation cancelled.');
  }
  return null;
}

/**
 * Execute a database operation with proper connection management
 */
export function withDatabase<T>(
  dbPath: string,
  operation: (db: Database.Database) => T,
  readonly = true
): T {
  const db = new Database(dbPath, { readonly });
  try {
    return operation(db);
  } finally {
    db.close();
  }
}

/**
 * Database row type for nodes
 */
export interface NodeRow {
  id: string;
  type: string;
  name: string;
  metadata: string | null;
}

/**
 * Database row type for edges
 */
export interface EdgeRow {
  id: number;
  source_id: string;
  target_id: string;
  relation: string;
  metadata: string | null;
}

/**
 * Parse JSON metadata safely, returning undefined on failure
 * @param metadata - JSON string or null
 * @param logWarning - If true, logs parse failures for debugging
 */
export function parseMetadata(
  metadata: string | null,
  logWarning = false
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  try {
    return JSON.parse(metadata);
  } catch (error) {
    if (logWarning) {
      console.warn('Failed to parse metadata:', error);
    }
    return undefined;
  }
}
