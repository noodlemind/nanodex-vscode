# nanodex Architecture Evolution Plan

## Enhancement Summary

**Deepened on:** 2026-01-28
**Sections enhanced:** 10
**Research agents used:** VS Code LM Tools API, Agent Skills best practices, TypeScript review, Performance analysis, Security audit, Agent-native review, Architecture review, Code simplicity review

### Key Improvements
1. Comprehensive security mitigations for path traversal vulnerabilities
2. Database performance optimizations (connection pooling, query caching, recursive CTEs)
3. Agent Skills specification compliance with industry best practices
4. Consolidated Issue/Todo system to reduce code duplication

### Critical Findings Discovered
- Path traversal vulnerability in Issue ID handling (P1 security fix required)
- Database connection churn causing 50-150ms overhead per AI interaction
- Full table scans in `findRelevantNodes()` causing O(n) queries
- Issue/Todo systems are nearly identical (150+ LOC duplication)

---

## Executive Summary

This plan evolves nanodex from a VS Code-specific extension to a **cross-agent knowledge graph platform** with portable Agent Skills and complete Language Model Tools coverage.

**Current State:** 70% agent-native compliance with 7 LM tools and YAML-defined flows
**Target State:** 90%+ agent-native with portable skills, complete CRUD, and enhanced context

**Timeline:** 6 weeks (streamlined from original 10 weeks)

---

## Part 1: Agent Skills Adoption

### 1.1 Strategic Rationale

