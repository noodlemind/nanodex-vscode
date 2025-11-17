/**
 * Index Workspace command implementation
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { initializeGraphDatabase } from '../core/graph.js';
import { indexFile, getSourceFiles } from '../core/indexer.js';

export async function indexWorkspaceCommand(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
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
        title: 'Indexing workspace',
        cancellable: true
      },
      async (progress, token) => {
        progress.report({ message: 'Creating .nanodex directory...' });

        // Create .nanodex directory if it doesn't exist
        const nanodexDir = path.join(workspaceFolder.uri.fsPath, '.nanodex');
        if (!fs.existsSync(nanodexDir)) {
          fs.mkdirSync(nanodexDir, { recursive: true });
        }

        progress.report({ message: 'Initializing graph database...' });

        // Initialize the database
        const dbPath = path.join(nanodexDir, 'graph.sqlite');
        const db = initializeGraphDatabase(dbPath);

        try {
          progress.report({ message: 'Finding source files...' });

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
          // Close the database
          db.close();
        }
      }
    );

    vscode.window.showInformationMessage('Workspace indexed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to index workspace: ${errorMessage}`);
  }
}
