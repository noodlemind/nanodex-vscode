/**
 * Instruction loading and prompt assembly system
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { glob } from 'glob';

export interface AgentDefinition {
  id: string;
  name: string;
  context: string;
  constraints: string;
  response: string;
}

export interface InstructionFile {
  path: string;
  content: string;
  scope?: {
    languages?: string[];
    modules?: string[];
  };
}

export interface Instructions {
  agents: Map<string, AgentDefinition>;
  generalInstructions: string[];
  scopedInstructions: Map<string, string>;
}

/**
 * Load all instruction files from workspace
 */
export async function loadInstructions(workspaceRoot: string): Promise<Instructions> {
  const instructions: Instructions = {
    agents: new Map(),
    generalInstructions: [],
    scopedInstructions: new Map()
  };

  // Load built-in agents
  await loadBuiltInAgents(instructions);

  // Load AGENTS.md from workspace root
  const agentsPath = path.join(workspaceRoot, 'AGENTS.md');
  if (fs.existsSync(agentsPath)) {
    const content = fs.readFileSync(agentsPath, 'utf-8');
    instructions.generalInstructions.push(content);
  }

  // Load instruction files from instructions/ and .nanodex/instructions/
  const config = vscode.workspace.getConfiguration('nanodex');
  const instructionPatterns = config.get<string[]>('instructions.files', [
    'instructions/**/*.instructions.md',
    '.nanodex/instructions/**/*.instructions.md'
  ]);

  for (const pattern of instructionPatterns) {
    await loadInstructionFiles(workspaceRoot, pattern, instructions);
  }

  return instructions;
}

/**
 * Load built-in agent definitions
 */
async function loadBuiltInAgents(instructions: Instructions): Promise<void> {
  // Add default agent definitions
  instructions.agents.set('planner', {
    id: 'planner',
    name: 'Planner',
    context: 'You are an expert planner who creates detailed implementation plans.',
    constraints: 'Always break down tasks into small, actionable steps. Consider dependencies and edge cases.',
    response: 'Provide a structured plan in markdown format with numbered steps.'
  });

  instructions.agents.set('implementer', {
    id: 'implementer',
    name: 'Implementer',
    context: 'You are an expert software engineer who implements features according to plans.',
    constraints: 'Follow best practices and coding conventions. Write clean, maintainable code.',
    response: 'Provide complete, working code with proper error handling and comments.'
  });

  instructions.agents.set('reviewer', {
    id: 'reviewer',
    name: 'Reviewer',
    context: 'You are an expert code reviewer who ensures quality and correctness.',
    constraints: 'Check for bugs, security issues, and adherence to best practices.',
    response: 'Provide detailed feedback with specific suggestions for improvement.'
  });

  instructions.agents.set('documenter', {
    id: 'documenter',
    name: 'Documenter',
    context: 'You are an expert technical writer who creates clear documentation.',
    constraints: 'Write clear, concise documentation that is easy to understand.',
    response: 'Provide comprehensive documentation in markdown format.'
  });
}

/**
 * Load instruction files matching a pattern
 */
async function loadInstructionFiles(
  workspaceRoot: string,
  pattern: string,
  instructions: Instructions
): Promise<void> {
  try {
    const files = await glob(pattern, { cwd: workspaceRoot });

    for (const file of files) {
      const filePath = path.join(workspaceRoot, file);

      if (!fs.existsSync(filePath)) {
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf-8');

      // Parse front matter if present
      const frontMatterMatch = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);

      if (frontMatterMatch) {
        try {
          const frontMatter = yaml.load(frontMatterMatch[1]) as { scope?: { languages?: string[]; modules?: string[] } };
          const mainContent = frontMatterMatch[2];

          // Add scoped instruction
          if (frontMatter && typeof frontMatter === 'object' && frontMatter.scope) {
            const scopeKey = JSON.stringify(frontMatter.scope);
            instructions.scopedInstructions.set(scopeKey, mainContent);
          } else {
            instructions.generalInstructions.push(mainContent);
          }
        } catch (yamlError) {
          console.error(`Failed to parse YAML front matter in ${filePath}:`, yamlError);
          // Treat as regular content without front matter
          instructions.generalInstructions.push(content);
        }
      } else {
        instructions.generalInstructions.push(content);
      }
    }
  } catch (error) {
    console.error(`Failed to load instruction files for pattern ${pattern}:`, error);
  }
}

/**
 * Get instructions relevant to a specific file
 */
export function getRelevantInstructions(
  instructions: Instructions,
  filePath: string
): string[] {
  const result: string[] = [];

  // Add general instructions
  result.push(...instructions.generalInstructions);

  // Add scoped instructions
  const ext = path.extname(filePath).slice(1);
  const language = getLanguageFromExtension(ext);

  for (const [scopeKey, content] of instructions.scopedInstructions.entries()) {
    try {
      const scope = JSON.parse(scopeKey) as { languages?: string[]; modules?: string[] };

      if (scope.languages && language && scope.languages.includes(language)) {
        result.push(content);
      }

      if (scope.modules) {
        const relativePath = filePath;
        if (scope.modules.some(module => relativePath.startsWith(module))) {
          result.push(content);
        }
      }
    } catch (error) {
      console.error(`Failed to parse scope key: ${scopeKey}`, error);
    }
  }

  return result;
}

/**
 * Get language from file extension
 */
function getLanguageFromExtension(ext: string): string | undefined {
  const languageMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'py': 'python',
    'rb': 'ruby',
    'java': 'java',
    'go': 'go',
    'rs': 'rust'
  };

  return languageMap[ext];
}

/**
 * Merge instructions into a single prompt context
 */
export function mergeInstructions(instructions: string[], agent?: AgentDefinition): string {
  const parts: string[] = [];

  if (agent) {
    parts.push(`# Agent: ${agent.name}\n`);
    parts.push(`## Context\n${agent.context}\n`);
    parts.push(`## Constraints\n${agent.constraints}\n`);
    parts.push(`## Response Format\n${agent.response}\n`);
  }

  if (instructions.length > 0) {
    parts.push('## Additional Instructions\n');
    parts.push(...instructions);
  }

  return parts.join('\n\n');
}
