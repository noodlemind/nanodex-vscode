/**
 * Create Todo Tool - Language Model Tool for creating new todos
 */

import * as vscode from 'vscode';
import { createTodo } from '../core/todos.js';
import { CreateTodoInput } from '../core/types.js';
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
const MAX_DESCRIPTION_LENGTH = 5000;

export class NanodexCreateTodoTool implements vscode.LanguageModelTool<CreateTodoInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<CreateTodoInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { title, description, priority, tags } = options.input;

    // Check cancellation
    const cancelled = checkCancellation(token);
    if (cancelled) return cancelled;

    // Validate input lengths
    const titleError = validateInputLength(title, MAX_TITLE_LENGTH, 'Title');
    if (titleError) return titleError;

    const descError = validateInputLength(description, MAX_DESCRIPTION_LENGTH, 'Description');
    if (descError) return descError;

    // Get workspace context
    const wsContext = getWorkspaceContext();
    if (isErrorResult(wsContext)) {
      return wsContext;
    }

    try {
      const todo = await createTodo(
        wsContext.workspaceRoot,
        title,
        description,
        { priority, tags }
      );

      // Check cancellation after async operation
      if (token.isCancellationRequested) {
        return createErrorResult('Operation cancelled.');
      }

      // Format success response
      const results: string[] = [];
      results.push(`## Todo Created Successfully\n`);
      results.push(`**ID:** ${todo.id}`);
      results.push(`**Title:** ${todo.title}`);
      results.push(`**Status:** ${todo.status}`);
      if (todo.priority) {
        results.push(`**Priority:** ${todo.priority}`);
      }
      results.push(`**Created:** ${new Date(todo.createdAt).toISOString()}`);

      const descPreview = todo.description.length > 200
        ? todo.description.substring(0, 200) + '...'
        : todo.description;
      results.push(`\n### Description\n${descPreview}`);

      if (todo.tags && todo.tags.length > 0) {
        results.push(`\n### Tags\n${todo.tags.join(', ')}`);
      }

      results.push(`\n---`);
      results.push(`Use "nanodex-update-todo-status" with todoId "${todo.id}" to update the status.`);
      results.push(`Use "nanodex-get-todo" with todoId "${todo.id}" to view full details.`);

      return createSuccessResult(results.join('\n'));
    } catch (error) {
      return formatToolError('creating todo', error);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<CreateTodoInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { title } = options.input;
    return {
      invocationMessage: `Creating todo: "${title}"`
    };
  }
}
