/**
 * Status Bar UI Component
 *
 * This module manages a status bar item that displays the current nanodex model
 * configuration and provides quick access to model settings.
 *
 * @module statusBar
 */

import * as vscode from 'vscode';
import { formatModelForStatusBar, DEFAULT_MODEL } from '../core/modelUtils.js';

/**
 * Priority for status bar placement.
 * Higher values position the item more to the left when using Right alignment.
 *
 * @constant
 */
const STATUS_BAR_PRIORITY = 100;

/**
 * The active status bar item instance.
 * @internal
 */
let statusBarItem: vscode.StatusBarItem | undefined;

/**
 * Create and show the nanodex status bar item.
 *
 * The status bar item displays the current model configuration and updates
 * automatically when settings change. Clicking the item opens model configuration.
 *
 * This function includes a resource leak guard - if called multiple times,
 * it will dispose the old instance before creating a new one.
 *
 * @param context - Extension context for managing subscriptions
 *
 * @example
 * ```typescript
 * export function activate(context: vscode.ExtensionContext): void {
 *   createStatusBarItem(context);
 * }
 * ```
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
 * Update status bar item text and tooltip based on current configuration.
 *
 * Reads the current model configuration and updates the status bar display.
 * Called automatically when configuration changes.
 *
 * @internal
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
 * Dispose the status bar item and clean up resources.
 *
 * Should be called during extension deactivation to properly clean up UI resources.
 *
 * @example
 * ```typescript
 * export function deactivate(): void {
 *   disposeStatusBarItem();
 * }
 * ```
 */
export function disposeStatusBarItem(): void {
  statusBarItem?.dispose();
  statusBarItem = undefined;
}
