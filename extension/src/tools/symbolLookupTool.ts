/**
 * Symbol Lookup Tool - Language Model Tool for looking up specific symbols
 */

import * as vscode from 'vscode';
import { querySubgraph } from '../core/graph.js';
import { SymbolLookupInput } from '../core/types.js';
import {
  getDatabaseContext,
  isErrorResult,
  formatToolError,
  createSuccessResult,
  createErrorResult,
  withDatabase,
  escapeSqlLike,
  validateInputLength,
  checkCancellation,
  parseMetadata,
  NodeRow,
  MAX_SYMBOL_NAME_LENGTH
} from './utils.js';

export class NanodexSymbolLookupTool implements vscode.LanguageModelTool<SymbolLookupInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<SymbolLookupInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { symbolName, includeRelationships = true } = options.input;

    // Check cancellation
    const cancelled = checkCancellation(token);
    if (cancelled) return cancelled;

    // Validate input length
    const lengthError = validateInputLength(symbolName, MAX_SYMBOL_NAME_LENGTH, 'Symbol name');
    if (lengthError) return lengthError;

    // Get database context
    const dbContext = getDatabaseContext();
    if (isErrorResult(dbContext)) {
      return dbContext;
    }

    try {
      const result = await withDatabase(dbContext.dbPath, (db) => {
        // Check cancellation before query
        if (token.isCancellationRequested) {
          return null;
        }

        // Escape SQL LIKE wildcards to prevent injection
        const escapedSymbolName = escapeSqlLike(symbolName);

        // Search for symbols by name
        const symbols = db.prepare(
          `SELECT * FROM nodes WHERE type = 'symbol' AND name LIKE ? ESCAPE '\\' LIMIT 10`
        ).all(`%${escapedSymbolName}%`) as NodeRow[];

        if (symbols.length === 0) {
          return {
            found: false,
            message: `No symbol found matching "${symbolName}". The symbol may not exist or has not been indexed yet.`
          };
        }

        // Format results
        const results: string[] = [];
        results.push(`Found ${symbols.length} symbol(s) matching "${symbolName}":\n`);

        for (const symbol of symbols) {
          // Check cancellation during iteration
          if (token.isCancellationRequested) {
            return null;
          }

          results.push(`\n**${symbol.name}** (${symbol.id})`);

          // Parse metadata if available
          const metadata = parseMetadata(symbol.metadata);
          if (metadata) {
            if (metadata.kind) {
              results.push(`- Kind: ${metadata.kind}`);
            }
            if (metadata.filePath) {
              results.push(`- File: ${metadata.filePath}`);
            }
            if (metadata.range && typeof metadata.range === 'object') {
              const range = metadata.range as { start?: { line?: number } };
              if (range.start?.line !== undefined) {
                results.push(`- Location: Line ${range.start.line + 1}`);
              }
            }
          } else if (symbol.metadata) {
            // Metadata exists but failed to parse
            results.push(`- Metadata: [parse error]`);
          }

          // Include relationships if requested
          if (includeRelationships) {
            const subgraph = querySubgraph(db, symbol.id, 1);

            if (subgraph.edges.length > 0) {
              results.push(`- Relationships:`);

              const groupedEdges = new Map<string, number>();
              for (const edge of subgraph.edges) {
                const count = groupedEdges.get(edge.relation) || 0;
                groupedEdges.set(edge.relation, count + 1);
              }

              for (const [relation, count] of groupedEdges.entries()) {
                results.push(`  - ${relation}: ${count}`);
              }
            }
          }
        }

        return { found: true, content: results.join('\n') };
      });

      if (result === null) {
        return createErrorResult('Operation cancelled.');
      }

      if (!result.found) {
        return createErrorResult(result.message!);
      }

      return createSuccessResult(result.content!);
    } catch (error) {
      return formatToolError('looking up symbol', error);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<SymbolLookupInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { symbolName } = options.input;
    return {
      invocationMessage: `Looking up symbol: "${symbolName}" in nanodex knowledge graph`
    };
  }
}
