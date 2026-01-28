# Testing Guide for Language Model Tools

## Prerequisites

Before testing the Language Model Tools, ensure:

1. **VS Code Version**: 1.106.0 or later
2. **Node.js Version**: 20.0.0 or later
3. **Extension Built**: Run `pnpm run build` in the extension directory
4. **Workspace Indexed**: Run "Nanodex: Index Workspace" command

## Manual Testing Steps

### 1. Verify Extension Activation

1. Open VS Code with the extension installed
2. Open the Output panel (View → Output)
3. Select "nanodex" from the dropdown
4. Look for these log messages:
   ```
   nanodex extension is activating...
   Registering commands...
   Attempting to register chat participant...
   Attempting to register language model tools...
   Registered: nanodex-query-graph
   Registered: nanodex-lookup-symbol
   Registered: nanodex-list-issues
   Registered: nanodex-get-file-context
   All nanodex language model tools registered successfully
   nanodex extension activated successfully
   ```

### 2. Test Tool Discovery

Tools should be discoverable by any LLM in VS Code. To verify:

1. Open GitHub Copilot Chat (or any AI assistant in VS Code)
2. Type `#` and look for nanodex tools in the autocomplete:
   - `#nanodexGraph`
   - `#nanodexSymbol`
   - `#nanodexIssues`
   - `#nanodexFileContext`

### 3. Test Each Tool

#### Test 1: Query Graph Tool

**Command**:
```
@workspace Using #nanodexGraph, show me the main modules in this codebase
```

**Expected Result**:
- Tool is invoked with query: "main modules"
- Returns list of modules from the knowledge graph
- Includes facts, relations, and entry points

**Verification**:
- Check that module names are listed
- Verify relationships are shown
- Confirm token count is reasonable

---

#### Test 2: Symbol Lookup Tool

**Command**:
```
@workspace Use #nanodexSymbol to find information about "registerChatParticipant"
```

**Expected Result**:
- Tool is invoked with symbolName: "registerChatParticipant"
- Returns symbol details (location, kind, metadata)
- Shows relationships if includeRelationships is true

**Verification**:
- Symbol name matches search
- File path is shown
- Line number is correct
- Relationships are listed (imports, calls, etc.)

---

#### Test 3: List Issues Tool

**Command**:
```
@workspace Show me all pending issues using #nanodexIssues
```

**Expected Result**:
- Tool is invoked with status: "pending" (or inferred)
- Returns list of issues filtered by status
- Shows issue ID, title, goal, and creation date

**Verification**:
- Issues are listed correctly
- Status filter works
- Issue details are complete

---

#### Test 4: File Context Tool

**Command**:
```
@workspace Get #nanodexFileContext for "src/extension.ts"
```

**Expected Result**:
- Tool is invoked with filePath: "src/extension.ts"
- Returns file context (symbols, imports, exports)
- Shows related modules

**Verification**:
- File path is recognized
- Symbols are listed with kinds
- Imports are shown
- Exports are listed
- Related modules are identified

---

### 4. Test Error Handling

#### Test 4a: Missing Database

1. Delete or rename `.nanodex/graph.sqlite` in your workspace
2. Try to use any tool
3. Expected: Error message "Knowledge graph database not found. Please run 'Nanodex: Index Workspace' first."

#### Test 4b: Invalid File Path

1. Use `#nanodexFileContext` with a path outside workspace
2. Example: `#nanodexFileContext ../../../etc/passwd`
3. Expected: Error message "File path is outside the workspace"

#### Test 4c: Symbol Not Found

1. Use `#nanodexSymbol` with a non-existent symbol
2. Example: `#nanodexSymbol NonExistentSymbol12345`
3. Expected: "No symbol found matching..."

#### Test 4d: SQL Injection Attempt

1. Try to inject SQL through symbol name
2. Example: `#nanodexSymbol test%' OR '1'='1`
3. Expected: Search is escaped properly, returns no results (not an error)

---

### 5. Test Backward Compatibility

#### Test 5a: VS Code 1.105.x

1. Install extension on VS Code 1.105.x
2. Expected: Warning in console but extension still works
3. Chat participant should function normally
4. Tools won't be registered (graceful degradation)

#### Test 5b: Missing vscode.lm API

1. If running on older VS Code without Language Model API
2. Expected: Console warning and extension continues
3. No crash or activation failure

---

### 6. Test Security Features

#### Test 6a: SQL Wildcard Escaping

1. Search for symbols with wildcards in name: `#nanodexSymbol test%symbol_name`
2. Expected: Wildcards are escaped, literal search performed

#### Test 6b: Path Normalization

1. Try relative path with ..: `#nanodexFileContext ../src/extension.ts`
2. Expected: Error if outside workspace, normalized if within

#### Test 6c: Read-Only Access

1. While tool is running, try to modify database
2. Expected: No lock conflicts, tools use read-only mode

---

### 7. Performance Testing

#### Test 7a: Large Results

1. Query for common term: `#nanodexGraph function`
2. Expected: Results are limited and trimmed to max tokens
3. Response time should be < 2 seconds

#### Test 7b: Deep Traversal

1. Use maximum depth: `#nanodexGraph authentication depth:5`
2. Expected: Results include deep relationships
3. Response should complete without timeout

---

## Automated Testing (Future)

Create automated tests for:

1. Tool registration
2. Input validation
3. SQL escaping
4. Path validation
5. Error handling
6. Context selection
7. Result formatting

Example test structure:
```typescript
describe('NanodexGraphQueryTool', () => {
  it('should escape SQL wildcards', () => {
    const result = escapeSqlLike('test%value_name');
    expect(result).toBe('test\\%value\\_name');
  });

  it('should validate depth parameter', () => {
    // Test depth clamping to 1-5 range
  });

  it('should handle missing database gracefully', () => {
    // Test error message
  });
});
```

---

## Troubleshooting

### Issue: Tools not appearing in autocomplete

**Solution**:
1. Verify VS Code version is 1.106.0+
2. Check console for registration messages
3. Restart VS Code
4. Reinstall extension

### Issue: Database not found error

**Solution**:
1. Run "Nanodex: Index Workspace" command
2. Verify `.nanodex/graph.sqlite` exists
3. Check workspace folder is open

### Issue: Symbol not found

**Solution**:
1. Verify workspace is indexed
2. Check symbol name spelling
3. Try reindexing with "Nanodex: Reindex"

### Issue: Slow responses

**Solution**:
1. Reduce query depth parameter
2. Optimize database with "Nanodex: Optimize"
3. Be more specific in queries

---

## Reporting Issues

When reporting issues, include:

1. VS Code version
2. Extension version
3. Node.js version
4. Console logs (Output panel)
5. Steps to reproduce
6. Expected vs actual behavior

Submit issues to: https://github.com/nanodex/nanodex-vscode/issues

---

## Test Checklist

- [ ] Extension activates successfully
- [ ] All 4 tools are registered
- [ ] Tools appear in autocomplete
- [ ] Graph query tool works
- [ ] Symbol lookup tool works
- [ ] Issues list tool works
- [ ] File context tool works
- [ ] Error messages are clear
- [ ] Security validations work
- [ ] Backward compatibility maintained
- [ ] Performance is acceptable
- [ ] Documentation is accurate

---

## Success Criteria

✅ All tools registered without errors
✅ Tools are discoverable in VS Code
✅ All test cases pass
✅ No security vulnerabilities
✅ Backward compatible
✅ Performance meets expectations
