/**
 * Work command implementation
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { loadIssue, updateIssueStatus, listIssues } from '../core/issues.js';
import { loadInstructions } from '../core/prompts.js';
import { selectRelevantContext, formatContext } from '../core/context.js';
import { selectAgent, assemblePrompt } from '../core/router.js';
import { parseModelConfig } from '../core/modelUtils.js';

// Constants for context selection
const MAX_CONTEXT_DEPTH = 2;
const MAX_CONTEXT_TOKENS = 3000;

/**
 * Parsed file edit from LLM response
 */
interface FileEdit {
  filePath: string;
  content: string;
  operation: 'create' | 'update' | 'delete';
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
 * Call Language Model API to generate implementation
 */
async function callLanguageModel(prompt: string): Promise<string> {
  const config = vscode.workspace.getConfiguration('nanodex');
  const defaultModel = config.get<string>('defaultModel', 'copilot/gpt-4o');

  const tokenSource = new vscode.CancellationTokenSource();
  try {
    const modelConfig = parseModelConfig(defaultModel);
    const model = await selectLanguageModel(modelConfig);
    return await streamModelResponse(model, prompt, tokenSource.token);
  } finally {
    tokenSource.dispose();
  }
}

/**
 * Validate that a file path is within workspace boundaries
 */
function validatePathInWorkspace(filePath: string, workspaceRoot: string): boolean {
  const normalizedPath = path.normalize(filePath);
  const normalizedRoot = path.normalize(workspaceRoot);

  // Path must start with workspace root or be exactly the root
  return normalizedPath.startsWith(normalizedRoot + path.sep) || normalizedPath === normalizedRoot;
}

/**
 * Validate file edit for security and sanity
 */
function validateFileEdit(edit: FileEdit, workspaceRoot: string): string | undefined {
  // Check path is within workspace (CRITICAL SECURITY)
  if (!validatePathInWorkspace(edit.filePath, workspaceRoot)) {
    return `Security violation: Path ${edit.filePath} is outside workspace boundaries`;
  }

  // Validate file name doesn't contain dangerous patterns
  const fileName = path.basename(edit.filePath);
  if (fileName.startsWith('.') && !fileName.match(/^\.(gitignore|env\.example|editorconfig)$/)) {
    return `Suspicious file name: ${fileName} (dotfiles not allowed except specific cases)`;
  }

  // Check content size (prevent DoS)
  const maxSize = 1024 * 1024; // 1MB
  if (edit.content.length > maxSize) {
    return `File content too large: ${edit.content.length} bytes (max ${maxSize})`;
  }

  // Validate file path components
  const pathParts = edit.filePath.split(path.sep);
  for (const part of pathParts) {
    if (part === '..' || part === '.' || part.includes('\0')) {
      return `Invalid path component: ${part}`;
    }
  }

  return undefined; // Valid
}

/**
 * Parse file edits from LLM response
 */
function parseFileEdits(response: string, workspaceRoot: string): FileEdit[] {
  const edits: FileEdit[] = [];

  // Look for file blocks with size limit to prevent catastrophic backtracking
  const maxBlockSize = 1024 * 1024; // 1MB limit
  const fileBlockRegex = /```([^\n]+)\n([\s\S]{0,1048576}?)```/g;
  let match;

  while ((match = fileBlockRegex.exec(response)) !== null) {
    const header = match[1].trim();
    const content = match[2];

    // Warn if content may be truncated by regex limit
    if (content.length >= maxBlockSize - 10) {
      console.warn(
        `Warning: File block for "${header}" may be truncated (near ${maxBlockSize} byte limit). ` +
        `Content length: ${content.length} bytes`
      );
    }

    // Parse header for file path and operation
    let filePath: string;
    let operation: 'create' | 'update' | 'delete' = 'update';

    if (header.startsWith('DELETE:')) {
      operation = 'delete';
      filePath = header.substring('DELETE:'.length).trim();
    } else if (header.startsWith('CREATE:')) {
      operation = 'create';
      filePath = header.substring('CREATE:'.length).trim();
    } else {
      // Default to update, treat header as file path
      filePath = header;
    }

    // Normalize path
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(workspaceRoot, filePath);
    }

    const edit: FileEdit = {
      filePath,
      content,
      operation
    };

    // Validate edit
    const validationError = validateFileEdit(edit, workspaceRoot);
    if (validationError) {
      console.warn(`Skipping invalid file edit: ${validationError}`);
      continue;
    }

    edits.push(edit);
  }

