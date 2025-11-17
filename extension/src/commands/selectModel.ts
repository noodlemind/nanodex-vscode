/**
 * Model Selection Command
 */

import * as vscode from 'vscode';
import { isValidModelString, isValidChatStrategy, getAvailableModels, DEFAULT_MODEL } from '../core/modelUtils.js';

/**
 * Show current model configuration
 */
export async function showModelStatusCommand(): Promise<void> {
  const config = vscode.workspace.getConfiguration('nanodex');
  const defaultModel = config.get<string>('defaultModel', DEFAULT_MODEL);
  const chatStrategy = config.get<string>('chat.modelStrategy', 'useChatModel');

  // Runtime validation
  if (!isValidModelString(defaultModel)) {
    await vscode.window.showErrorMessage(`Invalid model configuration: ${defaultModel}`);
    return;
  }

  if (!isValidChatStrategy(chatStrategy)) {
    await vscode.window.showErrorMessage(`Invalid chat strategy: ${chatStrategy}`);
    return;
  }

  const strategyDescription = chatStrategy === 'useChatModel'
    ? 'Using active Chat panel model'
    : `Using configured model: ${defaultModel}`;

  const message = `**Nanodex Model Configuration**

**Plan/Work Commands:** ${defaultModel}
**Chat Participant:** ${strategyDescription}`;

  const selection = await vscode.window.showInformationMessage(
    message,
    { modal: false },
    'Change Model',
    'Change Chat Strategy'
  );

  if (selection === 'Change Model') {
    await selectModelCommand();
  } else if (selection === 'Change Chat Strategy') {
    await selectChatStrategyCommand();
  }
}

/**
 * Select default model for Plan/Work commands
 */
export async function selectModelCommand(): Promise<void> {
  const config = vscode.workspace.getConfiguration('nanodex');
  const currentModel = config.get<string>('defaultModel', DEFAULT_MODEL);

  // Runtime validation
  if (!isValidModelString(currentModel)) {
    console.warn(`Invalid current model: ${currentModel}, using default`);
  }

  const items = getAvailableModels().map(model => ({
    label: model.label,
    description: model.description,
    detail: model.value === currentModel ? '✓ Currently selected' : undefined,
    value: model.value
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select default model for Plan/Work commands',
    matchOnDescription: true
  });

  if (!selected) {
    return; // User cancelled
  }

  try {
    await config.update('defaultModel', selected.value, vscode.ConfigurationTarget.Global);
    await vscode.window.showInformationMessage(`Default model updated to ${selected.label}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`Failed to update model: ${errorMessage}`);
  }
}

/**
 * Select chat model strategy
 */
export async function selectChatStrategyCommand(): Promise<void> {
  const config = vscode.workspace.getConfiguration('nanodex');
  const currentStrategy = config.get<string>('chat.modelStrategy', 'useChatModel');

  const items = [
    {
      label: 'Use Chat Panel Model',
      description: 'Automatically use the active model in VS Code Chat panel',
      detail: currentStrategy === 'useChatModel' ? '✓ Currently selected' : undefined,
      value: 'useChatModel'
    },
    {
      label: 'Use Configured Model',
      description: 'Always use the configured default model',
      detail: currentStrategy === 'useConfiguredModel' ? '✓ Currently selected' : undefined,
      value: 'useConfiguredModel'
    }
  ];

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select chat participant model strategy',
    matchOnDescription: true
  });

  if (!selected) {
    return; // User cancelled
  }

  try {
    await config.update('chat.modelStrategy', selected.value, vscode.ConfigurationTarget.Global);
    await vscode.window.showInformationMessage(`Chat model strategy updated to: ${selected.label}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`Failed to update strategy: ${errorMessage}`);
  }
}
