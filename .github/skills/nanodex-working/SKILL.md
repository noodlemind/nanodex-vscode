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

```
Use nanodex-get-issue with the issue ID to load full details.
```

Review:
- Goal and acceptance criteria
- Implementation plan phases
- Related modules from context

### 2. Start Work

```
Use nanodex-update-issue-status to mark as "in_progress"
```

### 3. Context-Driven Implementation

For each phase:

1. **Query Context**
   - Use `nanodex-query-graph` for related symbols
   - Use `nanodex-get-file-context` for specific files
   - Use `nanodex-lookup-symbol` for function details

2. **Follow Patterns**
   - Match existing code conventions
   - Reuse similar implementations
   - Stay consistent with codebase style

3. **Implement & Test**
   - Make changes incrementally
   - Run tests after each change
   - Commit logical units

### 4. Complete Work

```
Use nanodex-update-issue-status to mark as "completed"
```

## Workflow Example

**Issue:** ISSUE-001 - Add user authentication

**Steps:**
1. `nanodex-get-issue` → Load full plan
2. `nanodex-update-issue-status` → Mark in_progress
3. `nanodex-query-graph` → Find auth patterns
4. `nanodex-get-file-context` → Understand UserController
5. Implement following patterns
6. `nanodex-update-issue-status` → Mark completed

## Guidelines

- Always load the issue before starting work
- Query the graph for context on each phase
- Follow existing patterns found in the codebase
- Update issue status to track progress
- Commit after completing each phase
