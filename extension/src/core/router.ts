/**
 * Flow routing and agent selection system
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { AgentDefinition } from './prompts.js';

export interface FlowStep {
  agent: string;
  prompt: string;
  context?: {
    type: string;
    depth?: number;
    relations?: string[];
  };
}

export interface FlowDefinition {
  name: string;
  description: string;
  steps: FlowStep[];
}

/**
 * Select agent based on task type and context
 */
export function selectAgent(
  task: string,
  agents: Map<string, AgentDefinition>
): AgentDefinition | undefined {
  const taskLower = task.toLowerCase();

  // Determine task type from keywords
  if (taskLower.includes('plan') || taskLower.includes('design')) {
    return agents.get('planner');
  }

  if (taskLower.includes('implement') || taskLower.includes('code') || taskLower.includes('write')) {
    return agents.get('implementer');
  }

  if (taskLower.includes('review') || taskLower.includes('check') || taskLower.includes('verify')) {
    return agents.get('reviewer');
  }

  if (taskLower.includes('document') || taskLower.includes('readme') || taskLower.includes('docs')) {
    return agents.get('documenter');
  }

  // Default to implementer
  return agents.get('implementer');
}

/**
 * Load flow definition from YAML file
 */
export function loadFlowDefinition(flowPath: string): FlowDefinition | undefined {
  if (!fs.existsSync(flowPath)) {
    return undefined;
  }

  try {
    const content = fs.readFileSync(flowPath, 'utf-8');
    const flow = yaml.load(content) as FlowDefinition;

    // Validate flow structure
    if (!flow.name || !flow.steps || !Array.isArray(flow.steps)) {
      console.error(`Invalid flow definition in ${flowPath}`);
      return undefined;
    }

    return flow;
  } catch (error) {
    console.error(`Failed to load flow definition from ${flowPath}:`, error);
    return undefined;
  }
}

/**
 * Execute a flow step by step
 */
export async function executeFlow(
  flow: FlowDefinition,
  agents: Map<string, AgentDefinition>,
  userInput: string,
  contextData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {
    ...contextData,
    userInput
  };

  for (let i = 0; i < flow.steps.length; i++) {
    const step = flow.steps[i];

    // Get agent for this step
    const agent = agents.get(step.agent);
    if (!agent) {
      console.error(`Agent ${step.agent} not found for step ${i + 1}`);
      continue;
    }

    // Interpolate prompt with context
    const interpolatedPrompt = interpolatePrompt(step.prompt, results);

    // Store step results
    results[`step${i + 1}_agent`] = agent.name;
    results[`step${i + 1}_prompt`] = interpolatedPrompt;

    // In a real implementation, this would call the LLM API
    // For now, just store the prepared data
  }

  return results;
}

/**
 * Interpolate template variables in prompt
 */
function interpolatePrompt(
  template: string,
  context: Record<string, unknown>
): string {
  let result = template;

  // Replace {{variable}} with context values
  const matches = template.match(/\{\{([^}]+)\}\}/g);

  if (matches) {
    for (const match of matches) {
      const key = match.slice(2, -2).trim();
      const value = getNestedValue(context, key);

      if (value !== undefined) {
        result = result.replace(match, String(value));
      }
    }
  }

  return result;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Assemble final prompt with all components
 */
export function assemblePrompt(
  agent: AgentDefinition,
  instructions: string[],
  graphContext: string,
  userInput: string
): string {
  const parts: string[] = [];

  // Add agent context
  parts.push(`# ${agent.name}\n`);
  parts.push(agent.context);

  // Add constraints
  if (agent.constraints) {
    parts.push('\n## Constraints\n');
    parts.push(agent.constraints);
  }

  // Add instructions
  if (instructions.length > 0) {
    parts.push('\n## Instructions\n');
    parts.push(instructions.join('\n\n'));
  }

  // Add graph context
  if (graphContext) {
    parts.push('\n## Code Context\n');
    parts.push(graphContext);
  }

  // Add user input
  if (userInput) {
    parts.push('\n## Task\n');
    parts.push(userInput);
  }

  // Add response format
  if (agent.response) {
    parts.push('\n## Response Format\n');
    parts.push(agent.response);
  }

  return parts.join('\n');
}
