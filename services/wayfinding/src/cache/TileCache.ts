/**
 * TileCache.ts
 * Handles caching of floor plan tiles for offline navigation with compression
 */

import { Redis } from 'ioredis';
import { gzip, ungzip } from 'node-gzip';
import { Vector3 } from 'three';
import { MetricsClient } from '../monitoring/MetricsClient';
import { TracingClient } from '../monitoring/TracingClient';
import { Logger } from '../utils/Logger';
import { Cache } from '../utils/Cache';
import { FloorPlan } from '../models/FloorPlan';

interface TileConfig {
  redis: {
    url: string;
    keyPrefix: string;
  };
  cache: {
    maxSize: number;
    ttl: number;
  };
  tileSize: number;  // Size of each tile in meters
  maxTilesPerFloor: number;
  compressionEnabled: boolean;
}

interface Tile {
  id: string;
  floorId: string;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  walkablePoints: Array<{
    x: number;
    y: number;
    z: number;
    type: string;
  }>;
  connections: Array<{
    start: [number, number, number];
    end: [number, number, number];
    type: string;
  }>;
  lastUpdated: string;
  version: number;
}

export class TileCache {
  private redis: Redis;
  private cache: Cache<string, Tile>;
  private metrics: MetricsClient;
  private tracer: TracingClient;
  private logger: Logger;
  private config: TileConfig;

