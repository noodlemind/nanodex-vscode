/**
 * Workspace structure management for .nanodex directory
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface NanodexDirectories {
  root: string;
  commands: string;
  todos: string;
  workflows: string;
  issues: string;
}

/**
 * Get .nanodex directory paths for workspace
 */
export function getNanodexPaths(workspaceRoot: string): NanodexDirectories {
  const root = path.join(workspaceRoot, '.nanodex');

  return {
    root,
    commands: path.join(root, 'commands'),
    todos: path.join(root, 'todos'),
    workflows: path.join(root, 'workflows'),
    issues: path.join(root, 'issues')
  };
}

/**
 * Ensure .nanodex directory structure exists
 */
export async function ensureNanodexStructure(workspaceRoot: string): Promise<NanodexDirectories> {
  const paths = getNanodexPaths(workspaceRoot);

  // Create all directories
  await fs.mkdir(paths.root, { recursive: true });
  await fs.mkdir(paths.commands, { recursive: true });
  await fs.mkdir(paths.todos, { recursive: true });
  await fs.mkdir(paths.workflows, { recursive: true });
  await fs.mkdir(paths.issues, { recursive: true });

  return paths;
}

/**
 * Check if .nanodex structure exists
 */
export async function hasNanodexStructure(workspaceRoot: string): Promise<boolean> {
  const paths = getNanodexPaths(workspaceRoot);

  try {
    const stats = await fs.stat(paths.root);
    return stats.isDirectory();
  } catch {
    return false;
  }
}
