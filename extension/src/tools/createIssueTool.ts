/**
 * Create Issue Tool - Language Model Tool for creating new issues
 */

import * as vscode from 'vscode';
import { createIssue } from '../core/issues.js';
import { CreateIssueInput } from '../core/types.js';
import {
  getWorkspaceContext,
  isErrorResult,
  formatToolError,
  createSuccessResult,
  createErrorResult,
  checkCancellation,
  validateInputLength
} from './utils.js';

const MAX_TITLE_LENGTH = 200;
const MAX_GOAL_LENGTH = 5000;
const MAX_PLAN_LENGTH = 50000;

export class NanodexCreateIssueTool implements vscode.LanguageModelTool<CreateIssueInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<CreateIssueInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { title, goal, plan, acceptanceCriteria } = options.input;

    // Check cancellation
    const cancelled = checkCancellation(token);
    if (cancelled) return cancelled;

    // Validate input lengths
    const titleError = validateInputLength(title, MAX_TITLE_LENGTH, 'Title');
    if (titleError) return titleError;

    const goalError = validateInputLength(goal, MAX_GOAL_LENGTH, 'Goal');
    if (goalError) return goalError;

    if (plan) {
      const planError = validateInputLength(plan, MAX_PLAN_LENGTH, 'Plan');
      if (planError) return planError;
    }

    // Get workspace context
    const wsContext = getWorkspaceContext();
    if (isErrorResult(wsContext)) {
      return wsContext;
    }

    try {
      const issue = await createIssue(
        wsContext.workspaceRoot,
        title,
        goal,
        plan,
        { acceptanceCriteria }
      );

      // Check cancellation after async operation
      if (token.isCancellationRequested) {
        return createErrorResult('Operation cancelled.');
      }

      // Format success response
      const results: string[] = [];
      results.push(`## Issue Created Successfully\n`);
      results.push(`**ID:** ${issue.id}`);
      results.push(`**Title:** ${issue.title}`);
      results.push(`**Status:** ${issue.status}`);
      results.push(`**Created:** ${new Date(issue.createdAt).toISOString()}`);
      results.push(`\n### Goal\n${issue.goal}`);

      if (issue.plan) {
        const planPreview = issue.plan.length > 200
          ? issue.plan.substring(0, 200) + '...'
          : issue.plan;
        results.push(`\n### Plan\n${planPreview}`);
      }

      if (issue.acceptanceCriteria && issue.acceptanceCriteria.length > 0) {
        results.push(`\n### Acceptance Criteria`);
        for (const criterion of issue.acceptanceCriteria) {
          results.push(`- [ ] ${criterion}`);
        }
      }

      results.push(`\n---`);
      results.push(`Use "nanodex-update-issue-status" with issueId "${issue.id}" to update the status.`);
      results.push(`Use "nanodex-get-issue" with issueId "${issue.id}" to view full details.`);

      return createSuccessResult(results.join('\n'));
    } catch (error) {
      return formatToolError('creating issue', error);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<CreateIssueInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { title } = options.input;
    return {
      invocationMessage: `Creating issue: "${title}"`
    };
  }
}
