/**
 * Resolve TODOs command implementation using flow engine
 */

import * as vscode from 'vscode';
import { runFlowCommand } from '../core/flowCommandRunner.js';
import { listTodos, updateTodoStatus, loadTodo } from '../core/todos.js';
import { ensureNanodexStructure } from '../core/workspace.js';

export async function resolveTodosCommand(context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;

  // Ensure structure exists
  await ensureNanodexStructure(workspaceRoot);

  // Load pending TODOs
  const pendingTodos = await listTodos(workspaceRoot, { status: 'pending' });

  if (pendingTodos.length === 0) {
    vscode.window.showInformationMessage('No pending TODOs found');
    return;
  }

  // Let user select which TODOs to resolve
  const selectedTodos = await vscode.window.showQuickPick(
    pendingTodos.map(todo => ({
      label: todo.id,
      description: todo.title,
      detail: todo.description.substring(0, 100),
      picked: true,
      todo
    })),
    {
      placeHolder: 'Select TODOs to resolve',
      canPickMany: true,
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  if (!selectedTodos || selectedTodos.length === 0) {
    return; // User cancelled
  }

  // Build document with all selected TODOs
  const todoDocument = selectedTodos.map(item => {
    const todo = item.todo;
    return `## ${todo.id}: ${todo.title}

**Status:** ${todo.status}
**Priority:** ${todo.priority || 'medium'}
**Created:** ${todo.createdAt}

${todo.description}

---
`;
  }).join('\n');

  await runFlowCommand({
    flowId: 'nanodex.flow.resolve-todos',
    context,
    title: 'Resolving TODOs',
    getInputs: async () => ({
      todos: todoDocument,
      count: String(selectedTodos.length)
    }),
    handleResult: async (result, workspaceRoot) => {
      // Mark TODOs as completed
      for (const item of selectedTodos) {
        await updateTodoStatus(workspaceRoot, item.todo.id, 'completed');
      }

      vscode.window.showInformationMessage(
        `Resolved ${selectedTodos.length} TODO${selectedTodos.length !== 1 ? 's' : ''}`
      );
    }
  });
}
