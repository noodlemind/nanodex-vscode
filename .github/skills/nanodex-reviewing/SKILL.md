---
name: nanodex-reviewing
description: Review code changes using knowledge graph context to understand impact and ensure consistency. Use when reviewing PRs, validating implementations, checking code quality, or assessing change impact. Triggers on "review", "check", "validate", "assess impact", "code review".
license: Apache-2.0
---

# Code Review with Knowledge Graph

Review code changes with full context from the knowledge graph.

## Quick Start

1. Identify changed files
2. Query graph for relationships and dependencies
3. Check for breaking changes
4. Validate against patterns

## Instructions

### 1. Understand Changes

For each changed file:
```
Use nanodex-get-file-context to understand:
- What symbols exist in the file
- What the file imports/exports
- Related modules
```

### 2. Check Impact

```
Use nanodex-query-graph to find:
- What depends on changed code
- What the changed code depends on
- Potential breaking changes
```

### 3. Validate Patterns

```
Use nanodex-lookup-symbol to:
- Find similar implementations
- Check naming conventions
- Verify consistent patterns
```

## Review Checklist

### Correctness
- [ ] Logic matches intended behavior
- [ ] Edge cases handled
- [ ] Error handling appropriate

### Consistency
- [ ] Follows existing patterns (query graph for examples)
- [ ] Naming matches conventions
- [ ] File structure consistent

### Impact
- [ ] Dependencies updated if needed
- [ ] No breaking changes to dependents
- [ ] Tests cover new functionality

## Example Review

**Changed:** `src/services/UserService.ts`

**Process:**
1. `nanodex-get-file-context` → See exports, imports
2. `nanodex-query-graph` → Find what calls UserService
3. `nanodex-lookup-symbol` → Check similar services
4. Validate changes follow ServiceBase pattern

## Guidelines

- Always check what depends on changed code
- Look for similar implementations to ensure consistency
- Consider impact on the broader codebase
- Use graph context to inform review comments
