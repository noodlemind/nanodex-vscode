/**
 * Symbol Lookup Tool - Language Model Tool for looking up specific symbols
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { querySubgraph } from '../core/graph.js';
import { Node } from '../core/types.js';

interface SymbolLookupInput {
  symbolName: string;
  includeRelationships?: boolean;
}

export class NanodexSymbolLookupTool implements vscode.LanguageModelTool<SymbolLookupInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<SymbolLookupInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { symbolName, includeRelationships = true } = options.input;

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

      // Search for symbols by name
      const symbols = db.prepare(
        `SELECT * FROM nodes WHERE type = 'symbol' AND name LIKE ?`
      ).all(`%${symbolName}%`) as Array<{
        id: string;
        type: string;
        name: string;
        metadata: string | null;
      }>;

      if (symbols.length === 0) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `No symbol found matching "${symbolName}". The symbol may not exist or has not been indexed yet.`
          )
        ]);
      }

      // Format results
      const results: string[] = [];
      results.push(`Found ${symbols.length} symbol(s) matching "${symbolName}":\n`);

      for (const symbol of symbols.slice(0, 10)) {
        results.push(`\n**${symbol.name}** (${symbol.id})`);
        
        // Parse metadata if available
        if (symbol.metadata) {
          try {
            const metadata = JSON.parse(symbol.metadata);
            if (metadata.kind) {
              results.push(`- Kind: ${metadata.kind}`);
            }
            if (metadata.filePath) {
              results.push(`- File: ${metadata.filePath}`);
            }
            if (metadata.range) {
              results.push(`- Location: Line ${metadata.range.start.line + 1}`);
            }
          } catch (error) {
            // Metadata parsing failed, skip
          }
        }

        // Include relationships if requested
        if (includeRelationships) {
          const subgraph = querySubgraph(db, symbol.id, 1);
          
          if (subgraph.edges.length > 0) {
            results.push(`- Relationships:`);
            
            const groupedEdges = new Map<string, number>();
            for (const edge of subgraph.edges) {
              const count = groupedEdges.get(edge.relation) || 0;
              groupedEdges.set(edge.relation, count + 1);
            }
            
            for (const [relation, count] of groupedEdges.entries()) {
              results.push(`  - ${relation}: ${count}`);
            }
          }
        }
      }

      if (symbols.length > 10) {
        results.push(`\n... and ${symbols.length - 10} more symbols`);
      }

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(results.join('\n'))
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to lookup symbol:', error);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error looking up symbol: ${errorMessage}`)
      ]);
    } finally {
      db?.close();
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<SymbolLookupInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { symbolName } = options.input;
    return {
      invocationMessage: `Looking up symbol: "${symbolName}" in nanodex knowledge graph`
    };
  }
}
