import * as vscode from 'vscode';

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
  const indexCommand = vscode.commands.registerCommand('nanodex.index', async () => {
    vscode.window.showInformationMessage('Nanodex: Index Workspace command (not yet implemented)');
  });

  // Register Clear Index command
  const clearCommand = vscode.commands.registerCommand('nanodex.clear', async () => {
    vscode.window.showInformationMessage('Nanodex: Clear Index command (not yet implemented)');
  });

  // Register Graph Stats command
  const statsCommand = vscode.commands.registerCommand('nanodex.stats', async () => {
    vscode.window.showInformationMessage('Nanodex: Graph Stats command (not yet implemented)');
  });

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
