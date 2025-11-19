/**
 * Work command implementation using flow engine
 */

import * as vscode from 'vscode';
import { loadIssue, updateIssueStatus, listIssues } from '../core/issues.js';
import { loadInstructions } from '../core/prompts.js';
import { loadFlowDefinition, executeFlow, findFlowFile } from '../core/flowEngine.js';

/**
 * Select issue to work on
 */
async function selectIssue(workspaceRoot: string): Promise<string | undefined> {
  const issues = await listIssues(workspaceRoot);

  if (issues.length === 0) {
    vscode.window.showWarningMessage('No issues found. Create a plan first using "Nanodex: Plan".');
    return undefined;
  }

  // Filter to pending issues
  const pendingIssues = issues.filter(i => i.status === 'pending');

  if (pendingIssues.length === 0) {
    vscode.window.showWarningMessage('No pending issues found.');
    return undefined;
  }

  // Show quick pick
  const items = pendingIssues.map(issue => ({
    label: issue.id,
    description: issue.title,
    detail: issue.goal,
    issueId: issue.id
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select an issue to work on',
    matchOnDescription: true,
    matchOnDetail: true
  });

  return selected?.issueId;
}

export async function workCommand(context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  try {
    // Step 1: Select issue
    const issueId = await selectIssue(workspaceFolder.uri.fsPath);

    if (!issueId) {
      return; // User cancelled
    }

    // Step 2: Load issue
    const issue = await loadIssue(workspaceFolder.uri.fsPath, issueId);

    if (!issue) {
      vscode.window.showErrorMessage(`Issue ${issueId} not found`);
      return;
    }

    if (!issue.plan) {
      vscode.window.showErrorMessage(`Issue ${issueId} has no plan. Run "Nanodex: Plan" first.`);
      return;
    }

    // Update status to in_progress
    await updateIssueStatus(workspaceFolder.uri.fsPath, issueId, 'in_progress');

    // Step 3: Execute work flow
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Working on ${issueId}`,
        cancellable: false
      },
      async (progress) => {
        progress.report({ message: 'Loading flow definition...' });

        // Load work.flow.yaml
        const flowPath = findFlowFile('nanodex.flow.work', context.extensionPath);
        if (!flowPath) {
          throw new Error('Work flow definition not found');
        }

        const flow = loadFlowDefinition(flowPath);
        if (!flow) {
          throw new Error('Failed to load work flow definition');
        }

        console.log(`[work] Loaded flow: ${flow.id} with ${flow.steps.length} steps`);

        progress.report({ message: 'Loading instructions and agents...' });

        // Load instructions and agents
        const instructions = await loadInstructions(workspaceFolder.uri.fsPath);

        console.log(`[work] Loaded ${instructions.agents.size} agents`);

        // Prepare document for flow
        // The work flow expects a "document" input containing the full issue details
        const documentParts = [
          `# ${issue.title}`,
          '',
          `**Issue ID:** ${issueId}`,
          `**Status:** ${issue.status}`,
          '',
          `## Goal`,
          issue.goal,
          ''
        ];

        if (issue.acceptanceCriteria && issue.acceptanceCriteria.length > 0) {
          documentParts.push('## Acceptance Criteria');
          documentParts.push(...issue.acceptanceCriteria.map(c => `- ${c}`));
          documentParts.push('');
        }

        if (issue.constraints && issue.constraints.length > 0) {
          documentParts.push('## Constraints');
          documentParts.push(...issue.constraints.map(c => `- ${c}`));
          documentParts.push('');
        }

        if (issue.plan) {
          documentParts.push('## Plan');
          documentParts.push(issue.plan);
          documentParts.push('');
        }

        const document = documentParts.join('\n');

        // Execute flow with document input
        try {
          const result = await executeFlow(flow, {
            workspaceRoot: workspaceFolder.uri.fsPath,
            agents: instructions.agents,
            userInputs: { document },
            progress
          });

          progress.report({ message: 'Work completed!' });

          // Mark issue as completed
          await updateIssueStatus(workspaceFolder.uri.fsPath, issueId, 'completed');

          // Show success message
          const selection = await vscode.window.showInformationMessage(
            `Work completed for ${issueId}`,
            'View Issue',
            'Close'
          );

          if (selection === 'View Issue') {
            const issuePath = require('path').join(workspaceFolder.uri.fsPath, '.nanodex', 'issues', `${issueId}.yml`);
            const document = await vscode.workspace.openTextDocument(issuePath);
            await vscode.window.showTextDocument(document);
          }
        } catch (flowError) {
          console.error('[work] Flow execution error:', flowError);
          // Reset issue status on flow error
          await updateIssueStatus(workspaceFolder.uri.fsPath, issueId, 'pending');
          throw flowError;
        }
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to work on issue: ${errorMessage}`);
    console.error('[work] Error:', error);
  }
}
