# Language Model Tools Integration

## Overview

Nanodex now exposes its knowledge graph as Language Model Tools that can be discovered and invoked by ANY language model in VS Code (not just the chat participant). This makes the knowledge graph a first-class citizen in VS Code's AI ecosystem.

## Available Tools

### 1. Query Nanodex Knowledge Graph (`nanodex-query-graph`)

**Tool Reference**: `#nanodexGraph`

Query the knowledge graph for codebase symbols, modules, relationships, and architecture.

**Input Schema**:
- `query` (string, required): Natural language query about the codebase
- `depth` (number, optional): Traversal depth for relationships (1-5, default 2)

**Example**:
```
Query: "authentication flow"
Depth: 2
```

**Use Cases**:
- Understanding code structure
- Finding related code
- Getting architectural context
- Exploring module relationships

---

### 2. Lookup Symbol in Nanodex (`nanodex-lookup-symbol`)

**Tool Reference**: `#nanodexSymbol`

Look up detailed information about a specific symbol (function, class, variable) including its relationships, callers, and dependencies.

**Input Schema**:
- `symbolName` (string, required): Name of the symbol to look up
- `includeRelationships` (boolean, optional): Include symbol relationships

**Example**:
```
Symbol Name: "AuthService"
Include Relationships: true
```

**Use Cases**:
- Finding function/class definitions
- Understanding symbol dependencies
- Exploring call graphs
- Analyzing symbol relationships

---

### 3. List Nanodex Issues (`nanodex-list-issues`)

**Tool Reference**: `#nanodexIssues`

List all nanodex issues (implementation plans) in the workspace with their status and details.

**Input Schema**:
- `status` (string, optional): Filter by status - "pending", "in_progress", "completed", or "all" (default)

**Example**:
```
Status: "pending"
```

**Use Cases**:
- Viewing current implementation plans
- Tracking work progress
- Finding pending tasks
- Getting project context

---

### 4. Get File Context from Nanodex (`nanodex-get-file-context`)

**Tool Reference**: `#nanodexFileContext`

Get knowledge graph context for a specific file including its symbols, imports, exports, and relationships to other modules.

**Input Schema**:
- `filePath` (string, required): Path to the file (relative to workspace root)

**Example**:
```
File Path: "src/extension.ts"
```

**Use Cases**:
- Understanding file structure
- Finding file dependencies
- Exploring imports/exports
- Analyzing module relationships

---

## How to Use

### Automatic Discovery

All language models in VS Code can automatically discover and use these tools. When you ask a question about your codebase, the LLM may automatically invoke the appropriate nanodex tool to gather context.

### Explicit Reference

You can explicitly reference tools in your prompts using the `#` symbol:

```
@workspace Using #nanodexGraph, explain the authentication flow in this codebase.
```

```
@workspace Look up the #nanodexSymbol "UserController" and show me its dependencies.
```

```
@workspace Show me all #nanodexIssues that are currently pending.
```

```
@workspace Get #nanodexFileContext for "src/core/graph.ts" and explain its purpose.
```

### In Chat Participant

The nanodex chat participant (`@nanodex`) can also leverage these tools:

```
@nanodex /explain How does the indexer work?
```

The participant will automatically query the knowledge graph to provide context-aware answers.

---

## Security Features

All tools include robust security measures:

1. **SQL Injection Prevention**: All user inputs are properly escaped before being used in SQL LIKE patterns
2. **Path Traversal Protection**: File paths are validated to ensure they stay within the workspace
3. **Read-Only Access**: Tools use read-only database connections to prevent accidental modifications
4. **Input Validation**: All inputs are validated and sanitized

---

## Backward Compatibility

The tools are designed with backward compatibility in mind:

- **VS Code 1.106.0+**: Full tool support with automatic discovery
- **VS Code 1.105.x**: Extension works without tools; chat participant still functional
- **Graceful Degradation**: If the Language Model Tool API is not available, the extension logs a warning and continues without tool registration

---

## Requirements

- **VS Code Version**: 1.106.0 or later (for full tool support)
- **Node.js Version**: 20.0.0 or later
- **Indexed Workspace**: Tools require an indexed workspace to provide context. Run "Nanodex: Index Workspace" first.

---

## Technical Details

### Tool Implementation

Each tool is implemented as a class that implements `vscode.LanguageModelTool<InputType>`:

```typescript
class NanodexGraphQueryTool implements vscode.LanguageModelTool<GraphQueryInput> {
  async invoke(options, token): Promise<vscode.LanguageModelToolResult>
  async prepareInvocation(options, token): Promise<vscode.PreparedToolInvocation>
}
```

### Registration

Tools are registered during extension activation:

```typescript
vscode.lm.registerTool('nanodex-query-graph', new NanodexGraphQueryTool())
```

### Package.json Configuration

Tools are declared in `package.json` under `contributes.languageModelTools`:

```json
{
  "contributes": {
    "languageModelTools": [
      {
        "name": "nanodex-query-graph",
        "tags": ["nanodex", "codebase", "knowledge-graph"],
        "toolReferenceName": "nanodexGraph",
        "displayName": "Query Nanodex Knowledge Graph",
        "modelDescription": "...",
        "inputSchema": { ... }
      }
    ]
  }
}
```

---

## Troubleshooting

### Tools Not Appearing

1. Ensure you're running VS Code 1.106.0 or later
2. Check the extension is activated (look for "nanodex extension activated successfully" in the console)
3. Verify the workspace is indexed (run "Nanodex: Index Workspace")

### Tool Errors

- **"No workspace folder is open"**: Open a workspace before using tools
- **"Knowledge graph database not found"**: Run "Nanodex: Index Workspace" first
- **"No module found for file"**: The file may not be indexed yet; try reindexing
- **"File path is outside the workspace"**: Ensure file paths are relative to workspace root

---

## Future Enhancements

Planned improvements for Language Model Tools:

1. **Chat Variables**: Add `#nanodex-context` variable for quick context injection
2. **Streaming Responses**: Stream large results for better UX
3. **Caching**: Cache frequently accessed graph queries
4. **Advanced Filtering**: More sophisticated query capabilities
5. **Integration with chat-extension-utils**: Automatic tool calling in chat participant (when stable)

---

## Feedback

Found an issue or have a suggestion? Please open an issue on [GitHub](https://github.com/nanodex/nanodex-vscode/issues).
