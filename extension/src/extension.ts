import * as vscode from 'vscode';
import { indexWorkspaceCommand } from './commands/index.js';
import { clearIndexCommand } from './commands/clear.js';
import { graphStatsCommand } from './commands/stats.js';

export function activate(context: vscode.ExtensionContext): void {
  console.log('nanodex extension is now active');

  // Register Plan command
  const planCommand = vscode.commands.registerCommand('nanodex.plan', async () => {
    vscode.window.showInformationMessage('Nanodex: Plan command (not yet implemented)');
  });

  // Register Work command
  const workCommand = vscode.commands.registerCommand('nanodex.work', async () => {
    vscode.window.showInformationMessage('Nanodex: Work command (not yet implemented)');
  });

  // Register Index Workspace command
  const indexCommand = vscode.commands.registerCommand('nanodex.index', indexWorkspaceCommand);

  // Register Clear Index command
  const clearCommand = vscode.commands.registerCommand('nanodex.clear', clearIndexCommand);

  // Register Graph Stats command
  const statsCommand = vscode.commands.registerCommand('nanodex.stats', graphStatsCommand);

  context.subscriptions.push(
    planCommand,
    workCommand,
    indexCommand,
    clearCommand,
    statsCommand
  );
}

export function deactivate(): void {
  console.log('nanodex extension is now deactivated');
}