  constructor(
    config: TileConfig,
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
   * Generate and cache tiles for a floor plan
   */
  public async generateTiles(floorPlan: FloorPlan): Promise<void> {
    const span = this.tracer.startSpan('TileCache.generateTiles');
    const startTime = Date.now();

    try {
      // Calculate tile grid dimensions
      const bounds = floorPlan.bounds;
      const size = bounds.getSize();
      const tilesX = Math.ceil(size.x / this.config.tileSize);
      const tilesY = Math.ceil(size.z / this.config.tileSize); // Use z for 2D grid

      const totalTiles = tilesX * tilesY;
      if (totalTiles > this.config.maxTilesPerFloor) {
        throw new Error(`Floor plan exceeds maximum tile count: ${totalTiles}`);
      }

      // Generate tiles
      const tiles: Tile[] = [];
      for (let x = 0; x < tilesX; x++) {
        for (let y = 0; y < tilesY; y++) {
          const tile = this.createTile(floorPlan, x, y);
          tiles.push(tile);
        }
      }

      // Store tiles
      await Promise.all(tiles.map(tile => this.storeTile(tile)));

      // Record metrics
      const duration = Date.now() - startTime;
      this.recordTileMetrics(floorPlan.id, tiles.length, duration);

    } catch (error) {
      this.logger.error('Error generating tiles', error);
      this.metrics.increment('tiles.generation_errors');
      throw error;

    } finally {
      span.end();
    }
  }

  /**
   * Get tiles for a specific area
   */
  public async getTilesForArea(
    floorId: string,
    bounds: { minX: number; minY: number; maxX: number; maxY: number }
  ): Promise<Tile[]> {
    const span = this.tracer.startSpan('TileCache.getTilesForArea');

    try {
      // Calculate tile coordinates
      const minTileX = Math.floor(bounds.minX / this.config.tileSize);
      const minTileY = Math.floor(bounds.minY / this.config.tileSize);
      const maxTileX = Math.ceil(bounds.maxX / this.config.tileSize);
      const maxTileY = Math.ceil(bounds.maxY / this.config.tileSize);

      const tiles: Tile[] = [];
      for (let x = minTileX; x <= maxTileX; x++) {
        for (let y = minTileY; y <= maxTileY; y++) {
          const tileId = this.getTileId(floorId, x, y);
          const tile = await this.getTile(tileId);
          if (tile) {
            tiles.push(tile);
          }
        }
      }

      return tiles;

    } catch (error) {
      this.logger.error('Error getting tiles', error);
      this.metrics.increment('tiles.fetch_errors');
      throw error;

    } finally {
      span.end();
    }
  }

  /**
   * Prefetch tiles around a position
   */
  public async prefetchTiles(
    floorId: string,
    position: { x: number; y: number },
    radius: number
  ): Promise<void> {
    const span = this.tracer.startSpan('TileCache.prefetchTiles');

    try {
      const bounds = {
        minX: position.x - radius,
        minY: position.y - radius,
        maxX: position.x + radius,
        maxY: position.y + radius
      };

      await this.getTilesForArea(floorId, bounds);
      this.metrics.increment('tiles.prefetch_requests');

    } catch (error) {
      this.logger.error('Error prefetching tiles', error);
      this.metrics.increment('tiles.prefetch_errors');
      throw error;

    } finally {
      span.end();
    }
  }

  /**
   * Clear cached tiles for a floor
   */
  public async clearFloorTiles(floorId: string): Promise<void> {
    const span = this.tracer.startSpan('TileCache.clearFloorTiles');

    try {
      const pattern = `${floorId}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        keys.forEach((key: string) => this.cache.delete(key));
      }

      this.metrics.increment('tiles.clear_requests');

    } catch (error) {
      this.logger.error('Error clearing tiles', error);
      this.metrics.increment('tiles.clear_errors');
      throw error;

    } finally {
      span.end();
    }
  }

  private createTile(floorPlan: FloorPlan, tileX: number, tileY: number): Tile {
    const minX = tileX * this.config.tileSize;
    const minY = tileY * this.config.tileSize;
    const maxX = minX + this.config.tileSize;
    const maxY = minY + this.config.tileSize;

    // Filter points within tile bounds
    const walkablePoints = floorPlan.walkablePoints
      .filter(point => {
        return point.position.x >= minX && point.position.x < maxX &&
               point.position.z >= minY && point.position.z < maxY;
      })
      .map(point => ({
        x: point.position.x,
        y: point.position.y,
        z: point.position.z,
        type: point.type
      }));

    // Filter connections that intersect tile
    const connections = floorPlan.connections
      .filter(conn => {
        const start = conn.start.position;
        const end = conn.end.position;
        return this.lineIntersectsTile(
          start.x, start.z, end.x, end.z,
          minX, minY, maxX, maxY
        );
      })
      .map(conn => ({
        start: [
          conn.start.position.x,
          conn.start.position.y,
          conn.start.position.z
        ] as [number, number, number],
        end: [
          conn.end.position.x,
          conn.end.position.y,
          conn.end.position.z
        ] as [number, number, number],
        type: conn.type
      }));

    return {
      id: this.getTileId(floorPlan.id, tileX, tileY),
      floorId: floorPlan.id,
      bounds: { minX, minY, maxX, maxY },
      walkablePoints,
      connections,
      lastUpdated: new Date().toISOString(),
      version: 1
    };
  }

  private async storeTile(tile: Tile): Promise<void> {
    const data = this.config.compressionEnabled
      ? await this.compressTile(tile)
      : JSON.stringify(tile);

    await this.redis.set(tile.id, data);
    this.cache.set(tile.id, tile);
  }

  private async getTile(tileId: string): Promise<Tile | null> {
    // Check memory cache
    const cached = this.cache.get(tileId);
    if (cached) {
      this.metrics.increment('tiles.cache_hits');
      return cached;
    }

    // Get from Redis
    const data = await this.redis.get(tileId);
    if (!data) return null;

    const tile = this.config.compressionEnabled
      ? await this.decompressTile(data)
      : JSON.parse(data);

    this.cache.set(tileId, tile);
    return tile;
  }

  private getTileId(floorId: string, x: number, y: number): string {
    return `${floorId}:${x},${y}`;
  }

  private lineIntersectsTile(
    x1: number, y1: number,
    x2: number, y2: number,
    minX: number, minY: number,
    maxX: number, maxY: number
  ): boolean {
    // Check if line segment intersects tile bounds
    // Using Cohen-Sutherland algorithm
    const INSIDE = 0;
    const LEFT = 1;
    const RIGHT = 2;
    const BOTTOM = 4;
    const TOP = 8;

    const getCode = (x: number, y: number): number => {
      let code = INSIDE;
      if (x < minX) code |= LEFT;
      else if (x > maxX) code |= RIGHT;
      if (y < minY) code |= BOTTOM;
      else if (y > maxY) code |= TOP;
      return code;
    };

    let code1 = getCode(x1, y1);
    let code2 = getCode(x2, y2);

    while (true) {
      if (!(code1 | code2)) return true; // Both points inside
      if (code1 & code2) return false; // Both points on same side

      const code = code1 || code2;
      let x, y;

      if (code & TOP) {
        x = x1 + (x2 - x1) * (maxY - y1) / (y2 - y1);
        y = maxY;
      } else if (code & BOTTOM) {
        x = x1 + (x2 - x1) * (minY - y1) / (y2 - y1);
        y = minY;
      } else if (code & RIGHT) {
        y = y1 + (y2 - y1) * (maxX - x1) / (x2 - x1);
        x = maxX;
      } else {
        y = y1 + (y2 - y1) * (minX - x1) / (x2 - x1);
        x = minX;
      }

      if (code === code1) {
        x1 = x;
        y1 = y;
        code1 = getCode(x1, y1);
      } else {
        x2 = x;
        y2 = y;
        code2 = getCode(x2, y2);
      }
    }
  }

  private async compressTile(tile: Tile): Promise<string> {
    try {
      const tileData = JSON.stringify(tile);
      const compressed = await gzip(tileData);
      const ratio = compressed.length / tileData.length;
      
      this.metrics.histogram('tiles.compression_ratio', ratio);
      return compressed.toString('base64');
    } catch (error) {
      this.logger.error('Error compressing tile', error);
      this.metrics.increment('tiles.compression_errors');
      // Fallback to uncompressed
      return JSON.stringify(tile);
    }
  }

  private async decompressTile(data: string): Promise<Tile> {
    try {
      const compressed = Buffer.from(data, 'base64');
      const decompressed = await ungzip(compressed);
      return JSON.parse(decompressed.toString());
    } catch (error) {
      this.logger.error('Error decompressing tile', error);
      this.metrics.increment('tiles.decompression_errors');
      // Fallback to uncompressed
      return JSON.parse(data);
    }
  }

  /**
   * Background prefetch tiles in a radius around a position
   */
  public async backgroundPrefetch(
    floorId: string,
    position: Vector3,
    radius: number = this.config.tileSize * 2
  ): Promise<void> {
    const span = this.tracer.startSpan('TileCache.backgroundPrefetch');

    try {
      // Calculate tile bounds
      const bounds = {
        minX: position.x - radius,
        minY: position.y - radius,
        maxX: position.x + radius,
        maxY: position.y + radius
      };

      // Get tiles in background
      setTimeout(async () => {
        try {
          await this.getTilesForArea(floorId, bounds);
          this.metrics.increment('tiles.background_prefetch_success');
        } catch (error) {
          this.logger.error('Background prefetch failed', error);
          this.metrics.increment('tiles.background_prefetch_errors');
        }
      }, 0);

    } catch (error) {
      this.logger.error('Error starting background prefetch', error);
      this.metrics.increment('tiles.background_prefetch_errors');
    } finally {
      span.end();
    }
  }

  /**
   * Get tile storage stats
   */
  public async getStats(): Promise<{
    totalTiles: number;
    cachedTiles: number;
    compressionRatio: number;
    storageSize: number;
  }> {
    const span = this.tracer.startSpan('TileCache.getStats');

    try {
      const keys = await this.redis.keys('*');
      const cachedKeys = Array.from(this.cache.keys());
      
      let totalSize = 0;
      let uncompressedSize = 0;

      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          totalSize += data.length;
          const tile = await this.decompressTile(data);
          uncompressedSize += JSON.stringify(tile).length;
        }
      }

      return {
        totalTiles: keys.length,
        cachedTiles: cachedKeys.length,
        compressionRatio: totalSize / uncompressedSize,
        storageSize: totalSize
      };

    } catch (error) {
      this.logger.error('Error getting cache stats', error);
      this.metrics.increment('tiles.stats_errors');
      throw error;
    } finally {
      span.end();
    }
  }

  private setupMetrics(): void {
    this.metrics.defineCounter('tiles.generation_errors', 'Tile generation error count');
    this.metrics.defineCounter('tiles.fetch_errors', 'Tile fetch error count');
    this.metrics.defineCounter('tiles.prefetch_errors', 'Tile prefetch error count');
    this.metrics.defineCounter('tiles.clear_errors', 'Tile clear error count');
    this.metrics.defineCounter('tiles.cache_hits', 'Tile cache hit count');
    this.metrics.defineCounter('tiles.prefetch_requests', 'Tile prefetch request count');
    this.metrics.defineCounter('tiles.clear_requests', 'Tile clear request count');
    this.metrics.defineHistogram('tiles.generation_duration', 'Tile generation duration');
    this.metrics.defineGauge('tiles.total', 'Total number of cached tiles');
    this.metrics.defineHistogram('tiles.compression_ratio', 'Tile compression ratio');
    this.metrics.defineCounter('tiles.compression_errors', 'Tile compression error count');
    this.metrics.defineCounter('tiles.decompression_errors', 'Tile decompression error count');
    this.metrics.defineCounter('tiles.background_prefetch_success', 'Background prefetch success count');
    this.metrics.defineCounter('tiles.background_prefetch_errors', 'Background prefetch error count');
    this.metrics.defineCounter('tiles.stats_errors', 'Cache stats error count');
    this.metrics.defineGauge('tiles.storage_size', 'Total tile storage size in bytes');
  }

  private recordTileMetrics(floorId: string, tileCount: number, duration: number): void {
    this.metrics.histogram('tiles.generation_duration', duration, {});
    this.metrics.gauge(`tiles.count.${floorId}`, tileCount, {});
    this.metrics.increment('tiles.generated', {}, tileCount);
  }
} 