/**
 * Caching system for performance optimization
 *
 * This module provides LRU (Least Recently Used) and TTL (Time-To-Live) cache
 * implementations for optimizing frequently accessed data.
 *
 * @module cache
 *
 * @example
 * ```typescript
 * // Create cache instances as needed
 * const fileCache = new LRUCache<string, FileData>(500);
 * const apiCache = new TTLCache<string, Response>(300000); // 5 minutes
 * ```
 */

/**
 * LRU (Least Recently Used) Cache implementation.
 *
 * Maintains a fixed-size cache that evicts the least recently used items
 * when capacity is reached. Uses Map insertion order for efficient LRU tracking.
 *
 * @template K - The type of cache keys
 * @template V - The type of cached values
 *
 * @example
 * ```typescript
 * const cache = new LRUCache<string, ParseResult>(200);
 *
 * cache.set('file1.ts', result1);
 * cache.set('file2.ts', result2);
 *
 * const result = cache.get('file1.ts'); // Updates recency
 * ```
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  /**
   * Create a new LRU cache.
   *
   * @param maxSize - Maximum number of items to store (default: 1000)
   */
  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Get value from cache and mark as recently used.
   *
   * If the key exists, it's moved to the end of the cache (most recently used position).
   *
   * @param key - Cache key to retrieve
   * @returns Cached value or undefined if not found
   */
  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * Set value in cache with automatic LRU eviction.
   *
   * If the cache is at capacity, the least recently used item is evicted first.
   * If the key already exists, it's updated and moved to most recently used position.
   *
   * @param key - Cache key
   * @param value - Value to cache
   */
  set(key: K, value: V): void {
    // Remove if exists to re-add at end
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, value);
  }

  /**
   * Check if key exists in cache.
   *
   * @param key - Cache key to check
   * @returns True if key exists
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete key from cache.
   *
   * @param key - Cache key to delete
   * @returns True if key was deleted, false if not found
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current number of items in cache.
   *
   * @returns Number of cached items
   */
  get size(): number {
    return this.cache.size;
  }
}

/**
 * TTL (Time-To-Live) Cache implementation.
 *
 * Stores values with automatic expiration based on time-to-live.
 * Expired entries are removed on access or via clearExpired().
 *
 * @template K - The type of cache keys
 * @template V - The type of cached values
 *
 * @example
 * ```typescript
 * const cache = new TTLCache<string, ApiResponse>(60000); // 1 minute TTL
 *
 * cache.set('api-key', response);
 * cache.set('short-lived', data, 5000); // Custom 5s TTL
 *
 * // Automatically returns undefined after TTL expires
 * const result = cache.get('api-key');
 * ```
 */
export class TTLCache<K, V> {
  private cache = new Map<K, { value: V; expiresAt: number }>();
  private ttl: number;

  /**
   * Create a new TTL cache.
   *
   * @param ttlMs - Default time-to-live in milliseconds (default: 60000 = 1 minute)
   */
  constructor(ttlMs: number = 60000) {
    this.ttl = ttlMs;
  }

  /**
   * Get value from cache if not expired.
   *
   * Expired entries are automatically removed on access.
   *
   * @param key - Cache key to retrieve
   * @returns Cached value or undefined if not found or expired
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set value in cache with TTL.
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param customTTL - Optional custom TTL in milliseconds (overrides default)
   */
  set(key: K, value: V, customTTL?: number): void {
    const ttl = customTTL ?? this.ttl;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl
    });
  }

  /**
   * Check if key exists and is not expired.
   *
   * Expired entries are automatically removed during check.
   *
   * @param key - Cache key to check
   * @returns True if key exists and is not expired
   */
  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete key from cache.
   *
   * @param key - Cache key to delete
   * @returns True if key was deleted, false if not found
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Manually clear all expired entries.
   *
   * @returns Number of entries that were cleared
   */
  clearExpired(): number {
    const now = Date.now();
    let cleared = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Clear all entries from cache, including non-expired ones.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current number of items in cache (including expired items not yet cleared).
   *
   * @returns Number of cached items
   */
  get size(): number {
    return this.cache.size;
  }
}

/**
 * Note: Cache instances should be created per-module as needed.
 * Example usage:
 *
 * const fileContentCache = new LRUCache<string, string>(500);
 * const parseResultCache = new LRUCache<string, ParseResult>(200);
 * const contextCache = new TTLCache<string, string>(300000);
 */
