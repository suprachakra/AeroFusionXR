/**
 * POIService.ts
 * Service for managing points of interest
 */

import { Redis } from 'ioredis';
import { Vector3 } from 'three';
import { MetricsClient } from '../monitoring/MetricsClient';
import { TracingClient } from '../monitoring/TracingClient';
import { createLogger } from '@aerofusionxr/shared';
import { Cache } from '../utils/Cache';
import { PointOfInterest, POICategory } from '../models/PointOfInterest';

interface POIConfig {
  redis: {
    url: string;
    keyPrefix: string;
  };
  cache: {
    maxSize: number;
    ttl: number;
  };
  searchRadius: number;
  maxResults: number;
  updateInterval: number;
}

interface POIQuery {
  position?: Vector3;
  floorId?: string;
  buildingId?: string;
  category?: POICategory;
  tags?: string[];
  amenities?: string[];
  accessibility?: {
    wheelchairAccessible?: boolean;
    brailleSignage?: boolean;
    hearingLoop?: boolean;
  };
  status?: 'open' | 'closed' | 'temporarily_closed' | 'maintenance';
  maxDistance?: number;
  limit?: number;
}

export class POIService {
  private redis: Redis;
  private cache: Cache<string, PointOfInterest>;
  private metrics: MetricsClient;
  private tracer: TracingClient;
  private logger: Logger;
  private config: POIConfig;
  private updateTimer?: NodeJS.Timeout;

  constructor(
    config: POIConfig,
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
    this.startPeriodicUpdates();
  }

  /**
   * Add or update a point of interest
   */
  public async upsertPOI(poi: PointOfInterest): Promise<void> {
    const span = this.tracer.startSpan('POIService.upsertPOI');

    try {
      // Validate POI data
      this.validatePOI(poi);

      // Store in Redis
      await this.redis.set(
        `poi:${poi.id}`,
        JSON.stringify(poi)
      );

      // Update cache
      this.cache.set(poi.id, poi);

      // Record metrics
      this.metrics.increment('poi.updates', { category: poi.category });

    } catch (error) {
      this.logger.error('Error upserting POI', error);
      this.metrics.increment('poi.errors');
      throw error;

    } finally {
      span.end();
    }
  }

  /**
   * Get a point of interest by ID
   */
  public async getPOI(id: string): Promise<PointOfInterest | null> {
    const span = this.tracer.startSpan('POIService.getPOI');

    try {
      // Check cache first
      const cached = this.cache.get(id);
      if (cached) {
        this.metrics.increment('poi.cache_hits');
        return cached;
      }

      // Get from Redis
      const data = await this.redis.get(`poi:${id}`);
      if (!data) return null;

      const poi = JSON.parse(data);
      this.cache.set(id, poi);
      
      return poi;

    } catch (error) {
      this.logger.error('Error getting POI', error);
      this.metrics.increment('poi.errors');
      throw error;

    } finally {
      span.end();
    }
  }

  /**
   * Delete a point of interest
   */
  public async deletePOI(id: string): Promise<void> {
    const span = this.tracer.startSpan('POIService.deletePOI');

    try {
      await this.redis.del(`poi:${id}`);
      this.cache.delete(id);
      this.metrics.increment('poi.deletions');

    } catch (error) {
      this.logger.error('Error deleting POI', error);
      this.metrics.increment('poi.errors');
      throw error;

    } finally {
      span.end();
    }
  }

  /**
   * Search for points of interest
   */
  public async searchPOIs(query: POIQuery): Promise<PointOfInterest[]> {
    const span = this.tracer.startSpan('POIService.searchPOIs');

    try {
      // Get all POIs first (could be optimized with spatial index)
      const keys = await this.redis.keys('poi:*');
      const pois: PointOfInterest[] = [];

      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const poi = JSON.parse(data);
          if (this.matchesQuery(poi, query)) {
            pois.push(poi);
          }
        }
      }

      // Sort by distance if position provided
      if (query.position) {
        pois.sort((a, b) => {
          const distA = this.getDistance(a.position, query.position!);
          const distB = this.getDistance(b.position, query.position!);
          return distA - distB;
        });
      }

      // Apply limit
      const limit = query.limit || this.config.maxResults;
      const results = pois.slice(0, limit);

