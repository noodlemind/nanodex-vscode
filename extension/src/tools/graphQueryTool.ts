/**
 * Graph Query Tool - Language Model Tool for querying the knowledge graph
 */

import * as vscode from 'vscode';
import { selectRelevantContext, formatContext } from '../core/context.js';
import { GraphQueryInput } from '../core/types.js';
import {
  getDatabaseContext,
  isErrorResult,
  formatToolError,
  createSuccessResult,
  createErrorResult,
  withDatabase,
  validateInputLength,
  checkCancellation,
  MAX_QUERY_LENGTH
} from './utils.js';

export class NanodexGraphQueryTool implements vscode.LanguageModelTool<GraphQueryInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<GraphQueryInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { query, depth = 2 } = options.input;

    // Check cancellation
    const cancelled = checkCancellation(token);
    if (cancelled) return cancelled;

    // Validate input length
    const lengthError = validateInputLength(query, MAX_QUERY_LENGTH, 'Query');
    if (lengthError) return lengthError;

    // Validate depth
    const validatedDepth = Math.min(Math.max(depth, 1), 5);

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

        // Query the graph using existing context selection
        const contextResult = selectRelevantContext(query, db, validatedDepth, 2500);
        return formatContext(contextResult);
      });

      if (result === null) {
        return createErrorResult('Operation cancelled.');
      }

      if (!result || result.trim().length === 0) {
        return createErrorResult(
          `No relevant context found for query: "${query}". The knowledge graph may not contain information related to this query.`
        );
      }

      return createSuccessResult(result);
    } catch (error) {
      return formatToolError('querying knowledge graph', error);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<GraphQueryInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { query, depth = 2 } = options.input;
    const validatedDepth = Math.min(Math.max(depth, 1), 5);
    return {
      invocationMessage: `Querying nanodex knowledge graph for: "${query}" (depth: ${validatedDepth})`
    };
  }
}
