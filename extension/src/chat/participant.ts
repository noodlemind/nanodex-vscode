/**
 * Chat Participant Implementation
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { loadInstructions } from '../core/prompts.js';
import { selectRelevantContext, formatContext } from '../core/context.js';
import { selectAgent, assemblePrompt } from '../core/router.js';
import { listIssues } from '../core/issues.js';

// Constants
const MAX_CONTEXT_DEPTH = 2;
const MAX_CONTEXT_TOKENS = 2500;

/**
 * Metadata structure for chat results
 */
interface ChatResultMetadata {
  command?: string;
  count?: number;
  error?: string;
  hasContext?: boolean;
  pendingCount?: number;
}

/**
 * Type guard for ChatResultMetadata
 */
function isChatResultMetadata(metadata: unknown): metadata is ChatResultMetadata {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }

  const candidate = metadata as Record<string, unknown>;

  // Validate optional fields
  if (candidate.command !== undefined && typeof candidate.command !== 'string') {
    return false;
  }
  if (candidate.count !== undefined && typeof candidate.count !== 'number') {
    return false;
  }
  if (candidate.error !== undefined && typeof candidate.error !== 'string') {
    return false;
  }
  if (candidate.hasContext !== undefined && typeof candidate.hasContext !== 'boolean') {
    return false;
  }
  if (candidate.pendingCount !== undefined && typeof candidate.pendingCount !== 'number') {
    return false;
  }

  return true;
}

/**
 * Model configuration interface
 */
interface ModelConfig {
  vendor: string;
  family: string;
}

/**
 * Parse model configuration string
 */
