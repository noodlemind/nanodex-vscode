/**
 * Get Todo Tool - Language Model Tool for retrieving a single todo
 */

import * as vscode from 'vscode';
import { loadTodo } from '../core/todos.js';
import { GetTodoInput } from '../core/types.js';
import {
  getWorkspaceContext,
  isErrorResult,
  formatToolError,
  createSuccessResult,
  createErrorResult,
  checkCancellation,
  validateId
} from './utils.js';

export class NanodexGetTodoTool implements vscode.LanguageModelTool<GetTodoInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<GetTodoInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { todoId } = options.input;

    // Check cancellation
    const cancelled = checkCancellation(token);
    if (cancelled) return cancelled;

    // Validate todo ID format
    const idError = validateId(todoId, 'Todo');
    if (idError) return idError;

    // Get workspace context
    const wsContext = getWorkspaceContext();
    if (isErrorResult(wsContext)) {
      return wsContext;
    }

    try {
      const todo = await loadTodo(wsContext.workspaceRoot, todoId);

      // Check cancellation after async operation
      if (token.isCancellationRequested) {
        return createErrorResult('Operation cancelled.');
      }

      if (!todo) {
        return createErrorResult(
          `Todo "${todoId}" not found. Use "nanodex-list-todos" to see available todos.`
        );
      }

      // Format full todo details
      const results: string[] = [];
      results.push(`## ${todo.id}: ${todo.title}\n`);
      results.push(`**Status:** ${todo.status}`);
      if (todo.priority) {
        results.push(`**Priority:** ${todo.priority}`);
      }
      results.push(`**Created:** ${new Date(todo.createdAt).toISOString()}`);
      results.push(`**Updated:** ${new Date(todo.updatedAt).toISOString()}`);

      results.push(`\n### Description\n${todo.description}`);

      if (todo.tags && todo.tags.length > 0) {
        results.push(`\n### Tags\n${todo.tags.join(', ')}`);
      }

      if (todo.context && Object.keys(todo.context).length > 0) {
        results.push(`\n### Context`);
        for (const [key, value] of Object.entries(todo.context)) {
          results.push(`- ${key}: ${JSON.stringify(value)}`);
        }
      }

      return createSuccessResult(results.join('\n'));
    } catch (error) {
      return formatToolError('getting todo', error);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<GetTodoInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { todoId } = options.input;
    return {
      invocationMessage: `Getting todo: ${todoId}`
    };
  }
}
