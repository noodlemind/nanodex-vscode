/**
 * Delete Issue Tool - Language Model Tool for deleting issues
 */

import * as vscode from 'vscode';
import { deleteIssue, loadIssue } from '../core/issues.js';
import { DeleteIssueInput } from '../core/types.js';
import {
  getWorkspaceContext,
  isErrorResult,
  formatToolError,
  createSuccessResult,
  createErrorResult,
  checkCancellation,
  validateId
} from './utils.js';

export class NanodexDeleteIssueTool implements vscode.LanguageModelTool<DeleteIssueInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<DeleteIssueInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { issueId } = options.input;

    // Check cancellation
    const cancelled = checkCancellation(token);
    if (cancelled) return cancelled;

    // Validate issue ID format (defense-in-depth)
    const idError = validateId(issueId, 'Issue');
    if (idError) return idError;

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

      // Check cancellation before destructive operation
      if (token.isCancellationRequested) {
        return createErrorResult('Operation cancelled.');
      }

      // Delete the issue
      await deleteIssue(wsContext.workspaceRoot, issueId);

      // Format success response
      const results: string[] = [];
      results.push(`## Issue Deleted\n`);
      results.push(`**Issue:** ${issueId}`);
      results.push(`**Title:** ${existingIssue.title}`);
      results.push(`**Status at deletion:** ${existingIssue.status}`);
      results.push(`\nThe issue has been permanently deleted.`);

      return createSuccessResult(results.join('\n'));
    } catch (error) {
      return formatToolError('deleting issue', error);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<DeleteIssueInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { issueId } = options.input;
    return {
      invocationMessage: `Deleting issue: ${issueId}`
    };
  }
}
