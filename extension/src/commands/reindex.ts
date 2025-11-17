/**
 * Reindex Changed Files command implementation
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { indexFile, getSourceFiles } from '../core/indexer.js';

export async function reindexCommand(): Promise<void> {
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
    const config = vscode.workspace.getConfiguration('nanodex');
    const exclude = config.get<string[]>('index.exclude', [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/.git/**',
      '**/.nanodex/**'
    ]);

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Reindexing workspace',
        cancellable: true
      },
      async (progress, token) => {
        const db = new Database(dbPath);

        try {
          // Get all source files
          const files = getSourceFiles(workspaceFolder.uri.fsPath, exclude);

          progress.report({ message: `Found ${files.length} files` });

          // Index each file
          for (let i = 0; i < files.length; i++) {
            if (token.isCancellationRequested) {
              break;
            }

            const file = files[i];
            const relativePath = path.relative(workspaceFolder.uri.fsPath, file);

            progress.report({
              message: `Indexing ${relativePath}`,
              increment: (100 / files.length)
            });

            try {
              await indexFile(file, workspaceFolder.uri.fsPath, db);
            } catch (error) {
              console.error(`Failed to index ${file}:`, error);
            }
          }

          progress.report({ message: 'Complete!' });
        } finally {
          db.close();
        }
      }
    );

    vscode.window.showInformationMessage('Workspace reindexed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to reindex workspace: ${errorMessage}`);
  }
}
