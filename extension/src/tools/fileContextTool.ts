/**
 * File Context Tool - Language Model Tool for getting file context from the knowledge graph
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';

interface FileContextInput {
  filePath: string;
}

/**
 * Escape SQL LIKE wildcards to prevent injection
 */
function escapeSqlLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export class NanodexFileContextTool implements vscode.LanguageModelTool<FileContextInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<FileContextInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { filePath } = options.input;

    // Get workspace folder
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('Error: No workspace folder is open.')
      ]);
    }

    // Check if database exists
    const dbPath = path.join(workspaceFolder.uri.fsPath, '.nanodex', 'graph.sqlite');
    if (!fs.existsSync(dbPath)) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'Error: Knowledge graph database not found. Please run "Nanodex: Index Workspace" first.'
        )
      ]);
    }

    let db: Database.Database | undefined;
    try {
      db = new Database(dbPath, { readonly: true });

      // Normalize file path to be relative to workspace
      let relativePath = filePath;
      if (path.isAbsolute(filePath)) {
        relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
      }

      // Validate that the path is within the workspace (prevent path traversal)
      const normalizedPath = path.normalize(relativePath);
      if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `Error: File path "${filePath}" is outside the workspace.`
          )
        ]);
      }

      // Escape SQL LIKE wildcards in the relative path
      const escapedRelativePath = escapeSqlLike(normalizedPath);

      // Look for the module node
      const moduleId = `module:${normalizedPath}`;
      const moduleNode = db.prepare('SELECT * FROM nodes WHERE id = ?').get(moduleId) as {
        id: string;
        type: string;
        name: string;
        metadata: string | null;
      } | undefined;

      if (!moduleNode) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `No module found for file "${filePath}". The file may not be indexed yet.`
          )
        ]);
      }

      const results: string[] = [];
      results.push(`## File Context: ${normalizedPath}\n`);

      // Get module metadata
      if (moduleNode.metadata) {
        try {
          const metadata = JSON.parse(moduleNode.metadata);
          if (metadata.language) {
            results.push(`- Language: ${metadata.language}`);
          }
          if (metadata.loc) {
            results.push(`- Lines of Code: ${metadata.loc}`);
          }
        } catch (error) {
          // Metadata parsing failed, skip
        }
      }

      // Get all symbols in this file
      const symbols = db.prepare(
        `SELECT * FROM nodes WHERE type = 'symbol' AND id LIKE ? ESCAPE '\\'`
      ).all(`symbol:${escapedRelativePath}:%`) as Array<{
        id: string;
        type: string;
        name: string;
        metadata: string | null;
      }>;

      if (symbols.length > 0) {
        results.push(`\n### Symbols (${symbols.length})`);
        
        // Group symbols by kind
        const symbolsByKind = new Map<string, string[]>();
        for (const symbol of symbols) {
          let kind = 'other';
          if (symbol.metadata) {
            try {
              const metadata = JSON.parse(symbol.metadata);
              kind = metadata.kind || 'other';
            } catch (error) {
              // Metadata parsing failed
            }
          }
          
          const list = symbolsByKind.get(kind) || [];
          list.push(symbol.name);
          symbolsByKind.set(kind, list);
        }

        for (const [kind, names] of symbolsByKind.entries()) {
          results.push(`- ${kind}s: ${names.join(', ')}`);
        }
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

      // Get exports (edges from symbols in this file with relation 'exports')
      const exports = db.prepare(
        `SELECT DISTINCT n.name 
         FROM edges e 
         JOIN nodes n ON e.source_id = n.id 
         WHERE e.source_id LIKE ? ESCAPE '\\' AND e.relation = 'exports'`
      ).all(`symbol:${escapedRelativePath}:%`) as Array<{ name: string }>;

      if (exports.length > 0) {
        results.push(`\n### Exports (${exports.length})`);
        for (const exp of exports.slice(0, 10)) {
          results.push(`- ${exp.name}`);
        }
        if (exports.length > 10) {
          results.push(`... and ${exports.length - 10} more`);
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

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(results.join('\n'))
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to get file context:', error);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error getting file context: ${errorMessage}`)
      ]);
    } finally {
      db?.close();
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<FileContextInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { filePath } = options.input;
    return {
      invocationMessage: `Getting file context for: ${filePath}`
    };
  }
}
