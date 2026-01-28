/**
 * SQLite-based knowledge graph implementation
 */

import Database from 'better-sqlite3';
import { Node, Edge, NodeType, EdgeRelation, SubgraphResult, GraphStats } from './types.js';
import { getSubgraphCache } from './queryCache.js';

/**
 * Initialize the graph database with schema and indexes
 */
export function initializeGraphDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Create nodes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Create edges table
  db.exec(`
    CREATE TABLE IF NOT EXISTS edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      relation TEXT NOT NULL,
      metadata TEXT,
      FOREIGN KEY (source_id) REFERENCES nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (target_id) REFERENCES nodes(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
    CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
    CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
    CREATE INDEX IF NOT EXISTS idx_edges_relation ON edges(relation);
  `);

  return db;
}

/**
 * Insert a node into the graph
 */
export function insertNode(db: Database.Database, node: Node): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO nodes (id, type, name, metadata, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    node.id,
    node.type,
    node.name,
    node.metadata ? JSON.stringify(node.metadata) : null,
    node.createdAt || Math.floor(Date.now() / 1000)
  );
}

/**
 * Update a node's properties
 */
export function updateNode(
  db: Database.Database,
  id: string,
  updates: Partial<Node>
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }

  if (updates.type !== undefined) {
    fields.push('type = ?');
    values.push(updates.type);
  }

  if (updates.metadata !== undefined) {
    fields.push('metadata = ?');
    values.push(JSON.stringify(updates.metadata));
  }

  if (fields.length === 0) {
    return;
  }

  values.push(id);

  const stmt = db.prepare(`
    UPDATE nodes
    SET ${fields.join(', ')}
    WHERE id = ?
  `);

  stmt.run(...values);
}

/**
 * Delete a node and its associated edges
 */
export function deleteNode(db: Database.Database, id: string): void {
  const stmt = db.prepare('DELETE FROM nodes WHERE id = ?');
  stmt.run(id);
}

/**
 * Insert an edge into the graph
 */
export function insertEdge(db: Database.Database, edge: Edge): void {
  const stmt = db.prepare(`
    INSERT INTO edges (source_id, target_id, relation, metadata)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(
    edge.sourceId,
    edge.targetId,
    edge.relation,
    edge.metadata ? JSON.stringify(edge.metadata) : null
  );
}

/**
 * Query a subgraph starting from a root node
 */
export function querySubgraph(
  db: Database.Database,
  rootId: string,
  maxDepth: number
): SubgraphResult {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const visited = new Set<string>();

  function traverseNode(nodeId: string, currentDepth: number): void {
    if (currentDepth > maxDepth || visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);

    // Fetch the node
    const nodeStmt = db.prepare('SELECT * FROM nodes WHERE id = ?');
    const nodeRow = nodeStmt.get(nodeId) as {
      id: string;
      type: string;
      name: string;
      metadata: string | null;
      created_at: number;
    } | undefined;

    if (!nodeRow) {
      return;
    }

    nodes.push({
      id: nodeRow.id,
      type: nodeRow.type as NodeType,
      name: nodeRow.name,
      metadata: nodeRow.metadata ? JSON.parse(nodeRow.metadata) : undefined,
      createdAt: nodeRow.created_at
    });

    // Fetch outgoing edges
    const edgeStmt = db.prepare('SELECT * FROM edges WHERE source_id = ?');
    const edgeRows = edgeStmt.all(nodeId) as Array<{
      id: number;
      source_id: string;
      target_id: string;
      relation: string;
      metadata: string | null;
    }>;

    for (const edgeRow of edgeRows) {
      edges.push({
        id: edgeRow.id,
        sourceId: edgeRow.source_id,
        targetId: edgeRow.target_id,
        relation: edgeRow.relation as EdgeRelation,
        metadata: edgeRow.metadata ? JSON.parse(edgeRow.metadata) : undefined
      });

      // Recursively traverse connected nodes
      traverseNode(edgeRow.target_id, currentDepth + 1);
    }
  }

  traverseNode(rootId, 0);

  return {
    nodes,
    edges,
    depth: maxDepth
  };
}

/**
 * Query a subgraph with caching support
 *
 * Uses LRU cache with 60-second TTL for repeated queries.
 * Cache is keyed by (dbPath, rootId, maxDepth).
 */
export function querySubgraphCached(
  db: Database.Database,
  dbPath: string,
  rootId: string,
  maxDepth: number
): SubgraphResult {
  const cache = getSubgraphCache();

  // Check cache first
  const cached = cache.get(dbPath, rootId, maxDepth);
  if (cached) {
    return cached;
  }

  // Execute query
  const result = querySubgraph(db, rootId, maxDepth);

  // Store in cache
  cache.set(dbPath, rootId, maxDepth, result);

  return result;
}

/**
 * Invalidate cache for a database (call after writes)
 */
export function invalidateSubgraphCache(dbPath: string): void {
  getSubgraphCache().invalidate(dbPath);
}

/**
 * Find all nodes of a specific type
 */
export function findNodesByType(
  db: Database.Database,
  type: NodeType
): Node[] {
  const stmt = db.prepare('SELECT * FROM nodes WHERE type = ?');
  const rows = stmt.all(type) as Array<{
    id: string;
    type: string;
    name: string;
    metadata: string | null;
    created_at: number;
  }>;

  return rows.map(row => ({
    id: row.id,
    type: row.type as NodeType,
    name: row.name,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.created_at
  }));
}

/**
 * Get graph statistics
 */
export function getGraphStats(db: Database.Database): GraphStats {
  const totalNodesStmt = db.prepare('SELECT COUNT(*) as count FROM nodes');
  const totalEdgesStmt = db.prepare('SELECT COUNT(*) as count FROM edges');

  const totalNodes = (totalNodesStmt.get() as { count: number }).count;
  const totalEdges = (totalEdgesStmt.get() as { count: number }).count;

  // Count nodes by type
  const nodesByTypeStmt = db.prepare('SELECT type, COUNT(*) as count FROM nodes GROUP BY type');
  const nodesByTypeRows = nodesByTypeStmt.all() as Array<{ type: string; count: number }>;
  const nodesByType: Record<NodeType, number> = {
    [NodeType.Symbol]: 0,
    [NodeType.Module]: 0,
    [NodeType.Capability]: 0,
    [NodeType.Concept]: 0,
    [NodeType.Error]: 0,
    [NodeType.Recipe]: 0
  };

  for (const row of nodesByTypeRows) {
    nodesByType[row.type as NodeType] = row.count;
  }

  // Count edges by relation
  const edgesByRelationStmt = db.prepare('SELECT relation, COUNT(*) as count FROM edges GROUP BY relation');
  const edgesByRelationRows = edgesByRelationStmt.all() as Array<{ relation: string; count: number }>;
  const edgesByRelation: Record<EdgeRelation, number> = {
    [EdgeRelation.Calls]: 0,
    [EdgeRelation.Imports]: 0,
    [EdgeRelation.Implements]: 0,
    [EdgeRelation.Extends]: 0,
    [EdgeRelation.Throws]: 0,
    [EdgeRelation.DependsOn]: 0
  };

  for (const row of edgesByRelationRows) {
    edgesByRelation[row.relation as EdgeRelation] = row.count;
  }

  // Get database size
  const dbSizeStmt = db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()');
  const databaseSize = (dbSizeStmt.get() as { size: number }).size;

  return {
    totalNodes,
    totalEdges,
    nodesByType,
    edgesByRelation,
    databaseSize
  };
}
