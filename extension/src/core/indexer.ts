/**
 * File indexing logic with TypeScript parsing
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import Database from 'better-sqlite3';
import { insertNode, insertEdge } from './graph.js';
import { NodeType, EdgeRelation } from './types.js';

export interface ParseResult {
  symbols: Array<{
    name: string;
    kind: string;
    line: number;
  }>;
  imports: Array<{
    source: string;
    specifiers: string[];
  }>;
}

/**
 * Calculate content hash for change detection
 */
export function calculateContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Parse TypeScript/JavaScript file and extract symbols
 */
export function parseTypeScript(content: string, filePath: string): ParseResult {
  const symbols: Array<{ name: string; kind: string; line: number }> = [];
  const imports: Array<{ source: string; specifiers: string[] }> = [];

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNumber = i + 1;

    // Extract class declarations
    const classMatch = line.match(/^export\s+(?:abstract\s+)?class\s+(\w+)/);
    if (classMatch) {
      symbols.push({
        name: classMatch[1],
        kind: 'class',
        line: lineNumber
      });
    }

    // Extract interface declarations
    const interfaceMatch = line.match(/^export\s+interface\s+(\w+)/);
    if (interfaceMatch) {
      symbols.push({
        name: interfaceMatch[1],
        kind: 'interface',
        line: lineNumber
      });
    }

    // Extract type declarations
    const typeMatch = line.match(/^export\s+type\s+(\w+)/);
    if (typeMatch) {
      symbols.push({
        name: typeMatch[1],
        kind: 'type',
        line: lineNumber
      });
    }

    // Extract enum declarations
    const enumMatch = line.match(/^export\s+enum\s+(\w+)/);
    if (enumMatch) {
      symbols.push({
        name: enumMatch[1],
        kind: 'enum',
        line: lineNumber
      });
    }

    // Extract function declarations
    const functionMatch = line.match(/^export\s+(?:async\s+)?function\s+(\w+)/);
    if (functionMatch) {
      symbols.push({
        name: functionMatch[1],
        kind: 'function',
        line: lineNumber
      });
    }

    // Extract const exports
    const constMatch = line.match(/^export\s+const\s+(\w+)/);
    if (constMatch) {
      symbols.push({
        name: constMatch[1],
        kind: 'const',
        line: lineNumber
      });
    }

    // Extract imports
    const importMatch = line.match(/^import\s+(?:{([^}]+)}|(\w+)|\*\s+as\s+(\w+))\s+from\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      const [, namedImports, defaultImport, namespaceImport, source] = importMatch;
      const specifiers: string[] = [];

      if (namedImports) {
        specifiers.push(...namedImports.split(',').map(s => s.trim()));
      }
      if (defaultImport) {
        specifiers.push(defaultImport);
      }
      if (namespaceImport) {
        specifiers.push(namespaceImport);
      }

      imports.push({ source, specifiers });
    }
  }

  return { symbols, imports };
}

/**
 * Index a single file and update the graph
 */
export async function indexFile(
  filePath: string,
  workspaceRoot: string,
  db: Database.Database
): Promise<void> {
  // Read file content
  const content = fs.readFileSync(filePath, 'utf-8');
  const contentHash = calculateContentHash(content);

  // Get relative path for node ID
  const relativePath = path.relative(workspaceRoot, filePath);
  const moduleId = `module:${relativePath}`;

  // Check if file has changed
  const existingNode = db.prepare('SELECT metadata FROM nodes WHERE id = ?').get(moduleId) as {
    metadata: string;
  } | undefined;

  if (existingNode) {
    const metadata = JSON.parse(existingNode.metadata);
    if (metadata.contentHash === contentHash) {
      // File unchanged, skip indexing
      return;
    }
  }

  // Parse the file
  const parseResult = parseTypeScript(content, filePath);

  // Start transaction
  const transaction = db.transaction(() => {
    // Insert/update module node
    insertNode(db, {
      id: moduleId,
      type: NodeType.Module,
      name: path.basename(filePath),
      metadata: {
        path: relativePath,
        contentHash,
        symbolCount: parseResult.symbols.length,
        importCount: parseResult.imports.length
      }
    });

    // Delete old symbol nodes for this module
    db.prepare('DELETE FROM nodes WHERE id LIKE ?').run(`symbol:${relativePath}:%`);

    // Insert symbol nodes
    for (const symbol of parseResult.symbols) {
      const symbolId = `symbol:${relativePath}:${symbol.name}`;

      insertNode(db, {
        id: symbolId,
        type: NodeType.Symbol,
        name: symbol.name,
        metadata: {
          kind: symbol.kind,
          line: symbol.line,
          module: relativePath
        }
      });

      // Create edge from module to symbol
      insertEdge(db, {
        sourceId: moduleId,
        targetId: symbolId,
        relation: EdgeRelation.DependsOn
      });
    }

    // Process imports
    for (const imp of parseResult.imports) {
      // Resolve import path
      let importPath = imp.source;

      // Handle relative imports
      if (importPath.startsWith('.')) {
        const fileDir = path.dirname(filePath);
        importPath = path.relative(
          workspaceRoot,
          path.resolve(fileDir, importPath)
        );

        // Add .ts extension if not present
        if (!importPath.endsWith('.ts') && !importPath.endsWith('.tsx') &&
            !importPath.endsWith('.js') && !importPath.endsWith('.jsx')) {
          if (fs.existsSync(path.join(workspaceRoot, `${importPath}.ts`))) {
            importPath = `${importPath}.ts`;
          } else if (fs.existsSync(path.join(workspaceRoot, `${importPath}.tsx`))) {
            importPath = `${importPath}.tsx`;
          }
        }

        const importModuleId = `module:${importPath}`;

        // Create import edge
        insertEdge(db, {
          sourceId: moduleId,
          targetId: importModuleId,
          relation: EdgeRelation.Imports,
          metadata: {
            specifiers: imp.specifiers
          }
        });
      }
    }
  });

  transaction();
}

/**
 * Get all TypeScript/JavaScript files in workspace
 */
export function getSourceFiles(
  workspaceRoot: string,
  exclude: string[]
): string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(workspaceRoot, fullPath);

      // Check exclusions
      if (exclude.some(pattern => {
        // Simple glob matching
        const regex = new RegExp(
          pattern
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '.')
        );
        return regex.test(relativePath);
      })) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(workspaceRoot);
  return files;
}
