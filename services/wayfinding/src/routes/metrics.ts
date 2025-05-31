/**
 * metrics.ts
 * Prometheus metrics route handler
 */

import { Router, Request, Response } from 'express';
import { MetricsClient } from '../monitoring/MetricsClient';

export function metricsRouter(metrics: MetricsClient): Router {
  const router = Router();

  /**
   * Get Prometheus metrics
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const metricsData = await metrics.getMetrics();
      res.set('Content-Type', 'text/plain');
      res.send(metricsData);
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to collect metrics'
      });
    }
  });

  return router;
} 