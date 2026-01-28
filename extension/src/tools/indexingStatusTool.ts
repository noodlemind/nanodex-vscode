/**
 * Indexing Status Tool - Language Model Tool for checking indexing status
 */

import * as vscode from 'vscode';
import { getIndexingState } from '../core/indexingState.js';
import { IndexingStatusInput } from '../core/types.js';
import {
  createSuccessResult,
  checkCancellation
} from './utils.js';

export class NanodexIndexingStatusTool implements vscode.LanguageModelTool<IndexingStatusInput> {
  async invoke(
    _options: vscode.LanguageModelToolInvocationOptions<IndexingStatusInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    // Check cancellation
    const cancelled = checkCancellation(token);
    if (cancelled) return cancelled;

    const status = getIndexingState().getStatus();
    const lines: string[] = [];

    if (status.isIndexing) {
      lines.push('## Indexing In Progress\n');
      lines.push(`**Progress:** ${status.progress}%`);
      if (status.totalFiles && status.indexedFiles !== undefined) {
        lines.push(`**Files:** ${status.indexedFiles} / ${status.totalFiles}`);
      }
      if (status.currentFile) {
        lines.push(`**Current:** ${status.currentFile}`);
      }
      if (status.startedAt) {
        lines.push(`**Started:** ${status.startedAt}`);
      }
      lines.push('\nPlease wait for indexing to complete before querying the graph.');
    } else if (status.completedAt) {
      lines.push('## Indexing Complete\n');
      lines.push(`**Completed:** ${status.completedAt}`);
      if (status.totalFiles) {
        lines.push(`**Files indexed:** ${status.totalFiles}`);
      }
      if (status.lastError) {
        lines.push(`\n**Last Error:** ${status.lastError}`);
      }
      lines.push('\nThe knowledge graph is ready to query.');
    } else {
      lines.push('## Indexing Status\n');
      lines.push('No indexing has been performed in this session.');
      lines.push('Run "Nanodex: Index Workspace" to index the codebase.');
    }

    return createSuccessResult(lines.join('\n'));
  }

  async prepareInvocation(
    _options: vscode.LanguageModelToolInvocationPrepareOptions<IndexingStatusInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: 'Checking indexing status'
    };
  }
}
