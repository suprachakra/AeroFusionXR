/**
 * FeatureFlags.ts
 * Feature flag system with canary rollout support
 */

import { Redis } from 'ioredis';
import { MetricsClient } from '../monitoring/MetricsClient';
import { TracingClient } from '../monitoring/TracingClient';
import { createLogger } from '@aerofusionxr/shared';
import { Cache } from '../utils/Cache';

interface FeatureConfig {
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  userGroups?: string[];
  startDate?: string;
  endDate?: string;
  metadata?: Record<string, any>;
}

interface RolloutConfig {
  redis: {
    url: string;
    keyPrefix: string;
  };
  cache: {
    maxSize: number;
    ttl: number;
  };
  defaultTTL: number;
}

export class FeatureFlags {
  private redis: Redis;
  private cache: Cache<string, FeatureConfig>;
  private metrics: MetricsClient;
  private tracer: TracingClient;
  private logger: Logger;
  private config: RolloutConfig;

  constructor(
    config: RolloutConfig,
    metrics: MetricsClient,
    tracer: TracingClient,
    logger: Logger
  ) {
    this.config = config;
    this.redis = new Redis(config.redis.url, {
      keyPrefix: config.redis.keyPrefix
    });
    this.cache = new Cache(config.cache);
    this.metrics = metrics;
    this.tracer = tracer;
    this.logger = logger;

    this.setupMetrics();
  }

  /**
   * Check if a feature is enabled for a user
   */
  public async isEnabled(
    featureName: string,
    userId: string,
    userGroups: string[] = []
  ): Promise<boolean> {
    const span = this.tracer.startSpan('FeatureFlags.isEnabled');

    try {
      const feature = await this.getFeature(featureName);
      if (!feature) return false;

      // Check if feature is globally enabled/disabled
      if (!feature.enabled) return false;

      // Check date restrictions
      if (!this.isWithinDateRange(feature)) return false;

      // Check user groups
      if (feature.userGroups && feature.userGroups.length > 0) {
        if (!userGroups.some(group => feature.userGroups?.includes(group))) {
          return false;
        }
      }

      // Check rollout percentage
      const isInRollout = this.isUserInRollout(userId, feature.rolloutPercentage);
      
      // Record metrics
      this.recordFeatureMetrics(featureName, isInRollout);

      return isInRollout;

    } catch (error) {
      this.logger.error('Error checking feature flag', error);
      this.metrics.increment('feature_flags.errors');
      return false;

    } finally {
      span.end();
    }
  }

  /**
   * Set feature configuration
   */
  public async setFeature(feature: FeatureConfig): Promise<void> {
    const span = this.tracer.startSpan('FeatureFlags.setFeature');

    try {
      // Validate feature config
      this.validateFeatureConfig(feature);

      // Store in Redis
      await this.redis.set(
        feature.name,
        JSON.stringify(feature),
        'EX',
        this.config.defaultTTL
      );

      // Update cache
      this.cache.set(feature.name, feature);

      // Record metrics
      this.metrics.increment('feature_flags.updates');
      this.metrics.gauge(
        `feature_flags.${feature.name}.rollout_percentage`,
        feature.rolloutPercentage
      );

    } catch (error) {
      this.logger.error('Error setting feature flag', error);
      this.metrics.increment('feature_flags.errors');
      throw error;

    } finally {
      span.end();
    }
  }

  /**
   * Get all feature configurations
   */
  public async getAllFeatures(): Promise<FeatureConfig[]> {
    const span = this.tracer.startSpan('FeatureFlags.getAllFeatures');

    try {
      const keys = await this.redis.keys('*');
      const features: FeatureConfig[] = [];

      for (const key of keys) {
        const feature = await this.getFeature(key);
        if (feature) {
          features.push(feature);
        }
      }

      return features;

    } catch (error) {
      this.logger.error('Error getting all feature flags', error);
      this.metrics.increment('feature_flags.errors');
      throw error;

    } finally {
      span.end();
    }
  }

  /**
   * Delete a feature configuration
   */
  public async deleteFeature(featureName: string): Promise<void> {
    const span = this.tracer.startSpan('FeatureFlags.deleteFeature');

    try {
      await this.redis.del(featureName);
      this.cache.delete(featureName);
      this.metrics.increment('feature_flags.deletions');

    } catch (error) {
      this.logger.error('Error deleting feature flag', error);
      this.metrics.increment('feature_flags.errors');
      throw error;

    } finally {
      span.end();
    }
  }

  private async getFeature(name: string): Promise<FeatureConfig | null> {
    // Check cache first
    const cached = this.cache.get(name);
    if (cached) {
      this.metrics.increment('feature_flags.cache_hits');
      return cached;
    }

    // Get from Redis
    const data = await this.redis.get(name);
    if (!data) return null;

    const feature = JSON.parse(data);
    this.cache.set(name, feature);
    
    return feature;
  }

  private isUserInRollout(userId: string, percentage: number): boolean {
    // Use consistent hashing to ensure same users get same result
    const hash = this.hashString(userId);
    const normalized = hash % 100;
    return normalized < percentage;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private isWithinDateRange(feature: FeatureConfig): boolean {
    const now = new Date();
    
    if (feature.startDate && new Date(feature.startDate) > now) {
      return false;
    }
    
    if (feature.endDate && new Date(feature.endDate) < now) {
      return false;
    }
    
    return true;
  }

  private validateFeatureConfig(feature: FeatureConfig): void {
    if (!feature.name) {
      throw new Error('Feature name is required');
    }
    
    if (feature.rolloutPercentage < 0 || feature.rolloutPercentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }
    
    if (feature.startDate && isNaN(Date.parse(feature.startDate))) {
      throw new Error('Invalid start date format');
    }
    
    if (feature.endDate && isNaN(Date.parse(feature.endDate))) {
      throw new Error('Invalid end date format');
    }
  }

  private setupMetrics(): void {
    this.metrics.defineCounter('feature_flags.cache_hits', 'Feature flag cache hit count');
    this.metrics.defineCounter('feature_flags.updates', 'Feature flag update count');
    this.metrics.defineCounter('feature_flags.deletions', 'Feature flag deletion count');
    this.metrics.defineCounter('feature_flags.errors', 'Feature flag operation error count');
    this.metrics.defineGauge('feature_flags.total', 'Total number of feature flags');
  }

  private recordFeatureMetrics(featureName: string, isEnabled: boolean): void {
    this.metrics.increment(`feature_flags.${featureName}.evaluations`);
    if (isEnabled) {
      this.metrics.increment(`feature_flags.${featureName}.enabled`);
    }
  }
} 