The industry is converging on Agent Skills as a portable capability standard:
- [GitHub Copilot](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills) (VS Code, CLI, coding agent)
- [Claude Code](https://code.claude.com/docs/en/skills)
- [Cursor](https://cursor.sh) and other AI coding tools

Converting our YAML flows to Agent Skills provides:
- Cross-agent portability
- Community discovery ([github/awesome-copilot](https://github.com/github/awesome-copilot))
- Future-proof architecture

### Research Insights

**Best Practices (from [agentskills.io](https://agentskills.io/specification)):**
- Use gerund naming: `nanodex-planning`, `nanodex-working`, `nanodex-reviewing`
- Keep SKILL.md under 500 lines; use `references/` for detailed content
- Description field is critical for discovery - include BOTH what the skill does AND trigger keywords
- Use standard Markdown headings, not XML tags
- Test with Haiku, Sonnet, and Opus models

**Portability Requirements:**
- Store in `.github/skills/` for project-level skills
- Use forward slashes in all paths (cross-platform)
- Reference tools by their registered names

### 1.2 Skills Directory Structure

```
.github/skills/
├── nanodex-planning/
│   └── SKILL.md
├── nanodex-working/
│   └── SKILL.md
├── nanodex-reviewing/
│   └── SKILL.md
├── nanodex-debugging/
│   └── SKILL.md
├── nanodex-refactoring/
│   └── SKILL.md
└── nanodex-explaining/
    └── SKILL.md
```

### 1.3 Flow-to-Skill Conversion

#### 1.3.1 nanodex-planning Skill

**Current:** `extension/src/prompts/flows/plan.flow.yaml`
**New:** `.github/skills/nanodex-planning/SKILL.md`

```markdown
---
name: nanodex-planning
description: Create structured implementation plans using knowledge graph context. Use when planning features, designing refactoring strategies, creating bug fix approaches, or breaking down complex coding tasks. Triggers on "plan", "design", "architect", "break down", "implementation plan".
license: Apache-2.0
---

# Implementation Planning with Knowledge Graph

Create comprehensive implementation plans by leveraging the nanodex knowledge graph.

## Quick Start

1. Query the knowledge graph for related code
2. Identify affected modules and relationships
3. Create phased implementation plan
4. Save as tracked issue

## Instructions

### 1. Context Gathering

Use `nanodex-query-graph` to understand:
- Related modules and symbols
- Dependency relationships
- Existing patterns in the codebase

### 2. Plan Creation

- Break into independently testable phases
- Define specific acceptance criteria
- Identify risks and mitigations

### 3. Issue Creation

Use `nanodex-create-issue` with:
- Clear, actionable title
- Detailed goal description
- Phased implementation plan
- Acceptance criteria checklist

## Output Template

```markdown
## Plan: [Title]

### Goal
[What we're trying to accomplish]

### Context (from Knowledge Graph)
- Related modules: [list]
- Key relationships: [list]
- Patterns to follow: [list]

### Phases

#### Phase 1: [Name]
- [ ] Task 1
- [ ] Task 2
Files: [list]

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

### Risks & Mitigations
- Risk: [description] → Mitigation: [approach]
```

## Examples

**Input:** "Plan adding caching to the API layer"

**Process:**
1. Query: `nanodex-query-graph` with "API caching"
2. Found: ApiService, HttpClient, ResponseHandler
3. Pattern: Existing cache in SessionManager

**Output:** 3-phase plan following SessionManager pattern

## Guidelines

- Always query the knowledge graph before creating a plan
- Reference existing patterns found in the codebase
- Keep phases small and independently testable
- Create a tracked issue for every plan
```

#### 1.3.2 nanodex-working Skill

**New:** `.github/skills/nanodex-working/SKILL.md`

```markdown
---
name: nanodex-working
description: Execute implementation work on nanodex issues systematically using knowledge graph context. Use when implementing features, working on issues, executing phased development, or following up on planning sessions. Triggers on "work on", "implement", "code", "build", "execute plan".
license: Apache-2.0
---

# Implementation Workflow

Execute planned work using knowledge graph context.

## Quick Start

1. Load the issue with `nanodex-get-issue`
2. Mark as in_progress with `nanodex-update-issue-status`
3. Query graph for context on each phase
4. Implement following existing patterns
5. Mark as completed when done

## Instructions

### 1. Load Issue
Use `nanodex-get-issue` to retrieve full plan details.

### 2. Update Status
Use `nanodex-update-issue-status` to mark as `in_progress`.

### 3. Execute Phases
For each phase:
- Query graph for context
- Implement following patterns
- Verify acceptance criteria

### 4. Complete
Mark as `completed` with summary.

## Guidelines

- Always load the full issue before starting
- Update status transitions in order: pending → in_progress → completed
- Query the graph before implementing each phase
- Verify each acceptance criterion before marking complete
```

#### 1.3.3 Additional Skills

| Skill | Purpose | Key Tools | Triggers |
|-------|---------|-----------|----------|
| `nanodex-reviewing` | Graph-aware code review | `nanodex-query-graph`, `nanodex-lookup-symbol` | "review", "check", "audit" |
| `nanodex-debugging` | Graph-aware debugging | `nanodex-query-graph`, `nanodex-lookup-symbol` | "debug", "fix", "troubleshoot" |
| `nanodex-refactoring` | Relationship-aware refactoring | `nanodex-query-graph`, `nanodex-get-file-context` | "refactor", "restructure", "clean" |
| `nanodex-explaining` | Code explanation with context | `nanodex-query-graph`, `nanodex-get-file-context` | "explain", "how does", "what does" |

---

## Part 2: Language Model Tools

### 2.1 Current Tools (7)

| Tool | Purpose | Status |
|------|---------|--------|
| `nanodex-query-graph` | Query knowledge graph | Implemented |
| `nanodex-lookup-symbol` | Symbol search | Implemented |
| `nanodex-list-issues` | List all issues | Implemented |
| `nanodex-get-file-context` | File context retrieval | Implemented |
| `nanodex-get-issue` | Get single issue | Implemented |
| `nanodex-create-issue` | Create new issue | Implemented |
| `nanodex-update-issue-status` | Update issue status | Implemented |

### 2.2 New Tools (5)

#### 2.2.1 `nanodex-graph-stats`

```typescript
// extension/src/tools/graphStatsTool.ts
import { GraphStats } from '../core/types.js';

interface GraphStatsOutput extends GraphStats {
  lastIndexed: string | null;
  isIndexed: boolean;
}
```

### Research Insights (VS Code LM Tools API)

**Best Practices from [VS Code Documentation](https://code.visualstudio.com/api/extension-guides/ai/tools):**
- Always declare tools in `package.json` first - tools are not visible without this
- Use descriptive `modelDescription` - tell the LLM when and why to use the tool
- Include guidance in error messages for LLM recovery
- Use `confirmationMessages` for operations with side effects
- Check `token.isCancellationRequested` before and during expensive operations

**Tool Registration:**
```typescript
// Both steps required:
// 1. Declare in package.json contributes.languageModelTools
// 2. Register with vscode.lm.registerTool()
```

**Error Handling Pattern:**
```typescript
// Return errors as tool results with recovery guidance
if (!workspaceFolder) {
  return new vscode.LanguageModelToolResult([
    new vscode.LanguageModelTextPart(
      'Error: No workspace folder is open. ' +
      'Please open a workspace folder before using this tool.'
    )
  ]);
}
```

#### 2.2.2 `nanodex-delete-issue`

```typescript
// extension/src/tools/deleteIssueTool.ts
interface DeleteIssueInput {
  issueId: string;
}
```

**Security Note:** Must validate issueId format before use (see Part 7 Security Fixes).

#### 2.2.3 Todo Tools (Thin Wrappers)

The Todo tools wrap existing functions in `core/todos.ts`:

```typescript
// extension/src/tools/todoTools.ts
// Thin wrappers over existing createTodo, listTodos, updateTodoStatus, deleteTodo

interface CreateTodoInput {
  title: string;
  description: string;
  priority?: 'critical' | 'high' | 'normal' | 'low';
  tags?: string[];
}

interface ListTodosInput {
  status?: 'pending' | 'in_progress' | 'completed' | 'all';
  priority?: 'critical' | 'high' | 'normal' | 'low';
}

interface UpdateTodoInput {
  todoId: string;
  status?: 'pending' | 'in_progress' | 'completed';
}

interface DeleteTodoInput {
  todoId: string;
}
```

### 2.3 Tools Removed from Original Plan

Per reviewer feedback, these tools are **not needed**:

| Tool | Reason for Removal |
|------|-------------------|
| `nanodex-search-nodes` | Redundant with `nanodex-query-graph` |
| `nanodex-get-relationships` | Redundant with `nanodex-lookup-symbol` (includeRelationships: true) |
| `nanodex-trigger-reindex` | Already available as VS Code command |

### 2.4 Final Tool Count: 12

---

## Part 3: Context Injection (Simplified)

### 3.1 Git Branch Context Only

Per reviewer feedback, capability enumeration is removed (LM API handles tool discovery).

**File:** `extension/src/core/environment.ts`

```typescript
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface EnvironmentContext {
  gitBranch: string | null;
  hasUncommittedChanges: boolean;
  workspaceName: string;
}

export async function getEnvironmentContext(
  workspaceFolder: vscode.WorkspaceFolder
): Promise<EnvironmentContext> {
  const cwd = workspaceFolder.uri.fsPath;

  let gitBranch: string | null = null;
  let hasUncommittedChanges = false;

  try {
    const { stdout: branch } = await execAsync('git branch --show-current', {
      cwd,
      timeout: 5000  // 5 second timeout
    });
    gitBranch = branch.trim();

    const { stdout: status } = await execAsync('git status --porcelain', {
      cwd,
      timeout: 5000
    });
    hasUncommittedChanges = status.trim().length > 0;
  } catch {
    // Not a git repo or git not available
  }

  return {
    gitBranch,
    hasUncommittedChanges,
    workspaceName: workspaceFolder.name
  };
}

export function formatEnvironmentContext(env: EnvironmentContext): string {
  return `## Environment
- Workspace: ${env.workspaceName}
- Branch: ${env.gitBranch || 'N/A'}
- Uncommitted changes: ${env.hasUncommittedChanges ? 'Yes' : 'No'}`;
}
```

### Research Insights (TypeScript Review)

**Improvements Applied:**
- Pass `workspaceFolder` as parameter (not global reference)
- Add 5-second timeout on exec operations
- Trim stdout to remove trailing newlines
- Use proper error handling pattern

### 3.2 Removed from Original Plan

| Feature | Reason |
|---------|--------|
| Capability enumeration | LM API handles tool discovery |
| ContextBudgetManager | Premature optimization |
| Progressive disclosure | Over-engineering |

---

## Part 4: CRUD Completeness

### 4.1 Current vs Target

| Entity | Create | Read | Update | Delete | Current | Target |
|--------|--------|------|--------|--------|---------|--------|
| Issue | Y | Y | Y | N | 75% | 100% |
| Todo | N | N | N | N | 0% | 100% |

### 4.2 Implementation

Issues: Add `nanodex-delete-issue` (1 new tool)
Todos: Add 4 thin wrappers over existing `core/todos.ts` functions

### Research Insights (Simplicity Review)

**Major Finding: Issues and Todos Are Nearly Identical**

Both systems in `core/issues.ts` (351 LOC) and `core/todos.ts` (225 LOC) have:
- Same YAML file storage pattern in `.nanodex/{issues,todos}/`
- Same CRUD functions: `create`, `load`, `list`, `save`, `updateStatus`, `delete`
- Same ID generation pattern (100 retry loop with temp file)
- Same status values: `pending | in_progress | completed | cancelled`

**Recommendation:** Consider unifying into single `workItems.ts` with `type: 'issue' | 'todo'` discriminator in Phase 3. Saves ~150 LOC.

---

## Part 5: UI Feedback (Simplified)

### 5.1 Event-Driven Status Updates

No polling. Status updates triggered by:
- File save events
- Reindex command execution
- File watcher events

```typescript
// extension/src/ui/indexingStatus.ts
export function showIndexingStatus(fileCount: number): vscode.Disposable {
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );

  statusBarItem.text = `$(sync~spin) Indexing ${fileCount} files...`;
  statusBarItem.show();

  return statusBarItem;
}

export function showIndexingComplete(statusBarItem: vscode.StatusBarItem, fileCount: number): void {
  statusBarItem.text = `$(check) Indexed ${fileCount} files`;
  setTimeout(() => statusBarItem.hide(), 3000);
}
```

### 5.2 Removed from Original Plan

| Feature | Reason |
|---------|--------|
| 30-second polling | Wasteful; use event-driven |
| IndexingStatusManager class | Over-engineered; simple functions suffice |
| Welcome webview | Not needed for MVP |

---

## Part 6: YAML Chat Routing - REMOVED

Per all three reviewers, YAML-driven chat routing is removed entirely.

**Rationale:**
- Current TypeScript if/else is clear and debuggable
- Only 4 commands don't justify abstraction
- YAML loses compile-time type safety
- Adds parsing complexity without benefit

**Keep:** Existing `participant.ts` routing logic unchanged.

---

## Part 7: Security Fixes (P1 CRITICAL)

### Research Insights (Security Audit)

#### 7.1 Path Traversal Vulnerability in Issue ID

**Severity: HIGH**
**Location:** `extension/src/core/issues.ts` (lines 46-47)

**Current Vulnerable Code:**
```typescript
export function getIssuePath(workspaceRoot: string, issueId: string): string {
  return path.join(getIssuesDir(workspaceRoot), `${issueId}.yml`);
}
```

**Attack Vector:** `issueId = "../../.env"` could access files outside issues directory.

**Required Fix:**
```typescript
const ISSUE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_ISSUE_ID_LENGTH = 50;

function validateIssueId(issueId: string): boolean {
  return (
    issueId.length <= MAX_ISSUE_ID_LENGTH &&
    ISSUE_ID_PATTERN.test(issueId) &&
    !issueId.includes('..')
  );
}

export function getIssuePath(workspaceRoot: string, issueId: string): string {
  if (!validateIssueId(issueId)) {
    throw new Error('Invalid issue ID format');
  }

  const filePath = path.join(getIssuesDir(workspaceRoot), `${issueId}.yml`);
  const resolvedPath = path.resolve(filePath);
  const issuesDir = path.resolve(getIssuesDir(workspaceRoot));

  // Ensure resolved path is within issues directory
  if (!resolvedPath.startsWith(issuesDir + path.sep)) {
    throw new Error('Invalid issue path');
  }

  return resolvedPath;
}
```

#### 7.2 YAML Deserialization Safety

**Location:** `extension/src/core/issues.ts` (line 211)

**Fix:** Use safe YAML loading:
```typescript
import * as yaml from 'js-yaml';
const parsed = yaml.load(content, { schema: yaml.JSON_SCHEMA });
```

#### 7.3 Issue ID Validation in Tools

Add to all tools accepting `issueId`:
- `getIssueTool.ts`
- `updateIssueStatusTool.ts`
- `deleteIssueTool.ts` (new)

---

## Part 8: Performance Optimizations

### Research Insights (Performance Analysis)

#### 8.1 Database Connection Pooling (HIGH PRIORITY)

**Problem:** Each tool opens/closes a fresh connection. With 5-10 tool calls per AI interaction, this adds 50-150ms overhead.

**Solution:** Implement connection pool with lazy initialization:

```typescript
// extension/src/core/databasePool.ts
class DatabasePool {
  private static instance: Database.Database | null = null;
  private static refCount = 0;
  private static closeTimer: NodeJS.Timeout | null = null;

  static acquire(dbPath: string, readonly = true): Database.Database {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }

    if (!this.instance) {
      this.instance = new Database(dbPath, { readonly });
    }
    this.refCount++;
    return this.instance;
  }

  static release(): void {
    this.refCount--;
    if (this.refCount === 0) {
      // Close after 30 seconds of inactivity
      this.closeTimer = setTimeout(() => {
        this.instance?.close();
        this.instance = null;
      }, 30000);
    }
  }
}
```

**Expected Impact:** 70-80% reduction in repeated query latency.

#### 8.2 Replace Full Table Scan in findRelevantNodes (HIGH PRIORITY)

**Problem:** `findRelevantNodes()` does `SELECT * FROM nodes` for every query.

**Location:** `extension/src/core/context.ts` (lines 153-209)

**Current:** O(n) where n = total nodes. For 50,000 nodes: 100-250ms per query.

**Solution:** Use indexed LIKE queries with early termination:

```typescript
function findRelevantNodes(
  db: Database.Database,
  keywords: string[]
): RelevanceScore[] {
  if (keywords.length === 0) return [];

  const scores = new Map<string, { score: number; keywords: string[] }>();

  for (const keyword of keywords) {
    const escaped = escapeSqlLike(keyword);
    const matches = db.prepare(`
      SELECT id, name, type, metadata
      FROM nodes
      WHERE name LIKE ? ESCAPE '\\'
      LIMIT 50
    `).all(`%${escaped}%`);

    for (const match of matches) {
      const existing = scores.get(match.id) || { score: 0, keywords: [] };
      existing.score += match.name.toLowerCase() === keyword ? 10 : 5;
      existing.keywords.push(keyword);
      scores.set(match.id, existing);
    }
  }

  return Array.from(scores.entries())
    .map(([nodeId, data]) => ({ nodeId, score: data.score, reason: `Matched: ${data.keywords.join(', ')}` }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}
```

**Expected Impact:** 10-100x improvement for large workspaces.

#### 8.3 Subgraph Query Caching (MEDIUM PRIORITY)

**Problem:** Same subgraph queries repeated during AI conversations.

**Solution:** Use existing (but unused) cache infrastructure:

```typescript
// extension/src/core/cacheInstances.ts
import { TTLCache } from './cache.js';
import { SubgraphResult } from './types.js';

export const subgraphCache = new TTLCache<string, SubgraphResult>(60000); // 1 min TTL

// In graph.ts
export function querySubgraph(db, rootId, maxDepth): SubgraphResult {
  const cacheKey = `${rootId}:${maxDepth}`;
  const cached = subgraphCache.get(cacheKey);
  if (cached) return cached;

  const result = doQuerySubgraph(db, rootId, maxDepth);
  subgraphCache.set(cacheKey, result);
  return result;
}
```

**Expected Impact:** 90%+ reduction in repeated query latency.

#### 8.4 Recursive CTE for Subgraph Traversal (MEDIUM PRIORITY)

**Problem:** N+1 query pattern in `querySubgraph()` - 222 queries for depth=2 with 10 edges/node.

**Solution:** Single recursive CTE query:

```sql
WITH RECURSIVE graph_walk(id, depth) AS (
  SELECT ?, 0
  UNION ALL
  SELECT e.target_id, gw.depth + 1
  FROM graph_walk gw
  JOIN edges e ON e.source_id = gw.id
  WHERE gw.depth < ?
)
SELECT DISTINCT n.*, gw.depth
FROM graph_walk gw
JOIN nodes n ON n.id = gw.id
```

**Expected Impact:** 50-100x reduction in query count for deep traversals.

---

## Part 9: TypeScript Fixes

Per Kieran's review, these issues must be addressed:

### 9.1 Extend Existing Types

```typescript
// extension/src/core/types.ts
interface GraphStatsOutput extends GraphStats {
  lastIndexed: string | null;
  isIndexed: boolean;
}
```

### 9.2 Use Async exec

Replace all `execSync` with promisified `exec` in async functions.

### 9.3 Add Type Guards

```typescript
// extension/src/core/types.ts
const VALID_TODO_STATUSES = ['pending', 'in_progress', 'completed'] as const;
type TodoStatus = typeof VALID_TODO_STATUSES[number];

function isValidTodoStatus(status: unknown): status is TodoStatus {
  return typeof status === 'string' &&
    (VALID_TODO_STATUSES as readonly string[]).includes(status);
}

export function isValidTodo(obj: unknown): obj is Todo {
  if (typeof obj !== 'object' || obj === null) return false;

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    isValidTodoStatus(candidate.status)
  );
}
```

### 9.4 Fix Priority Enum

Use clear names instead of `p1/p2/p3`:

```typescript
priority?: 'critical' | 'high' | 'normal' | 'low';
```

### 9.5 Update Package.json Schemas

Add missing node types (`error`, `recipe`) to search schemas.

---

## Part 10: Configuration (Minimal)

Only essential settings. Convention over configuration.

```json
{
  "nanodex.ui.showIndexingStatus": {
    "type": "boolean",
    "default": true,
    "description": "Show indexing status in status bar"
  }
}
```

### Removed Settings

| Setting | Reason |
|---------|--------|
| `nanodex.skills.enabled` | Skills always enabled |
| `nanodex.skills.locations` | Use standard `.github/skills` |
| `nanodex.context.injectStats` | Always inject (low cost) |
| `nanodex.context.injectEnvironment` | Always inject (low cost) |
| `nanodex.context.injectCapabilities` | Removed entirely |

---

## Part 11: Implementation Phases

### Phase 1: Foundation & Security (Week 1-2)

| Task | Effort | Notes | Priority |
|------|--------|-------|----------|
| **P1 Security: Issue ID validation** | Low | Path traversal fix | CRITICAL |
| **P1 Security: YAML safe loading** | Low | Use JSON_SCHEMA | CRITICAL |
| Create `.github/skills/` structure | Low | Directory + 6 SKILL.md files | High |
| `nanodex-graph-stats` tool | Low | Extend existing GraphStats | High |
| `nanodex-delete-issue` tool | Low | Call existing deleteIssue | High |
| Indexing status feedback | Low | Event-driven, 2 functions | Medium |
| TypeScript fixes (async exec, types) | Low | Per Kieran review | Medium |

**Deliverables:** Security fixes, 9 tools, status feedback, skills directory

### Phase 2: Skills & CRUD (Week 3-4)

| Task | Effort | Notes |
|------|--------|-------|
| nanodex-planning SKILL.md | Medium | Convert from plan.flow.yaml |
| nanodex-working SKILL.md | Medium | Convert from work.flow.yaml |
| nanodex-reviewing SKILL.md | Low | New skill |
| nanodex-debugging SKILL.md | Low | New skill |
| nanodex-refactoring SKILL.md | Low | New skill |
| nanodex-explaining SKILL.md | Low | New skill |
| Todo CRUD tools (4 thin wrappers) | Low | Wrap existing todos.ts |
| Database connection pooling | Medium | Performance fix |

**Deliverables:** 6 portable skills, 12 tools total, connection pooling

### Phase 3: Polish & Performance (Week 5-6)

| Task | Effort | Notes |
|------|--------|-------|
| Git branch context injection | Low | ~30 lines |
| Replace full table scan in context.ts | Medium | Use indexed queries |
| Add subgraph query caching | Low | Use existing cache class |
| Type guards for new inputs | Low | Follow issues.ts pattern |
| Documentation update | Medium | README, CHANGELOG |
| Publish to awesome-copilot | Low | PR to community repo |

**Deliverables:** Complete 90%+ agent-native compliance, performance optimizations

---

## Part 12: Success Metrics

### Agent-Native Score Progression

| Phase | Score | Key Improvements |
|-------|-------|------------------|
| Current | 70% | 7 tools, YAML flows |
| Phase 1 | 78% | +2 tools, security fixes, UI feedback |
| Phase 2 | 88% | +6 skills, +3 todo tools, connection pooling |
| Phase 3 | 90%+ | Context injection, performance, documentation |

### Principle-Level Targets

| Principle | Current | Target | Changes |
|-----------|---------|--------|---------|
| Action Parity | 71% | 85% | +stats, +delete-issue, +todos |
| CRUD Completeness | 25% | 100% | +todo CRUD, +delete issue |
| Context Injection | 38% | 60% | +git branch (no capability enum) |
| Prompt-Native | 74% | 90% | +6 portable skills |
| UI Integration | 81% | 90% | +indexing feedback |

### Performance Targets

| Metric | Current | Target | Optimization |
|--------|---------|--------|--------------|
| Connection overhead | 50-150ms/interaction | <10ms | Connection pooling |
| Context query (10K nodes) | 50-150ms | 10-30ms | Indexed LIKE queries |
| Subgraph traversal (depth 2) | 222 queries | 2 queries | Recursive CTE |
| Repeated query latency | Same as first | <5ms | Query caching |

---

## Appendix A: Final File Structure

```
nanodex-vscode/
├── .github/
│   └── skills/
│       ├── nanodex-planning/SKILL.md
│       ├── nanodex-working/SKILL.md
│       ├── nanodex-reviewing/SKILL.md
│       ├── nanodex-debugging/SKILL.md
│       ├── nanodex-refactoring/SKILL.md
│       └── nanodex-explaining/SKILL.md
│
├── extension/
│   ├── package.json                    # 12 tool definitions
│   └── src/
│       ├── core/
│       │   ├── types.ts                # +GraphStatsOutput, +Todo, +type guards
│       │   ├── environment.ts          # NEW: git branch context
│       │   ├── databasePool.ts         # NEW: connection pooling
│       │   └── ...
│       ├── tools/
│       │   ├── utils.ts
│       │   ├── graphQueryTool.ts
│       │   ├── symbolLookupTool.ts
│       │   ├── fileContextTool.ts
│       │   ├── issuesTool.ts
│       │   ├── getIssueTool.ts
│       │   ├── createIssueTool.ts
│       │   ├── updateIssueStatusTool.ts
│       │   ├── deleteIssueTool.ts      # NEW
│       │   ├── graphStatsTool.ts       # NEW
│       │   ├── createTodoTool.ts       # NEW (thin wrapper)
│       │   ├── listTodosTool.ts        # NEW (thin wrapper)
│       │   ├── updateTodoTool.ts       # NEW (thin wrapper)
│       │   ├── deleteTodoTool.ts       # NEW (thin wrapper)
│       │   └── index.ts
│       └── ui/
│           └── indexingStatus.ts       # NEW: simple functions
│
├── AGENTS.md
└── docs/
    └── ARCHITECTURE_EVOLUTION_PLAN.md
```

---

## Appendix B: Package.json Tool Definitions

```json
{
  "contributes": {
    "languageModelTools": [
      {
        "name": "nanodex-query-graph",
        "displayName": "Query Knowledge Graph",
        "modelDescription": "Query the knowledge graph for symbols, modules, and relationships. Use this when you need to understand codebase structure, find related code, or get context about the codebase.",
        "inputSchema": { "type": "object", "properties": { "query": { "type": "string", "description": "Natural language query about the codebase" }, "depth": { "type": "number", "description": "Traversal depth 1-5, default 2" } }, "required": ["query"] }
      },
      {
        "name": "nanodex-lookup-symbol",
        "displayName": "Lookup Symbol",
        "modelDescription": "Look up a specific symbol by name with optional relationships. Use when you need detailed information about a function, class, or variable.",
        "inputSchema": { "type": "object", "properties": { "symbolName": { "type": "string", "description": "Name of the symbol to find" }, "includeRelationships": { "type": "boolean", "description": "Include callers and dependencies" } }, "required": ["symbolName"] }
      },
      {
        "name": "nanodex-get-file-context",
        "displayName": "Get File Context",
        "modelDescription": "Get knowledge graph context for a file including symbols, imports, exports, and relationships.",
        "inputSchema": { "type": "object", "properties": { "filePath": { "type": "string", "description": "Path relative to workspace root" } }, "required": ["filePath"] }
      },
      {
        "name": "nanodex-list-issues",
        "displayName": "List Issues",
        "modelDescription": "List nanodex issues (implementation plans) with optional status filter.",
        "inputSchema": { "type": "object", "properties": { "status": { "type": "string", "enum": ["pending", "in_progress", "completed", "all"] } } }
      },
      {
        "name": "nanodex-get-issue",
        "displayName": "Get Issue",
        "modelDescription": "Get full details for a specific issue including plan, acceptance criteria, and context.",
        "inputSchema": { "type": "object", "properties": { "issueId": { "type": "string", "description": "The issue ID (e.g., 'ISSUE-001')" } }, "required": ["issueId"] }
      },
      {
        "name": "nanodex-create-issue",
        "displayName": "Create Issue",
        "modelDescription": "Create a new nanodex issue (implementation plan). Use after planning to track work.",
        "inputSchema": { "type": "object", "properties": { "title": { "type": "string" }, "goal": { "type": "string" }, "plan": { "type": "string" }, "acceptanceCriteria": { "type": "array", "items": { "type": "string" } } }, "required": ["title", "goal"] }
      },
      {
        "name": "nanodex-update-issue-status",
        "displayName": "Update Issue Status",
        "modelDescription": "Update the status of an issue. Use to mark as in_progress when starting or completed when done.",
        "inputSchema": { "type": "object", "properties": { "issueId": { "type": "string" }, "status": { "type": "string", "enum": ["pending", "in_progress", "completed"] } }, "required": ["issueId", "status"] }
      },
      {
        "name": "nanodex-delete-issue",
        "displayName": "Delete Issue",
        "modelDescription": "Delete an issue by ID. Use to remove cancelled or obsolete plans.",
        "inputSchema": { "type": "object", "properties": { "issueId": { "type": "string", "description": "The issue ID to delete" } }, "required": ["issueId"] }
      },
      {
        "name": "nanodex-graph-stats",
        "displayName": "Graph Statistics",
        "modelDescription": "Get statistics about the knowledge graph including node/edge counts and index status. Use to understand graph health.",
        "inputSchema": { "type": "object", "properties": {} }
      },
      {
        "name": "nanodex-create-todo",
        "displayName": "Create Todo",
        "modelDescription": "Create a new todo item for tracking work.",
        "inputSchema": { "type": "object", "properties": { "title": { "type": "string" }, "description": { "type": "string" }, "priority": { "type": "string", "enum": ["critical", "high", "normal", "low"] }, "tags": { "type": "array", "items": { "type": "string" } } }, "required": ["title", "description"] }
      },
      {
        "name": "nanodex-list-todos",
        "displayName": "List Todos",
        "modelDescription": "List todos with optional status and priority filters.",
        "inputSchema": { "type": "object", "properties": { "status": { "type": "string", "enum": ["pending", "in_progress", "completed", "all"] }, "priority": { "type": "string", "enum": ["critical", "high", "normal", "low"] } } }
      },
      {
        "name": "nanodex-update-todo",
        "displayName": "Update Todo",
        "modelDescription": "Update todo status. Use to mark progress on work items.",
        "inputSchema": { "type": "object", "properties": { "todoId": { "type": "string" }, "status": { "type": "string", "enum": ["pending", "in_progress", "completed"] } }, "required": ["todoId"] }
      },
      {
        "name": "nanodex-delete-todo",
        "displayName": "Delete Todo",
        "modelDescription": "Delete a todo item.",
        "inputSchema": { "type": "object", "properties": { "todoId": { "type": "string" } }, "required": ["todoId"] }
      }
    ]
  }
}
```

---

## Appendix C: Security Checklist

| Requirement | Status | Notes |
|-------------|--------|-------|
| Issue ID validation | **FIX REQUIRED** | Add pattern + path containment check |
| Todo ID validation | **FIX REQUIRED** | Same pattern as issue ID |
| SQL injection prevention | PASS | All queries use prepared statements |
| Path traversal (file context) | PASS | Already validates workspace containment |
| YAML safe loading | **FIX REQUIRED** | Use JSON_SCHEMA |
| No hardcoded secrets | PASS | None found |
| Input length validation | PASS | Applied to all tool inputs |

---

## Summary of Changes from Original Plan

### Kept
- Agent Skills adoption (6 portable skills)
- Essential new tools (graph-stats, delete-issue, todo CRUD)
- Git branch context injection
- Event-driven UI feedback

### Removed
- YAML chat routing (Part 6)
- `nanodex-search-nodes` tool (redundant)
- `nanodex-get-relationships` tool (redundant)
- `nanodex-trigger-reindex` tool (command exists)
- Capability enumeration (LM API handles)
- ContextBudgetManager abstraction
- Progressive disclosure infrastructure
- 5 of 6 configuration options
- 30-second polling
- IndexingStatusManager class
- Welcome webview

### Added (from research)
- P1 Security fixes (path traversal, YAML safety)
- Database connection pooling
- Query caching for subgraphs
- Indexed LIKE queries for context selection
- Proper skill naming (gerund form)
- Comprehensive tool modelDescriptions

### Fixed
- Extend `GraphStats` type (don't duplicate)
- Use async `exec` (not `execSync`)
- Add type guards for inputs
- Clear priority names (`critical/high/normal/low`)
- Package.json schema completeness

### Timeline
- Original: 10 weeks, 5 phases
- Revised: 6 weeks, 3 phases
- Tools: 16 → 12
- Config options: 6 → 1

---

## Sources

**VS Code Extension Development:**
- [Language Model Tools API](https://code.visualstudio.com/api/extension-guides/ai/tools)
- [VS Code Extension API](https://code.visualstudio.com/api)

**Agent Skills Standard:**
- [Agent Skills Specification](https://agentskills.io/specification)
- [GitHub Copilot Agent Skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills)
- [VS Code Agent Skills Documentation](https://code.visualstudio.com/docs/copilot/customization/agent-skills)
- [awesome-copilot Skills](https://github.com/github/awesome-copilot/blob/main/docs/README.skills.md)

**Best Practices:**
- [Anthropic Tool Use Documentation](https://docs.anthropic.com/en/docs/tool-use)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
