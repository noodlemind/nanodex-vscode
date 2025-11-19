/**
 * Custom command management in .nanodex/commands/
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getNanodexPaths } from './workspace.js';

export interface CustomCommand {
  name: string;
  description: string;
  prompt: string;
  createdAt: string;
}

/**
 * Get path for a custom command file
 */
export function getCommandPath(workspaceRoot: string, commandName: string): string {
  const paths = getNanodexPaths(workspaceRoot);
  return path.join(paths.commands, `${commandName}.md`);
}

/**
 * Save a custom command to .nanodex/commands/
 */
export async function saveCommand(
  workspaceRoot: string,
  commandName: string,
  description: string,
  prompt: string
): Promise<string> {
  const commandPath = getCommandPath(workspaceRoot, commandName);

  const content = `# ${commandName}

**Description:** ${description}

**Created:** ${new Date().toISOString()}

---

${prompt}
`;

  await fs.writeFile(commandPath, content, 'utf-8');

  return commandPath;
}

/**
 * Load a custom command
 */
export async function loadCommand(
  workspaceRoot: string,
  commandName: string
): Promise<CustomCommand | undefined> {
  const commandPath = getCommandPath(workspaceRoot, commandName);

  try {
    const content = await fs.readFile(commandPath, 'utf-8');

    // Parse markdown format
    const lines = content.split('\n');
    const name = lines[0].replace(/^#\s*/, '').trim();

    const descMatch = content.match(/\*\*Description:\*\*\s*(.+)/);
    const description = descMatch ? descMatch[1].trim() : '';

    const createdMatch = content.match(/\*\*Created:\*\*\s*(.+)/);
    const createdAt = createdMatch ? createdMatch[1].trim() : '';

    // Extract prompt (everything after the --- separator)
    const promptStart = content.indexOf('---');
    const prompt = promptStart >= 0 ? content.substring(promptStart + 3).trim() : '';

    return {
      name,
      description,
      prompt,
      createdAt
    };
  } catch {
    return undefined;
  }
}

/**
 * List all custom commands
 */
export async function listCommands(workspaceRoot: string): Promise<string[]> {
  const paths = getNanodexPaths(workspaceRoot);

  try {
    const files = await fs.readdir(paths.commands);
    return files
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace(/\.md$/, ''));
  } catch {
    return [];
  }
}

/**
 * Delete a custom command
 */
export async function deleteCommand(
  workspaceRoot: string,
  commandName: string
): Promise<void> {
  const commandPath = getCommandPath(workspaceRoot, commandName);
  await fs.unlink(commandPath);
}
