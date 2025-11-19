/**
 * Dynamic custom flow registration
 * 
 * Discovers and registers custom flows as VS Code commands at activation
 */

import * as vscode from 'vscode';
import { discoverCustomFlows, CustomFlowMetadata, getFlowCommandName } from './customFlows.js';
import { runFlowCommand } from './flowCommandRunner.js';

/**
 * Register all custom flows as commands
 */
export async function registerCustomFlows(
  context: vscode.ExtensionContext,
  workspaceRoot: string
): Promise<number> {
  console.log('Discovering custom flows...');
  
  try {
    const customFlows = await discoverCustomFlows(workspaceRoot);
    
    if (customFlows.length === 0) {
      console.log('No custom flows found');
      return 0;
    }

    console.log(`Found ${customFlows.length} custom flow(s)`);

    // Register each custom flow as a command
    for (const flow of customFlows) {
      try {
        registerCustomFlowCommand(context, flow);
        console.log(`Registered custom flow: ${flow.id}`);
      } catch (error) {
        console.error(`Failed to register custom flow ${flow.id}:`, error);
      }
    }

    return customFlows.length;
  } catch (error) {
    console.error('Failed to discover custom flows:', error);
    return 0;
  }
}

/**
 * Register a single custom flow as a command
 */
function registerCustomFlowCommand(
  context: vscode.ExtensionContext,
  flow: CustomFlowMetadata
): void {
  // Create command ID from flow ID
  const commandId = `nanodex.customFlow.${flow.id}`;
  
  // Register the command
  const command = vscode.commands.registerCommand(commandId, async () => {
    await executeCustomFlow(context, flow);
  });

  context.subscriptions.push(command);

  // Note: To make the command appear in the Command Palette, we would need to
  // modify package.json dynamically, which isn't possible. Users need to 
  // execute custom flows via:
  // 1. Command: vscode.commands.executeCommand(commandId)
  // 2. Chat: @nanodex /<flow-chat-command>
  // 3. Or we create a "Run Custom Flow" command that shows a picker
}

/**
 * Execute a custom flow
 */
async function executeCustomFlow(
  context: vscode.ExtensionContext,
  flow: CustomFlowMetadata
): Promise<void> {
  // Collect required inputs
  const inputs: Record<string, string> = {};
  
  if (flow.definition.inputs) {
    for (const input of flow.definition.inputs) {
      if (input.required) {
        const value = await vscode.window.showInputBox({
          prompt: input.description || `Enter ${input.name}`,
          placeHolder: input.name,
          validateInput: (v) => {
            if (!v || v.trim().length === 0) {
              return `${input.name} is required`;
            }
            return null;
          }
        });

        if (!value) {
          return; // User cancelled
        }

        inputs[input.name] = value;
      }
    }
  }

  // Run the flow
  await runFlowCommand({
    flowId: flow.id,
    context,
    title: `Running ${flow.name}`,
    getInputs: async () => inputs,
    handleResult: async (result) => {
      // Show results
      const doc = await vscode.workspace.openTextDocument({
        content: result.finalOutput,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc);
    }
  });
}

/**
 * Create a "Run Custom Flow" picker command
 */
export async function runCustomFlowPicker(
  context: vscode.ExtensionContext,
  workspaceRoot: string
): Promise<void> {
  const customFlows = await discoverCustomFlows(workspaceRoot);

  if (customFlows.length === 0) {
    vscode.window.showInformationMessage(
      'No custom flows found. Create one with "Nanodex: Create Custom Flow"'
    );
    return;
  }

  // Show quick pick
  const selected = await vscode.window.showQuickPick(
    customFlows.map(flow => ({
      label: flow.name,
      description: flow.description,
      detail: `Flow ID: ${flow.id}`,
      flow
    })),
    {
      placeHolder: 'Select a custom flow to run'
    }
  );

  if (!selected) {
    return;
  }

  // Execute the selected flow
  await executeCustomFlow(context, selected.flow);
}
