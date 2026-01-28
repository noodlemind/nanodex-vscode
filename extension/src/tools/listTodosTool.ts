/**
 * List Todos Tool - Language Model Tool for listing todos
 */

import * as vscode from 'vscode';
import { listTodos } from '../core/todos.js';
import { ListTodosInput } from '../core/types.js';
import {
  getWorkspaceContext,
  isErrorResult,
  formatToolError,
  createSuccessResult,
  createErrorResult,
  checkCancellation
} from './utils.js';

export class NanodexListTodosTool implements vscode.LanguageModelTool<ListTodosInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ListTodosInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { status, tag } = options.input || {};

    // Check cancellation
    const cancelled = checkCancellation(token);
    if (cancelled) return cancelled;

    // Get workspace context
    const wsContext = getWorkspaceContext();
    if (isErrorResult(wsContext)) {
      return wsContext;
    }

    try {
      // Build filter
      const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
      const filter: { status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'; tag?: string } = {};
      if (status && status !== 'all') {
        if (!validStatuses.includes(status)) {
          return createErrorResult(
            `Invalid status "${status}". Valid values are: ${validStatuses.join(', ')}, all`
          );
        }
        filter.status = status as 'pending' | 'in_progress' | 'completed' | 'cancelled';
      }
      if (tag) {
        filter.tag = tag;
      }

      const todos = await listTodos(wsContext.workspaceRoot, Object.keys(filter).length > 0 ? filter : undefined);

      // Check cancellation after async operation
      if (token.isCancellationRequested) {
        return createErrorResult('Operation cancelled.');
      }

      if (todos.length === 0) {
        const filterDesc = status && status !== 'all' ? ` with status "${status}"` : '';
        const tagDesc = tag ? ` tagged "${tag}"` : '';
        return createSuccessResult(`No todos found${filterDesc}${tagDesc}. Use "nanodex-create-todo" to create one.`);
      }

      // Format results
      const results: string[] = [];
      results.push(`## Todos (${todos.length})\n`);

      for (const todo of todos) {
        const statusIcon = todo.status === 'completed' ? '✓' : todo.status === 'in_progress' ? '→' : '○';
        const priorityBadge = todo.priority ? ` [${todo.priority}]` : '';
        const tagsBadge = todo.tags?.length ? ` (${todo.tags.join(', ')})` : '';
        results.push(`${statusIcon} **${todo.id}**: ${todo.title}${priorityBadge}${tagsBadge}`);
        results.push(`  Status: ${todo.status} | Created: ${new Date(todo.createdAt).toLocaleDateString()}`);
      }

      return createSuccessResult(results.join('\n'));
    } catch (error) {
      return formatToolError('listing todos', error);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<ListTodosInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { status, tag } = options.input || {};
    let message = 'Listing todos';
    if (status && status !== 'all') message += ` with status: ${status}`;
    if (tag) message += ` tagged: ${tag}`;
    return { invocationMessage: message };
  }
}
