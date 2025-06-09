/**
 * @fileoverview AI Concierge Service - Cache Manager
 * @version 1.0.0
 * @author AeroFusionXR AI Engineering Team
 * @created 2024-01-15
 * @updated 2024-01-15
 * 
 * Enterprise-grade Redis cache management for all AI Concierge features.
 * Handles caching, session management, and performance optimization.
 * 
 * Features:
 * - Redis connection management
 * - Automatic failover and reconnection
 * - Performance monitoring
 * - TTL management
 * - Serialization/deserialization
 * - Cache invalidation strategies
 */

import Redis from 'ioredis';
import winston from 'winston';
import { ConfigurationManager } from './ConfigurationManager';

/**
 * Cache health status interface
 */
interface CacheHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connections: {
    active: number;
    total: number;
  };
  memory: {
    used: number;
    peak: number;
    fragmentation: number;
  };
  latency: number;
  lastCheck: string;
  errors?: string[];
}

/**
 * Cache operation metrics interface
 */
interface CacheMetrics {
  operations: {
    gets: number;
    sets: number;
    deletes: number;
    hits: number;
    misses: number;
  };
  performance: {
    averageResponseTime: number;
    slowOperations: number;
    errors: number;
  };
  memory: {
    currentUsage: number;
    peakUsage: number;
    evictions: number;
  };
}

/**
 * Cache configuration interface
 */
interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  ttl: number;
  maxRetries: number;
  retryDelayOnFailover: number;
}

/**
 * Cache Manager Class
 * Provides comprehensive Redis caching operations for all AI Concierge features
 */
export class CacheManager {
  private client: Redis | null = null;
  private config: ConfigurationManager;
  private logger: winston.Logger;
  private isConnected: boolean = false;
  private metrics: CacheMetrics;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(config: ConfigurationManager, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;
    this.metrics = this.initializeMetrics();
  }

  /**
   * Initialize cache metrics tracking
   */
  private initializeMetrics(): CacheMetrics {
    return {
      operations: {
        gets: 0,
        sets: 0,
        deletes: 0,
        hits: 0,
        misses: 0
      },
      performance: {
        averageResponseTime: 0,
        slowOperations: 0,
        errors: 0
      },
      memory: {
        currentUsage: 0,
        peakUsage: 0,
        evictions: 0
      }
    };
  }

