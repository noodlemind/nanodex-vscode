import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import Database from 'better-sqlite3';
import {
  initializeGraphDatabase,
  insertNode,
  updateNode,
  deleteNode,
  insertEdge,
  querySubgraph,
  findNodesByType,
  getGraphStats
} from '../core/graph';
import { NodeType, EdgeRelation } from '../core/types';

suite('Graph System Tests', () => {
  let testDbPath: string;
  let db: Database.Database;

  setup(() => {
    // Create a temporary database for testing
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanodex-test-'));
    testDbPath = path.join(tempDir, 'test.sqlite');
    db = initializeGraphDatabase(testDbPath);
  });

  teardown(() => {
    // Close and cleanup
    if (db) {
      db.close();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
      // Clean up WAL and SHM files
      const walPath = `${testDbPath}-wal`;
      const shmPath = `${testDbPath}-shm`;
      if (fs.existsSync(walPath)) {
        fs.unlinkSync(walPath);
      }
      if (fs.existsSync(shmPath)) {
        fs.unlinkSync(shmPath);
      }
      // Remove temp directory
      const tempDir = path.dirname(testDbPath);
      if (fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir);
      }
    }
  });

  test('Database initialization', () => {
    assert.ok(fs.existsSync(testDbPath), 'Database file should exist');

    // Check that tables exist
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all() as Array<{ name: string }>;

    const tableNames = tables.map(t => t.name);
    assert.ok(tableNames.includes('nodes'), 'nodes table should exist');
    assert.ok(tableNames.includes('edges'), 'edges table should exist');
  });

  test('Insert and retrieve node', () => {
    const node = {
      id: 'test-node-1',
      type: NodeType.Symbol,
      name: 'TestSymbol',
      metadata: { kind: 'function' }
    };

    insertNode(db, node);

    const result = db.prepare('SELECT * FROM nodes WHERE id = ?').get('test-node-1') as {
      id: string;
      type: string;
      name: string;
      metadata: string;
    };

    assert.strictEqual(result.id, node.id);
    assert.strictEqual(result.type, node.type);
    assert.strictEqual(result.name, node.name);
    assert.deepStrictEqual(JSON.parse(result.metadata), node.metadata);
  });

  test('Update node', () => {
    const node = {
      id: 'test-node-2',
      type: NodeType.Module,
      name: 'OldName'
    };

    insertNode(db, node);
    updateNode(db, 'test-node-2', { name: 'NewName' });

    const result = db.prepare('SELECT * FROM nodes WHERE id = ?').get('test-node-2') as {
      name: string;
    };

    assert.strictEqual(result.name, 'NewName');
  });

  test('Delete node', () => {
    const node = {
      id: 'test-node-3',
      type: NodeType.Concept,
      name: 'TestConcept'
    };

    insertNode(db, node);
    deleteNode(db, 'test-node-3');

    const result = db.prepare('SELECT * FROM nodes WHERE id = ?').get('test-node-3');
    assert.strictEqual(result, undefined);
  });

  test('Insert and retrieve edge', () => {
    // Insert nodes first
    insertNode(db, { id: 'node-a', type: NodeType.Symbol, name: 'A' });
    insertNode(db, { id: 'node-b', type: NodeType.Symbol, name: 'B' });

    const edge = {
      sourceId: 'node-a',
      targetId: 'node-b',
      relation: EdgeRelation.Calls
    };

    insertEdge(db, edge);

    const result = db.prepare('SELECT * FROM edges WHERE source_id = ? AND target_id = ?')
      .get('node-a', 'node-b') as {
      source_id: string;
      target_id: string;
      relation: string;
    };

    assert.strictEqual(result.source_id, edge.sourceId);
    assert.strictEqual(result.target_id, edge.targetId);
    assert.strictEqual(result.relation, edge.relation);
  });

  test('Query subgraph', () => {
    // Create a small graph: A -> B -> C
    insertNode(db, { id: 'a', type: NodeType.Symbol, name: 'A' });
    insertNode(db, { id: 'b', type: NodeType.Symbol, name: 'B' });
    insertNode(db, { id: 'c', type: NodeType.Symbol, name: 'C' });

    insertEdge(db, { sourceId: 'a', targetId: 'b', relation: EdgeRelation.Calls });
    insertEdge(db, { sourceId: 'b', targetId: 'c', relation: EdgeRelation.Calls });

    const result = querySubgraph(db, 'a', 2);

    assert.strictEqual(result.nodes.length, 3);
    assert.strictEqual(result.edges.length, 2);
    assert.ok(result.nodes.some(n => n.id === 'a'));
    assert.ok(result.nodes.some(n => n.id === 'b'));
    assert.ok(result.nodes.some(n => n.id === 'c'));
  });

  test('Find nodes by type', () => {
    insertNode(db, { id: 'sym1', type: NodeType.Symbol, name: 'Symbol1' });
    insertNode(db, { id: 'sym2', type: NodeType.Symbol, name: 'Symbol2' });
    insertNode(db, { id: 'mod1', type: NodeType.Module, name: 'Module1' });

    const symbols = findNodesByType(db, NodeType.Symbol);
    const modules = findNodesByType(db, NodeType.Module);

    assert.strictEqual(symbols.length, 2);
    assert.strictEqual(modules.length, 1);
  });

  test('Get graph stats', () => {
    insertNode(db, { id: 'n1', type: NodeType.Symbol, name: 'N1' });
    insertNode(db, { id: 'n2', type: NodeType.Module, name: 'N2' });
    insertEdge(db, { sourceId: 'n1', targetId: 'n2', relation: EdgeRelation.Imports });

    const stats = getGraphStats(db);

    assert.strictEqual(stats.totalNodes, 2);
    assert.strictEqual(stats.totalEdges, 1);
    assert.strictEqual(stats.nodesByType[NodeType.Symbol], 1);
    assert.strictEqual(stats.nodesByType[NodeType.Module], 1);
    assert.strictEqual(stats.edgesByRelation[EdgeRelation.Imports], 1);
    assert.ok(stats.databaseSize > 0);
  });

  test('Transaction rollback on error', () => {
    const transaction = db.transaction(() => {
      insertNode(db, { id: 'tx1', type: NodeType.Symbol, name: 'TX1' });
      throw new Error('Simulated error');
    });

    assert.throws(() => transaction());

    // Verify node was not inserted
    const result = db.prepare('SELECT * FROM nodes WHERE id = ?').get('tx1');
    assert.strictEqual(result, undefined);
  });

  test('Cascade delete edges when node is deleted', () => {
    insertNode(db, { id: 'cascade-a', type: NodeType.Symbol, name: 'A' });
    insertNode(db, { id: 'cascade-b', type: NodeType.Symbol, name: 'B' });
    insertEdge(db, { sourceId: 'cascade-a', targetId: 'cascade-b', relation: EdgeRelation.Calls });

    deleteNode(db, 'cascade-a');

    // Check that edge was also deleted
    const edges = db.prepare('SELECT * FROM edges WHERE source_id = ?').all('cascade-a');
    assert.strictEqual(edges.length, 0);
  });
});
