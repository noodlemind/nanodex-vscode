/**
 * Language detection and file type registry
 */

import * as path from 'path';

/**
 * Supported language types
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
 * Language metadata
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
 * Language registry
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
 * Extension to language mapping cache
 */
const extensionCache = new Map<string, Language>();

/**
 * Detect language from file path
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
 * Get language metadata
 */
export function getLanguageMetadata(language: Language): LanguageMetadata {
  return LANGUAGE_REGISTRY[language];
}

/**
 * Check if language supports indexing
 */
export function supportsIndexing(filePath: string): boolean {
  const language = detectLanguage(filePath);
  return LANGUAGE_REGISTRY[language].supportsIndexing;
}

/**
 * Get all supported extensions
 */
export function getSupportedExtensions(): string[] {
  const extensions: string[] = [];
  for (const metadata of Object.values(LANGUAGE_REGISTRY)) {
    extensions.push(...metadata.extensions);
  }
  return extensions.filter(ext => ext.length > 0);
}

/**
 * Cached file watcher pattern
 */
let cachedWatcherPattern: string | undefined;

/**
 * Create file watcher glob pattern for all supported languages
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