  /**
   * Initialize Redis connection
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Redis cache connection...');

      const cacheConfig = this.config.getCacheConfig();
      
      // Create Redis client with configuration
      this.client = new Redis({
        host: cacheConfig.host,
        port: cacheConfig.port,
        password: cacheConfig.password,
        db: cacheConfig.db,
        keyPrefix: cacheConfig.keyPrefix,
        maxRetriesPerRequest: cacheConfig.maxRetries,
        retryDelayOnFailover: cacheConfig.retryDelayOnFailover,
        enableReadyCheck: true,
        maxLoadingTimeout: 5000,
        lazyConnect: true
      });

      // Add event handlers
      this.setupEventHandlers();

      // Connect to Redis
      await this.client.connect();
      
      // Setup health monitoring
      this.setupHealthMonitoring();
      
      this.isConnected = true;
      this.logger.info('Redis cache connection established successfully');

    } catch (error) {
      this.logger.error('Failed to initialize Redis cache', { error: error.message });
      throw new Error(`Cache initialization failed: ${error.message}`);
    }
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      this.logger.info('Redis connected');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      this.logger.info('Redis ready for operations');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis connection error', { error: error.message });
      this.metrics.performance.errors++;
      this.isConnected = false;
    });

    this.client.on('close', () => {
      this.logger.warn('Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      this.logger.info('Redis reconnecting...');
    });

    this.client.on('end', () => {
      this.logger.warn('Redis connection ended');
      this.isConnected = false;
    });
  }

  /**
   * Setup periodic health monitoring
   */
  private setupHealthMonitoring(): void {
    const interval = 30000; // 30 seconds
    
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck().catch((error) => {
        this.logger.error('Cache health check failed', { error: error.message });
      });
    }, interval);

    this.logger.info('Cache health monitoring started', { interval });
  }

  /**
   * Perform comprehensive cache health check
   */
  public async performHealthCheck(): Promise<CacheHealth> {
    const startTime = Date.now();
    
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      // Test connectivity with ping
      await this.client.ping();
      
      // Get Redis info
      const info = await this.client.info('memory');
      const memoryInfo = this.parseRedisInfo(info);
      
      const latency = Date.now() - startTime;
      
      // Update metrics
      if (latency > 100) {
        this.metrics.performance.slowOperations++;
      }

      const health: CacheHealth = {
        status: latency > 1000 ? 'degraded' : 'healthy',
        connections: {
          active: 1,
          total: 1
        },
        memory: {
          used: memoryInfo.used_memory || 0,
          peak: memoryInfo.used_memory_peak || 0,
          fragmentation: memoryInfo.mem_fragmentation_ratio || 1
        },
        latency,
        lastCheck: new Date().toISOString()
      };

      return health;
      
    } catch (error) {
      this.metrics.performance.errors++;
      this.logger.error('Cache health check failed', { error: error.message });
      
      return {
        status: 'unhealthy',
        connections: {
          active: 0,
          total: 0
        },
        memory: {
          used: 0,
          peak: 0,
          fragmentation: 0
        },
        latency: -1,
        lastCheck: new Date().toISOString(),
        errors: [error.message]
      };
    }
  }

  /**
   * Parse Redis INFO command output
   */
  private parseRedisInfo(info: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = info.split('\r\n');
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = isNaN(Number(value)) ? value : Number(value);
      }
    }
    
    return result;
  }

  /**
   * Get value from cache
   */
  public async get<T = any>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const value = await this.client.get(key);
      
      // Update metrics
      this.metrics.operations.gets++;
      if (value !== null) {
        this.metrics.operations.hits++;
      } else {
        this.metrics.operations.misses++;
      }
      
      this.updatePerformanceMetrics(Date.now() - startTime);
      
      return value ? JSON.parse(value) : null;
      
    } catch (error) {
      this.metrics.performance.errors++;
      this.logger.error('Cache get operation failed', { 
        key, 
        error: error.message,
        duration: Date.now() - startTime
      });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  public async set(key: string, value: any, ttl?: number): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const serializedValue = JSON.stringify(value);
      const cacheTtl = ttl || this.config.getCacheConfig().ttl;
      
      await this.client.setex(key, cacheTtl, serializedValue);
      
      // Update metrics
      this.metrics.operations.sets++;
      this.updatePerformanceMetrics(Date.now() - startTime);
      
      return true;
      
    } catch (error) {
      this.metrics.performance.errors++;
      this.logger.error('Cache set operation failed', { 
        key, 
        error: error.message,
        duration: Date.now() - startTime
      });
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  public async delete(key: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const result = await this.client.del(key);
      
      // Update metrics
      this.metrics.operations.deletes++;
      this.updatePerformanceMetrics(Date.now() - startTime);
      
      return result > 0;
      
    } catch (error) {
      this.metrics.performance.errors++;
      this.logger.error('Cache delete operation failed', { 
        key, 
        error: error.message,
        duration: Date.now() - startTime
      });
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  public async exists(key: string): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const result = await this.client.exists(key);
      return result === 1;
      
    } catch (error) {
      this.logger.error('Cache exists operation failed', { key, error: error.message });
      return false;
    }
  }

  /**
   * Set expiration time for a key
   */
  public async expire(key: string, ttl: number): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const result = await this.client.expire(key, ttl);
      return result === 1;
      
    } catch (error) {
      this.logger.error('Cache expire operation failed', { key, ttl, error: error.message });
      return false;
    }
  }

  /**
   * Get multiple values from cache
   */
  public async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const values = await this.client.mget(...keys);
      
      // Update metrics
      this.metrics.operations.gets += keys.length;
      
      return values.map(value => {
        if (value !== null) {
          this.metrics.operations.hits++;
          return JSON.parse(value);
        } else {
          this.metrics.operations.misses++;
          return null;
        }
      });
      
    } catch (error) {
      this.metrics.performance.errors++;
      this.logger.error('Cache mget operation failed', { keys, error: error.message });
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple values in cache
   */
  public async mset(keyValuePairs: Record<string, any>, ttl?: number): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const pipeline = this.client.pipeline();
      const cacheTtl = ttl || this.config.getCacheConfig().ttl;
      
      for (const [key, value] of Object.entries(keyValuePairs)) {
        const serializedValue = JSON.stringify(value);
        pipeline.setex(key, cacheTtl, serializedValue);
      }
      
      await pipeline.exec();
      
      // Update metrics
      this.metrics.operations.sets += Object.keys(keyValuePairs).length;
      
      return true;
      
    } catch (error) {
      this.metrics.performance.errors++;
      this.logger.error('Cache mset operation failed', { error: error.message });
      return false;
    }
  }

  /**
   * Delete multiple keys from cache
   */
  public async mdel(keys: string[]): Promise<number> {
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const result = await this.client.del(...keys);
      
      // Update metrics
      this.metrics.operations.deletes += keys.length;
      
      return result;
      
    } catch (error) {
      this.metrics.performance.errors++;
      this.logger.error('Cache mdel operation failed', { keys, error: error.message });
      return 0;
    }
  }

  /**
   * Clear all cache entries with the configured prefix
   */
  public async clear(): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error('Cache client not initialized');
      }

      const prefix = this.config.getCacheConfig().keyPrefix;
      const keys = await this.client.keys(`${prefix}*`);
      
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      
      this.logger.info('Cache cleared', { keysDeleted: keys.length });
      return true;
      
    } catch (error) {
      this.metrics.performance.errors++;
      this.logger.error('Cache clear operation failed', { error: error.message });
      return false;
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(duration: number): void {
    const currentAvg = this.metrics.performance.averageResponseTime;
    const totalOps = Object.values(this.metrics.operations).reduce((sum, count) => sum + count, 0);
    
    this.metrics.performance.averageResponseTime = 
      (currentAvg * (totalOps - 1) + duration) / totalOps;
    
    if (duration > 100) {
      this.metrics.performance.slowOperations++;
    }
  }

  /**
   * Get current cache metrics
   */
  public getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Check if cache is connected and healthy
   */
  public isHealthy(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Get cache health status
   */
  public async healthCheck(): Promise<CacheHealth> {
    return await this.performHealthCheck();
  }

  /**
   * Gracefully disconnect from cache
   */
  public async disconnect(): Promise<void> {
    try {
      this.logger.info('Disconnecting from Redis cache...');

      // Clear health check timer
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = null;
      }

      // Close Redis connection
      if (this.client) {
        await this.client.quit();
        this.logger.info('Redis cache disconnected');
      }

      this.isConnected = false;
      this.client = null;
      
      this.logger.info('Cache disconnection completed');
      
    } catch (error) {
      this.logger.error('Error during cache disconnection', { error: error.message });
      throw error;
    }
  }
} 