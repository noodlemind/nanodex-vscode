/**
 * Issues Tool - Language Model Tool for listing nanodex issues
 */

import * as vscode from 'vscode';
import { listIssues } from '../core/issues.js';
import { IssuesToolInput } from '../core/types.js';
import {
  getWorkspaceContext,
  isErrorResult,
  formatToolError,
  createSuccessResult,
  createErrorResult,
  checkCancellation
} from './utils.js';

export class NanodexIssuesTool implements vscode.LanguageModelTool<IssuesToolInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IssuesToolInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { status = 'all' } = options.input;

    // Check cancellation
    const cancelled = checkCancellation(token);
    if (cancelled) return cancelled;

    // Get workspace context
    const wsContext = getWorkspaceContext();
    if (isErrorResult(wsContext)) {
      return wsContext;
    }

    try {
      // List all issues
      const allIssues = await listIssues(wsContext.workspaceRoot);

      // Check cancellation after async operation
      if (token.isCancellationRequested) {
        return createErrorResult('Operation cancelled.');
      }

      // Filter by status if not 'all'
      const filteredIssues = status === 'all'
        ? allIssues
        : allIssues.filter(issue => issue.status === status);

      if (filteredIssues.length === 0) {
        const statusMsg = status === 'all' ? '' : ` with status "${status}"`;
        return createErrorResult(
          `No issues found${statusMsg}. You can create a new plan using the "Nanodex: Plan" command (nanodex.plan).`
        );
      }

      // Format issues as markdown
      const results: string[] = [];

      // Summary
      if (status === 'all') {
        const pending = allIssues.filter(i => i.status === 'pending').length;
        const inProgress = allIssues.filter(i => i.status === 'in_progress').length;
        const completed = allIssues.filter(i => i.status === 'completed').length;

        results.push(`## Issues Summary\n`);
        results.push(`Total: ${allIssues.length} | Pending: ${pending} | In Progress: ${inProgress} | Completed: ${completed}\n`);
      } else {
        results.push(`## ${status.replace('_', ' ').toUpperCase()} Issues (${filteredIssues.length})\n`);
      }

      // List issues
      for (const issue of filteredIssues) {
        results.push(`\n### ${issue.id}: ${issue.title}`);
        results.push(`- Status: ${issue.status}`);
        results.push(`- Created: ${new Date(issue.createdAt).toLocaleDateString()}`);
        results.push(`- Goal: ${issue.goal}`);

        if (issue.acceptanceCriteria && issue.acceptanceCriteria.length > 0) {
          results.push(`- Acceptance Criteria: ${issue.acceptanceCriteria.length} items`);
        }

        if (issue.plan) {
          const planPreview = issue.plan.length > 100
            ? issue.plan.substring(0, 100) + '...'
            : issue.plan;
          results.push(`- Plan: ${planPreview}`);
        }
      }

      return createSuccessResult(results.join('\n'));
    } catch (error) {
      return formatToolError('listing issues', error);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<IssuesToolInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { status = 'all' } = options.input;
    const statusMsg = status === 'all' ? 'all' : status;
    return {
      invocationMessage: `Listing ${statusMsg} nanodex issues`
    };
  }
}
