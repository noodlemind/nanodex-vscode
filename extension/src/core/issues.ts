/**
 * Issue management system
 */

import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface Issue {
  id: string;
  title: string;
  createdAt: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  goal: string;
  plan?: string;
  acceptanceCriteria?: string[];
  constraints?: string[];
  context?: {
    relatedModules?: string[];
    graphContext?: {
      summary: string;
      tokenCount?: number;
      nodeCount?: number;
    };
  };
  flow?: {
    id: string;
    steps?: Array<{
      name: string;
      agent: string;
    }>;
  };
}

/**
 * Issue ID validation pattern - alphanumeric, underscore, hyphen only
 */
const ISSUE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_ISSUE_ID_LENGTH = 50;

/**
 * Validate issue ID format to prevent path traversal attacks
 */
export function validateIssueId(issueId: string): boolean {
  return (
    typeof issueId === 'string' &&
    issueId.length > 0 &&
    issueId.length <= MAX_ISSUE_ID_LENGTH &&
    ISSUE_ID_PATTERN.test(issueId) &&
    !issueId.includes('..')
  );
}

/**
 * Get the issues directory path
 */
function getIssuesDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.nanodex', 'issues');
}

/**
 * Get the full path for an issue file with path traversal protection
 */
export function getIssuePath(workspaceRoot: string, issueId: string): string {
  if (!validateIssueId(issueId)) {
    throw new Error(`Invalid issue ID format: ${issueId}`);
  }

  const issuesDir = path.resolve(getIssuesDir(workspaceRoot));
  const filePath = path.resolve(path.join(issuesDir, `${issueId}.yml`));

  // Verify resolved path is within issues directory (path containment check)
  if (!filePath.startsWith(issuesDir + path.sep)) {
    throw new Error(`Invalid issue path: path traversal detected`);
  }

  return filePath;
}

/**
 * Ensure issues directory exists
 */
async function ensureIssuesDir(workspaceRoot: string): Promise<void> {
  const issuesDir = getIssuesDir(workspaceRoot);
  await fsp.mkdir(issuesDir, { recursive: true });
}

/**
 * Type guard to validate Issue objects loaded from YAML
 */
function isValidIssue(obj: unknown): obj is Issue {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  // Required fields
  if (typeof candidate.id !== 'string' || !candidate.id) {
    return false;
  }
  if (typeof candidate.title !== 'string' || !candidate.title) {
    return false;
  }
  if (typeof candidate.goal !== 'string' || !candidate.goal) {
    return false;
  }
  if (typeof candidate.createdAt !== 'string') {
    return false;
  }

  // Status must be valid enum value
  const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
  if (typeof candidate.status !== 'string' || !validStatuses.includes(candidate.status)) {
    return false;
  }

  // Optional string field
  if (candidate.plan !== undefined && typeof candidate.plan !== 'string') {
    return false;
  }

  // Optional array fields
  if (candidate.acceptanceCriteria !== undefined) {
    if (!Array.isArray(candidate.acceptanceCriteria) ||
        !candidate.acceptanceCriteria.every(item => typeof item === 'string')) {
      return false;
    }
  }

  if (candidate.constraints !== undefined) {
    if (!Array.isArray(candidate.constraints) ||
        !candidate.constraints.every(item => typeof item === 'string')) {
      return false;
    }
  }

  // Optional context object
  if (candidate.context !== undefined) {
    if (typeof candidate.context !== 'object' || candidate.context === null) {
      return false;
    }

    const context = candidate.context as Record<string, unknown>;

    if (context.relatedModules !== undefined) {
      if (!Array.isArray(context.relatedModules) ||
          !context.relatedModules.every(item => typeof item === 'string')) {
        return false;
      }
    }

    if (context.graphContext !== undefined) {
      if (typeof context.graphContext !== 'object' || context.graphContext === null) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Generate next issue ID with atomic file creation to prevent races
 */
async function generateIssueId(workspaceRoot: string): Promise<string> {
  await ensureIssuesDir(workspaceRoot);
  const issuesDir = getIssuesDir(workspaceRoot);

  const maxAttempts = 100;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const files = await fsp.readdir(issuesDir);
      const issueFiles = files.filter(f => f.startsWith('ISSUE-') && f.endsWith('.yml'));

      const nextNumber = issueFiles.length === 0 ? 1 :
        Math.max(...issueFiles
          .map(f => parseInt(f.match(/ISSUE-(\d+)\.yml/)?.[1] ?? '0', 10))
          .filter(n => n > 0)
        ) + 1;

      const issueId = `ISSUE-${String(nextNumber).padStart(3, '0')}`;
      const filePath = path.join(issuesDir, `${issueId}.yml`);

      // Try to create file exclusively (fails if exists)
      try {
        await fsp.writeFile(filePath, '', { flag: 'wx' });
        // Delete the temp file
        await fsp.unlink(filePath);
        return issueId;
      } catch (err) {
        // File exists, try next number
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'EEXIST') {
          continue;
        }
        throw err;
      }
    } catch (error) {
      console.error('Failed to generate issue ID:', error);
      throw new Error('Could not generate unique issue ID', { cause: error });
    }
  }

  throw new Error('Exceeded maximum attempts to generate unique issue ID');
}

