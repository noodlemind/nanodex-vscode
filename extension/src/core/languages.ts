/**
 * Language detection and file type registry
 *
 * This module provides language detection, metadata management, and file watching
 * utilities for multi-language workspace indexing support.
 *
 * Supported languages: TypeScript, JavaScript, Python, Go, Rust, Java, C#, Ruby, PHP
 *
 * @module languages
 */

import * as path from 'path';

/**
 * Supported programming languages for code indexing.
 *
 * @enum {string}
 */
export enum Language {
  TypeScript = 'typescript',
  JavaScript = 'javascript',
  Python = 'python',
  Go = 'go',
  Rust = 'rust',
  Java = 'java',
  CSharp = 'csharp',
  Ruby = 'ruby',
  PHP = 'php',
  Unknown = 'unknown'
}

/**
 * Metadata describing a programming language's characteristics.
 *
 * @interface LanguageMetadata
 */
interface LanguageMetadata {
  name: string;
  extensions: string[];
  commentStyle: {
    line?: string;
    block?: { start: string; end: string };
  };
  supportsIndexing: boolean;
}

/**
 * Centralized registry mapping languages to their metadata.
 *
 * Contains configuration for file extensions, comment styles, and indexing support
 * for each supported language.
 *
 * @constant
 */
const LANGUAGE_REGISTRY: Record<Language, LanguageMetadata> = {
  [Language.TypeScript]: {
    name: 'TypeScript',
    extensions: ['.ts', '.tsx'],
    commentStyle: {
      line: '//',
      block: { start: '/*', end: '*/' }
    },
    supportsIndexing: true
  },
  [Language.JavaScript]: {
    name: 'JavaScript',
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    commentStyle: {
      line: '//',
      block: { start: '/*', end: '*/' }
    },
    supportsIndexing: true
  },
  [Language.Python]: {
    name: 'Python',
    extensions: ['.py', '.pyi'],
    commentStyle: {
      line: '#',
      block: { start: '"""', end: '"""' }
    },
    supportsIndexing: true
  },
  [Language.Go]: {
    name: 'Go',
    extensions: ['.go'],
    commentStyle: {
      line: '//',
      block: { start: '/*', end: '*/' }
    },
    supportsIndexing: true
  },
  [Language.Rust]: {
    name: 'Rust',
    extensions: ['.rs'],
    commentStyle: {
      line: '//',
      block: { start: '/*', end: '*/' }
    },
    supportsIndexing: true
  },
  [Language.Java]: {
    name: 'Java',
    extensions: ['.java'],
    commentStyle: {
      line: '//',
      block: { start: '/*', end: '*/' }
    },
    supportsIndexing: true
  },
  [Language.CSharp]: {
    name: 'C#',
    extensions: ['.cs'],
    commentStyle: {
      line: '//',
      block: { start: '/*', end: '*/' }
    },
    supportsIndexing: true
  },
  [Language.Ruby]: {
    name: 'Ruby',
    extensions: ['.rb'],
    commentStyle: {
      line: '#',
      block: { start: '=begin', end: '=end' }
    },
    supportsIndexing: true
  },
  [Language.PHP]: {
    name: 'PHP',
    extensions: ['.php'],
    commentStyle: {
      line: '//',
      block: { start: '/*', end: '*/' }
    },
    supportsIndexing: true
  },
  [Language.Unknown]: {
    name: 'Unknown',
    extensions: [],
    commentStyle: {},
    supportsIndexing: false
  }
};

/**
 * Cache mapping file extensions to detected languages for performance.
 * @internal
 */
const extensionCache = new Map<string, Language>();

/**
 * Detect programming language from file path.
 *
 * Uses file extension to determine language. Results are cached for performance.
 * Handles edge cases like dotfiles and files without extensions correctly.
 *
 * @param filePath - Full path to the file
 * @returns Detected language or Language.Unknown if not supported
 *
 * @example
 * ```typescript
 * detectLanguage('/path/to/file.ts'); // Language.TypeScript
 * detectLanguage('/path/to/file.py'); // Language.Python
 * detectLanguage('/path/to/.gitignore'); // Language.Unknown
 * detectLanguage('/path/to/Makefile'); // Language.Unknown
 * ```
 */
