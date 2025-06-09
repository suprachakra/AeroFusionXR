/**
 * navigation.ts
 * Navigation route handlers
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Vector3 } from 'three';
import { MetricsClient } from '../monitoring/MetricsClient';
import { TracingClient } from '../monitoring/TracingClient';
import { createLogger } from '@aerofusionxr/shared';
import { MultiFloorRouter } from '../core/slam/MultiFloorRouter';
import { NavigationPoint } from '../models/NavigationPoint';
import { Cache } from '../utils/Cache';

// Request validation schemas
const PathRequestSchema = z.object({
  start: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
    floorId: z.string()
  }),
  end: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
    floorId: z.string()
  }),
  preferences: z.object({
    avoidCrowded: z.boolean().optional(),
    accessibilityMode: z.boolean().optional()
  }).optional()
});

const UpdatePositionSchema = z.object({
  position: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number()
  }),
  heading: z.number(),
  floorId: z.string()
});

export function navigationRouter(
  metrics: MetricsClient,
  tracer: TracingClient,
  logger: Logger
): Router {
  const router = Router();
  
  // Initialize router
  const multiFloorRouter = new MultiFloorRouter({
    maxPathLength: 1000, // meters
    maxTransitions: 5,
    weightFactors: {
      distance: 1,
      transition: 2,
      crowding: 1.5
    },
    cacheConfig: {
      maxSize: 1000,
      ttl: 300000 // 5 minutes
    }
  }, metrics, tracer, logger);

  // Position update cache
  const positionCache = new Cache<string, { position: Vector3; timestamp: number }>({
    maxSize: 10000,
    ttl: 60000 // 1 minute
  });

  /**
   * Find path between two points
   */
  router.post('/path', async (req: Request, res: Response, next: NextFunction) => {
    const span = tracer.startSpan('navigation.find_path');

    try {
      // Validate request
      const { start, end, preferences } = PathRequestSchema.parse(req.body);

      // Convert to navigation points
      const startPoint: NavigationPoint = {
        position: new Vector3(start.x, start.y, start.z),
        floorId: start.floorId,
        type: 'waypoint'
      };

      const endPoint: NavigationPoint = {
        position: new Vector3(end.x, end.y, end.z),
        floorId: end.floorId,
        type: 'waypoint'
      };

      // Find path
      const path = await multiFloorRouter.findPath(startPoint, endPoint, preferences);

      // Record metrics
      metrics.histogram('navigation.path_length', path.length);
      metrics.histogram('navigation.path_distance', 
        path.reduce((acc, point, i) => {
          if (i === 0) return 0;
          return acc + point.position.distanceTo(path[i-1].position);
        }, 0)
      );

      res.json({
        path: path.map(point => ({
          x: point.position.x,
          y: point.position.y,
          z: point.position.z,
          floorId: point.floorId,
          type: point.type,
          label: point.label
        }))
      });

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
   * Update current position
   */
  router.post('/position', async (req: Request, res: Response, next: NextFunction) => {
    const span = tracer.startSpan('navigation.update_position');

    try {
      // Validate request
      const { position, heading, floorId } = UpdatePositionSchema.parse(req.body);

      // Store position
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User ID required'
        });
        return;
      }

      positionCache.set(userId, {
        position: new Vector3(position.x, position.y, position.z),
        timestamp: Date.now()
      });

      // Record metrics
      metrics.gauge('navigation.active_users', positionCache.size());

      res.sendStatus(204);

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
   * Get nearby users
   */
  router.get('/nearby', async (req: Request, res: Response, next: NextFunction) => {
    const span = tracer.startSpan('navigation.get_nearby');

    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User ID required'
        });
        return;
      }

      const userPosition = positionCache.get(userId);
      if (!userPosition) {
        res.status(404).json({
          error: 'Not Found',
          message: 'User position not found'
        });
        return;
      }

      // Find nearby users within 50 meters
      const nearbyUsers = Array.from(positionCache.entries())
        .filter(([id, data]) => {
          if (id === userId) return false;
          return data.position.distanceTo(userPosition.position) <= 50;
        })
        .map(([id, data]) => ({
          userId: id,
          position: {
            x: data.position.x,
            y: data.position.y,
            z: data.position.z
          },
          distance: data.position.distanceTo(userPosition.position)
        }));

      res.json({ users: nearbyUsers });

    } catch (error) {
      next(error);

    } finally {
      span.end();
    }
  });

  return router;
} 
