/**
 * Get Issue Tool - Language Model Tool for retrieving a single issue by ID
 */

import * as vscode from 'vscode';
import { loadIssue } from '../core/issues.js';
import { GetIssueInput } from '../core/types.js';
import {
  getWorkspaceContext,
  isErrorResult,
  formatToolError,
  createSuccessResult,
  createErrorResult,
  checkCancellation,
  validateId
} from './utils.js';

export class NanodexGetIssueTool implements vscode.LanguageModelTool<GetIssueInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<GetIssueInput>,
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
      const issue = await loadIssue(wsContext.workspaceRoot, issueId);

      // Check cancellation after async operation
      if (token.isCancellationRequested) {
        return createErrorResult('Operation cancelled.');
      }

      if (!issue) {
        return createErrorResult(
          `Issue "${issueId}" not found. Use "nanodex-list-issues" to see available issues.`
        );
      }

      // Format full issue details
      const results: string[] = [];
      results.push(`## ${issue.id}: ${issue.title}\n`);
      results.push(`**Status:** ${issue.status}`);
      results.push(`**Created:** ${new Date(issue.createdAt).toISOString()}`);
      results.push(`\n### Goal\n${issue.goal}`);

      if (issue.plan) {
        results.push(`\n### Plan\n${issue.plan}`);
      }

      if (issue.acceptanceCriteria && issue.acceptanceCriteria.length > 0) {
        results.push(`\n### Acceptance Criteria`);
        for (const criterion of issue.acceptanceCriteria) {
          results.push(`- [ ] ${criterion}`);
        }
      }

      if (issue.constraints && issue.constraints.length > 0) {
        results.push(`\n### Constraints`);
        for (const constraint of issue.constraints) {
          results.push(`- ${constraint}`);
        }
      }

      if (issue.context) {
        results.push(`\n### Context`);
        if (issue.context.relatedModules && issue.context.relatedModules.length > 0) {
          results.push(`**Related Modules:** ${issue.context.relatedModules.join(', ')}`);
        }
        if (issue.context.graphContext) {
          results.push(`**Graph Summary:** ${issue.context.graphContext.summary}`);
          if (issue.context.graphContext.nodeCount) {
            results.push(`**Nodes:** ${issue.context.graphContext.nodeCount}`);
          }
        }
      }

      if (issue.flow) {
        results.push(`\n### Flow`);
        results.push(`**Flow ID:** ${issue.flow.id}`);
        if (issue.flow.steps && issue.flow.steps.length > 0) {
          results.push(`**Steps:**`);
          for (const step of issue.flow.steps) {
            results.push(`1. ${step.name} (${step.agent})`);
          }
        }
      }

      return createSuccessResult(results.join('\n'));
    } catch (error) {
      return formatToolError('getting issue', error);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<GetIssueInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { issueId } = options.input;
    return {
      invocationMessage: `Getting issue: ${issueId}`
    };
  }
}
