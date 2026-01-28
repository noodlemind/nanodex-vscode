/**
 * Tool Registration - Register all nanodex Language Model Tools
 */

import * as vscode from 'vscode';
import { NanodexGraphQueryTool } from './graphQueryTool.js';
import { NanodexSymbolLookupTool } from './symbolLookupTool.js';
import { NanodexIssuesTool } from './issuesTool.js';
import { NanodexFileContextTool } from './fileContextTool.js';
import { NanodexGetIssueTool } from './getIssueTool.js';
import { NanodexCreateIssueTool } from './createIssueTool.js';
import { NanodexUpdateIssueStatusTool } from './updateIssueStatusTool.js';
import { NanodexDeleteIssueTool } from './deleteIssueTool.js';
import { NanodexGraphStatsTool } from './graphStatsTool.js';
import { NanodexIndexingStatusTool } from './indexingStatusTool.js';
import { NanodexListTodosTool } from './listTodosTool.js';
import { NanodexGetTodoTool } from './getTodoTool.js';
import { NanodexCreateTodoTool } from './createTodoTool.js';
import { NanodexUpdateTodoStatusTool } from './updateTodoStatusTool.js';

/**
 * Register all nanodex language model tools
 */
export function registerNanodexTools(context: vscode.ExtensionContext): void {
  // Check if the Language Model Tool API is available
  if (!vscode.lm || !vscode.lm.registerTool) {
    console.warn('Language Model Tool API is not available. Please upgrade to VS Code 1.106.0 or later.');
    return;
  }

  try {
    // Register each tool individually to preserve type safety
    context.subscriptions.push(
      vscode.lm.registerTool('nanodex-query-graph', new NanodexGraphQueryTool()),
      vscode.lm.registerTool('nanodex-lookup-symbol', new NanodexSymbolLookupTool()),
      vscode.lm.registerTool('nanodex-list-issues', new NanodexIssuesTool()),
      vscode.lm.registerTool('nanodex-get-file-context', new NanodexFileContextTool()),
      vscode.lm.registerTool('nanodex-get-issue', new NanodexGetIssueTool()),
      vscode.lm.registerTool('nanodex-create-issue', new NanodexCreateIssueTool()),
      vscode.lm.registerTool('nanodex-update-issue-status', new NanodexUpdateIssueStatusTool()),
      vscode.lm.registerTool('nanodex-delete-issue', new NanodexDeleteIssueTool()),
      vscode.lm.registerTool('nanodex-graph-stats', new NanodexGraphStatsTool()),
      vscode.lm.registerTool('nanodex-indexing-status', new NanodexIndexingStatusTool()),
      vscode.lm.registerTool('nanodex-list-todos', new NanodexListTodosTool()),
      vscode.lm.registerTool('nanodex-get-todo', new NanodexGetTodoTool()),
      vscode.lm.registerTool('nanodex-create-todo', new NanodexCreateTodoTool()),
      vscode.lm.registerTool('nanodex-update-todo-status', new NanodexUpdateTodoStatusTool())
    );
    console.log('Registered 14 nanodex language model tools');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to register language model tools:', errorMessage);
    vscode.window.showWarningMessage(
      `Failed to register nanodex tools: ${errorMessage}`
    );
  }
}

// Export tool classes for testing
export { NanodexGraphQueryTool } from './graphQueryTool.js';
export { NanodexSymbolLookupTool } from './symbolLookupTool.js';
export { NanodexIssuesTool } from './issuesTool.js';
export { NanodexFileContextTool } from './fileContextTool.js';
export { NanodexGetIssueTool } from './getIssueTool.js';
export { NanodexCreateIssueTool } from './createIssueTool.js';
export { NanodexUpdateIssueStatusTool } from './updateIssueStatusTool.js';
export { NanodexDeleteIssueTool } from './deleteIssueTool.js';
export { NanodexGraphStatsTool } from './graphStatsTool.js';
export { NanodexIndexingStatusTool } from './indexingStatusTool.js';
export { NanodexListTodosTool } from './listTodosTool.js';
export { NanodexGetTodoTool } from './getTodoTool.js';
export { NanodexCreateTodoTool } from './createTodoTool.js';
export { NanodexUpdateTodoStatusTool } from './updateTodoStatusTool.js';
