/**
 * Review command implementation using flow engine
 */

import * as vscode from 'vscode';
import { runFlowCommand } from '../core/flowCommandRunner.js';
import { createTodo } from '../core/todos.js';
import { ensureNanodexStructure } from '../core/workspace.js';

export async function reviewCommand(context: vscode.ExtensionContext): Promise<void> {
  // Get PR number or URL from user
  const prInput = await vscode.window.showInputBox({
    prompt: 'Enter PR number or GitHub URL',
    placeHolder: 'e.g., 123 or https://github.com/owner/repo/pull/123',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Please enter a PR number or URL';
      }
      return null;
    }
  });

  if (!prInput) {
    return; // User cancelled
  }

  // Extract PR number from input (handle both number and URL)
  let prNumber: string;
  const urlMatch = prInput.match(/\/pull\/(\d+)/);
  if (urlMatch) {
    prNumber = urlMatch[1];
  } else {
    prNumber = prInput.trim();
  }

  await runFlowCommand({
    flowId: 'nanodex.flow.review',
    context,
    title: `Reviewing PR #${prNumber}`,
    getInputs: async () => ({
      pr: prNumber,
      prUrl: prInput.includes('github.com') ? prInput : ''
    }),
    handleResult: async (result, workspaceRoot) => {
      // Ensure .nanodex structure exists
      await ensureNanodexStructure(workspaceRoot);

      // Parse review findings from the flow output
      // The flow should output review comments and findings
      const output = result.finalOutput;

      // Split output into sections (look for headers or numbered items)
      const sectionMatches = output.match(/(?:^|\n)(?:##\s+(.+?)(?=\n##|\n\n|$)|(\d+)\.\s*(.+?)(?=\n\d+\.|\n\n|$))/gs);

      if (!sectionMatches || sectionMatches.length === 0) {
        // Create single TODO with all review content
        await createTodo(
          workspaceRoot,
          `Review PR #${prNumber}`,
          output,
          {
            priority: 'high',
            tags: ['review', `pr-${prNumber}`]
          }
        );

        vscode.window.showInformationMessage('Review complete: 1 TODO created');
        return;
      }

      // Create TODOs for each review finding
      let createdCount = 0;

      for (const sectionMatch of sectionMatches) {
        const section = sectionMatch.trim();

        // Extract title and description
        const lines = section.split('\n').map(l => l.trim()).filter(l => l);
        const titleLine = lines[0].replace(/^(##\s*|\d+\.\s*)/, '');
        const title = `PR #${prNumber}: ${titleLine.substring(0, 80)}`;
        const description = lines.slice(1).join('\n') || titleLine;

        await createTodo(
          workspaceRoot,
          title,
          description,
          {
            priority: 'high',
            tags: ['review', `pr-${prNumber}`]
          }
        );
        createdCount++;
      }

      vscode.window.showInformationMessage(
        `Review complete: ${createdCount} TODO${createdCount !== 1 ? 's' : ''} created`
      );
    }
  });
}
