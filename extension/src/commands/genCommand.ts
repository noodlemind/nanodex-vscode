/**
 * Generate custom command implementation using flow engine
 */

import * as vscode from 'vscode';
import { runFlowCommand } from '../core/flowCommandRunner.js';
import { saveCommand } from '../core/commands.js';
import { ensureNanodexStructure } from '../core/workspace.js';

export async function genCommandCommand(context: vscode.ExtensionContext): Promise<void> {
  // Get command goal from user
  const goal = await vscode.window.showInputBox({
    prompt: 'What should this custom command do?',
    placeHolder: 'e.g., Generate API documentation from OpenAPI spec',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Please enter a goal for the command';
      }
      return null;
    }
  });

  if (!goal) {
    return; // User cancelled
  }

  await runFlowCommand({
    flowId: 'nanodex.flow.gen-command',
    context,
    title: 'Generating command',
    getInputs: async () => ({ goal }),
    handleResult: async (result, workspaceRoot) => {
      // Ensure .nanodex structure exists
      await ensureNanodexStructure(workspaceRoot);

      // Parse the generated command from the flow output
      // The flow should output: command name, description, and prompt
      const output = result.finalOutput;

      // Extract command name (look for markdown header)
      const nameMatch = output.match(/^#\s+(.+)$/m);
      const commandName = nameMatch ? nameMatch[1].trim().toLowerCase().replace(/\s+/g, '-') : 'custom-command';

      // Extract description
      const descMatch = output.match(/\*\*Description:\*\*\s*(.+)/);
      const description = descMatch ? descMatch[1].trim() : goal;

      // The prompt is the main content (everything after metadata)
      let prompt = output;

      // Try to clean up the prompt by removing metadata sections
      const promptStart = output.indexOf('---');
      if (promptStart >= 0) {
        prompt = output.substring(promptStart + 3).trim();
      }

      // Save the command
      const commandPath = await saveCommand(
        workspaceRoot,
        commandName,
        description,
        prompt
      );

      // Show success message
      const selection = await vscode.window.showInformationMessage(
        `Command created: ${commandName}`,
        'Open Command',
        'Close'
      );

      if (selection === 'Open Command') {
        const document = await vscode.workspace.openTextDocument(commandPath);
        await vscode.window.showTextDocument(document);
      }
    }
  });
}
