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
 * Extended graph stats with indexing information
 */
export interface GraphStatsOutput extends GraphStats {
  /** Last time the workspace was indexed */
  lastIndexed: string | null;
  /** Whether the workspace has been indexed */
  isIndexed: boolean;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Valid status values for issues
 */
export const VALID_ISSUE_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
export type IssueStatus = typeof VALID_ISSUE_STATUSES[number];

/**
 * Check if a status string is a valid issue status
 */
export function isValidIssueStatus(status: unknown): status is IssueStatus {
  return typeof status === 'string' &&
    (VALID_ISSUE_STATUSES as readonly string[]).includes(status);
}

/**
 * Valid status values for todos
 */
export const VALID_TODO_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
export type TodoStatus = typeof VALID_TODO_STATUSES[number];

/**
 * Check if a status string is a valid todo status
 */
export function isValidTodoStatus(status: unknown): status is TodoStatus {
  return typeof status === 'string' &&
    (VALID_TODO_STATUSES as readonly string[]).includes(status);
}

/**
 * Valid priority values
 */
export const VALID_PRIORITIES = ['low', 'medium', 'high'] as const;
export type Priority = typeof VALID_PRIORITIES[number];

/**
 * Check if a string is a valid priority
 */
export function isValidPriority(priority: unknown): priority is Priority {
  return typeof priority === 'string' &&
    (VALID_PRIORITIES as readonly string[]).includes(priority);
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

/**
 * Input for graph stats tool
 */
export interface GraphStatsInput {
  /** Include detailed breakdown by type/relation */
  detailed?: boolean;
}

/**
 * Input for delete issue tool
 */
export interface DeleteIssueInput {
  /** Issue ID to delete */
  issueId: string;
}

/**
 * Input for indexing status tool (no parameters)
 */
export interface IndexingStatusInput {
  // No input required
}

// ============================================================================
// Todo Tool Input Types
// ============================================================================

/**
 * Input for listing todos
 */
export interface ListTodosInput {
  /** Filter by status */
  status?: 'pending' | 'in_progress' | 'completed' | 'all';
  /** Filter by tag */
  tag?: string;
}

/**
 * Input for getting a single todo
 */
export interface GetTodoInput {
  /** Todo ID to retrieve */
  todoId: string;
}

/**
 * Input for creating a new todo
 */
export interface CreateTodoInput {
  /** Todo title */
  title: string;
  /** Todo description */
  description: string;
  /** Priority level */
  priority?: 'low' | 'medium' | 'high';
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Input for updating todo status
 */
export interface UpdateTodoStatusInput {
  /** Todo ID to update */
  todoId: string;
  /** New status */
  status: 'pending' | 'in_progress' | 'completed';
}
