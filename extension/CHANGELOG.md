# Change Log

All notable changes to the nanodex extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2025-11-19

### Added
- **Custom Flow Runner**: Create and run custom flows from your workspace
  - `Nanodex: Create Custom Flow` command to generate flow templates
  - `Nanodex: Run Custom Flow` command to execute custom flows
  - Automatic discovery of flows in `.nanodex/flows/` and `flows/` directories
  - Dynamic command registration for discovered custom flows
  - Chat integration: run custom flows via `@nanodex /<flow-name>`
  - Flow validation with helpful error messages
  - Configuration option `nanodex.flows.paths` for custom flow locations
- Documentation for custom flows in README

### Changed
- Updated README with Custom Flows section
- Enhanced chat participant to support custom flow slash commands

## [Unreleased]

### Added
- Multi-language support for TypeScript, JavaScript, Python, Go, Rust, Java, C#, Ruby, and PHP
- LRU and TTL cache implementations for performance optimization
- Batch database operations for improved indexing performance
- Database optimization command (VACUUM and ANALYZE)
- Model selection UI with status bar integration
- Chat participant integration (@nanodex)
- Support for slash commands in chat: /plan, /work, /explain, /issues
- Configurable model strategy for chat participant
- Real-time status bar showing current model configuration
- Language detection with extension caching
- Automatic file watching and reindexing
- Workspace edit preview system
- Knowledge graph statistics command
- Custom instruction loading system
- Flow-based agent orchestration (Plan/Work commands)

### Changed
- Improved error handling with context-specific messages
- Enhanced type safety with runtime validation
- Optimized file extension detection using path.extname()
- Centralized model metadata and configuration utilities

### Fixed
- Database connection leaks in chat participant
- Resource leak risks in status bar item
- Language detection edge cases (dotfiles, no extension)
- Type safety violations in batch operations
- Hardcoded model selection ignoring configuration

## [0.1.0] - Initial Development

### Added
- Core knowledge graph implementation with SQLite backend
- Node types: symbol, module, capability, concept, error, recipe
- Edge relations: calls, imports, implements, extends, throws, depends_on
- Graph indexing for workspace analysis
- Context selection and prompt assembly
- Basic command palette integration
