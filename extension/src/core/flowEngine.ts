/**
 * Flow execution engine for multi-agent workflows
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { AgentDefinition } from './prompts.js';
import { assemblePrompt } from './router.js';

export interface FlowInput {
  name: string;
  required: boolean;
  description?: string;
}

export interface FlowContextInjection {
  name: string;
  query: string;
}

export interface FlowContext {
  inject?: FlowContextInjection[];
}

export interface FlowStep {
  name: string;
  agentId: string;
  prompt: string;
}

export interface FlowDefinition {
  id: string;
  sourceFile?: string;
  intent: string;
  inputs?: FlowInput[];
  context?: FlowContext;
  steps: FlowStep[];
}

export interface FlowExecutionContext {
  workspaceRoot: string;
  agents: Map<string, AgentDefinition>;
  userInputs: Record<string, string>;
  graphContext?: string;
  progress: vscode.Progress<{ message?: string; increment?: number }>;
}

export interface FlowExecutionResult {
  stepResults: Array<{
    stepName: string;
    agentId: string;
    output: string;
  }>;
  finalOutput: string;
}

/**
 * Load flow definition from YAML file
 */
export function loadFlowDefinition(flowPath: string): FlowDefinition | undefined {
  if (!fs.existsSync(flowPath)) {
    console.error(`Flow file not found: ${flowPath}`);
    return undefined;
  }

  try {
    const content = fs.readFileSync(flowPath, 'utf-8');
    const flow = yaml.load(content) as FlowDefinition;

    // Validate flow structure
    if (!flow.id || !flow.intent || !flow.steps || !Array.isArray(flow.steps)) {
      console.error(`Invalid flow definition in ${flowPath}: missing required fields`);
      return undefined;
    }

    if (flow.steps.length === 0) {
      console.error(`Invalid flow definition in ${flowPath}: no steps defined`);
      return undefined;
    }

    return flow;
  } catch (error) {
    console.error(`Failed to load flow definition from ${flowPath}:`, error);
    return undefined;
  }
}

/**
 * Execute a complete flow with all steps
 */
export async function executeFlow(
  flow: FlowDefinition,
  context: FlowExecutionContext
): Promise<FlowExecutionResult> {
  const stepResults: Array<{ stepName: string; agentId: string; output: string }> = [];

  console.log(`[flowEngine] Starting flow execution: ${flow.id}`);
  context.progress.report({ message: `Starting ${flow.id}...` });

  // Validate inputs
  const missingInputs = validateFlowInputs(flow, context.userInputs);
  if (missingInputs.length > 0) {
    throw new Error(`Missing required inputs: ${missingInputs.join(', ')}`);
  }

  // Inject graph context if specified
  let graphContext = '';
  if (flow.context?.inject) {
    graphContext = await injectGraphContext(
      flow.context.inject,
      context.workspaceRoot,
      context.userInputs
    );
    console.log(`[flowEngine] Injected graph context: ${graphContext.length} chars`);
  }

  // Execute each step sequentially
  for (let i = 0; i < flow.steps.length; i++) {
    const step = flow.steps[i];
    console.log(`[flowEngine] Executing step ${i + 1}/${flow.steps.length}: ${step.name}`);
    context.progress.report({
      message: `Step ${i + 1}/${flow.steps.length}: ${step.name}`,
      increment: (100 / flow.steps.length)
    });

    // Get agent for this step
    const agent = context.agents.get(step.agentId);
    if (!agent) {
      console.error(`[flowEngine] Agent not found: ${step.agentId}`);
      throw new Error(`Agent not found: ${step.agentId} for step "${step.name}"`);
    }

    console.log(`[flowEngine] Using agent: ${agent.name} (${agent.id})`);

    // Interpolate step prompt with user inputs and previous results
    const interpolationContext = {
      ...context.userInputs,
      ...buildStepContext(stepResults)
    };
    const interpolatedPrompt = interpolatePrompt(step.prompt, interpolationContext);

    // Assemble final prompt with agent context
    const fullPrompt = assemblePrompt(
      agent,
      [], // No additional instructions for now
      graphContext,
      interpolatedPrompt
    );

    // Call Language Model API
    const output = await callLanguageModel(fullPrompt, context.progress, step.name);

    stepResults.push({
      stepName: step.name,
      agentId: step.agentId,
      output
    });

    console.log(`[flowEngine] Step ${i + 1} completed: ${output.substring(0, 100)}...`);
  }

  // Combine all step outputs
  const finalOutput = stepResults.map(r => r.output).join('\n\n---\n\n');

  console.log(`[flowEngine] Flow execution completed: ${flow.id}`);
  return { stepResults, finalOutput };
}

/**
 * Validate that all required inputs are provided
 */
function validateFlowInputs(
  flow: FlowDefinition,
  userInputs: Record<string, string>
): string[] {
  const missingInputs: string[] = [];

  if (flow.inputs) {
    for (const input of flow.inputs) {
      if (input.required && !userInputs[input.name]) {
        missingInputs.push(input.name);
      }
    }
  }

  return missingInputs;
}

/**
 * Inject graph context based on flow context queries
 */
