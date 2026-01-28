---
name: nanodex-debugging
description: Debug issues using knowledge graph to trace dependencies and understand code flow. Use when investigating bugs, tracing errors, understanding call chains, or finding root causes. Triggers on "debug", "investigate", "trace", "find bug", "root cause", "why is this".
license: Apache-2.0
---

# Debugging with Knowledge Graph

Use the knowledge graph to trace issues and understand code flow.

## Quick Start

1. Identify the symptom location
2. Query graph for call chains and dependencies
3. Trace through relationships
4. Find root cause

## Instructions

### 1. Locate the Problem

Start with the file/function showing the error:
```
Use nanodex-get-file-context to understand:
- What the file does
- Its dependencies
- Its relationships
```

### 2. Trace Dependencies

```
Use nanodex-lookup-symbol with includeRelationships: true
- See what calls this function
- See what this function calls
- Understand the call chain
```

### 3. Explore Related Code

```
Use nanodex-query-graph to find:
- Related error handlers
- Similar implementations
- Connected modules
```

### 4. Narrow Down

Follow the dependency chain:
1. Start at error location
2. Query each upstream dependency
3. Check each for potential issues
4. Identify root cause

## Debugging Workflow

**Error:** "TypeError in UserService.getUser"

**Process:**
1. `nanodex-get-file-context` on UserService.ts
2. `nanodex-lookup-symbol` on "getUser" → See callers
3. `nanodex-query-graph` on "user validation"
4. Found: Caller passes null, no null check

## Common Patterns

### Tracing Null Errors
- Query symbol relationships
- Check all callers for what they pass
- Verify input validation

### Understanding Side Effects
- Query module dependencies
- Check what gets modified
- Trace state changes

### Finding Missing Handlers
- Query for error patterns
- Check related modules for handlers
- Compare with similar code

## Guidelines

- Start at the error and work backwards
- Use relationships to understand call flow
- Compare with similar working code
- Query for error handling patterns
