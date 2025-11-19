/**
 * Plan command implementation using flow engine
 */

import * as vscode from 'vscode';
import { createIssue, getIssuePath } from '../core/issues.js';
import { runFlowCommand } from '../core/flowCommandRunner.js';

export async function planCommand(context: vscode.ExtensionContext): Promise<void> {
  // Get user goal first (before progress dialog)
  const goal = await vscode.window.showInputBox({
    prompt: 'What do you want to implement?',
    placeHolder: 'e.g., Add user authentication with JWT',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Please enter a goal';
      }
      return null;
    }
  });

  if (!goal) {
    return; // User cancelled
  }

  await runFlowCommand({
    flowId: 'nanodex.flow.plan',
    context,
    title: 'Creating plan',
    getInputs: async () => ({ goal }),
    handleResult: async (result, workspaceRoot) => {
      // Create issue with plan
      const issue = await createIssue(
        workspaceRoot,
        goal,
        goal,
        result.finalOutput,
        {
          flow: 'nanodex.flow.plan',
          steps: result.stepResults.map(r => ({
            name: r.stepName,
            agent: r.agentId
          }))
        }
      );

      // Show success message with option to open issue
      const selection = await vscode.window.showInformationMessage(
        `Plan created: ${issue.id}`,
        'Open Issue',
        'Close'
      );

      if (selection === 'Open Issue') {
        const issueFilePath = getIssuePath(workspaceRoot, issue.id);
        const document = await vscode.workspace.openTextDocument(issueFilePath);
        await vscode.window.showTextDocument(document);
      }
    }
  });
}

