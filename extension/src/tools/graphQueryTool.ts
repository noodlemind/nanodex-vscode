/**
 * Graph Query Tool - Language Model Tool for querying the knowledge graph
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { selectRelevantContext, formatContext } from '../core/context.js';

interface GraphQueryInput {
  query: string;
  depth?: number;
}

export class NanodexGraphQueryTool implements vscode.LanguageModelTool<GraphQueryInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<GraphQueryInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { query, depth = 2 } = options.input;

    // Validate depth
    const validatedDepth = Math.min(Math.max(depth, 1), 5);

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
          'Error: Knowledge graph database not found. Please run "Nanodex: Index Workspace" first to build the knowledge graph.'
        )
      ]);
    }

    let db: Database.Database | undefined;
    try {
      db = new Database(dbPath, { readonly: true });
      
      // Query the graph using existing context selection
      const contextResult = selectRelevantContext(query, db, validatedDepth, 2500);
      const formattedContext = formatContext(contextResult);

      if (!formattedContext || formattedContext.trim().length === 0) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `No relevant context found for query: "${query}". The knowledge graph may not contain information related to this query.`
          )
        ]);
      }

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(formattedContext)
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to query graph:', error);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error querying knowledge graph: ${errorMessage}`)
      ]);
    } finally {
      db?.close();
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<GraphQueryInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { query, depth = 2 } = options.input;
    return {
      invocationMessage: `Querying nanodex knowledge graph for: "${query}" (depth: ${depth})`
    };
  }
}
