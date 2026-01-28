/**
 * File Context Tool - Language Model Tool for getting file context from the knowledge graph
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { FileContextInput } from '../core/types.js';
import {
  getDatabaseContext,
  isErrorResult,
  formatToolError,
  createSuccessResult,
  createErrorResult,
  withDatabase,
  escapeSqlLike,
  validateInputLength,
  checkCancellation,
  parseMetadata,
  NodeRow,
  MAX_FILE_PATH_LENGTH
} from './utils.js';

export class NanodexFileContextTool implements vscode.LanguageModelTool<FileContextInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<FileContextInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { filePath } = options.input;

    // Check cancellation
    const cancelled = checkCancellation(token);
    if (cancelled) return cancelled;

    // Validate input length
    const lengthError = validateInputLength(filePath, MAX_FILE_PATH_LENGTH, 'File path');
    if (lengthError) return lengthError;

    // Get database context
    const dbContext = getDatabaseContext();
    if (isErrorResult(dbContext)) {
      return dbContext;
    }

    try {
      // Normalize file path to be relative to workspace
      let relativePath = filePath;
      if (path.isAbsolute(filePath)) {
        relativePath = path.relative(dbContext.workspaceRoot, filePath);
      }

      // Validate that the path is within the workspace (prevent path traversal)
      const normalizedPath = path.normalize(relativePath);
      if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
        return createErrorResult(
          `Error: File path "${filePath}" is outside the workspace.`
        );
      }

      const result = await withDatabase(dbContext.dbPath, (db) => {
        // Check cancellation before query
        if (token.isCancellationRequested) {
          return null;
        }

        // Escape SQL LIKE wildcards in the relative path
        const escapedRelativePath = escapeSqlLike(normalizedPath);

        // Look for the module node
        const moduleId = `module:${normalizedPath}`;
        const moduleNode = db.prepare('SELECT * FROM nodes WHERE id = ?').get(moduleId) as NodeRow | undefined;

        if (!moduleNode) {
          return {
            found: false,
            message: `No module found for file "${filePath}". The file may not be indexed yet.`
          };
        }

        const results: string[] = [];
        results.push(`## File Context: ${normalizedPath}\n`);

        // Get module metadata
        const metadata = parseMetadata(moduleNode.metadata);
        if (metadata) {
          if (metadata.language) {
            results.push(`- Language: ${metadata.language}`);
          }
          if (metadata.loc) {
            results.push(`- Lines of Code: ${metadata.loc}`);
          }
        }

        // Check cancellation
        if (token.isCancellationRequested) {
          return null;
        }

        // Get all symbols in this file
        const symbols = db.prepare(
          `SELECT * FROM nodes WHERE type = 'symbol' AND id LIKE ? ESCAPE '\\'`
        ).all(`symbol:${escapedRelativePath}:%`) as NodeRow[];

        if (symbols.length > 0) {
          results.push(`\n### Symbols (${symbols.length})`);

          // Group symbols by kind
          const symbolsByKind = new Map<string, string[]>();
          for (const symbol of symbols) {
            const symMeta = parseMetadata(symbol.metadata);
            const kind = (symMeta?.kind as string) || 'other';

            const list = symbolsByKind.get(kind) || [];
            list.push(symbol.name);
            symbolsByKind.set(kind, list);
          }

          for (const [kind, names] of symbolsByKind.entries()) {
            results.push(`- ${kind}s: ${names.join(', ')}`);
          }
        }

        // Check cancellation
        if (token.isCancellationRequested) {
          return null;
        }

        // Get imports (edges with relation 'imports')
        const imports = db.prepare(
          `SELECT e.*, n.name as targetName
           FROM edges e
           JOIN nodes n ON e.target_id = n.id
           WHERE e.source_id = ? AND e.relation = 'imports'`
        ).all(moduleId) as Array<{ targetName: string }>;

        if (imports.length > 0) {
          results.push(`\n### Imports (${imports.length})`);
          for (const imp of imports.slice(0, 10)) {
            results.push(`- ${imp.targetName}`);
          }
          if (imports.length > 10) {
            results.push(`... and ${imports.length - 10} more`);
          }
        }

        // Get exported symbols (symbols defined in this file are exports)
        // Note: The graph stores symbols with IDs like 'symbol:{filePath}:{name}'
        // All symbols in a file are considered exports since they're extracted from export statements
        const exportedSymbols = symbols.map(s => s.name);

        if (exportedSymbols.length > 0) {
          results.push(`\n### Exports (${exportedSymbols.length})`);
          for (const name of exportedSymbols.slice(0, 10)) {
            results.push(`- ${name}`);
          }
          if (exportedSymbols.length > 10) {
            results.push(`... and ${exportedSymbols.length - 10} more`);
          }
        }

        // Get relationships to other modules
        const relatedModules = db.prepare(
          `SELECT DISTINCT n.name, e.relation
           FROM edges e
           JOIN nodes n ON e.target_id = n.id
           WHERE e.source_id = ? AND n.type = 'module' AND e.relation != 'imports'`
        ).all(moduleId) as Array<{ name: string; relation: string }>;

        if (relatedModules.length > 0) {
          results.push(`\n### Related Modules (${relatedModules.length})`);
          for (const rel of relatedModules.slice(0, 5)) {
            results.push(`- ${rel.name} (${rel.relation})`);
          }
          if (relatedModules.length > 5) {
            results.push(`... and ${relatedModules.length - 5} more`);
          }
        }

        return { found: true, content: results.join('\n') };
      });

      if (result === null) {
        return createErrorResult('Operation cancelled.');
      }

      if (!result.found) {
        return createErrorResult(result.message!);
      }

      return createSuccessResult(result.content!);
    } catch (error) {
      return formatToolError('getting file context', error);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<FileContextInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { filePath } = options.input;
    return {
      invocationMessage: `Getting file context for: ${filePath}`
    };
  }
}
