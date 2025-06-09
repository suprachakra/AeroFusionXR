/**
 * health.ts
 * Health check route handlers
 */

import { Router, Request, Response } from 'express';
import os from 'os';

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  memory: {
    total: number;
    free: number;
    used: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  cpu: {
    loadAvg: number[];
    cores: number;
  };
}

const router = Router();

/**
 * Basic health check
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

/**
 * Detailed health check
 */
router.get('/details', (req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();
  
  const status: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.SERVICE_VERSION || 'unknown',
    uptime: process.uptime(),
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem(),
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external
    },
    cpu: {
      loadAvg: os.loadavg(),
      cores: os.cpus().length
    }
  };

  res.json(status);
});

/**
 * Readiness probe
 */
router.get('/ready', (req: Request, res: Response) => {
  // Add any additional readiness checks here
  res.json({
    status: 'ready',
    timestamp: new Date().toISOString()
  });
});

/**
 * Liveness probe
 */
router.get('/live', (req: Request, res: Response) => {
  // Add any additional liveness checks here
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

export const healthRouter = router; 