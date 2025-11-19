/**
 * Custom flow discovery and management
 * 
 * Allows users to create custom flows in their workspace and
 * dynamically register them as commands.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { FlowDefinition, loadFlowDefinition } from './flowEngine.js';

export interface CustomFlowLocation {
  pattern: string;
  description: string;
}

/**
 * Default locations to search for custom flows
 */
export const DEFAULT_CUSTOM_FLOW_LOCATIONS: CustomFlowLocation[] = [
  {
    pattern: '.nanodex/flows/*.flow.yaml',
    description: 'Workspace .nanodex flows'
  },
  {
    pattern: '.nanodex/flows/*.flow.yml',
    description: 'Workspace .nanodex flows (yml)'
  },
  {
    pattern: 'flows/*.flow.yaml',
    description: 'Workspace flows'
  },
  {
    pattern: 'flows/*.flow.yml',
    description: 'Workspace flows (yml)'
  }
];

/**
 * Validation result for flow definitions
 */
export interface FlowValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Custom flow metadata
 */
export interface CustomFlowMetadata {
  id: string;
  name: string;
  description: string;
  filePath: string;
  definition: FlowDefinition;
}

/**
 * Discover custom flows in the workspace
 */
export async function discoverCustomFlows(
  workspacePath: string,
  customLocations?: string[]
): Promise<CustomFlowMetadata[]> {
  const flows: CustomFlowMetadata[] = [];
  
  // Get flow locations from configuration or use defaults
  const locations = customLocations || 
    vscode.workspace.getConfiguration('nanodex.flows').get<string[]>('paths') ||
    DEFAULT_CUSTOM_FLOW_LOCATIONS.map(loc => loc.pattern);

  for (const pattern of locations) {
    const fullPattern = path.join(workspacePath, pattern);
    const flowFiles = await findFlowFiles(fullPattern);
    
    for (const flowFile of flowFiles) {
      try {
        const definition = loadFlowDefinition(flowFile);
        if (definition) {
          const validation = validateFlowDefinition(definition);
          if (validation.valid) {
            flows.push({
              id: definition.id,
              name: extractFlowName(definition),
              description: definition.intent,
              filePath: flowFile,
              definition
            });
          } else {
            console.warn(`Invalid flow ${flowFile}:`, validation.errors);
          }
        }
      } catch (error) {
        console.error(`Error loading flow ${flowFile}:`, error);
      }
    }
  }

  return flows;
}

/**
 * Find flow files matching a glob pattern
 */
async function findFlowFiles(pattern: string): Promise<string[]> {
  try {
    const uris = await vscode.workspace.findFiles(
      new vscode.RelativePattern(
        path.dirname(pattern),
        path.basename(pattern)
      ),
      '**/node_modules/**'
    );
    return uris.map(uri => uri.fsPath);
  } catch (error) {
    console.error(`Error finding flow files for pattern ${pattern}:`, error);
    return [];
  }
}

/**
 * Validate a flow definition
 */
export function validateFlowDefinition(flow: FlowDefinition): FlowValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!flow.id) {
    errors.push('Flow ID is required');
  } else if (!flow.id.match(/^[a-z][a-z0-9.-]*$/)) {
    errors.push('Flow ID must start with lowercase letter and contain only lowercase letters, numbers, dots, and hyphens');
  }

  if (!flow.intent) {
    errors.push('Flow intent is required');
  }

  if (!flow.steps || !Array.isArray(flow.steps)) {
    errors.push('Flow steps are required and must be an array');
  } else {
    if (flow.steps.length === 0) {
      errors.push('Flow must have at least one step');
    }

    // Validate each step
    flow.steps.forEach((step, index) => {
      if (!step.name) {
        errors.push(`Step ${index + 1}: name is required`);
      }
      if (!step.agentId) {
        errors.push(`Step ${index + 1}: agentId is required`);
      }
      if (!step.prompt) {
        errors.push(`Step ${index + 1}: prompt is required`);
      }
    });
  }

  // Validate inputs if present
  if (flow.inputs) {
    if (!Array.isArray(flow.inputs)) {
      errors.push('Flow inputs must be an array');
    } else {
      flow.inputs.forEach((input, index) => {
        if (!input.name) {
          errors.push(`Input ${index + 1}: name is required`);
        }
        if (typeof input.required !== 'boolean') {
          warnings.push(`Input ${index + 1}: required field should be boolean`);
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Extract a human-readable name from flow definition
 */
function extractFlowName(flow: FlowDefinition): string {
  // Use source file name if available
  if (flow.sourceFile) {
    const baseName = path.basename(flow.sourceFile, path.extname(flow.sourceFile));
    return baseName
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Extract from flow ID
  const idParts = flow.id.split('.').pop();
  if (idParts) {
    return idParts
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  return flow.id;
}

/**
 * Load a custom flow by ID
 */
export async function loadCustomFlow(
  workspacePath: string,
  flowId: string
): Promise<CustomFlowMetadata | undefined> {
  const flows = await discoverCustomFlows(workspacePath);
  return flows.find(flow => flow.id === flowId);
}

/**
 * Create a flow template file
 */
export async function createFlowTemplate(
  targetPath: string,
  flowName: string,
  intent: string
): Promise<void> {
  const flowId = flowName.toLowerCase().replace(/\s+/g, '-');
  
  const template = {
    id: `custom.flow.${flowId}`,
    sourceFile: `commands/${flowName.toLowerCase().replace(/\s+/g, '_')}.md`,
    intent,
    inputs: [
      {
        name: 'goal',
        required: true,
        description: 'The goal or objective for this flow'
      }
    ],
    context: {
      inject: [
        {
          name: 'relevant_nodes',
          query: "relevant_nodes(goal='{goal}', max=12)"
        }
      ]
    },
    steps: [
      {
        name: 'Analyze Requirements',
        agentId: 'nanodex.specialist.repo-research-analyst',
        prompt: `Analyze the requirements for: {goal}
        
- Review existing code patterns
- Identify relevant modules and symbols
- Note any constraints or considerations`
      },
      {
        name: 'Create Implementation Plan',
        agentId: 'nanodex.specialist.best-practices-researcher',
        prompt: `Create a detailed implementation plan for: {goal}

- Break down into actionable steps
- Identify potential risks
- Suggest best practices`
      }
    ]
  };

  const yamlContent = yaml.dump(template, {
    indent: 2,
    lineWidth: 100,
    noRefs: true
  });

  // Ensure directory exists
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write template
  fs.writeFileSync(targetPath, yamlContent, 'utf-8');
}

/**
 * Get command name for a custom flow
 */
export function getFlowCommandName(flow: CustomFlowMetadata): string {
  return `Nanodex: ${flow.name}`;
}

/**
 * Get chat command name for a custom flow
 */
export function getFlowChatCommand(flow: CustomFlowMetadata): string {
  const idParts = flow.id.split('.');
  return idParts[idParts.length - 1];
}
