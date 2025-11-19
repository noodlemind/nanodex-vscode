import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { indexWorkspaceCommand } from './commands/index.js';
import { clearIndexCommand } from './commands/clear.js';
import { graphStatsCommand } from './commands/stats.js';
import { reindexCommand } from './commands/reindex.js';
import { planCommand } from './commands/plan.js';
import { workCommand } from './commands/work.js';
import { selectModelCommand, selectChatStrategyCommand, showModelStatusCommand } from './commands/selectModel.js';
import { genCommandCommand } from './commands/genCommand.js';
import { triageCommand } from './commands/triage.js';
import { resolveTodosCommand } from './commands/resolveTodos.js';
import { reviewCommand } from './commands/review.js';
import { registerChatParticipant } from './chat/participant.js';
import { createStatusBarItem, disposeStatusBarItem } from './ui/statusBar.js';
import { indexFile } from './core/indexer.js';
import { getFileWatcherPattern, supportsIndexing } from './core/languages.js';
import { optimizeDatabase } from './core/batchOps.js';
import { registerModelChangeHandler } from './core/modelChangeHandler.js';

let fileWatcher: vscode.FileSystemWatcher | undefined;
let debounceTimer: NodeJS.Timeout | undefined;
const pendingIndexes = new Set<string>();

export function activate(context: vscode.ExtensionContext): void {
  console.log('nanodex extension is activating...');

  try {
    // Register commands
    console.log('Registering commands...');
    const planCommandReg = vscode.commands.registerCommand('nanodex.plan', () => planCommand(context));
    const workCommandReg = vscode.commands.registerCommand('nanodex.work', () => workCommand(context));
    const indexCommand = vscode.commands.registerCommand('nanodex.index', indexWorkspaceCommand);
    const clearCommand = vscode.commands.registerCommand('nanodex.clear', clearIndexCommand);
    const statsCommand = vscode.commands.registerCommand('nanodex.stats', graphStatsCommand);
    const reindexCommandReg = vscode.commands.registerCommand('nanodex.reindex', reindexCommand);
    const selectModelCommandReg = vscode.commands.registerCommand('nanodex.selectModel', selectModelCommand);
    const selectChatStrategyCommandReg = vscode.commands.registerCommand('nanodex.selectChatStrategy', selectChatStrategyCommand);
    const showModelStatusCommandReg = vscode.commands.registerCommand('nanodex.showModelStatus', showModelStatusCommand);
    const optimizeCommandReg = vscode.commands.registerCommand('nanodex.optimize', optimizeDatabaseCommand);
    const genCommandCommandReg = vscode.commands.registerCommand('nanodex.genCommand', () => genCommandCommand(context));
    const triageCommandReg = vscode.commands.registerCommand('nanodex.triage', () => triageCommand(context));
    const resolveTodosCommandReg = vscode.commands.registerCommand('nanodex.resolveTodos', () => resolveTodosCommand(context));
    const reviewCommandReg = vscode.commands.registerCommand('nanodex.review', () => reviewCommand(context));

    context.subscriptions.push(
      planCommandReg,
      workCommandReg,
      indexCommand,
      clearCommand,
      statsCommand,
      reindexCommandReg,
      selectModelCommandReg,
      selectChatStrategyCommandReg,
      showModelStatusCommandReg,
      optimizeCommandReg,
      genCommandCommandReg,
      triageCommandReg,
      resolveTodosCommandReg,
      reviewCommandReg
    );
    console.log('Commands registered successfully');

    // Register chat participant
    console.log('Attempting to register chat participant...');
    registerChatParticipant(context);

    // Create status bar item
    console.log('Creating status bar item...');
    createStatusBarItem(context);

    // Register model change handler
    console.log('Registering model change handler...');
    registerModelChangeHandler(context);

    // Setup file watchers for automatic reindexing
    console.log('Setting up file watchers...');
    setupFileWatchers(context);

    console.log('nanodex extension activated successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to activate nanodex extension:', errorMessage, error);
    vscode.window.showErrorMessage(`Failed to activate Nanodex: ${errorMessage}`);
  }
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

  // Create file watcher for all supported languages
  const watchPattern = getFileWatcherPattern();
  fileWatcher = vscode.workspace.createFileSystemWatcher(
    watchPattern,
    false, // ignoreCreateEvents
    false, // ignoreChangeEvents
    false  // ignoreDeleteEvents
  );

  // Handle file changes
  const handleFileChange = (uri: vscode.Uri) => {
    // Check if file language is supported
    if (!supportsIndexing(uri.fsPath)) {
      return;
    }

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

    let db: Database.Database | undefined;
    try {
      db = new Database(dbPath);
      const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
      const moduleId = `module:${relativePath}`;

      // Delete module and its symbols
      db.prepare('DELETE FROM nodes WHERE id = ?').run(moduleId);
      db.prepare('DELETE FROM nodes WHERE id LIKE ?').run(`symbol:${relativePath}:%`);
    } catch (error) {
      console.error('Failed to handle file deletion:', error);
    } finally {
      if (db) {
        db.close();
      }
    }
  });

  context.subscriptions.push(fileWatcher);

  // Listen for file saves (for onSave and onApply modes)
  if (autoReindexMode === 'onSave' || autoReindexMode === 'onApply') {
    const saveListener = vscode.workspace.onDidSaveTextDocument((document) => {
      if (supportsIndexing(document.uri.fsPath)) {
        handleFileChange(document.uri);
      }
    });
    context.subscriptions.push(saveListener);
  }
}

