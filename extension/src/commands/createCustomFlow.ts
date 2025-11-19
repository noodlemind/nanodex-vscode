/**
 * Create Custom Flow command implementation
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { createFlowTemplate } from '../core/customFlows.js';

export async function createCustomFlowCommand(context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  // Get flow name
  const flowName = await vscode.window.showInputBox({
    prompt: 'Enter a name for your custom flow',
    placeHolder: 'e.g., Security Audit, Performance Review',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Flow name is required';
      }
      if (value.length < 3) {
        return 'Flow name must be at least 3 characters';
      }
      return null;
    }
  });

  if (!flowName) {
    return; // User cancelled
  }

  // Get flow intent/description
  const intent = await vscode.window.showInputBox({
    prompt: 'Describe what this flow does',
    placeHolder: 'e.g., Perform comprehensive security audit of codebase',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Flow description is required';
      }
      return null;
    }
  });

  if (!intent) {
    return; // User cancelled
  }

  // Ask where to save the flow
  const location = await vscode.window.showQuickPick(
    [
      {
        label: '.nanodex/flows/',
        description: 'Recommended - Workspace-specific flows',
        value: '.nanodex/flows'
      },
      {
        label: 'flows/',
        description: 'Alternative location',
        value: 'flows'
      }
    ],
    {
      placeHolder: 'Where should the flow be saved?'
    }
  );

  if (!location) {
    return; // User cancelled
  }

  // Generate file name
  const fileName = `${flowName.toLowerCase().replace(/\s+/g, '-')}.flow.yaml`;
  const targetPath = path.join(workspaceRoot, location.value, fileName);

  try {
    // Create the flow template
    await createFlowTemplate(targetPath, flowName, intent);

    // Show success message and offer to open the file
    const selection = await vscode.window.showInformationMessage(
      `Custom flow created: ${fileName}`,
      'Open Flow',
      'View Documentation'
    );

    if (selection === 'Open Flow') {
      const document = await vscode.workspace.openTextDocument(targetPath);
      await vscode.window.showTextDocument(document);
    } else if (selection === 'View Documentation') {
      // Open flow documentation
      vscode.env.openExternal(vscode.Uri.parse(
        'https://github.com/noodlemind/nanodex-vscode#custom-flows'
      ));
    }

    // Inform user about next steps
    vscode.window.showInformationMessage(
      'Flow template created! Edit the file to customize steps and agents. The flow will be automatically discovered on restart.',
      'Got it'
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to create flow: ${error}`);
  }
}
