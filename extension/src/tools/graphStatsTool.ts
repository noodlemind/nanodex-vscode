/**
 * Graph Stats Tool - Language Model Tool for getting knowledge graph statistics
 */

import * as vscode from 'vscode';
import { getGraphStats } from '../core/graph.js';
import { GraphStatsInput } from '../core/types.js';
import {
  getDatabaseContext,
  isErrorResult,
  formatToolError,
  createSuccessResult,
  checkCancellation,
  withDatabase
} from './utils.js';

export class NanodexGraphStatsTool implements vscode.LanguageModelTool<GraphStatsInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<GraphStatsInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { detailed = false } = options.input || {};

    // Check cancellation
    const cancelled = checkCancellation(token);
    if (cancelled) return cancelled;

    // Get database context
    const dbContext = getDatabaseContext();
    if (isErrorResult(dbContext)) {
      return dbContext;
    }

    try {
      const result = withDatabase(dbContext.dbPath, (db) => {
        // Check cancellation before query
        if (token.isCancellationRequested) {
          return null;
        }

        return getGraphStats(db);
      });

      if (result === null) {
        return createSuccessResult('Operation cancelled.');
      }

      // Format the stats
      const lines: string[] = [];
      lines.push('## Knowledge Graph Statistics\n');
      lines.push(`**Total Nodes:** ${result.totalNodes}`);
      lines.push(`**Total Edges:** ${result.totalEdges}`);
      lines.push(`**Database Size:** ${(result.databaseSize / 1024).toFixed(2)} KB`);

      if (detailed || result.totalNodes > 0) {
        lines.push('\n### Nodes by Type');
        for (const [type, count] of Object.entries(result.nodesByType)) {
          if (count > 0) {
            lines.push(`- ${type}: ${count}`);
          }
        }

        lines.push('\n### Edges by Relation');
        for (const [relation, count] of Object.entries(result.edgesByRelation)) {
          if (count > 0) {
            lines.push(`- ${relation}: ${count}`);
          }
        }
      }

      return createSuccessResult(lines.join('\n'));
    } catch (error) {
      return formatToolError('getting graph stats', error);
    }
  }

  async prepareInvocation(
    _options: vscode.LanguageModelToolInvocationPrepareOptions<GraphStatsInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: 'Getting knowledge graph statistics'
    };
  }
}
