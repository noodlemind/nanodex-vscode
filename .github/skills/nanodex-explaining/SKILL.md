---
name: nanodex-explaining
description: Explain code structure and relationships using knowledge graph context. Use when onboarding, documenting architecture, understanding unfamiliar code, or answering "how does this work" questions. Triggers on "explain", "how does", "what is", "describe", "understand", "walk through".
license: Apache-2.0
---

# Code Explanation with Knowledge Graph

Explain code with full context from the knowledge graph.

## Quick Start

1. Query the graph for the target code
2. Understand its relationships
3. Build a complete picture
4. Explain with context

## Instructions

### 1. Get File Overview

```
Use nanodex-get-file-context to understand:
- What symbols the file defines
- What it imports and exports
- How it relates to other modules
```

### 2. Understand Relationships

```
Use nanodex-lookup-symbol with includeRelationships: true
- What calls this code
- What this code calls
- The dependency chain
```

### 3. Find Related Code

```
Use nanodex-query-graph to find:
- Similar implementations
- Related modules
- The broader context
```

### 4. Build the Explanation

Combine graph context with code to explain:
- What the code does
- How it fits in the system
- Why it's designed this way

## Explanation Template

```markdown
## [Symbol/File Name]

### Purpose
[What this code does]

### Location in Architecture
- Part of: [module/layer]
- Used by: [list from graph]
- Depends on: [list from graph]

### Key Relationships
- Imports: [from graph]
- Exports: [from graph]
- Calls: [from graph]

### How It Works
[Step-by-step explanation]
```

## Example Explanation

**Question:** "How does UserService work?"

**Process:**
1. `nanodex-get-file-context` on UserService.ts
2. `nanodex-lookup-symbol UserService` → See methods
3. `nanodex-query-graph "UserService"` → Find usage

**Answer:**
- UserService handles user CRUD operations
- Called by UserController and AuthMiddleware
- Depends on DatabaseService and CacheService
- Key methods: getUser, createUser, updateUser

## Guidelines

- Always query the graph for context
- Show relationships, not just code
- Explain the "why" along with the "what"
- Use graph data to support explanations
