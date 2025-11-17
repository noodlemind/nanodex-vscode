/**
 * Graph Stats command implementation
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { getGraphStats } from '../core/graph.js';

export async function graphStatsCommand(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const dbPath = path.join(workspaceFolder.uri.fsPath, '.nanodex', 'graph.sqlite');

  if (!fs.existsSync(dbPath)) {
    vscode.window.showInformationMessage('No index found. Run "Nanodex: Index Workspace" first.');
    return;
  }

  try {
    const db = new Database(dbPath, { readonly: true });
    const stats = getGraphStats(db);
    db.close();

    // Format the stats for display
    const statsMessage = `
**Graph Statistics**

**Total Nodes:** ${stats.totalNodes}
**Total Edges:** ${stats.totalEdges}

**Nodes by Type:**
- Symbols: ${stats.nodesByType.symbol}
- Modules: ${stats.nodesByType.module}
- Capabilities: ${stats.nodesByType.capability}
- Concepts: ${stats.nodesByType.concept}
- Errors: ${stats.nodesByType.error}
- Recipes: ${stats.nodesByType.recipe}

**Edges by Relation:**
- Calls: ${stats.edgesByRelation.calls}
- Imports: ${stats.edgesByRelation.imports}
- Implements: ${stats.edgesByRelation.implements}
- Extends: ${stats.edgesByRelation.extends}
- Throws: ${stats.edgesByRelation.throws}
- Depends On: ${stats.edgesByRelation.depends_on}

**Database Size:** ${(stats.databaseSize / 1024).toFixed(2)} KB
    `.trim();

    // Show in information message
    vscode.window.showInformationMessage(statsMessage, { modal: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to get graph stats: ${errorMessage}`);
  }
}
