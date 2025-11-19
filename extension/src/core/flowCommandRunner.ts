/**
 * Flow command runner - reduces boilerplate for flow-based commands
 */

import * as vscode from 'vscode';
import { loadInstructions } from './prompts.js';
import { loadFlowDefinition, executeFlow, findFlowFile, FlowExecutionResult } from './flowEngine.js';

export interface FlowCommandOptions {
  flowId: string;
  context: vscode.ExtensionContext;
  title: string;
  getInputs: (workspaceRoot: string) => Promise<Record<string, string>>;
  handleResult: (result: FlowExecutionResult, workspaceRoot: string) => Promise<void>;
}

/**
 * Execute a flow command with common setup/teardown
 */
export async function runFlowCommand(options: FlowCommandOptions): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: options.title,
        cancellable: false
      },
      async (progress) => {
        progress.report({ message: 'Loading flow definition...' });

        // Load flow
        const flowPath = findFlowFile(options.flowId, options.context.extensionPath);
        if (!flowPath) {
          throw new Error(`Flow definition not found: ${options.flowId}`);
        }

        const flow = loadFlowDefinition(flowPath);
        if (!flow) {
          throw new Error(`Failed to load flow definition: ${options.flowId}`);
        }

        console.log(`[flowCommand] Loaded flow: ${flow.id} with ${flow.steps.length} steps`);

        progress.report({ message: 'Loading instructions and agents...' });

        // Load instructions and agents
        const instructions = await loadInstructions(workspaceRoot);
        console.log(`[flowCommand] Loaded ${instructions.agents.size} agents`);

        // Get user inputs
        progress.report({ message: 'Preparing inputs...' });
        const userInputs = await options.getInputs(workspaceRoot);

        // Execute flow
        const result = await executeFlow(flow, {
          workspaceRoot,
          agents: instructions.agents,
          userInputs,
          progress
        });

        progress.report({ message: 'Processing results...' });

        // Handle results
        await options.handleResult(result, workspaceRoot);

        progress.report({ message: 'Complete!' });
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`${options.title} failed: ${errorMessage}`);
    console.error(`[flowCommand] ${options.flowId} error:`, error);
    throw error;
  }
}
