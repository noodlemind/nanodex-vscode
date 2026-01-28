/**
 * Core type definitions for the nanodex knowledge graph
 */

/**
 * Types of nodes in the knowledge graph
 */
export enum NodeType {
  Symbol = 'symbol',
  Module = 'module',
  Capability = 'capability',
  Concept = 'concept',
  Error = 'error',
  Recipe = 'recipe'
}

/**
 * Types of relationships between nodes
 */
export enum EdgeRelation {
  Calls = 'calls',
  Imports = 'imports',
  Implements = 'implements',
  Extends = 'extends',
  Throws = 'throws',
  DependsOn = 'depends_on'
}

/**
 * Represents a node in the knowledge graph
 */
export interface Node {
  id: string;
  type: NodeType;
  name: string;
  metadata?: Record<string, unknown>;
  createdAt?: number;
}

/**
 * Represents an edge (relationship) between two nodes
 */
export interface Edge {
  id?: number;
  sourceId: string;
  targetId: string;
  relation: EdgeRelation;
  metadata?: Record<string, unknown>;
}

/**
 * Result of a subgraph query
 */
export interface SubgraphResult {
  nodes: Node[];
  edges: Edge[];
  depth: number;
}

/**
 * Query parameters for graph operations
 */
export interface GraphQuery {
  rootId?: string;
  nodeType?: NodeType;
  maxDepth?: number;
  relations?: EdgeRelation[];
}

/**
 * Statistics about the graph
 */
export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<NodeType, number>;
  edgesByRelation: Record<EdgeRelation, number>;
  databaseSize: number;
}

/**
 * Model configuration parsed from provider/model-name format
 */
export interface ModelConfig {
  vendor: string;
  family: string;
}

/**
 * Metadata for a language model
 */
export interface ModelMetadata {
  label: string;
  shortLabel: string;
  description: string;
}

// ============================================================================
// Language Model Tool Input Types
// ============================================================================

/**
 * Input for the graph query tool
 */
export interface GraphQueryInput {
  /** Natural language query about the codebase */
  query: string;
  /** Traversal depth for relationships (1-5, default 2) */
  depth?: number;
}

/**
 * Input for the symbol lookup tool
 */
export interface SymbolLookupInput {
  /** Name of the symbol to look up */
  symbolName: string;
  /** Include symbol relationships (imports, calls, etc.) */
  includeRelationships?: boolean;
}

/**
 * Input for the file context tool
 */
export interface FileContextInput {
  /** Path to the file (relative to workspace root) */
  filePath: string;
}

/**
 * Input for the issues tool
 */
export interface IssuesToolInput {
  /** Filter by issue status (default: all) */
  status?: 'pending' | 'in_progress' | 'completed' | 'all';
}

/**
 * Input for creating a new issue
 */
export interface CreateIssueInput {
  /** Issue title */
  title: string;
  /** Issue goal/description */
  goal: string;
  /** Implementation plan (optional) */
  plan?: string;
  /** Acceptance criteria (optional) */
  acceptanceCriteria?: string[];
}

/**
 * Input for updating issue status
 */
export interface UpdateIssueStatusInput {
  /** Issue ID to update */
  issueId: string;
  /** New status */
  status: 'pending' | 'in_progress' | 'completed';
}

/**
 * Input for getting a single issue
 */
export interface GetIssueInput {
  /** Issue ID to retrieve */
  issueId: string;
}
