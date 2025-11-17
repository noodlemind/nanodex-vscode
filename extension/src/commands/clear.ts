/**
 * Clear Index command implementation
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export async function clearIndexCommand(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const dbPath = path.join(workspaceFolder.uri.fsPath, '.nanodex', 'graph.sqlite');

  if (!fs.existsSync(dbPath)) {
    vscode.window.showInformationMessage('No index found to clear');
    return;
  }

  // Show confirmation dialog
  const confirmation = await vscode.window.showWarningMessage(
    'Are you sure you want to clear the graph index? This cannot be undone.',
    { modal: true },
    'Clear Index',
    'Cancel'
  );

  if (confirmation !== 'Clear Index') {
    return;
  }

  try {
    // Delete the database file
    fs.unlinkSync(dbPath);

    // Also delete WAL and SHM files if they exist
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;

    if (fs.existsSync(walPath)) {
      fs.unlinkSync(walPath);
    }

    if (fs.existsSync(shmPath)) {
      fs.unlinkSync(shmPath);
    }

    vscode.window.showInformationMessage('Graph index cleared successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to clear index: ${errorMessage}`);
  }
}
