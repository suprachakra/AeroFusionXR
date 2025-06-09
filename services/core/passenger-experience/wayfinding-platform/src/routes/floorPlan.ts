/**
 * floorPlan.ts
 * Floor plan route handlers
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Vector3, Box3 } from 'three';
import { MetricsClient } from '../monitoring/MetricsClient';
import { TracingClient } from '../monitoring/TracingClient';
import { createLogger } from '@aerofusionxr/shared';
import { FloorPlan, FloorPlanZone, FloorPlanPOI } from '../models/FloorPlan';
import { NavigationPoint } from '../models/NavigationPoint';
import { Cache } from '../utils/Cache';

// Request validation schemas
const FloorPlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.number(),
  bounds: z.object({
    min: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number()
    }),
    max: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number()
    })
  }),
  walkablePoints: z.array(z.object({
    position: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number()
    }),
    type: z.enum(['waypoint', 'transition', 'poi', 'entrance', 'exit']),
    label: z.string().optional()
  })),
  zones: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['gate', 'security', 'retail', 'restroom', 'restaurant', 'lounge']),
    bounds: z.object({
      min: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number()
      }),
      max: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number()
      })
    }),
    capacity: z.number().optional(),
    occupancy: z.number().optional(),
    restrictions: z.array(z.string()).optional()
  })),
  pois: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    position: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number()
    }),
    description: z.string().optional(),
    icon: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional()
  }))
});

export function floorPlanRouter(
  metrics: MetricsClient,
  tracer: TracingClient,
  logger: Logger
): Router {
  const router = Router();

  // Floor plan cache
  const floorPlanCache = new Cache<string, FloorPlan>({
    maxSize: 100,
    ttl: 3600000 // 1 hour
  });

  /**
   * Get all floor plans
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    const span = tracer.startSpan('floorplan.get_all');

    try {
      const floorPlans = Array.from(floorPlanCache.values());
      
      metrics.gauge('floorplan.count', floorPlans.length);

      res.json({ floorPlans });

    } catch (error) {
      next(error);

    } finally {
      span.end();
    }
  });

  /**
   * Get floor plan by ID
   */
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    const span = tracer.startSpan('floorplan.get_by_id');

    try {
      const floorPlan = floorPlanCache.get(req.params.id);
      
      if (!floorPlan) {
        res.status(404).json({
          error: 'Not Found',
          message: `Floor plan ${req.params.id} not found`
        });
        return;
      }

      res.json({ floorPlan });

    } catch (error) {
      next(error);

    } finally {
      span.end();
    }
  });

  /**
   * Create or update floor plan
   */
  router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    const span = tracer.startSpan('floorplan.update');

    try {
      // Validate request
      const data = FloorPlanSchema.parse(req.body);

      // Convert to internal model
      const floorPlan: FloorPlan = {
        id: data.id,
        name: data.name,
        level: data.level,
        bounds: new Box3(
          new Vector3(data.bounds.min.x, data.bounds.min.y, data.bounds.min.z),
          new Vector3(data.bounds.max.x, data.bounds.max.y, data.bounds.max.z)
        ),
        walkablePoints: data.walkablePoints.map(wp => ({
          position: new Vector3(wp.position.x, wp.position.y, wp.position.z),
          type: wp.type,
          label: wp.label,
          floorId: data.id
        })),
        zones: data.zones.map(zone => ({
          id: zone.id,
          name: zone.name,
          type: zone.type,
          bounds: new Box3(
            new Vector3(zone.bounds.min.x, zone.bounds.min.y, zone.bounds.min.z),
            new Vector3(zone.bounds.max.x, zone.bounds.max.y, zone.bounds.max.z)
          ),
          capacity: zone.capacity,
          occupancy: zone.occupancy,
          restrictions: zone.restrictions
        })),
        pois: data.pois.map(poi => ({
          id: poi.id,
          name: poi.name,
          type: poi.type,
          position: new Vector3(poi.position.x, poi.position.y, poi.position.z),
          description: poi.description,
          icon: poi.icon,
          category: poi.category,
          tags: poi.tags
        })),
        metadata: {
          lastUpdated: new Date().toISOString(),
          version: '1.0',
          source: req.headers['x-source'] as string || 'api'
        }
      };

      // Store in cache
      floorPlanCache.set(floorPlan.id, floorPlan);

      // Record metrics
      metrics.increment('floorplan.updates');
      metrics.gauge('floorplan.walkable_points', floorPlan.walkablePoints.length);
      metrics.gauge('floorplan.zones', floorPlan.zones.length);
      metrics.gauge('floorplan.pois', floorPlan.pois.length);

      res.json({ floorPlan });

    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation Error',
          details: error.errors
        });
        return;
      }
      next(error);

    } finally {
      span.end();
    }
  });

  /**
   * Delete floor plan
   */
  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    const span = tracer.startSpan('floorplan.delete');

    try {
      const deleted = floorPlanCache.delete(req.params.id);
      
      if (!deleted) {
        res.status(404).json({
          error: 'Not Found',
          message: `Floor plan ${req.params.id} not found`
        });
        return;
      }

      metrics.increment('floorplan.deletions');

      res.sendStatus(204);

    } catch (error) {
      next(error);

    } finally {
      span.end();
    }
  });

  /**
   * Get floor plan statistics
   */
  router.get('/:id/stats', async (req: Request, res: Response, next: NextFunction) => {
    const span = tracer.startSpan('floorplan.get_stats');

    try {
      const floorPlan = floorPlanCache.get(req.params.id);
      
      if (!floorPlan) {
        res.status(404).json({
          error: 'Not Found',
          message: `Floor plan ${req.params.id} not found`
        });
        return;
      }

      // Calculate statistics
      const totalArea = calculateArea(floorPlan.bounds);
      const walkableArea = calculateWalkableArea(floorPlan.walkablePoints);
      const zoneOccupancy = calculateZoneOccupancy(floorPlan.zones);

      res.json({
        id: floorPlan.id,
        name: floorPlan.name,
        level: floorPlan.level,
        stats: {
          totalArea,
          walkableArea,
          walkablePoints: floorPlan.walkablePoints.length,
          zones: floorPlan.zones.length,
          pois: floorPlan.pois.length,
          zoneOccupancy
        }
      });

    } catch (error) {
      next(error);

    } finally {
      span.end();
    }
  });

  return router;
}

function calculateArea(bounds: Box3): number {
  const size = bounds.getSize(new Vector3());
  return size.x * size.z; // Ignore height (y)
}

function calculateWalkableArea(points: NavigationPoint[]): number {
  // Simple estimation: assume each point represents a 2x2 meter area
  return points.length * 4;
}

function calculateZoneOccupancy(zones: FloorPlanZone[]): {
  total: number;
  current: number;
  percentage: number;
} {
  const total = zones.reduce((acc, zone) => acc + (zone.capacity || 0), 0);
  const current = zones.reduce((acc, zone) => acc + (zone.occupancy || 0), 0);
  
  return {
    total,
    current,
    percentage: total > 0 ? (current / total) * 100 : 0
  };
} 
