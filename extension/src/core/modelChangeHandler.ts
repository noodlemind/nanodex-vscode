/**
 * Language Model Change Handler
 *
 * Listens for changes to available language models and handles updates.
 */

import * as vscode from 'vscode';
import { getAvailableModelsFromAPI, isValidModelString } from './modelUtils.js';

/**
 * Register handler for language model availability changes
 */
export function registerModelChangeHandler(context: vscode.ExtensionContext): void {
  try {
    // Check if vscode.lm API is available
    if (!vscode.lm || !vscode.lm.onDidChangeChatModels) {
      console.warn('[nanodex] vscode.lm.onDidChangeChatModels API not available');
      return;
    }

    // Subscribe to model changes
    const disposable = vscode.lm.onDidChangeChatModels(async () => {
      console.log('[nanodex] Available language models changed, refreshing...');

      try {
        // Query updated model list
        const models = await getAvailableModelsFromAPI();
        console.log(`[nanodex] Now ${models.length} language model(s) available`);

        // Check if currently configured model is still available
        const config = vscode.workspace.getConfiguration('nanodex');
        const currentModel = config.get<string>('defaultModel');

        if (currentModel && isValidModelString(currentModel)) {
          const isCurrentModelAvailable = models.some(m => m.value === currentModel);

          if (!isCurrentModelAvailable && models.length > 0) {
            console.warn(`[nanodex] Configured model ${currentModel} is no longer available`);

            // Show notification to user
            const selection = await vscode.window.showWarningMessage(
              `Your configured model "${currentModel}" is no longer available. Would you like to select a new model?`,
              'Select Model',
              'Dismiss'
            );

            if (selection === 'Select Model') {
              vscode.commands.executeCommand('nanodex.selectModel');
            }
          }
        }
      } catch (error) {
        console.error('[nanodex] Failed to refresh models after change event:', error);
      }
    });

    context.subscriptions.push(disposable);
    console.log('[nanodex] Model change listener registered successfully');
  } catch (error) {
    console.error('[nanodex] Failed to register model change listener:', error);
  }
}
