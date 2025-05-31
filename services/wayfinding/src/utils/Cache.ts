/**
 * Cache.ts
 * In-memory cache with TTL support
 */

interface CacheConfig {
  maxSize: number;
  ttl: number;  // Time-to-live in milliseconds
}

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

export class Cache<K, V> {
  private store: Map<K, CacheEntry<V>>;
  private config: CacheConfig;
  private cleanupInterval: NodeJS.Timer;

  constructor(config: CacheConfig) {
    this.store = new Map();
    this.config = config;

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, Math.min(config.ttl / 2, 60000)); // Run cleanup at half TTL or max 1 minute
  }

  /**
   * Sets a value in the cache
   */
  public set(key: K, value: V): void {
    // Enforce size limit
    if (this.store.size >= this.config.maxSize) {
      this.evictOldest();
    }

    this.store.set(key, {
      value,
      expiry: Date.now() + this.config.ttl
    });
  }

  /**
   * Gets a value from the cache
   */
  public get(key: K): V | undefined {
    const entry = this.store.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Checks if a key exists and is not expired
   */
  public has(key: K): boolean {
    const entry = this.store.get(key);
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Deletes a key from the cache
   */
  public delete(key: K): boolean {
    return this.store.delete(key);
  }

  /**
   * Clears all entries from the cache
   */
  public clear(): void {
    this.store.clear();
  }

  /**
   * Gets the current size of the cache
   */
  public size(): number {
    return this.store.size;
  }

  /**
   * Gets all non-expired keys
   */
  public keys(): K[] {
    const now = Date.now();
    return Array.from(this.store.entries())
      .filter(([_, entry]) => entry.expiry > now)
      .map(([key]) => key);
  }

  /**
   * Gets all non-expired values
   */
  public values(): V[] {
    const now = Date.now();
    return Array.from(this.store.values())
      .filter(entry => entry.expiry > now)
      .map(entry => entry.value);
  }

  /**
   * Gets all non-expired entries
   */
  public entries(): [K, V][] {
    const now = Date.now();
    return Array.from(this.store.entries())
      .filter(([_, entry]) => entry.expiry > now)
      .map(([key, entry]) => [key, entry.value]);
  }

  /**
   * Updates the TTL for an existing entry
   */
  public touch(key: K): boolean {
    const entry = this.store.get(key);
    if (!entry) {
      return false;
    }

    entry.expiry = Date.now() + this.config.ttl;
    return true;
  }

  /**
   * Gets cache statistics
   */
  public stats(): {
    size: number;
    maxSize: number;
    ttl: number;
    expired: number;
  } {
    const now = Date.now();
    const expired = Array.from(this.store.values())
      .filter(entry => entry.expiry <= now)
      .length;

    return {
      size: this.store.size,
      maxSize: this.config.maxSize,
      ttl: this.config.ttl,
      expired
    };
  }

  /**
   * Stops the cleanup interval
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiry <= now) {
        this.store.delete(key);
      }
    }
  }

  private evictOldest(): void {
    let oldestKey: K | undefined;
    let oldestExpiry = Infinity;

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiry < oldestExpiry) {
        oldestKey = key;
        oldestExpiry = entry.expiry;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
    }
  }
} 