/**
 * Database connection pooling for reduced connection overhead
 *
 * Problem: Each tool opens/closes a fresh connection. With 5-10 tool calls
 * per AI interaction, this adds 50-150ms overhead.
 *
 * Solution: Connection pool with lazy initialization and 30-second idle timeout.
 * Expected impact: 70-80% reduction in repeated query latency.
 */

import Database from 'better-sqlite3';

/**
 * Database connection pool with lazy initialization
 */
class DatabasePool {
  private static instances: Map<string, DatabasePool> = new Map();

  private connection: Database.Database | null = null;
  private refCount = 0;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly dbPath: string;
  private readonly readonly: boolean;

  /** Idle timeout before closing connection (30 seconds) */
  private static readonly IDLE_TIMEOUT_MS = 30000;

  private constructor(dbPath: string, readonly: boolean) {
    this.dbPath = dbPath;
    this.readonly = readonly;
  }

  /**
   * Get or create a pool for the given database path
   */
  static getPool(dbPath: string, readonly = true): DatabasePool {
    const key = `${dbPath}:${readonly}`;
    let pool = this.instances.get(key);

    if (!pool) {
      pool = new DatabasePool(dbPath, readonly);
      this.instances.set(key, pool);
    }

    return pool;
  }

  /**
   * Acquire a database connection from the pool
   */
  acquire(): Database.Database {
    // Cancel any pending close
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }

    // Create connection if needed
    if (!this.connection) {
      this.connection = new Database(this.dbPath, { readonly: this.readonly });
    }

    this.refCount++;
    return this.connection;
  }

  /**
   * Release a connection back to the pool
   */
  release(): void {
    this.refCount--;

    if (this.refCount <= 0) {
      this.refCount = 0;

      // Schedule close after idle timeout
      this.closeTimer = setTimeout(() => {
        this.closeConnection();
      }, DatabasePool.IDLE_TIMEOUT_MS);
    }
  }

  /**
   * Close the connection immediately
   */
  private closeConnection(): void {
    if (this.connection) {
      try {
        this.connection.close();
      } catch (error) {
        console.warn('Error closing database connection:', error);
      }
      this.connection = null;
    }
    this.closeTimer = null;
  }

  /**
   * Force close all pools (for extension deactivation)
   */
  static closeAll(): void {
    for (const pool of this.instances.values()) {
      if (pool.closeTimer) {
        clearTimeout(pool.closeTimer);
      }
      pool.closeConnection();
    }
    this.instances.clear();
  }

  /**
   * Get connection status for debugging
   */
  getStatus(): { isConnected: boolean; refCount: number; hasPendingClose: boolean } {
    return {
      isConnected: this.connection !== null,
      refCount: this.refCount,
      hasPendingClose: this.closeTimer !== null
    };
  }
}

/**
 * Execute a database operation with pooled connection
 * Supports both sync and async operations
 */
export async function withPooledDatabase<T>(
  dbPath: string,
  operation: (db: Database.Database) => T | Promise<T>,
  readonly = true
): Promise<T> {
  const pool = DatabasePool.getPool(dbPath, readonly);
  const db = pool.acquire();

  try {
    return await operation(db);
  } finally {
    pool.release();
  }
}

/**
 * Close all database connections (call on extension deactivation)
 */
export function closeAllDatabaseConnections(): void {
  DatabasePool.closeAll();
}

// Export for testing
export { DatabasePool };
