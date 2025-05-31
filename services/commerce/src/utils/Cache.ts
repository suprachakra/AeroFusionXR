import Redis from 'ioredis';
import { Logger } from './Logger';
import { metrics } from './metrics';

export class Cache {
  private redis: Redis;
  private logger: Logger;

  // Metrics
  private readonly cacheHitCounter = metrics.createCounter({
    name: 'cache_hits_total',
    help: 'Total number of cache hits'
  });

  private readonly cacheMissCounter = metrics.createCounter({
    name: 'cache_misses_total',
    help: 'Total number of cache misses'
  });

  private readonly cacheErrorCounter = metrics.createCounter({
    name: 'cache_errors_total',
    help: 'Total number of cache errors',
    labelNames: ['operation']
  });

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
    this.logger = new Logger();

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
      this.cacheErrorCounter.inc({ operation: 'connection' });
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (value) {
        this.cacheHitCounter.inc();
        return JSON.parse(value);
      }
      this.cacheMissCounter.inc();
      return null;
    } catch (error) {
      this.logger.error('Cache get error:', error);
      this.cacheErrorCounter.inc({ operation: 'get' });
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      this.logger.error('Cache set error:', error);
      this.cacheErrorCounter.inc({ operation: 'set' });
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      this.logger.error('Cache delete error:', error);
      this.cacheErrorCounter.inc({ operation: 'delete' });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error('Cache exists error:', error);
      this.cacheErrorCounter.inc({ operation: 'exists' });
      return false;
    }
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.redis.incrby(key, amount);
    } catch (error) {
      this.logger.error('Cache increment error:', error);
      this.cacheErrorCounter.inc({ operation: 'increment' });
      return 0;
    }
  }

  async decrement(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.redis.decrby(key, amount);
    } catch (error) {
      this.logger.error('Cache decrement error:', error);
      this.cacheErrorCounter.inc({ operation: 'decrement' });
      return 0;
    }
  }

  async setHash(key: string, field: string, value: any): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.hset(key, field, serialized);
      return true;
    } catch (error) {
      this.logger.error('Cache setHash error:', error);
      this.cacheErrorCounter.inc({ operation: 'setHash' });
      return false;
    }
  }

  async getHash<T>(key: string, field: string): Promise<T | null> {
    try {
      const value = await this.redis.hget(key, field);
      if (value) {
        this.cacheHitCounter.inc();
        return JSON.parse(value);
      }
      this.cacheMissCounter.inc();
      return null;
    } catch (error) {
      this.logger.error('Cache getHash error:', error);
      this.cacheErrorCounter.inc({ operation: 'getHash' });
      return null;
    }
  }

  async deleteHash(key: string, field: string): Promise<boolean> {
    try {
      const result = await this.redis.hdel(key, field);
      return result > 0;
    } catch (error) {
      this.logger.error('Cache deleteHash error:', error);
      this.cacheErrorCounter.inc({ operation: 'deleteHash' });
      return false;
    }
  }

  async clear(pattern: string): Promise<boolean> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return true;
    } catch (error) {
      this.logger.error('Cache clear error:', error);
      this.cacheErrorCounter.inc({ operation: 'clear' });
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (error) {
      this.logger.error('Cache disconnect error:', error);
      this.cacheErrorCounter.inc({ operation: 'disconnect' });
    }
  }
} 