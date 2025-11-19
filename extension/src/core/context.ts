/**
 * Context injection and prompt assembly system
 */

import Database from 'better-sqlite3';
import { Node, EdgeRelation, SubgraphResult } from './types.js';
import { querySubgraph } from './graph.js';

export interface ContextResult {
  facts: string[];
  relations: string[];
  entryPoints: string[];
  nodes: Node[];
  tokenCount: number;
}

export interface RelevanceScore {
  nodeId: string;
  score: number;
  reason: string;
}

/**
 * Select relevant context from graph based on query
 */
export function selectRelevantContext(
  query: string,
  db: Database.Database,
  maxDepth: number = 2,
  maxTokens: number = 4000
): ContextResult {
  const result: ContextResult = {
    facts: [],
    relations: [],
    entryPoints: [],
    nodes: [],
    tokenCount: 0
  };

  // Extract keywords from query
  const keywords = extractKeywords(query);

  // Find relevant nodes using TF-IDF-like scoring
  const relevantNodes = findRelevantNodes(db, keywords);

  // Build subgraph from relevant nodes
  const visitedNodes = new Set<string>();
  const allNodes: Node[] = [];
  const allEdges: Array<{ source: string; target: string; relation: string }> = [];

  for (const { nodeId, score } of relevantNodes.slice(0, 5)) {
    if (visitedNodes.has(nodeId)) {
      continue;
    }

    const subgraph = querySubgraph(db, nodeId, maxDepth);

    for (const node of subgraph.nodes) {
      if (!visitedNodes.has(node.id)) {
        allNodes.push(node);
        visitedNodes.add(node.id);
      }
    }

    for (const edge of subgraph.edges) {
      allEdges.push({
        source: edge.sourceId,
        target: edge.targetId,
        relation: edge.relation
      });
    }
  }

  // Fallback: if no specific matches, provide overview of the codebase
  if (allNodes.length === 0) {
    const allNodesInDb = db.prepare('SELECT * FROM nodes ORDER BY type, name').all() as Node[];
    const allEdgesInDb = db.prepare('SELECT source_id as sourceId, target_id as targetId, relation FROM edges').all() as Array<{ sourceId: string; targetId: string; relation: string }>;

    // Include a sample of nodes for overview
    allNodes.push(...allNodesInDb.slice(0, 20));

    // Include all edges for the sampled nodes
    const sampledNodeIds = new Set(allNodes.map(n => n.id));
    for (const edge of allEdgesInDb) {
      if (sampledNodeIds.has(edge.sourceId) || sampledNodeIds.has(edge.targetId)) {
        allEdges.push({
          source: edge.sourceId,
          target: edge.targetId,
          relation: edge.relation
        });
      }
    }
  }

  result.nodes = allNodes;

  // Generate facts
  result.facts = generateFacts(allNodes);

  // Generate relations
  result.relations = generateRelations(allEdges, allNodes);

  // Generate entry points
  result.entryPoints = generateEntryPoints(allNodes);

  // Estimate token count (rough approximation: 4 chars per token)
  const allText = [
    ...result.facts,
    ...result.relations,
    ...result.entryPoints
  ].join('\n');
  result.tokenCount = Math.ceil(allText.length / 4);

  // Trim if exceeds max tokens
  if (result.tokenCount > maxTokens) {
    result.facts = result.facts.slice(0, Math.floor(result.facts.length * 0.6));
    result.relations = result.relations.slice(0, Math.floor(result.relations.length * 0.6));
    result.entryPoints = result.entryPoints.slice(0, Math.floor(result.entryPoints.length * 0.6));

    const trimmedText = [
      ...result.facts,
      ...result.relations,
      ...result.entryPoints
    ].join('\n');
    result.tokenCount = Math.ceil(trimmedText.length / 4);
  }

  return result;
}

/**
 * Extract keywords from query string
 */
function extractKeywords(query: string): string[] {
  // Simple keyword extraction (lowercase, remove common words)
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
  ]);

  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}

/**
 * Find nodes relevant to keywords using TF-IDF-like scoring
 */
