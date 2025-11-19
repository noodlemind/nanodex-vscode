/**
 * Triage command implementation using flow engine
 */

import * as vscode from 'vscode';
import { runFlowCommand } from '../core/flowCommandRunner.js';
import { createTodo } from '../core/todos.js';
import { ensureNanodexStructure } from '../core/workspace.js';

export async function triageCommand(context: vscode.ExtensionContext): Promise<void> {
  // Get context/findings from user
  const findings = await vscode.window.showInputBox({
    prompt: 'What findings or decisions need triage?',
    placeHolder: 'e.g., Code review findings, design decisions, technical debt items',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Please enter findings to triage';
      }
      return null;
    }
  });

  if (!findings) {
    return; // User cancelled
  }

  await runFlowCommand({
    flowId: 'nanodex.flow.triage',
    context,
    title: 'Triaging findings',
    getInputs: async () => ({ findings }),
    handleResult: async (result, workspaceRoot) => {
      // Ensure .nanodex structure exists
      await ensureNanodexStructure(workspaceRoot);

      // Parse the triage results
      // The flow should output a list of findings/decisions with recommendations
      const output = result.finalOutput;

      // Split output into individual findings (look for numbered lists or sections)
      const findingMatches = output.match(/(?:^|\n)(?:\d+\.|[-*])\s*(.+?)(?=\n(?:\d+\.|[-*])\s*|\n\n|$)/gs);

      if (!findingMatches || findingMatches.length === 0) {
        // If no structured findings found, create one TODO with all content
        await createTodo(
          workspaceRoot,
          'Triage Results',
          output,
          {
            priority: 'medium',
            tags: ['triage']
          }
        );

        vscode.window.showInformationMessage('Triage complete: 1 TODO created');
        return;
      }

      // Create TODOs for each finding interactively
      let createdCount = 0;

      for (const findingMatch of findingMatches) {
        const finding = findingMatch.trim();

        // Extract title (first line) and description (rest)
        const lines = finding.split('\n').map(l => l.trim()).filter(l => l);
        const title = lines[0].replace(/^(\d+\.|-|\*)\s*/, '').substring(0, 100);
        const description = lines.slice(1).join('\n') || title;

        // Ask user if they want to create a TODO for this finding
        const action = await vscode.window.showQuickPick(
          [
            { label: 'Create TODO', value: 'create' },
            { label: 'Skip', value: 'skip' },
            { label: 'Cancel Triage', value: 'cancel' }
          ],
          {
            placeHolder: `Create TODO for: ${title}?`,
            ignoreFocusOut: true
          }
        );

        if (action?.value === 'cancel') {
          break;
        }

        if (action?.value === 'create') {
          await createTodo(
            workspaceRoot,
            title,
            description,
            {
              priority: 'medium',
              tags: ['triage']
            }
          );
          createdCount++;
        }
      }

      vscode.window.showInformationMessage(
        `Triage complete: ${createdCount} TODO${createdCount !== 1 ? 's' : ''} created`
      );
    }
  });
}
