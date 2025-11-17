/**
 * Batch operations for optimized database access
 *
 * This module provides batch operations for bulk database queries and mutations,
 * with automatic chunking to avoid SQLite parameter limits and transaction support
 * for atomic operations.
 *
 * @module batchOps
 */

import Database from 'better-sqlite3';
import { Node, Edge, NodeType } from './types.js';

/**
 * Type guard to validate NodeType from database at runtime.
 *
 * @param type - String value to validate
 * @returns True if type is a valid NodeType
 * @internal
 */
function isValidNodeType(type: string): type is NodeType {
  return Object.values(NodeType).includes(type as NodeType);
}

/**
 * Batch insert or replace nodes into the database.
 *
 * Uses a transaction for atomic insertion. If a node with the same ID exists,
 * it will be replaced with the new data.
 *
 * @param db - SQLite database instance
 * @param nodes - Array of nodes to insert
 *
 * @example
 * ```typescript
 * const nodes: Node[] = [
 *   { id: 'module:app.ts', type: NodeType.Module, name: 'app.ts' },
 *   { id: 'symbol:app.ts:MyClass', type: NodeType.Symbol, name: 'MyClass' }
 * ];
 * batchInsertNodes(db, nodes);
 * ```
 */
export function batchInsertNodes(db: Database.Database, nodes: Node[]): void {
  if (nodes.length === 0) {
    return;
  }

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO nodes (id, type, name, metadata, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((nodesToInsert: Node[]) => {
    for (const node of nodesToInsert) {
      insertStmt.run(
        node.id,
        node.type,
        node.name,
        JSON.stringify(node.metadata || {}),
        node.createdAt || Date.now()
      );
    }
  });

  transaction(nodes);
}

/**
 * Batch insert or replace edges into the database.
 *
 * Uses a transaction for atomic insertion. Duplicate edges (same source, target,
 * and relation) will be replaced.
 *
 * @param db - SQLite database instance
 * @param edges - Array of edges to insert
 *
 * @example
 * ```typescript
 * const edges: Edge[] = [
 *   { sourceId: 'module:app.ts', targetId: 'module:lib.ts', relation: EdgeRelation.Imports },
 *   { sourceId: 'symbol:app.ts:foo', targetId: 'symbol:lib.ts:bar', relation: EdgeRelation.Calls }
 * ];
 * batchInsertEdges(db, edges);
 * ```
 */
export function batchInsertEdges(db: Database.Database, edges: Edge[]): void {
  if (edges.length === 0) {
    return;
  }

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO edges (source_id, target_id, relation, metadata)
    VALUES (?, ?, ?, ?)
  `);

  const transaction = db.transaction((edgesToInsert: Edge[]) => {
    for (const edge of edgesToInsert) {
      insertStmt.run(
        edge.sourceId,
        edge.targetId,
        edge.relation,
        JSON.stringify(edge.metadata || {})
      );
    }
  });

  transaction(edges);
}

/**
 * Batch delete nodes by their IDs.
 *
 * Automatically chunks deletions to avoid SQLite's parameter limit (999).
 * Uses a transaction for atomic deletion.
 *
 * @param db - SQLite database instance
 * @param nodeIds - Array of node IDs to delete
 *
 * @example
 * ```typescript
 * const nodeIds = ['module:old.ts', 'symbol:old.ts:OldClass'];
 * batchDeleteNodes(db, nodeIds);
 * ```
 */
export function batchDeleteNodes(db: Database.Database, nodeIds: string[]): void {
  if (nodeIds.length === 0) {
    return;
  }

  // Split into chunks to avoid SQL parameter limits (SQLite has a limit of 999)
  const chunkSize = 500;
  const chunks: string[][] = [];

  for (let i = 0; i < nodeIds.length; i += chunkSize) {
    chunks.push(nodeIds.slice(i, i + chunkSize));
  }

  const transaction = db.transaction(() => {
    for (const chunk of chunks) {
      const placeholders = chunk.map(() => '?').join(',');
      const deleteStmt = db.prepare(`DELETE FROM nodes WHERE id IN (${placeholders})`);
      deleteStmt.run(...chunk);
    }
  });

  transaction();
}

/**
 * Batch delete edges by their source node IDs.
 *
 * Deletes all edges originating from the specified source nodes.
 * Automatically chunks deletions to avoid SQLite's parameter limit (999).
 * Uses a transaction for atomic deletion.
 *
 * @param db - SQLite database instance
 * @param sourceIds - Array of source node IDs
 *
 * @example
 * ```typescript
 * // Delete all edges from a module
 * const sourceIds = ['module:app.ts'];
 * batchDeleteEdgesBySource(db, sourceIds);
 * ```
 */
export function batchDeleteEdgesBySource(db: Database.Database, sourceIds: string[]): void {
  if (sourceIds.length === 0) {
    return;
  }

  const chunkSize = 500;
  const chunks: string[][] = [];

  for (let i = 0; i < sourceIds.length; i += chunkSize) {
    chunks.push(sourceIds.slice(i, i + chunkSize));
  }

  const transaction = db.transaction(() => {
    for (const chunk of chunks) {
      const placeholders = chunk.map(() => '?').join(',');
      const deleteStmt = db.prepare(`DELETE FROM edges WHERE source_id IN (${placeholders})`);
      deleteStmt.run(...chunk);
    }
  });

  transaction();
}

/**
 * Batch query nodes by their IDs.
 *
 * Automatically chunks queries to avoid SQLite's parameter limit (999).
 * Validates node types from database and skips invalid entries.
 *
 * @param db - SQLite database instance
 * @param nodeIds - Array of node IDs to query
 * @returns Array of found nodes (may be fewer than requested IDs)
 *
 * @example
 * ```typescript
 * const nodeIds = ['module:app.ts', 'symbol:app.ts:MyClass'];
 * const nodes = batchQueryNodes(db, nodeIds);
 * console.log(nodes.length); // 0-2 depending on what exists
 * ```
 */
export function batchQueryNodes(db: Database.Database, nodeIds: string[]): Node[] {
  if (nodeIds.length === 0) {
    return [];
  }

  const chunkSize = 500;
  const results: Node[] = [];

  for (let i = 0; i < nodeIds.length; i += chunkSize) {
    const chunk = nodeIds.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '?').join(',');

    const stmt = db.prepare(`
      SELECT id, type, name, metadata, created_at
      FROM nodes
      WHERE id IN (${placeholders})
    `);

    // Type assertion is safe because:
    // 1. SQL query selects specific columns matching this shape
    // 2. Database schema is controlled by our migrations
    // 3. SQLite returns objects with these exact properties
    // 4. We validate the critical 'type' field below with isValidNodeType()
    const rows = stmt.all(...chunk) as Array<{
      id: string;
      type: string;
      name: string;
      metadata: string;
      created_at: number;
    }>;

    for (const row of rows) {
      // Validate node type from database
      if (!isValidNodeType(row.type)) {
        console.error(`Invalid node type from database: ${row.type}`);
        continue; // Skip invalid nodes
      }

      results.push({
        id: row.id,
        type: row.type,
        name: row.name,
        metadata: JSON.parse(row.metadata),
        createdAt: row.created_at
      });
    }
  }

  return results;
}

/**
 * Optimize database using VACUUM and ANALYZE.
 *
 * VACUUM reclaims unused space and defragments the database file.
 * ANALYZE updates query optimizer statistics for better performance.
 *
 * Warning: VACUUM requires free disk space roughly equal to the database size
 * and briefly locks the entire database.
 *
 * @param db - SQLite database instance
 * @throws {Error} If database is locked, insufficient disk space, or database is corrupted
 *
 * @example
 * ```typescript
 * try {
 *   optimizeDatabase(db);
 *   console.log('Database optimized');
 * } catch (error) {
 *   console.error('Optimization failed:', error);
 * }
 * ```
 */
export function optimizeDatabase(db: Database.Database): void {
  db.prepare('VACUUM').run();
  db.prepare('ANALYZE').run();
}

/**
 * Get database statistics including size and fragmentation.
 *
 * @param db - SQLite database instance
 * @returns Database statistics object
 *
 * @example
 * ```typescript
 * const stats = getDatabaseStats(db);
 * console.log(`Database size: ${stats.sizeBytes} bytes`);
 * console.log(`Fragmentation: ${stats.fragmentationPercent.toFixed(2)}%`);
 * ```
 */
export function getDatabaseStats(db: Database.Database): {
  pageSize: number;
  pageCount: number;
  sizeBytes: number;
  fragmentationPercent: number;
} {
  const pageSizeRow = db.prepare('PRAGMA page_size').get() as { page_size: number };
  const pageCountRow = db.prepare('PRAGMA page_count').get() as { page_count: number };
  const freePagesRow = db.prepare('PRAGMA freelist_count').get() as { freelist_count: number };

  const pageSize = pageSizeRow.page_size;
  const pageCount = pageCountRow.page_count;
  const freePages = freePagesRow.freelist_count;

  const sizeBytes = pageSize * pageCount;
  const fragmentationPercent = pageCount > 0 ? (freePages / pageCount) * 100 : 0;

  return {
    pageSize,
    pageCount,
    sizeBytes,
    fragmentationPercent
  };
}
