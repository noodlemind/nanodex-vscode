---
name: nanodex-refactoring
description: Refactor code safely using knowledge graph to understand all usages and dependencies. Use when restructuring code, extracting functions, renaming symbols, or consolidating duplicates. Triggers on "refactor", "extract", "rename", "consolidate", "restructure", "clean up".
license: Apache-2.0
---

# Safe Refactoring with Knowledge Graph

Refactor with confidence using full dependency knowledge.

## Quick Start

1. Query all usages of the target code
2. Understand the dependency graph
3. Plan changes to avoid breaking dependents
4. Refactor systematically

## Instructions

### 1. Understand Current Usage

```
Use nanodex-lookup-symbol with includeRelationships: true
- Find all callers
- Find all dependencies
- Map the usage graph
```

### 2. Check Impact Scope

```
Use nanodex-query-graph to find:
- All modules that import this
- Transitive dependencies
- Test files that cover this
```

### 3. Plan the Refactor

Create an issue with:
- All files that need changes
- Order of changes (dependencies first)
- Test strategy

```
Use nanodex-create-issue to track the refactoring plan
```

### 4. Execute Safely

For each change:
1. Update the target
2. Update all dependents
3. Run tests
4. Commit

## Refactoring Patterns

### Extract Function
1. `nanodex-lookup-symbol` on original function
2. Identify extractable logic
3. Check no hidden dependencies
4. Extract and update callers

### Rename Symbol
1. `nanodex-lookup-symbol` to find all usages
2. List all files to update
3. Rename in all locations
4. Verify no broken references

### Consolidate Duplicates
1. `nanodex-query-graph` to find similar code
2. Compare implementations
3. Create shared version
4. Update all usages

## Example Refactor

**Goal:** Rename `getUserData` to `fetchUser`

**Process:**
1. `nanodex-lookup-symbol getUserData` → Found in 5 files
2. `nanodex-query-graph "calls getUserData"` → 12 callers
3. Create issue with all 17 files
4. Rename in order: definition first, then callers

## Guidelines

- Always query usages before changing
- Update dependencies in order
- Run tests after each change
- Track progress in an issue