function findRelevantNodes(
  db: Database.Database,
  keywords: string[]
): RelevanceScore[] {
  const scores = new Map<string, number>();
  const reasons = new Map<string, string>();

  // Get all nodes
  const nodes = db.prepare('SELECT * FROM nodes').all() as Array<{
    id: string;
    type: string;
    name: string;
    metadata: string | null;
  }>;

  for (const node of nodes) {
    let score = 0;
    const matchedKeywords: string[] = [];

    const nodeName = node.name.toLowerCase();

    for (const keyword of keywords) {
      // Exact match in name
      if (nodeName === keyword) {
        score += 10;
        matchedKeywords.push(keyword);
      }
      // Partial match in name
      else if (nodeName.includes(keyword)) {
        score += 5;
        matchedKeywords.push(keyword);
      }
      // Match in metadata
      else if (node.metadata) {
        const metadata = node.metadata.toLowerCase();
        if (metadata.includes(keyword)) {
          score += 2;
          matchedKeywords.push(keyword);
        }
      }
    }

    if (score > 0) {
      scores.set(node.id, score);
      reasons.set(node.id, `Matched keywords: ${matchedKeywords.join(', ')}`);
    }
  }

  // Sort by score descending
  return Array.from(scores.entries())
    .map(([nodeId, score]) => ({
      nodeId,
      score,
      reason: reasons.get(nodeId) || ''
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Generate fact statements about nodes
 */
function generateFacts(nodes: Node[]): string[] {
  const facts: string[] = [];

  // Count by type
  const typeCount = new Map<string, number>();
  for (const node of nodes) {
    typeCount.set(node.type, (typeCount.get(node.type) || 0) + 1);
  }

  facts.push(`Total nodes in context: ${nodes.length}`);

  for (const [type, count] of typeCount.entries()) {
    facts.push(`${type}s: ${count}`);
  }

  // List important symbols
  const symbols = nodes.filter(n => n.type === 'symbol').slice(0, 10);
  if (symbols.length > 0) {
    facts.push(`Key symbols: ${symbols.map(s => s.name).join(', ')}`);
  }

  return facts;
}

/**
 * Generate relation statements
 */
function generateRelations(
  edges: Array<{ source: string; target: string; relation: string }>,
  nodes: Node[]
): string[] {
  const relations: string[] = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Group by relation type
  const byRelation = new Map<string, number>();
  for (const edge of edges) {
    byRelation.set(edge.relation, (byRelation.get(edge.relation) || 0) + 1);
  }

  for (const [relation, count] of byRelation.entries()) {
    relations.push(`${relation}: ${count} connections`);
  }

  // List some specific relations
  for (const edge of edges.slice(0, 10)) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if (sourceNode && targetNode) {
      relations.push(
        `${sourceNode.name} ${edge.relation} ${targetNode.name}`
      );
    }
  }

  return relations;
}

/**
 * Generate entry point statements
 */
function generateEntryPoints(nodes: Node[]): string[] {
  const entryPoints: string[] = [];

  // Find modules (likely entry points)
  const modules = nodes.filter(n => n.type === 'module');
  if (modules.length > 0) {
    entryPoints.push(`Modules: ${modules.map(m => m.name).join(', ')}`);
  }

  // Find exported symbols
  const symbols = nodes.filter(n => n.type === 'symbol').slice(0, 5);
  if (symbols.length > 0) {
    entryPoints.push(`Exported symbols: ${symbols.map(s => s.name).join(', ')}`);
  }

  return entryPoints;
}

/**
 * Format context as markdown
 */
export function formatContext(context: ContextResult): string {
  const parts: string[] = [];

  if (context.facts.length > 0) {
    parts.push('## Facts\n');
    parts.push(context.facts.map(f => `- ${f}`).join('\n'));
  }

  if (context.relations.length > 0) {
    parts.push('\n## Relations\n');
    parts.push(context.relations.map(r => `- ${r}`).join('\n'));
  }

  if (context.entryPoints.length > 0) {
    parts.push('\n## Entry Points\n');
    parts.push(context.entryPoints.map(e => `- ${e}`).join('\n'));
  }

  return parts.join('\n');
}