/**
 * Save issue to YAML file
 */
export async function saveIssue(
  workspaceRoot: string,
  issue: Issue
): Promise<string> {
  await ensureIssuesDir(workspaceRoot);
  const filePath = getIssuePath(workspaceRoot, issue.id);

  const yamlContent = yaml.dump(issue, {
    indent: 2,
    lineWidth: 80,
    noRefs: true
  });

  await fsp.writeFile(filePath, yamlContent, 'utf-8');

  return filePath;
}

/**
 * Load issue from YAML file
 */
export async function loadIssue(
  workspaceRoot: string,
  issueId: string
): Promise<Issue | undefined> {
  const filePath = getIssuePath(workspaceRoot, issueId);

  try {
    const content = await fsp.readFile(filePath, 'utf-8');
    const parsed = yaml.load(content, { schema: yaml.JSON_SCHEMA });

    if (!isValidIssue(parsed)) {
      console.error(`Invalid issue structure in ${filePath}`);
      return undefined;
    }

    return parsed;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return undefined;
    }
    console.error(`Failed to load issue from ${filePath}:`, error);
    return undefined;
  }
}

/**
 * List all issues in workspace
 */
export async function listIssues(
  workspaceRoot: string
): Promise<Issue[]> {
  const issuesDir = getIssuesDir(workspaceRoot);

  try {
    const files = await fsp.readdir(issuesDir);
    const issueFiles = files.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));

    const issues: Issue[] = [];

    for (const file of issueFiles) {
      const filePath = path.join(issuesDir, file);
      try {
        const content = await fsp.readFile(filePath, 'utf-8');
        const parsed = yaml.load(content, { schema: yaml.JSON_SCHEMA });

        if (isValidIssue(parsed)) {
          issues.push(parsed);
        }
      } catch (error) {
        console.error(`Failed to load issue from ${file}:`, error);
      }
    }

    // Sort by ID descending (newest first)
    return issues.sort((a, b) => b.id.localeCompare(a.id));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return [];
    }
    console.error('Failed to list issues:', error);
    return [];
  }
}

/**
 * Update issue status
 */
export async function updateIssueStatus(
  workspaceRoot: string,
  issueId: string,
  status: Issue['status']
): Promise<void> {
  const issue = await loadIssue(workspaceRoot, issueId);

  if (!issue) {
    throw new Error(`Issue ${issueId} not found`);
  }

  issue.status = status;
  await saveIssue(workspaceRoot, issue);
}

/**
 * Delete issue file
 */
export async function deleteIssue(
  workspaceRoot: string,
  issueId: string
): Promise<void> {
  const filePath = getIssuePath(workspaceRoot, issueId);

  if (fs.existsSync(filePath)) {
    await fsp.unlink(filePath);
  }
}

/**
 * Create a new issue
 */
export async function createIssue(
  workspaceRoot: string,
  title: string,
  goal: string,
  plan?: string,
  options?: {
    acceptanceCriteria?: string[];
    constraints?: string[];
    relatedModules?: string[];
    graphContext?: {
      summary: string;
      tokenCount?: number;
      nodeCount?: number;
    };
    flow?: string;
    steps?: Array<{
      name: string;
      agent: string;
    }>;
  }
): Promise<Issue> {
  const id = await generateIssueId(workspaceRoot);

  const issue: Issue = {
    id,
    title,
    createdAt: new Date().toISOString(),
    status: 'pending',
    goal,
    plan,
    acceptanceCriteria: options?.acceptanceCriteria,
    constraints: options?.constraints,
    context: options?.relatedModules || options?.graphContext ? {
      relatedModules: options?.relatedModules,
      graphContext: options?.graphContext
    } : undefined,
    flow: options?.flow ? {
      id: options.flow,
      steps: options.steps
    } : undefined
  };

  await saveIssue(workspaceRoot, issue);

  return issue;
}
