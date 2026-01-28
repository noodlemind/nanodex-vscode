/**
 * Update Issue Status Tool - Language Model Tool for updating issue status
 */

import * as vscode from 'vscode';
import { updateIssueStatus, loadIssue } from '../core/issues.js';
import { UpdateIssueStatusInput } from '../core/types.js';
import {
  getWorkspaceContext,
  isErrorResult,
  formatToolError,
  createSuccessResult,
  createErrorResult,
  checkCancellation,
  validateId
} from './utils.js';

export class NanodexUpdateIssueStatusTool implements vscode.LanguageModelTool<UpdateIssueStatusInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<UpdateIssueStatusInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { issueId, status } = options.input;

    // Check cancellation
    const cancelled = checkCancellation(token);
    if (cancelled) return cancelled;

    // Validate issue ID format (defense-in-depth)
    const idError = validateId(issueId, 'Issue');
    if (idError) return idError;

    // Validate status
    const validStatuses = ['pending', 'in_progress', 'completed'];
    if (!validStatuses.includes(status)) {
      return createErrorResult(
        `Invalid status "${status}". Valid values are: ${validStatuses.join(', ')}`
      );
    }

    // Get workspace context
    const wsContext = getWorkspaceContext();
    if (isErrorResult(wsContext)) {
      return wsContext;
    }

    try {
      // First check if issue exists
      const existingIssue = await loadIssue(wsContext.workspaceRoot, issueId);

      if (!existingIssue) {
        return createErrorResult(
          `Issue "${issueId}" not found. Use "nanodex-list-issues" to see available issues.`
        );
      }

      // Check cancellation
      if (token.isCancellationRequested) {
        return createErrorResult('Operation cancelled.');
      }

      const previousStatus = existingIssue.status;

      // Update the status
      await updateIssueStatus(wsContext.workspaceRoot, issueId, status);

      // Check cancellation after update
      if (token.isCancellationRequested) {
        return createErrorResult('Operation cancelled.');
      }

      // Format success response
      const results: string[] = [];
      results.push(`## Issue Status Updated\n`);
      results.push(`**Issue:** ${issueId}`);
      results.push(`**Title:** ${existingIssue.title}`);
      results.push(`**Previous Status:** ${previousStatus}`);
      results.push(`**New Status:** ${status}`);

      // Add helpful next steps based on new status
      if (status === 'in_progress') {
        results.push(`\n### Next Steps`);
        results.push(`- Review the issue details with "nanodex-get-issue"`);
        results.push(`- Use "nanodex-query-graph" to understand related code`);
        results.push(`- When done, update status to "completed"`);
      } else if (status === 'completed') {
        results.push(`\n### Issue Completed`);
        results.push(`The issue has been marked as completed.`);
      } else if (status === 'pending') {
        results.push(`\n### Issue Pending`);
        results.push(`The issue is ready to be worked on.`);
      }

      return createSuccessResult(results.join('\n'));
    } catch (error) {
      return formatToolError('updating issue status', error);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<UpdateIssueStatusInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { issueId, status } = options.input;
    return {
      invocationMessage: `Updating issue ${issueId} status to: ${status}`
    };
  }
}
