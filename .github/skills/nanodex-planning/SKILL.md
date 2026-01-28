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
