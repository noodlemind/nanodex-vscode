/**
 * Index Workspace command implementation
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { initializeGraphDatabase } from '../core/graph.js';

export async function indexWorkspaceCommand(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Indexing workspace',
        cancellable: false
      },
      async (progress) => {
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

        // Close the database
        db.close();

        progress.report({ message: 'Complete!' });
      }
    );

    vscode.window.showInformationMessage('Workspace indexed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to index workspace: ${errorMessage}`);
  }
}