/**
 * Optimize database command
 */
async function optimizeDatabaseCommand(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const dbPath = path.join(workspaceFolder.uri.fsPath, '.nanodex', 'graph.sqlite');

  if (!fs.existsSync(dbPath)) {
    vscode.window.showWarningMessage('No index found. Run "Nanodex: Index Workspace" first.');
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Optimizing database',
      cancellable: false
    },
    async () => {
      let db: Database.Database | undefined;
      try {
        db = new Database(dbPath);
        optimizeDatabase(db);
        vscode.window.showInformationMessage('Database optimized successfully');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Provide context-specific error messages
        if (errorMessage.toLowerCase().includes('locked')) {
          vscode.window.showErrorMessage(
            'Database is locked. Close other nanodex operations and try again.'
          );
        } else if (errorMessage.toLowerCase().includes('disk')) {
          vscode.window.showErrorMessage(
            'Insufficient disk space to optimize database.'
          );
        } else if (errorMessage.toLowerCase().includes('corrupt')) {
          vscode.window.showErrorMessage(
            'Database may be corrupted. Try running "Nanodex: Clear Index" and reindexing.'
          );
        } else {
          vscode.window.showErrorMessage(`Failed to optimize database: ${errorMessage}`);
        }
      } finally {
        db?.close();
      }
    }
  );
}

async function processPendingIndexes(workspaceRoot: string, dbPath: string): Promise<void> {
  if (pendingIndexes.size === 0) {
    return;
  }

  const files = Array.from(pendingIndexes);
  pendingIndexes.clear();

  let db: Database.Database | undefined;
  try {
    db = new Database(dbPath);

    for (const file of files) {
      try {
        await indexFile(file, workspaceRoot, db);
      } catch (error) {
        console.error(`Failed to index ${file}:`, error);
      }
    }
  } catch (error) {
    console.error('Failed to process pending indexes:', error);
  } finally {
    if (db) {
      db.close();
    }
  }
}

export async function deactivate(): Promise<void> {
  console.log('nanodex extension is now deactivating');

  // Clear timer FIRST to prevent new additions during shutdown
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  // Dispose file watcher BEFORE processing pending items
  if (fileWatcher) {
    fileWatcher.dispose();
  }

  // Now safely process any pending indexes
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder && pendingIndexes.size > 0) {
    const dbPath = path.join(workspaceFolder.uri.fsPath, '.nanodex', 'graph.sqlite');
    if (fs.existsSync(dbPath)) {
      try {
        await processPendingIndexes(workspaceFolder.uri.fsPath, dbPath);
      } catch (error) {
        console.error('Failed to process pending indexes during deactivation:', error);
      }
    }
  }

  // Dispose status bar item
  disposeStatusBarItem();

  console.log('nanodex extension deactivated');
}
