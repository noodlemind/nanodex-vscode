/**
 * Tool Registration - Register all nanodex Language Model Tools
 */

import * as vscode from 'vscode';
import { NanodexGraphQueryTool } from './graphQueryTool.js';
import { NanodexSymbolLookupTool } from './symbolLookupTool.js';
import { NanodexIssuesTool } from './issuesTool.js';
import { NanodexFileContextTool } from './fileContextTool.js';

/**
 * Register all nanodex language model tools
 */
export function registerNanodexTools(context: vscode.ExtensionContext): void {
  // Check if the Language Model Tool API is available
  if (!vscode.lm || !vscode.lm.registerTool) {
    console.warn('Language Model Tool API is not available in this version of VS Code. Tools will not be registered.');
    console.warn('Please upgrade to VS Code 1.106.0 or later to use nanodex tools.');
    return;
  }

  try {
    console.log('Registering nanodex language model tools...');

    // Register graph query tool
    const graphQueryTool = vscode.lm.registerTool(
      'nanodex-query-graph',
      new NanodexGraphQueryTool()
    );
    context.subscriptions.push(graphQueryTool);
    console.log('Registered: nanodex-query-graph');

    // Register symbol lookup tool
    const symbolLookupTool = vscode.lm.registerTool(
      'nanodex-lookup-symbol',
      new NanodexSymbolLookupTool()
    );
    context.subscriptions.push(symbolLookupTool);
    console.log('Registered: nanodex-lookup-symbol');

    // Register issues tool
    const issuesTool = vscode.lm.registerTool(
      'nanodex-list-issues',
      new NanodexIssuesTool()
    );
    context.subscriptions.push(issuesTool);
    console.log('Registered: nanodex-list-issues');

    // Register file context tool
    const fileContextTool = vscode.lm.registerTool(
      'nanodex-get-file-context',
      new NanodexFileContextTool()
    );
    context.subscriptions.push(fileContextTool);
    console.log('Registered: nanodex-get-file-context');

    console.log('All nanodex language model tools registered successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to register language model tools:', errorMessage, error);
    vscode.window.showWarningMessage(
      `Failed to register some nanodex tools: ${errorMessage}. Tool calling may not work properly.`
    );
  }
}

// Export tool classes for testing
export { NanodexGraphQueryTool } from './graphQueryTool.js';
export { NanodexSymbolLookupTool } from './symbolLookupTool.js';
export { NanodexIssuesTool } from './issuesTool.js';
export { NanodexFileContextTool } from './fileContextTool.js';