async function injectGraphContext(
  injections: FlowContextInjection[],
  workspaceRoot: string,
  userInputs: Record<string, string>
): Promise<string> {
  const contextParts: string[] = [];

  for (const injection of injections) {
    // Interpolate query with user inputs
    const interpolatedQuery = interpolatePrompt(injection.query, userInputs);

    console.log(`[flowEngine] Running graph query: ${interpolatedQuery}`);

    // Execute graph query
    // TODO: Implement actual graph query execution
    // For now, return a placeholder
    const result = `# ${injection.name}\n(Graph context will be injected here)`;

    contextParts.push(result);
  }

  return contextParts.join('\n\n');
}

/**
 * Build context from previous step results
 */
function buildStepContext(stepResults: Array<{ stepName: string; agentId: string; output: string }>): Record<string, string> {
  const context: Record<string, string> = {};

  for (let i = 0; i < stepResults.length; i++) {
    const result = stepResults[i];
    context[`step${i + 1}_output`] = result.output;
    context[`step${i + 1}_agent`] = result.agentId;
  }

  return context;
}

/**
 * Interpolate template variables in prompt
 * Supports: {variable}, {{variable}}, {step1_output}, etc.
 */
function interpolatePrompt(
  template: string,
  context: Record<string, string>
): string {
  let result = template;

  // Replace {variable} and {{variable}} patterns
  const patterns = [
    /\{\{([^}]+)\}\}/g,  // {{variable}}
    /\{([^}]+)\}/g       // {variable}
  ];

  for (const pattern of patterns) {
    const matches = template.match(pattern);
    if (matches) {
      for (const match of matches) {
        // Extract variable name (remove braces)
        const key = match.replace(/\{+|\}+/g, '').trim();
        const value = context[key];

        if (value !== undefined) {
          result = result.replace(new RegExp(match.replace(/[{}]/g, '\\$&'), 'g'), value);
        }
      }
    }
  }

  return result;
}

/**
 * Call Language Model API
 */
async function callLanguageModel(
  prompt: string,
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  stepName: string
): Promise<string> {
  try {
    // Get configured model
    const config = vscode.workspace.getConfiguration('nanodex');
    const modelString = config.get<string>('defaultModel');

    if (!modelString) {
      throw new Error('No model configured. Run "Nanodex: Select Model" first.');
    }

    progress.report({ message: `${stepName} - Calling ${modelString}...` });

    // Parse model string (e.g., "copilot/gpt-4o" -> vendor: "copilot", family: "gpt-4o")
    const parts = modelString.split('/');
    if (parts.length !== 2) {
      throw new Error(`Invalid model format: ${modelString}. Expected format: vendor/family`);
    }

    const [vendor, family] = parts;

    console.log(`[flowEngine] Querying for models: vendor="${vendor}", family="${family}"`);

    // Query available models with vendor and family
    const models = await vscode.lm.selectChatModels({
      vendor,
      family
    });

    console.log(`[flowEngine] Found ${models.length} matching models`);

    if (models.length === 0) {
      // Try without filters to see what's available
      console.log(`[flowEngine] No models found for ${vendor}/${family}, trying all models...`);
      const allModels = await vscode.lm.selectChatModels();
      console.log(`[flowEngine] ${allModels.length} total models available:`);
      allModels.forEach(m => console.log(`  - ${m.vendor}/${m.family} (${m.id})`));

      if (allModels.length > 0) {
        console.log(`[flowEngine] Using first available model: ${allModels[0].vendor}/${allModels[0].family}`);
        const model = allModels[0];

        // Create chat messages
        const messages = [
          vscode.LanguageModelChatMessage.User(prompt)
        ];

        // Send request
        const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

        // Collect response
        let fullResponse = '';
        for await (const chunk of response.text) {
          fullResponse += chunk;
        }

        return fullResponse;
      }

      throw new Error(`Model ${modelString} not available. Please run "Nanodex: Select Model" to choose an available model.`);
    }

    const model = models[0];
    console.log(`[flowEngine] Using model: ${model.id} (${model.vendor}/${model.family})`);

    // Create chat messages
    const messages = [
      vscode.LanguageModelChatMessage.User(prompt)
    ];

    // Send request
    const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

    // Collect response
    let fullResponse = '';
    for await (const chunk of response.text) {
      fullResponse += chunk;
    }

    return fullResponse;
  } catch (error) {
    console.error(`[flowEngine] Language model error:`, error);
    throw new Error(`Failed to call language model: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Find flow definition file by flow ID
 */
export function findFlowFile(flowId: string, extensionPath: string): string | undefined {
  // Flow files are in extension/dist/prompts/flows/ (after build)
  const flowsDir = path.join(extensionPath, 'dist', 'prompts', 'flows');

  // Extract flow name from ID (e.g., "nanodex.flow.plan" -> "plan")
  const flowName = flowId.split('.').pop();

  if (!flowName) {
    return undefined;
  }

  const flowPath = path.join(flowsDir, `${flowName}.flow.yaml`);

  return fs.existsSync(flowPath) ? flowPath : undefined;
}