function parseModelConfig(modelString: string): ModelConfig {
  const parts = modelString.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid model format: ${modelString}. Expected format: provider/model-name`);
  }
  return { vendor: parts[0], family: parts[1] };
}

/**
 * Get language model based on configuration strategy
 */
async function getLanguageModel(): Promise<vscode.LanguageModelChat> {
  const config = vscode.workspace.getConfiguration('nanodex');
  const modelStrategy = config.get<string>('chat.modelStrategy', 'useChatModel');

  if (modelStrategy === 'useConfiguredModel') {
    // Use the configured default model
    const defaultModel = config.get<string>('defaultModel', 'copilot/gpt-4o');
    const modelConfig = parseModelConfig(defaultModel);

    const models = await vscode.lm.selectChatModels({
      vendor: modelConfig.vendor,
      family: modelConfig.family
    });

    if (models.length === 0) {
      throw new Error(`No language model found for ${modelConfig.vendor}/${modelConfig.family}`);
    }

    return models[0];
  } else {
    // Default: use active chat panel model (useChatModel)
    const models = await vscode.lm.selectChatModels();

    if (models.length === 0) {
      throw new Error('No language model available. Please ensure GitHub Copilot is enabled.');
    }

    return models[0];
  }
}

/**
 * Query graph context safely with proper resource cleanup
 */
function queryGraphContext(
  prompt: string,
  workspaceRoot: string,
  maxDepth: number = MAX_CONTEXT_DEPTH,
  maxTokens: number = MAX_CONTEXT_TOKENS
): string {
  const dbPath = path.join(workspaceRoot, '.nanodex', 'graph.sqlite');

  if (!fs.existsSync(dbPath)) {
    return '';
  }

  let db: Database.Database | undefined;
  try {
    db = new Database(dbPath, { readonly: true });
    const contextResult = selectRelevantContext(prompt, db, maxDepth, maxTokens);
    return formatContext(contextResult);
  } catch (error) {
    console.error('Failed to query graph context:', error);
    return '';
  } finally {
    db?.close();
  }
}

/**
 * Handle chat request with context awareness
 */
async function handleChatRequest(
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<vscode.ChatResult> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    stream.markdown('No workspace folder is open. Please open a workspace to use Nanodex.');
    return { metadata: { command: '' } };
  }

  try {
    // Parse command from prompt
    const prompt = request.prompt.trim();
    const command = request.command;

    // Handle different chat commands
    if (command === 'plan') {
      return await handlePlanRequest(prompt, workspaceFolder, stream, token);
    } else if (command === 'work') {
      return await handleWorkRequest(prompt, workspaceFolder, stream, token);
    } else if (command === 'explain') {
      return await handleExplainRequest(prompt, workspaceFolder, context, stream, token);
    } else if (command === 'issues') {
      return await handleIssuesRequest(workspaceFolder, stream);
    } else {
      // Default: general question with graph context
      return await handleGeneralRequest(prompt, workspaceFolder, context, stream, token);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    stream.markdown(`❌ Error: ${errorMessage}`);
    return { metadata: { command: request.command || '', error: errorMessage } };
  }
}

/**
 * Handle plan request
 */
async function handlePlanRequest(
  prompt: string,
  workspaceFolder: vscode.WorkspaceFolder,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<vscode.ChatResult> {
  stream.markdown('To create a plan, please use the **Nanodex: Plan** command from the command palette.\n\n');
  stream.markdown('This will guide you through:\n');
  stream.markdown('- Defining your goal\n');
  stream.markdown('- Setting acceptance criteria\n');
  stream.markdown('- Adding constraints\n');
  stream.markdown('- Generating an AI-powered implementation plan\n');

  stream.button({
    command: 'nanodex.plan',
    title: 'Open Plan Command'
  });

  return { metadata: { command: 'plan' } };
}

/**
 * Handle work request
 */
async function handleWorkRequest(
  prompt: string,
  workspaceFolder: vscode.WorkspaceFolder,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<vscode.ChatResult> {
  // Check for pending issues
  const issues = await listIssues(workspaceFolder.uri.fsPath);
  const pendingIssues = issues.filter(i => i.status === 'pending');

  if (pendingIssues.length === 0) {
    stream.markdown('No pending issues found. Create a plan first!\n\n');
    stream.button({
      command: 'nanodex.plan',
      title: 'Create Plan'
    });
  } else {
    stream.markdown(`Found ${pendingIssues.length} pending issue(s). Use the **Nanodex: Work** command to start implementation.\n\n`);

    stream.markdown('**Pending Issues:**\n');
    for (const issue of pendingIssues.slice(0, 5)) {
      stream.markdown(`- **${issue.id}**: ${issue.title}\n`);
    }

    stream.markdown('\n');
    stream.button({
      command: 'nanodex.work',
      title: 'Start Work'
    });
  }

  return { metadata: { command: 'work', pendingCount: pendingIssues.length } };
}

/**
 * Handle explain request with graph context
 */
async function handleExplainRequest(
  prompt: string,
  workspaceFolder: vscode.WorkspaceFolder,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<vscode.ChatResult> {
  stream.progress('Loading codebase context...');

  // Query graph database for context using safe helper
  const graphContext = queryGraphContext(prompt, workspaceFolder.uri.fsPath);

  if (!graphContext) {
    stream.markdown('⚠️ No graph data available. Run **Nanodex: Index Workspace** first to build the knowledge graph.\n\n');
    stream.button({
      command: 'nanodex.index',
      title: 'Index Workspace'
    });
    return { metadata: { command: 'explain', hasContext: false } };
  }

  // Use chat model to explain with context
  stream.progress('Generating explanation...');

  try {
    // Get language model based on configuration strategy
    const model = await getLanguageModel();

    // Build prompt with graph context
    const systemPrompt = `You are Nanodex, a code assistant with access to a knowledge graph of the codebase.

**Codebase Context:**
${graphContext}

Use this context to answer the user's question accurately and concisely.`;

    const messages = [
      vscode.LanguageModelChatMessage.User(systemPrompt),
      vscode.LanguageModelChatMessage.User(prompt)
    ];

    const chatRequest = await model.sendRequest(messages, {}, token);

    for await (const fragment of chatRequest.text) {
      stream.markdown(fragment);
    }

    return { metadata: { command: 'explain', hasContext: true } };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    stream.markdown(`\n\n❌ Failed to generate explanation: ${errorMessage}`);
    return { metadata: { command: 'explain', error: errorMessage } };
  }
}

/**
 * Handle issues list request
 */
async function handleIssuesRequest(
  workspaceFolder: vscode.WorkspaceFolder,
  stream: vscode.ChatResponseStream
): Promise<vscode.ChatResult> {
  const issues = await listIssues(workspaceFolder.uri.fsPath);

  if (issues.length === 0) {
    stream.markdown('No issues found. Create your first plan!\n\n');
    stream.button({
      command: 'nanodex.plan',
      title: 'Create Plan'
    });
    return { metadata: { command: 'issues', count: 0 } };
  }

  // Group by status
  const pending = issues.filter(i => i.status === 'pending');
  const inProgress = issues.filter(i => i.status === 'in_progress');
  const completed = issues.filter(i => i.status === 'completed');

  stream.markdown(`## Issues Summary\n\n`);
  stream.markdown(`Total: ${issues.length} | Pending: ${pending.length} | In Progress: ${inProgress.length} | Completed: ${completed.length}\n\n`);

  if (pending.length > 0) {
    stream.markdown('### 📋 Pending\n');
    for (const issue of pending.slice(0, 5)) {
      stream.markdown(`- **${issue.id}**: ${issue.title}\n`);
    }
    stream.markdown('\n');
  }

  if (inProgress.length > 0) {
    stream.markdown('### 🚧 In Progress\n');
    for (const issue of inProgress) {
      stream.markdown(`- **${issue.id}**: ${issue.title}\n`);
    }
    stream.markdown('\n');
  }

  if (completed.length > 0) {
    stream.markdown('### ✅ Completed\n');
    for (const issue of completed.slice(0, 3)) {
      stream.markdown(`- **${issue.id}**: ${issue.title}\n`);
    }
    stream.markdown('\n');
  }

  return { metadata: { command: 'issues', count: issues.length } };
}