  return edits;
}

/**
 * Create WorkspaceEdit from file edits
 */
async function createWorkspaceEdit(edits: FileEdit[]): Promise<vscode.WorkspaceEdit> {
  const workspaceEdit = new vscode.WorkspaceEdit();

  for (const edit of edits) {
    const uri = vscode.Uri.file(edit.filePath);

    if (edit.operation === 'delete') {
      workspaceEdit.deleteFile(uri, { ignoreIfNotExists: true });
    } else if (edit.operation === 'create') {
      // Create file and insert content (avoids race condition with replace)
      workspaceEdit.createFile(uri, { ignoreIfExists: true });
      workspaceEdit.insert(uri, new vscode.Position(0, 0), edit.content);
    } else {
      // Update existing file
      try {
        const document = await vscode.workspace.openTextDocument(uri);
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(document.getText().length)
        );
        workspaceEdit.replace(uri, fullRange, edit.content);
      } catch (error) {
        // File doesn't exist, create it instead
        workspaceEdit.createFile(uri, { ignoreIfExists: true });
        workspaceEdit.insert(uri, new vscode.Position(0, 0), edit.content);
      }
    }
  }

  return workspaceEdit;
}

/**
 * Show summary of edits to user
 */
async function showEditsSummary(edits: FileEdit[]): Promise<void> {
  if (edits.length === 0) {
    return;
  }

  // Group edits by operation
  const creates = edits.filter(e => e.operation === 'create');
  const updates = edits.filter(e => e.operation === 'update');
  const deletes = edits.filter(e => e.operation === 'delete');

  const summaryParts: string[] = [];

  if (creates.length > 0) {
    summaryParts.push(`**Create ${creates.length} file(s):**`);
    summaryParts.push(...creates.map(e => `  + ${path.relative(path.dirname(e.filePath), e.filePath)}`));
  }

  if (updates.length > 0) {
    summaryParts.push(`**Update ${updates.length} file(s):**`);
    summaryParts.push(...updates.map(e => `  ~ ${path.relative(path.dirname(e.filePath), e.filePath)}`));
  }

  if (deletes.length > 0) {
    summaryParts.push(`**Delete ${deletes.length} file(s):**`);
    summaryParts.push(...deletes.map(e => `  - ${path.relative(path.dirname(e.filePath), e.filePath)}`));
  }

  const summary = summaryParts.join('\n');

  // Show in output channel for reference
  const outputChannel = vscode.window.createOutputChannel('Nanodex Work');
  outputChannel.appendLine('Proposed Changes:');
  outputChannel.appendLine(summary);
  outputChannel.show(true);
}

/**
 * Select issue to work on
 */
