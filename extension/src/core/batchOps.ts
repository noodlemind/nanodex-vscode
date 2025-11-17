/**
 * Batch operations for optimized database access
 */

import Database from 'better-sqlite3';
import { Node, Edge, NodeType } from './types.js';

/**
 * Type guard for valid NodeType
 */
function isValidNodeType(type: string): type is NodeType {
  return Object.values(NodeType).includes(type as NodeType);
}

/**
 * Batch insert nodes
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
 * Batch insert edges
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
 * Batch delete nodes by IDs
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
 * Batch delete edges by source IDs
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
 * Batch query nodes by IDs
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
 * Optimize database (VACUUM and ANALYZE)
 */
export function optimizeDatabase(db: Database.Database): void {
  db.prepare('VACUUM').run();
  db.prepare('ANALYZE').run();
}

/**
 * Get database statistics
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