export function detectLanguage(filePath: string): Language {
  // Use path.extname() which handles edge cases correctly
  const ext = path.extname(filePath).toLowerCase();

  // No extension or empty extension
  if (!ext) {
    return Language.Unknown;
  }

  // Check cache first
  const cached = extensionCache.get(ext);
  if (cached !== undefined) {
    return cached;
  }

  // Find matching language
  for (const [lang, metadata] of Object.entries(LANGUAGE_REGISTRY)) {
    if (metadata.extensions.includes(ext)) {
      const language = lang as Language;
      extensionCache.set(ext, language);
      return language;
    }
  }

  // Cache unknown extensions to avoid repeated lookups
  extensionCache.set(ext, Language.Unknown);
  return Language.Unknown;
}

/**
 * Get metadata for a specific language.
 *
 * @param language - The language to get metadata for
 * @returns Language metadata including extensions, comment styles, and indexing support
 *
 * @example
 * ```typescript
 * const metadata = getLanguageMetadata(Language.TypeScript);
 * console.log(metadata.extensions); // ['.ts', '.tsx']
 * console.log(metadata.commentStyle.line); // '//'
 * ```
 */
export function getLanguageMetadata(language: Language): LanguageMetadata {
  return LANGUAGE_REGISTRY[language];
}

/**
 * Check if a file supports code indexing based on its language.
 *
 * @param filePath - Full path to the file
 * @returns True if the file's language supports indexing
 *
 * @example
 * ```typescript
 * supportsIndexing('/path/to/app.ts'); // true
 * supportsIndexing('/path/to/README.md'); // false
 * ```
 */
export function supportsIndexing(filePath: string): boolean {
  const language = detectLanguage(filePath);
  return LANGUAGE_REGISTRY[language].supportsIndexing;
}

/**
 * Get all supported file extensions across all languages.
 *
 * @returns Array of file extensions including the leading dot (e.g., ['.ts', '.js', '.py'])
 *
 * @example
 * ```typescript
 * const extensions = getSupportedExtensions();
 * // ['.ts', '.tsx', '.js', '.jsx', '.py', ...]
 * ```
 */
export function getSupportedExtensions(): string[] {
  const extensions: string[] = [];
  for (const metadata of Object.values(LANGUAGE_REGISTRY)) {
    extensions.push(...metadata.extensions);
  }
  return extensions.filter(ext => ext.length > 0);
}

/**
 * Cached file watcher pattern to avoid recomputation.
 * @internal
 */
let cachedWatcherPattern: string | undefined;

/**
 * Create file watcher glob pattern for all supported languages.
 *
 * Returns a glob pattern like `**\/*.{ts,tsx,js,jsx,py,...}` that matches
 * all files with supported extensions. Result is cached for performance.
 *
 * @returns Glob pattern string for VS Code file watcher
 * @throws {Error} If no supported language extensions are registered
 *
 * @example
 * ```typescript
 * const pattern = getFileWatcherPattern();
 * // '**\/*.{ts,tsx,js,jsx,mjs,cjs,py,pyi,go,rs,java,cs,rb,php}'
 *
 * const watcher = vscode.workspace.createFileSystemWatcher(pattern);
 * ```
 */
export function getFileWatcherPattern(): string {
  // Return cached pattern if available
  if (cachedWatcherPattern !== undefined) {
    return cachedWatcherPattern;
  }

  const extensions = getSupportedExtensions();

  if (extensions.length === 0) {
    throw new Error('No supported language extensions registered');
  }

  // Convert ['.ts', '.js'] to '**/*.{ts,js}'
  const extList = extensions.map(ext => ext.substring(1)).join(',');
  cachedWatcherPattern = `**/*.{${extList}}`;
  return cachedWatcherPattern;
}