      this.metrics.histogram('poi.search_results', results.length);
      return results;

    } catch (error) {
      this.logger.error('Error searching POIs', error);
      this.metrics.increment('poi.errors');
      throw error;

    } finally {
      span.end();
    }
  }

  /**
   * Get nearby points of interest
   */
  public async getNearbyPOIs(
    position: Vector3,
    radius: number = this.config.searchRadius
  ): Promise<PointOfInterest[]> {
    return this.searchPOIs({
      position,
      maxDistance: radius,
      status: 'open'
    });
  }

  /**
   * Update POI status (e.g., occupancy, queue time)
   */
  public async updatePOIStatus(
    id: string,
    updates: Partial<Pick<PointOfInterest, 'status' | 'occupancy' | 'queueTime'>>
  ): Promise<void> {
    const span = this.tracer.startSpan('POIService.updatePOIStatus');

    try {
      const poi = await this.getPOI(id);
      if (!poi) {
        throw new Error(`POI not found: ${id}`);
      }

      const updated = {
        ...poi,
        ...updates,
        lastUpdated: new Date().toISOString()
      };

      await this.upsertPOI(updated);
      this.metrics.increment('poi.status_updates');

    } catch (error) {
      this.logger.error('Error updating POI status', error);
      this.metrics.increment('poi.errors');
      throw error;

    } finally {
      span.end();
    }
  }

  private validatePOI(poi: PointOfInterest): void {
    if (!poi.id) {
      throw new Error('POI ID is required');
    }
    if (!poi.name) {
      throw new Error('POI name is required');
    }
    if (!poi.category) {
      throw new Error('POI category is required');
    }
    if (!poi.position) {
      throw new Error('POI position is required');
    }
    if (!poi.floorId) {
      throw new Error('POI floor ID is required');
    }
    if (!poi.buildingId) {
      throw new Error('POI building ID is required');
    }
  }

  private matchesQuery(poi: PointOfInterest, query: POIQuery): boolean {
    // Check floor and building
    if (query.floorId && poi.floorId !== query.floorId) return false;
    if (query.buildingId && poi.buildingId !== query.buildingId) return false;

    // Check category
    if (query.category && poi.category !== query.category) return false;

    // Check status
    if (query.status && poi.status !== query.status) return false;

    // Check distance
    if (query.position && query.maxDistance) {
      const distance = this.getDistance(poi.position, query.position);
      if (distance > query.maxDistance) return false;
    }

    // Check tags
    if (query.tags && query.tags.length > 0) {
      if (!query.tags.some(tag => poi.tags.includes(tag))) return false;
    }

    // Check amenities
    if (query.amenities && query.amenities.length > 0) {
      if (!query.amenities.some(amenity => poi.amenities.includes(amenity))) return false;
    }

    // Check accessibility
    if (query.accessibility) {
      const { wheelchairAccessible, brailleSignage, hearingLoop } = query.accessibility;
      if (wheelchairAccessible && !poi.accessibility.wheelchairAccessible) return false;
      if (brailleSignage && !poi.accessibility.brailleSignage) return false;
      if (hearingLoop && !poi.accessibility.hearingLoop) return false;
    }

    return true;
  }

  private getDistance(a: Vector3, b: Vector3): number {
    return a.distanceTo(b);
  }

  private startPeriodicUpdates(): void {
    this.updateTimer = setInterval(() => {
      this.updatePOIStatuses().catch(error => {
        this.logger.error('Error in periodic POI updates', error);
      });
    }, this.config.updateInterval);
  }

  private async updatePOIStatuses(): Promise<void> {
    const span = this.tracer.startSpan('POIService.updatePOIStatuses');

    try {
      const keys = await this.redis.keys('poi:*');
      const now = new Date();

      for (const key of keys) {
        const data = await this.redis.get(key);
        if (!data) continue;

        const poi = JSON.parse(data);
        let needsUpdate = false;

        // Update status based on hours
        if (poi.hours) {
          const isOpen = this.checkOpenStatus(poi.hours, now);
          if (isOpen && poi.status === 'closed') {
            poi.status = 'open';
            needsUpdate = true;
          } else if (!isOpen && poi.status === 'open') {
            poi.status = 'closed';
            needsUpdate = true;
          }
        }

        // Simulate occupancy changes (in real app, would get from sensors)
        if (poi.maxOccupancy && Math.random() < 0.3) {
          poi.occupancy = Math.floor(Math.random() * poi.maxOccupancy);
          needsUpdate = true;
        }

        // Simulate queue time changes
        if (poi.category === 'security' || poi.category === 'restaurant') {
          poi.queueTime = Math.floor(Math.random() * 20);
          needsUpdate = true;
        }

        if (needsUpdate) {
          poi.lastUpdated = now.toISOString();
          await this.upsertPOI(poi);
        }
      }

    } catch (error) {
      this.logger.error('Error updating POI statuses', error);
      this.metrics.increment('poi.errors');

    } finally {
      span.end();
    }
  }

  private checkOpenStatus(hours: PointOfInterest['hours'], now: Date): boolean {
    if (!hours) return true;

    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const day = days[now.getDay()];
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

    // Check exceptions first
    if (hours.exceptions) {
      const dateStr = now.toISOString().split('T')[0];
      const exception = hours.exceptions.find(e => e.date === dateStr);
      if (exception) {
        return this.isTimeInRange(timeStr, exception.open, exception.close);
      }
    }

    // Check regular hours
    const dayHours = hours[day as keyof typeof hours];
    if (!dayHours) return false;

    return dayHours.some(period =>
      this.isTimeInRange(timeStr, period.open, period.close)
    );
  }

  private isTimeInRange(time: string, open: string, close: string): boolean {
    return time >= open && time <= close;
  }

  private setupMetrics(): void {
    this.metrics.defineCounter('poi.updates', 'POI update count', ['category']);
    this.metrics.defineCounter('poi.deletions', 'POI deletion count');
    this.metrics.defineCounter('poi.status_updates', 'POI status update count');
    this.metrics.defineCounter('poi.errors', 'POI operation error count');
    this.metrics.defineCounter('poi.cache_hits', 'POI cache hit count');
    this.metrics.defineHistogram('poi.search_results', 'Number of POI search results');
    this.metrics.defineGauge('poi.total', 'Total number of POIs');
  }
} 
