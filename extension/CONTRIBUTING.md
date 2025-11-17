# Contributing to nanodex

Thank you for your interest in contributing to nanodex! This document provides guidelines and instructions for development.

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- VS Code >= 1.105.0

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd nanodex-vscode

# Install dependencies
pnpm install

# Build the extension
cd extension
pnpm run build
```

### Development Workflow

#### Running the Extension

Press **F5** in VS Code to launch the Extension Development Host with nanodex loaded.

#### Incremental Build

```bash
# Watch mode for automatic recompilation
pnpm run watch
```

#### Testing

```bash
# Run tests
pnpm run test
```

## Project Structure

```
extension/
├── src/
│   ├── chat/           # Chat participant integration
│   ├── commands/       # Command palette commands
│   ├── core/           # Core functionality
│   │   ├── graph.ts    # Knowledge graph operations
│   │   ├── types.ts    # Type definitions
│   │   ├── languages.ts # Language detection
│   │   ├── cache.ts    # Caching infrastructure
│   │   └── batchOps.ts # Database batch operations
│   └── ui/             # UI components
└── dist/               # Compiled output
```

## Code Style

### TypeScript Conventions

- **2-space indentation**
- **ES modules** (`import`/`export`)
- **camelCase** for variables and functions
- **PascalCase** for classes, interfaces, and types
- **Async/await** preferred over callbacks
- **Function length**: Keep under ~75 LOC

### Type Safety

- **No `any` types**: Use proper TypeScript types with validation
- **Type guards**: Validate all external data (configs, database)
- **Runtime validation**: Use type guards for data from untyped sources

Example type guard:
```typescript
function isValidNodeType(type: string): type is NodeType {
  return Object.values(NodeType).includes(type as NodeType);
}
```

### Resource Management

Always use try/finally blocks with optional chaining for cleanup:

```typescript
let db: Database.Database | undefined;
try {
  db = new Database(dbPath);
  // ... operations
} catch (error) {
  console.error('Operation failed:', error);
} finally {
  db?.close();
}
```

## Testing

### Test Structure

Tests mirror the source tree structure:

```
extension/test/
├── commands/
│   ├── plan.test.ts
│   └── work.test.ts
├── core/
│   ├── graph.test.ts
│   └── indexer.test.ts
└── chat/
    └── participant.test.ts
```

### Writing Tests

Focus on:
- Graph edge cases and query correctness
- File system interactions
- WorkspaceEdit generation
- Regression tests for fixed bugs

## Adding Language Support

To add a new language:

1. Edit `src/core/languages.ts`:

```typescript
export enum Language {
  // ... existing languages
  NewLang = 'newlang'
}

const LANGUAGE_REGISTRY: Record<Language, LanguageMetadata> = {
  // ... existing languages
  [Language.NewLang]: {
    name: 'New Language',
    extensions: ['.nl', '.newlang'],
    commentStyle: {
      line: '//',
      block: { start: '/*', end: '*/' }
    },
    supportsIndexing: true
  }
};
```

2. Create parser implementation in `src/parsers/` if needed
3. Add tests for the new language

## Database Schema Changes

The knowledge graph uses SQLite with this schema:

```sql
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  metadata TEXT,
  created_at INTEGER
);

CREATE TABLE edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  metadata TEXT,
  FOREIGN KEY (source_id) REFERENCES nodes(id),
  FOREIGN KEY (target_id) REFERENCES nodes(id)
);
```

When modifying schema:
1. Update schema in database initialization code
2. Add migration logic if needed
3. Update type definitions in `src/core/types.ts`

## Common Patterns

### Caching Pattern

```typescript
import { LRUCache, TTLCache } from '../core/cache.js';

// LRU cache for frequently accessed data
const fileCache = new LRUCache<string, FileData>(500);

// TTL cache for time-sensitive data
const apiCache = new TTLCache<string, Response>(300000); // 5 minutes
```

### Batch Operations Pattern

```typescript
import { batchInsertNodes, batchInsertEdges } from '../core/batchOps.js';

// Batch insert for performance
const nodes: Node[] = /* ... */;
const edges: Edge[] = /* ... */;

const transaction = db.transaction(() => {
  batchInsertNodes(db, nodes);
  batchInsertEdges(db, edges);
});

transaction();
```

## Commit Message Format

Follow conventional commits:

```
<type>: <description>

[optional body]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Test additions or fixes
- `perf`: Performance improvements

Examples:
```
feat: add support for Ruby language indexing
fix: prevent database connection leaks in chat participant
docs: update API documentation for graph queries
```

## Pull Request Process

1. **Branch naming**: `feature/<description>` or `fix/<description>`
2. **Ensure all tests pass**: `pnpm run test`
3. **Run linter**: `pnpm run lint`
4. **Update CHANGELOG.md** with your changes
5. **Create PR** with clear description of changes
6. **Address review feedback** promptly

## Important Constraints

### Never Commit

- `.nanodex/graph.sqlite` (generated database)
- `.nanodex/issues/` (generated issue files)
- `node_modules/`
- `dist/` (build output)

### Instruction Files

- Keep `AGENTS.md` concise (merged directly into prompts)
- Use `*.instructions.md` for language/module-specific guidance
- Delete stale instruction files when modules are removed

### Security

- Prefer local models when possible
- Document provider choices in PRs when using remote models
- Never commit API keys or credentials
- Validate all user input and external data

## Questions?

If you have questions or need help:

1. Check existing documentation in `/docs`
2. Search existing issues on GitHub
3. Open a new issue with the `question` label

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.
