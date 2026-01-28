/**
 * Update Todo Status Tool - Language Model Tool for updating todo status
 */

import * as vscode from 'vscode';
import { updateTodoStatus, loadTodo } from '../core/todos.js';
import { UpdateTodoStatusInput } from '../core/types.js';
import {
  getWorkspaceContext,
  isErrorResult,
  formatToolError,
  createSuccessResult,
  createErrorResult,
  checkCancellation,
  validateId
} from './utils.js';

export class NanodexUpdateTodoStatusTool implements vscode.LanguageModelTool<UpdateTodoStatusInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<UpdateTodoStatusInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { todoId, status } = options.input;

    // Check cancellation
    const cancelled = checkCancellation(token);
    if (cancelled) return cancelled;

    // Validate todo ID format
    const idError = validateId(todoId, 'Todo');
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
      // First check if todo exists
      const existingTodo = await loadTodo(wsContext.workspaceRoot, todoId);

      if (!existingTodo) {
        return createErrorResult(
          `Todo "${todoId}" not found. Use "nanodex-list-todos" to see available todos.`
        );
      }

      // Check cancellation
      if (token.isCancellationRequested) {
        return createErrorResult('Operation cancelled.');
      }

      const previousStatus = existingTodo.status;

      // Update the status
      await updateTodoStatus(wsContext.workspaceRoot, todoId, status);

      // Check cancellation after update
      if (token.isCancellationRequested) {
        return createErrorResult('Operation cancelled.');
      }

      // Format success response
      const results: string[] = [];
      results.push(`## Todo Status Updated\n`);
      results.push(`**Todo:** ${todoId}`);
      results.push(`**Title:** ${existingTodo.title}`);
      results.push(`**Previous Status:** ${previousStatus}`);
      results.push(`**New Status:** ${status}`);

      // Add helpful next steps based on new status
      if (status === 'in_progress') {
        results.push(`\n### Next Steps`);
        results.push(`- Review the todo details with "nanodex-get-todo"`);
        results.push(`- When done, update status to "completed"`);
      } else if (status === 'completed') {
        results.push(`\n### Todo Completed`);
        results.push(`The todo has been marked as completed.`);
      } else if (status === 'pending') {
        results.push(`\n### Todo Pending`);
        results.push(`The todo is ready to be worked on.`);
      }

      return createSuccessResult(results.join('\n'));
    } catch (error) {
      return formatToolError('updating todo status', error);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<UpdateTodoStatusInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { todoId, status } = options.input;
    return {
      invocationMessage: `Updating todo ${todoId} status to: ${status}`
    };
  }
}