async function selectIssue(workspaceRoot: string): Promise<string | undefined> {
  const issues = await listIssues(workspaceRoot);

  if (issues.length === 0) {
    vscode.window.showWarningMessage('No issues found. Create a plan first using "Nanodex: Plan".');
    return undefined;
  }

  // Filter to pending issues
  const pendingIssues = issues.filter(i => i.status === 'pending');

  if (pendingIssues.length === 0) {
    vscode.window.showWarningMessage('No pending issues found.');
    return undefined;
  }

  // Show quick pick
  const items = pendingIssues.map(issue => ({
    label: issue.id,
    description: issue.title,
    detail: issue.goal,
    issueId: issue.id
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select an issue to work on',
    matchOnDescription: true,
    matchOnDetail: true
  });

  return selected?.issueId;
}

export async function workCommand(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  try {
    // Step 1: Select issue
    const issueId = await selectIssue(workspaceFolder.uri.fsPath);

    if (!issueId) {
      return; // User cancelled
    }

    // Step 2: Load issue
    const issue = await loadIssue(workspaceFolder.uri.fsPath, issueId);

    if (!issue) {
      vscode.window.showErrorMessage(`Issue ${issueId} not found`);
      return;
    }

    if (!issue.plan) {
      vscode.window.showErrorMessage(`Issue ${issueId} has no plan. Run "Nanodex: Plan" first.`);
      return;
    }

    // Update status to in_progress
    await updateIssueStatus(workspaceFolder.uri.fsPath, issueId, 'in_progress');

    // Step 3: Generate implementation
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Working on ${issueId}`,
        cancellable: false
      },
      async (progress) => {
        progress.report({ message: 'Loading context...' });

        // Query graph for context
        const dbPath = path.join(workspaceFolder.uri.fsPath, '.nanodex', 'graph.sqlite');
        let graphContext = '';

        if (fs.existsSync(dbPath)) {
          let db: Database.Database | undefined;
          try {
            db = new Database(dbPath, { readonly: true });
            const context = selectRelevantContext(issue.goal, db, MAX_CONTEXT_DEPTH, MAX_CONTEXT_TOKENS);
            graphContext = formatContext(context);
          } catch (dbError) {
            console.error('Failed to query graph database:', dbError);
            graphContext = ''; // Reset on error
          } finally {
            db?.close();
          }
        }

        progress.report({ message: 'Loading instructions...' });

        // Load instructions
        const instructions = await loadInstructions(workspaceFolder.uri.fsPath);

        // Select implementer agent
        const agent = selectAgent('implement', instructions.agents);

        if (!agent) {
          throw new Error('Implementer agent not configured. Ensure AGENTS.md exists or built-in agents are loaded.');
        }

        progress.report({ message: 'Generating implementation...' });

        // Build implementation prompt
        const taskParts = [
          `Goal: ${issue.goal}`,
          '',
          'Plan:',
          issue.plan,
          ''
        ];

        if (issue.acceptanceCriteria && issue.acceptanceCriteria.length > 0) {
          taskParts.push('Acceptance Criteria:');
          taskParts.push(...issue.acceptanceCriteria.map(c => `- ${c}`));
          taskParts.push('');
        }

        if (issue.constraints && issue.constraints.length > 0) {
          taskParts.push('Constraints:');
          taskParts.push(...issue.constraints.map(c => `- ${c}`));
          taskParts.push('');
        }

        taskParts.push('Please provide file edits in the following format:');
        taskParts.push('```filepath');
        taskParts.push('file content here');
        taskParts.push('```');
        taskParts.push('');
        taskParts.push('Use CREATE: prefix for new files, DELETE: prefix for deletions.');

        const taskDescription = taskParts.join('\n');

        // Assemble prompt
        const prompt = assemblePrompt(
          agent,
          instructions.generalInstructions,
          graphContext,
          taskDescription
        );

        // Call Language Model API
        const llmResponse = await callLanguageModel(prompt);

        progress.report({ message: 'Parsing changes...' });

        // Parse file edits
        const edits = parseFileEdits(llmResponse, workspaceFolder.uri.fsPath);

        if (edits.length === 0) {
          vscode.window.showWarningMessage('No valid file edits found in implementation. Please try again.');
          await updateIssueStatus(workspaceFolder.uri.fsPath, issueId, 'pending');
          return;
        }

        progress.report({ message: 'Preparing summary...' });

        // Show edits summary
        await showEditsSummary(edits);

        // Create workspace edit
        const workspaceEdit = await createWorkspaceEdit(edits);

        // Count deletions for user awareness
        const deleteCount = edits.filter(e => e.operation === 'delete').length;
        const confirmMessage = deleteCount > 0
          ? `Apply ${edits.length} file change(s) for ${issueId}? (includes ${deleteCount} deletion(s))`
          : `Apply ${edits.length} file change(s) for ${issueId}?`;

        // Ask user to confirm
        const confirmation = await vscode.window.showInformationMessage(
          confirmMessage,
          { modal: true },
          'Apply',
          'Cancel'
        );

        if (confirmation === 'Apply') {
          progress.report({ message: 'Applying changes...' });

          const success = await vscode.workspace.applyEdit(workspaceEdit);

          if (success) {
            await updateIssueStatus(workspaceFolder.uri.fsPath, issueId, 'completed');
            vscode.window.showInformationMessage(`Successfully applied changes for ${issueId}`);
          } else {
            vscode.window.showErrorMessage(`Failed to apply changes for ${issueId}`);
            await updateIssueStatus(workspaceFolder.uri.fsPath, issueId, 'pending');
          }
        } else {
          // User cancelled
          await updateIssueStatus(workspaceFolder.uri.fsPath, issueId, 'pending');
        }
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to work on issue: ${errorMessage}`);
    // Try to reset issue status on error
    try {
      const issueId = await selectIssue(workspaceFolder.uri.fsPath);
      if (issueId) {
        await updateIssueStatus(workspaceFolder.uri.fsPath, issueId, 'pending');
      }
    } catch (statusError) {
      console.error('Failed to reset issue status:', statusError);
    }
  }
}
