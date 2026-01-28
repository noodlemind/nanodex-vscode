/**
 * TODO management in .nanodex/todos/
 */

import * as fs from 'fs/promises';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { getNanodexPaths } from './workspace.js';

export interface Todo {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  context?: Record<string, unknown>;
}

/**
 * Todo ID validation pattern - alphanumeric, underscore, hyphen only
 */
const TODO_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_TODO_ID_LENGTH = 50;

/**
 * Validate Todo ID format to prevent path traversal attacks
 */
export function validateTodoId(todoId: string): boolean {
  return (
    typeof todoId === 'string' &&
    todoId.length > 0 &&
    todoId.length <= MAX_TODO_ID_LENGTH &&
    TODO_ID_PATTERN.test(todoId) &&
    !todoId.includes('..')
  );
}

/**
 * Get path for a TODO file with path traversal protection
 */
export function getTodoPath(workspaceRoot: string, todoId: string): string {
  if (!validateTodoId(todoId)) {
    throw new Error(`Invalid TODO ID format: ${todoId}`);
  }

  const paths = getNanodexPaths(workspaceRoot);
  const todosDir = path.resolve(paths.todos);
  const filePath = path.resolve(path.join(todosDir, `${todoId}.yml`));

  // Verify resolved path is within todos directory (path containment check)
  if (!filePath.startsWith(todosDir + path.sep)) {
    throw new Error(`Invalid TODO path: path traversal detected`);
  }

  return filePath;
}

/**
 * Generate next TODO ID
 */
async function generateTodoId(workspaceRoot: string): Promise<string> {
  const paths = getNanodexPaths(workspaceRoot);

  const maxAttempts = 100;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const files = await fsp.readdir(paths.todos);
      const todoFiles = files.filter(f => f.startsWith('TODO-') && f.endsWith('.yml'));

      const nextNumber = todoFiles.length === 0 ? 1 :
        Math.max(...todoFiles
          .map(f => parseInt(f.match(/TODO-(\d+)\.yml/)?.[1] ?? '0', 10))
          .filter(n => n > 0)
        ) + 1;

      const todoId = `TODO-${String(nextNumber).padStart(3, '0')}`;
      const filePath = path.join(paths.todos, `${todoId}.yml`);

      // Try to create file exclusively
      try {
        await fsp.writeFile(filePath, '', { flag: 'wx' });
        await fsp.unlink(filePath);
        return todoId;
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'EEXIST') {
          continue;
        }
        throw err;
      }
    } catch (error) {
      console.error('Failed to generate TODO ID:', error);
      throw new Error('Could not generate unique TODO ID', { cause: error });
    }
  }

  throw new Error('Exceeded maximum attempts to generate unique TODO ID');
}

/**
 * Create a new TODO
 */
export async function createTodo(
  workspaceRoot: string,
  title: string,
  description: string,
  options?: {
    priority?: 'low' | 'medium' | 'high';
    tags?: string[];
    context?: Record<string, unknown>;
  }
): Promise<Todo> {
  const id = await generateTodoId(workspaceRoot);
  const now = new Date().toISOString();

  const todo: Todo = {
    id,
    title,
    description,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    priority: options?.priority,
    tags: options?.tags,
    context: options?.context
  };

  await saveTodo(workspaceRoot, todo);

  return todo;
}

/**
 * Save TODO to file
 */
export async function saveTodo(
  workspaceRoot: string,
  todo: Todo
): Promise<string> {
  const todoPath = getTodoPath(workspaceRoot, todo.id);

  const yamlContent = yaml.dump(todo, {
    indent: 2,
    lineWidth: 80,
    noRefs: true
  });

  await fs.writeFile(todoPath, yamlContent, 'utf-8');

  return todoPath;
}

/**
 * Load TODO from file
 */
export async function loadTodo(
  workspaceRoot: string,
  todoId: string
): Promise<Todo | undefined> {
  const todoPath = getTodoPath(workspaceRoot, todoId);

  try {
    const content = await fs.readFile(todoPath, 'utf-8');
    const todo = yaml.load(content, { schema: yaml.JSON_SCHEMA }) as Todo;

    // Validate required fields
    if (!todo.id || !todo.title || !todo.status) {
      console.error(`Invalid TODO format in ${todoPath}`);
      return undefined;
    }

    return todo;
  } catch {
    return undefined;
  }
}

/**
 * List all TODOs
 */
export async function listTodos(
  workspaceRoot: string,
  filter?: { status?: Todo['status']; tag?: string }
): Promise<Todo[]> {
  const paths = getNanodexPaths(workspaceRoot);

  try {
    const files = await fs.readdir(paths.todos);
    const todoFiles = files.filter(f => f.startsWith('TODO-') && f.endsWith('.yml'));

    const todos: Todo[] = [];

    for (const file of todoFiles) {
      const todoId = file.replace(/\.yml$/, '');
      const todo = await loadTodo(workspaceRoot, todoId);

      if (!todo) {
        continue;
      }

      // Apply filters
      if (filter?.status && todo.status !== filter.status) {
        continue;
      }

      if (filter?.tag && (!todo.tags || !todo.tags.includes(filter.tag))) {
        continue;
      }

      todos.push(todo);
    }

    // Sort by creation date (newest first)
    todos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return todos;
  } catch {
    return [];
  }
}

/**
 * Update TODO status
 */
export async function updateTodoStatus(
  workspaceRoot: string,
  todoId: string,
  status: Todo['status']
): Promise<void> {
  const todo = await loadTodo(workspaceRoot, todoId);

  if (!todo) {
    throw new Error(`TODO ${todoId} not found`);
  }

  todo.status = status;
  todo.updatedAt = new Date().toISOString();

  await saveTodo(workspaceRoot, todo);
}

/**
 * Delete a TODO
 */
export async function deleteTodo(
  workspaceRoot: string,
  todoId: string
): Promise<void> {
  const todoPath = getTodoPath(workspaceRoot, todoId);
  await fs.unlink(todoPath);
}
