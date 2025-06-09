/**
 * UserPreferencesService.ts
 * Service for managing user preferences with caching and persistence
 */

import { Redis } from 'ioredis';
import { MetricsClient } from '../monitoring/MetricsClient';
import { TracingClient } from '../monitoring/TracingClient';
import { createLogger } from '@aerofusionxr/shared';
import { Cache } from '../utils/Cache';
import { 
  UserPreferences, 
  SavedLocation,
  AccessibilityPreferences,
  NavigationPreferences,
  NotificationPreferences 
} from '../models/UserPreferences';

interface PreferencesConfig {
  redis: {
    url: string;
    keyPrefix: string;
  };
  cache: {
    maxSize: number;
    ttl: number;
  };
}

export class UserPreferencesService {
  private redis: Redis;
  private cache: Cache<string, UserPreferences>;
  private metrics: MetricsClient;
  private tracer: TracingClient;
  private logger: Logger;

  constructor(
    config: PreferencesConfig,
    metrics: MetricsClient,
    tracer: TracingClient,
    logger: Logger
  ) {
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
   * Get user preferences, from cache or persistent storage
   */
  public async getPreferences(userId: string): Promise<UserPreferences> {
    const span = this.tracer.startSpan('UserPreferencesService.getPreferences');

    try {
      // Check cache first
      const cached = this.cache.get(userId);
      if (cached) {
        this.metrics.increment('preferences.cache_hits');
        return cached;
      }

      // Get from Redis
      const data = await this.redis.get(userId);
      if (!data) {
        // Return default preferences if none exist
        return this.createDefaultPreferences(userId);
      }

      const preferences = JSON.parse(data);
      this.cache.set(userId, preferences);
      
      return preferences;

    } catch (error) {
      this.logger.error('Error getting user preferences', error);
      this.metrics.increment('preferences.errors');
      throw error;

    } finally {
      span.end();
    }
  }

  /**
   * Update user preferences
   */
  public async updatePreferences(
    userId: string, 
    preferences: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    const span = this.tracer.startSpan('UserPreferencesService.updatePreferences');

    try {
      const current = await this.getPreferences(userId);
      const updated = {
        ...current,
        ...preferences,
        lastSync: new Date().toISOString(),
        version: current.version + 1
      };

      // Save to Redis
      await this.redis.set(userId, JSON.stringify(updated));
      
      // Update cache
      this.cache.set(userId, updated);

      this.metrics.increment('preferences.updates');
      return updated;

    } catch (error) {
      this.logger.error('Error updating user preferences', error);
      this.metrics.increment('preferences.errors');
      throw error;

    } finally {
      span.end();
    }
  }

  /**
   * Add a saved location
   */
  public async addSavedLocation(
    userId: string,
    location: SavedLocation
  ): Promise<UserPreferences> {
    const span = this.tracer.startSpan('UserPreferencesService.addSavedLocation');

    try {
      const preferences = await this.getPreferences(userId);
      
      preferences.savedLocations.push({
        ...location,
        lastVisited: new Date().toISOString()
      });

      // Maintain limit of saved locations
      if (preferences.savedLocations.length > 100) {
        preferences.savedLocations = preferences.savedLocations
          .sort((a, b) => (b.lastVisited || '').localeCompare(a.lastVisited || ''))
          .slice(0, 100);
      }

      return this.updatePreferences(userId, preferences);

    } catch (error) {
      this.logger.error('Error adding saved location', error);
      this.metrics.increment('preferences.errors');
      throw error;

    } finally {
      span.end();
    }
  }

  /**
   * Remove a saved location
   */
  public async removeSavedLocation(
    userId: string,
    locationId: string
  ): Promise<UserPreferences> {
    const span = this.tracer.startSpan('UserPreferencesService.removeSavedLocation');

    try {
      const preferences = await this.getPreferences(userId);
      
      preferences.savedLocations = preferences.savedLocations
        .filter(loc => loc.id !== locationId);

      return this.updatePreferences(userId, preferences);

    } catch (error) {
      this.logger.error('Error removing saved location', error);
      this.metrics.increment('preferences.errors');
      throw error;

    } finally {
      span.end();
    }
  }

  private setupMetrics(): void {
    this.metrics.defineCounter('preferences.cache_hits', 'Cache hit count for preferences');
    this.metrics.defineCounter('preferences.updates', 'Number of preference updates');
    this.metrics.defineCounter('preferences.errors', 'Number of preference operation errors');
    this.metrics.defineGauge('preferences.saved_locations', 'Number of saved locations per user');
  }

  private createDefaultPreferences(userId: string): UserPreferences {
    return {
      id: `pref_${Date.now()}`,
      userId,
      savedLocations: [],
      accessibility: {
        fontSize: 'normal',
        highContrast: false,
        audioOnly: false,
        reducedMotion: false,
        wheelchairAccessible: false,
        visualGuides: true,
        audioGuides: false,
        hapticFeedback: true
      },
      navigation: {
        avoidCrowded: false,
        avoidStairs: false,
        preferElevators: false,
        preferEscalators: false,
        routeOptimization: 'fastest'
      },
      notifications: {
        pushEnabled: true,
        audioEnabled: true,
        vibrationEnabled: true,
        proximityAlerts: true,
        poiAlerts: true,
        distanceUnit: 'meters',
        language: 'en'
      },
      lastSync: new Date().toISOString(),
      version: 1
    };
  }
} 