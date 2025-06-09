/**
 * app.ts
 * Main Express application setup
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { json } from 'body-parser';
import { MetricsClient } from './monitoring/MetricsClient';
import { TracingClient } from './monitoring/TracingClient';
import { createLogger } from '@aerofusionxr/shared';
import { navigationRouter } from './routes/navigation';
import { floorPlanRouter } from './routes/floorPlan';
import { healthRouter } from './routes/health';
import { metricsRouter } from './routes/metrics';

export interface AppConfig {
  port: number;
  environment: string;
  serviceName: string;
  serviceVersion: string;
  cors: {
    origin: string | string[];
    methods: string[];
  };
  monitoring: {
    metricsPath: string;
    healthPath: string;
    otlpEndpoint: string;
  };
}

export class App {
  public app: express.Application;
  private config: AppConfig;
  private metrics: MetricsClient;
  private tracer: TracingClient;
  private logger: any;

  constructor(config: AppConfig) {
    this.config = config;
    this.app = express();

    // Initialize monitoring
    this.logger = createLogger('wayfinding-platform');

    this.metrics = new MetricsClient(this.logger);
    this.tracer = new TracingClient({
      serviceName: config.serviceName,
      serviceVersion: config.serviceVersion,
      environment: config.environment,
      otlpEndpoint: config.monitoring.otlpEndpoint,
      debug: config.environment === 'development'
    }, this.logger);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors(this.config.cors));

    // Body parsing
    this.app.use(json());
    this.app.use(compression());

    // Request logging
    this.app.use(this.logger.createRequestLogger());

    // Add trace context to requests
    this.app.use((req, res, next) => {
      const span = this.tracer.startSpan('http_request', {
        kind: 'server',
        attributes: {
          'http.method': req.method,
          'http.url': req.url,
          'http.user_agent': req.get('user-agent')
        }
      });

      // Store span in request for later use
      (req as any).span = span;
      next();
    });

    // Add basic security headers
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.use(this.config.monitoring.healthPath, healthRouter);

    // Metrics endpoint
    this.app.use(this.config.monitoring.metricsPath, metricsRouter(this.metrics));

    // API routes
    this.app.use('/api/v1/navigation', navigationRouter(this.metrics, this.tracer, this.logger));
    this.app.use('/api/v1/floor-plans', floorPlanRouter(this.metrics, this.tracer, this.logger));

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Path ${req.path} not found`
      });
    });
  }

  private setupErrorHandling(): void {
    // Error logging
    this.app.use(this.logger.createErrorLogger());

    // Global error handler
    this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      const span = (req as any).span;
      if (span) {
        this.tracer.recordError(err, span);
        span.end();
      }

      // Log error
      this.logger.error('Unhandled error', err);

      // Send error response
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' 
          ? 'An unexpected error occurred'
          : err.message
      });
    });
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      const server = this.app.listen(this.config.port, () => {
        this.logger.info('Server started', {
          port: this.config.port,
          environment: this.config.environment
        });
        resolve();
      });

      // Graceful shutdown
      const shutdown = async () => {
        this.logger.info('Shutting down server');
        
        server.close(async () => {
          await this.tracer.shutdown();
          process.exit(0);
        });

        // Force shutdown after 10s
        setTimeout(() => {
          this.logger.error('Forced shutdown after timeout');
          process.exit(1);
        }, 10000);
      };

      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    });
  }
} 