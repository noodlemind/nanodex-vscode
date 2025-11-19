/**
 * Plan command implementation using flow engine
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { createIssue, getIssuePath } from '../core/issues.js';
import { loadInstructions } from '../core/prompts.js';
import { loadFlowDefinition, executeFlow, findFlowFile } from '../core/flowEngine.js';

export async function planCommand(context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  try {
    // Step 1: Get user goal
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

    // Step 2: Execute flow
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Creating plan',
        cancellable: false
      },
      async (progress) => {
        progress.report({ message: 'Loading flow definition...' });

        // Load plan.flow.yaml
        const flowPath = findFlowFile('nanodex.flow.plan', context.extensionPath);
        if (!flowPath) {
          throw new Error('Plan flow definition not found');
        }

        const flow = loadFlowDefinition(flowPath);
        if (!flow) {
          throw new Error('Failed to load plan flow definition');
        }

        console.log(`[plan] Loaded flow: ${flow.id} with ${flow.steps.length} steps`);

        progress.report({ message: 'Loading instructions and agents...' });

        // Load instructions and agents
        const instructions = await loadInstructions(workspaceFolder.uri.fsPath);

        console.log(`[plan] Loaded ${instructions.agents.size} agents`);

        // Execute flow
        const result = await executeFlow(flow, {
          workspaceRoot: workspaceFolder.uri.fsPath,
          agents: instructions.agents,
          userInputs: { goal },
          progress
        });

        progress.report({ message: 'Saving issue...' });

        // Create issue with plan
        const issue = await createIssue(
          workspaceFolder.uri.fsPath,
          goal,
          goal,
          result.finalOutput,
          {
            flow: flow.id,
            steps: result.stepResults.map(r => ({
              name: r.stepName,
              agent: r.agentId
            }))
          }
        );

        progress.report({ message: 'Complete!' });

        // Show success message with option to open issue
        const selection = await vscode.window.showInformationMessage(
          `Plan created: ${issue.id}`,
          'Open Issue',
          'Close'
        );

        if (selection === 'Open Issue') {
          const issueFilePath = getIssuePath(workspaceFolder.uri.fsPath, issue.id);
          const document = await vscode.workspace.openTextDocument(issueFilePath);
          await vscode.window.showTextDocument(document);
        }
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to create plan: ${errorMessage}`);
    console.error('[plan] Error:', error);
  }
}