/**
 * Handle general chat request with context
 */
async function handleGeneralRequest(
  prompt: string,
  workspaceFolder: vscode.WorkspaceFolder,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<vscode.ChatResult> {
  // Check if graph is indexed
  const dbPath = path.join(workspaceFolder.uri.fsPath, '.nanodex', 'graph.sqlite');

  if (!fs.existsSync(dbPath)) {
    stream.markdown('⚠️ Workspace not indexed. For context-aware responses, please index your workspace first.\n\n');
    stream.button({
      command: 'nanodex.index',
      title: 'Index Workspace'
    });
    stream.markdown('\n\nI can still help with general questions, but I won\'t have knowledge of your specific codebase.\n\n');
  }

  stream.progress('Thinking...');

  try {
    // Get language model based on configuration strategy
    const model = await getLanguageModel();

    // Load instructions for context
    const instructions = await loadInstructions(workspaceFolder.uri.fsPath);
    const generalInstructions = instructions.generalInstructions.join('\n\n');

    // Query graph context using safe helper
    const graphContext = queryGraphContext(prompt, workspaceFolder.uri.fsPath);

    // Build messages with context
    const messages: vscode.LanguageModelChatMessage[] = [];

    if (generalInstructions || graphContext) {
      let systemContext = 'You are Nanodex, a helpful code assistant.\n\n';

      if (generalInstructions) {
        systemContext += `**Project Instructions:**\n${generalInstructions}\n\n`;
      }

      if (graphContext) {
        systemContext += `**Codebase Context:**\n${graphContext}\n\n`;
      }

      messages.push(vscode.LanguageModelChatMessage.User(systemContext));
    }

    // Add conversation history from context
    for (const historyItem of context.history) {
      if (historyItem instanceof vscode.ChatRequestTurn) {
        messages.push(vscode.LanguageModelChatMessage.User(historyItem.prompt));
      } else if (historyItem instanceof vscode.ChatResponseTurn) {
        // Note: ChatResponseTurn doesn't have direct text access in API
        // We'll rely on the model's context window
      }
    }

    messages.push(vscode.LanguageModelChatMessage.User(prompt));

    const chatRequest = await model.sendRequest(messages, {}, token);

    for await (const fragment of chatRequest.text) {
      stream.markdown(fragment);
    }

    return { metadata: { command: 'general', hasContext: !!graphContext } };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    stream.markdown(`\n\n❌ Error: ${errorMessage}`);
    return { metadata: { command: 'general', error: errorMessage } };
  }
}

/**
 * Register chat participant
 */
export function registerChatParticipant(context: vscode.ExtensionContext): void {
  const participant = vscode.chat.createChatParticipant('nanodex', handleChatRequest);

  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icon.png');

  // Add slash commands
  participant.followupProvider = {
    provideFollowups(result: vscode.ChatResult, context: vscode.ChatContext, token: vscode.CancellationToken) {
      const followups: vscode.ChatFollowup[] = [];

      if (!result.metadata) {
        return followups;
      }

      // Validate metadata structure before use
      if (!isChatResultMetadata(result.metadata)) {
        console.warn('Invalid metadata structure in chat result');
        return followups;
      }

      const metadata = result.metadata;

      if (metadata.command === 'plan') {
        followups.push({
          prompt: 'Show me pending issues',
          label: '📋 View Issues',
          command: 'issues'
        });
      } else if (metadata.command === 'issues' && metadata.count && metadata.count > 0) {
        followups.push({
          prompt: 'Start working on an issue',
          label: '🚀 Start Work',
          command: 'work'
        });
      } else if (metadata.command === 'explain' && !metadata.error) {
        followups.push({
          prompt: 'Explain more about this',
          label: '💡 More Details'
        });
      }

      // Always offer help
      followups.push({
        prompt: 'What can you help me with?',
        label: '❓ Help',
        command: ''
      });

      return followups;
    }
  };

  context.subscriptions.push(participant);
}
