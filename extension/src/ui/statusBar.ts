/**
 * Status Bar UI Component
 */

import * as vscode from 'vscode';
import { formatModelForStatusBar, DEFAULT_MODEL } from '../core/modelUtils.js';

// Priority for status bar placement (higher = more to the left in Right alignment)
const STATUS_BAR_PRIORITY = 100;

let statusBarItem: vscode.StatusBarItem | undefined;

/**
 * Create and show status bar item
 */
export function createStatusBarItem(context: vscode.ExtensionContext): void {
  // Guard against resource leak - dispose old instance if it exists
  if (statusBarItem) {
    console.warn('Status bar item already exists, disposing old instance');
    statusBarItem.dispose();
  }

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    STATUS_BAR_PRIORITY
  );

  statusBarItem.command = 'nanodex.showModelStatus';
  updateStatusBarItem();

  context.subscriptions.push(statusBarItem);
  statusBarItem.show();

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('nanodex.defaultModel') ||
          event.affectsConfiguration('nanodex.chat.modelStrategy')) {
        updateStatusBarItem();
      }
    })
  );
}

/**
 * Update status bar item text
 */
function updateStatusBarItem(): void {
  if (!statusBarItem) {
    return;
  }

  const config = vscode.workspace.getConfiguration('nanodex');
  const defaultModel = config.get<string>('defaultModel', DEFAULT_MODEL);

  const formatted = formatModelForStatusBar(defaultModel);
  statusBarItem.text = formatted.text;
  statusBarItem.tooltip = formatted.tooltip;
}

/**
 * Dispose status bar item
 */
export function disposeStatusBarItem(): void {
  statusBarItem?.dispose();
  statusBarItem = undefined;
}
