/**
 * Plan command implementation
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { createIssue, getIssuePath } from '../core/issues.js';
import { loadInstructions } from '../core/prompts.js';
import { selectRelevantContext, formatContext } from '../core/context.js';
import { selectAgent, assemblePrompt } from '../core/router.js';
import { parseModelConfig } from '../core/modelUtils.js';

// Constants for context selection
const MAX_CONTEXT_DEPTH = 2;
const MAX_CONTEXT_TOKENS = 2000;

export async function planCommand(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  try {
    // Step 1: Get user goal
    const goal = await vscode.window.showInputBox({
      prompt: 'What do you want to implement?',
      placeHolder: 'e.g., Add user authentication with JWT',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Please enter a goal';
        }
        return null;
      }
    });

    if (!goal) {
      return; // User cancelled
    }

    // Step 2: Get acceptance criteria (optional)
    const acceptanceCriteriaInput = await vscode.window.showInputBox({
      prompt: 'Acceptance criteria (comma-separated, optional)',
      placeHolder: 'e.g., Users can register, JWT tokens expire after 24h'
    });

    const acceptanceCriteria = parseCommaSeparatedInput(acceptanceCriteriaInput);

    // Step 3: Get constraints (optional)
    const constraintsInput = await vscode.window.showInputBox({
      prompt: 'Constraints (comma-separated, optional)',
      placeHolder: 'e.g., Use bcrypt for passwords, Store tokens in httpOnly cookies'
    });

    const constraints = parseCommaSeparatedInput(constraintsInput);

    // Step 4: Query graph for relevant context
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Creating plan',
        cancellable: false
      },
      async (progress) => {
        progress.report({ message: 'Loading graph context...' });

        const dbPath = path.join(workspaceFolder.uri.fsPath, '.nanodex', 'graph.sqlite');
        let graphContext = '';
        let relatedModules: string[] = [];

        if (fs.existsSync(dbPath)) {
          let db: Database.Database | undefined;
          try {
            db = new Database(dbPath, { readonly: true });
            const context = selectRelevantContext(goal, db, MAX_CONTEXT_DEPTH, MAX_CONTEXT_TOKENS);
            graphContext = formatContext(context);

            // Extract module names for issue context
            relatedModules = context.nodes
              .filter(n => n.type === 'module')
              .map(n => n.name);
          } catch (dbError) {
            console.error('Failed to query graph database:', dbError);
          } finally {
            if (db) {
              db.close();
            }
          }
        }

        progress.report({ message: 'Loading instructions...' });

        // Load instructions
        const instructions = await loadInstructions(workspaceFolder.uri.fsPath);

        // Select planner agent
        const agent = selectAgent('plan', instructions.agents);

        if (!agent) {
          throw new Error('Planner agent not configured. Ensure AGENTS.md exists or built-in agents are loaded.');
        }

        progress.report({ message: 'Generating plan...' });

        // Format task description
        const taskParts = [`Goal: ${goal}`];

        taskParts.push('\nAcceptance Criteria:');
        if (acceptanceCriteria && acceptanceCriteria.length > 0) {
          taskParts.push(acceptanceCriteria.map(c => `- ${c}`).join('\n'));
        } else {
          taskParts.push('None specified');
        }

        taskParts.push('\nConstraints:');
        if (constraints && constraints.length > 0) {
          taskParts.push(constraints.map(c => `- ${c}`).join('\n'));
        } else {
          taskParts.push('None specified');
        }

        const taskDescription = taskParts.join('\n');

        // Assemble prompt
        const prompt = assemblePrompt(
          agent,
          instructions.generalInstructions,
          graphContext,
          taskDescription
        );

        // Call Language Model API
        const generatedPlan = await callLanguageModel(prompt);

        progress.report({ message: 'Saving issue...' });

        // Create issue with plan
        const issue = await createIssue(
          workspaceFolder.uri.fsPath,
          goal,
          goal,
          generatedPlan,
          {
            acceptanceCriteria,
            constraints,
            relatedModules,
            graphContext: graphContext ? { summary: graphContext } : undefined
          }
        );

        progress.report({ message: 'Complete!' });

        // Show success message with option to open issue
        const selection = await vscode.window.showInformationMessage(
          `Plan created: ${issue.id}`,
          'Open Issue',
          'Close'
        );

        if (selection === 'Open Issue') {
          const issueFilePath = getIssuePath(workspaceFolder.uri.fsPath, issue.id);
          const document = await vscode.workspace.openTextDocument(issueFilePath);
          await vscode.window.showTextDocument(document);
        }
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to create plan: ${errorMessage}`);
  }
}

/**
 * Select language model from VS Code API
 */
async function selectLanguageModel(modelConfig: { vendor: string; family: string }): Promise<vscode.LanguageModelChat> {
  const models = await vscode.lm.selectChatModels({
    vendor: modelConfig.vendor,
    family: modelConfig.family
  });

  if (models.length === 0) {
    throw new Error(`No language model found for ${modelConfig.vendor}/${modelConfig.family}`);
  }

  return models[0];
}

/**
 * Stream model response
 */
async function streamModelResponse(
  model: vscode.LanguageModelChat,
  prompt: string,
  token: vscode.CancellationToken
): Promise<string> {
  const messages = [vscode.LanguageModelChatMessage.User(prompt)];
  const request = await model.sendRequest(messages, {}, token);

  let response = '';
  for await (const fragment of request.text) {
    response += fragment;
  }

  return response.trim();
}

/**
 * Get default plan template for fallback
 */
function getDefaultPlanTemplate(): string {
  return `# Implementation Plan

## Overview
This is a placeholder plan. Language model API call failed.

## Steps
1. Analyze requirements
2. Design solution
3. Implement features
4. Write tests
5. Review and refine

## Notes
Please configure the language model in settings.`;
}

/**
 * Parse comma-separated input into array
 */
function parseCommaSeparatedInput(input: string | undefined): string[] | undefined {
  if (!input) {
    return undefined;
  }

  const items = input
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);

  return items.length > 0 ? items : undefined;
}

/**
 * Call Language Model API to generate plan
 */
async function callLanguageModel(prompt: string): Promise<string> {
  const config = vscode.workspace.getConfiguration('nanodex');
  const defaultModel = config.get<string>('defaultModel', 'copilot/gpt-4o');

  const tokenSource = new vscode.CancellationTokenSource();
  try {
    const modelConfig = parseModelConfig(defaultModel);
    const model = await selectLanguageModel(modelConfig);
    return await streamModelResponse(model, prompt, tokenSource.token);
  } catch (error) {
    console.error('Failed to call language model:', error);
    return getDefaultPlanTemplate();
  } finally {
    tokenSource.dispose();
  }
}
