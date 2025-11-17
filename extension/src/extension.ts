import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { indexWorkspaceCommand } from './commands/index.js';
import { clearIndexCommand } from './commands/clear.js';
import { graphStatsCommand } from './commands/stats.js';
import { reindexCommand } from './commands/reindex.js';
import { indexFile } from './core/indexer.js';

let fileWatcher: vscode.FileSystemWatcher | undefined;
let debounceTimer: NodeJS.Timeout | undefined;
const pendingIndexes = new Set<string>();

export function activate(context: vscode.ExtensionContext): void {
  console.log('nanodex extension is now active');

  // Register commands
  const planCommand = vscode.commands.registerCommand('nanodex.plan', async () => {
    vscode.window.showInformationMessage('Nanodex: Plan command (not yet implemented)');
  });

  const workCommand = vscode.commands.registerCommand('nanodex.work', async () => {
    vscode.window.showInformationMessage('Nanodex: Work command (not yet implemented)');
  });

  const indexCommand = vscode.commands.registerCommand('nanodex.index', indexWorkspaceCommand);
  const clearCommand = vscode.commands.registerCommand('nanodex.clear', clearIndexCommand);
  const statsCommand = vscode.commands.registerCommand('nanodex.stats', graphStatsCommand);
  const reindexCommandReg = vscode.commands.registerCommand('nanodex.reindex', reindexCommand);

  context.subscriptions.push(
    planCommand,
    workCommand,
    indexCommand,
    clearCommand,
    statsCommand,
    reindexCommandReg
  );

  // Setup file watchers for automatic reindexing
  setupFileWatchers(context);
}

function setupFileWatchers(context: vscode.ExtensionContext): void {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return;
  }

  const config = vscode.workspace.getConfiguration('nanodex');
  const autoIndex = config.get<boolean>('index.auto', true);
  const autoReindexMode = config.get<string>('index.autoReindexMode', 'onSave');

  if (!autoIndex || autoReindexMode === 'off') {
    return;
  }

  // Create file watcher for TypeScript/JavaScript files
  fileWatcher = vscode.workspace.createFileSystemWatcher(
    '**/*.{ts,tsx,js,jsx}',
    false, // ignoreCreateEvents
    false, // ignoreChangeEvents
    false  // ignoreDeleteEvents
  );

  // Handle file changes
  const handleFileChange = (uri: vscode.Uri) => {
    const dbPath = path.join(workspaceFolder.uri.fsPath, '.nanodex', 'graph.sqlite');

    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      return;
    }

    // Add to pending indexes
    pendingIndexes.add(uri.fsPath);

    // Debounce: wait 500ms before indexing
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      processPendingIndexes(workspaceFolder.uri.fsPath, dbPath);
    }, 500);
  };

  fileWatcher.onDidCreate(handleFileChange);
  fileWatcher.onDidChange(handleFileChange);

  fileWatcher.onDidDelete((uri) => {
    const dbPath = path.join(workspaceFolder.uri.fsPath, '.nanodex', 'graph.sqlite');

    if (!fs.existsSync(dbPath)) {
      return;
    }

    try {
      const db = new Database(dbPath);
      const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
      const moduleId = `module:${relativePath}`;

      // Delete module and its symbols
      db.prepare('DELETE FROM nodes WHERE id = ?').run(moduleId);
      db.prepare('DELETE FROM nodes WHERE id LIKE ?').run(`symbol:${relativePath}:%`);

      db.close();
    } catch (error) {
      console.error('Failed to handle file deletion:', error);
    }
  });

  context.subscriptions.push(fileWatcher);

  // Listen for file saves (for onSave and onApply modes)
  if (autoReindexMode === 'onSave' || autoReindexMode === 'onApply') {
    const saveListener = vscode.workspace.onDidSaveTextDocument((document) => {
      if (['.ts', '.tsx', '.js', '.jsx'].includes(path.extname(document.uri.fsPath))) {
        handleFileChange(document.uri);
      }
    });
    context.subscriptions.push(saveListener);
  }
}

async function processPendingIndexes(workspaceRoot: string, dbPath: string): Promise<void> {
  if (pendingIndexes.size === 0) {
    return;
  }

  const files = Array.from(pendingIndexes);
  pendingIndexes.clear();

  try {
    const db = new Database(dbPath);

    for (const file of files) {
      try {
        await indexFile(file, workspaceRoot, db);
      } catch (error) {
        console.error(`Failed to index ${file}:`, error);
      }
    }

    db.close();
  } catch (error) {
    console.error('Failed to process pending indexes:', error);
  }
}

export function deactivate(): void {
  console.log('nanodex extension is now deactivated');

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  if (fileWatcher) {
    fileWatcher.dispose();
  }
}
