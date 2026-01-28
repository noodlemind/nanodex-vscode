/**
 * Query cache for subgraph results
 *
 * Provides LRU caching for repeated subgraph queries within a session.
 * Cache is invalidated when the database is modified.
 */

import { SubgraphResult } from './types.js';

interface CacheEntry {
  result: SubgraphResult;
  timestamp: number;
}

/**
 * LRU cache for subgraph query results
 */
class SubgraphCache {
  private static instance: SubgraphCache;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  private constructor(maxSize = 100, ttlMs = 60000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  static getInstance(): SubgraphCache {
    if (!SubgraphCache.instance) {
      SubgraphCache.instance = new SubgraphCache();
    }
    return SubgraphCache.instance;
  }

  /**
   * Generate cache key from query parameters
   */
  private makeKey(dbPath: string, rootId: string, maxDepth: number): string {
    return `${dbPath}:${rootId}:${maxDepth}`;
  }

  /**
   * Get cached result if available and not expired
   */
  get(dbPath: string, rootId: string, maxDepth: number): SubgraphResult | undefined {
    const key = this.makeKey(dbPath, rootId, maxDepth);
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.result;
  }

  /**
   * Store result in cache
   */
  set(dbPath: string, rootId: string, maxDepth: number, result: SubgraphResult): void {
    const key = this.makeKey(dbPath, rootId, maxDepth);

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  /**
   * Invalidate all entries for a database
   */
  invalidate(dbPath: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(dbPath + ':')) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; ttlMs: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs
    };
  }
}

// Export singleton getter
export function getSubgraphCache(): SubgraphCache {
  return SubgraphCache.getInstance();
}

// Export for testing
export { SubgraphCache };
