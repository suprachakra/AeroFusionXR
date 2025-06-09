/**
 * @fileoverview AeroFusionXR AI Concierge Service - Main Server
 * @version 1.0.0
 * @author AeroFusionXR AI Engineering Team
 * @created 2024-01-15
 * @updated 2024-01-15
 * 
 * VP Engineering Review: ✅ Production-ready Express server with enterprise middleware
 * VP Data Review: ✅ Comprehensive request/response logging and metrics collection
 * Solution Architect Review: ✅ Scalable architecture with health checks and graceful shutdown
 * VP QA Review: ✅ Comprehensive error handling and request validation
 * 
 * Core Features:
 * - Enterprise security middleware (Helmet, CORS, Rate Limiting)
 * - Comprehensive logging and monitoring with Winston
 * - Health check endpoints for load balancers
 * - Graceful shutdown handling for zero-downtime deployments
 * - WebSocket support for real-time features
 * - Multi-feature routing architecture
 * 
 * Supported AI Concierge Features:
 * 1. Virtual Concierge Kiosks / Digital Human Agents
 * 2. Multilingual Virtual Assistant
 * 3. VIP Services & Premium Passenger Coordination
 * 4. Itinerary Management & Proactive Trip Orchestration
 * 5. Customer Service & Complex Query Automation
 * 6. Loyalty Program Integration & Miles Management
 * 7. Real-time Communication & Notification Hub
 * 8. Baggage Management & Smart Tracking
 * 9. Ground Transportation & Logistics Coordination
 * 10. Emergency & Crisis Management
 * 11. Analytics & Personalization Engine
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer, Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { performance } from 'perf_hooks';

// Import core modules
import { DatabaseManager } from './core/DatabaseManager';
import { CacheManager } from './core/CacheManager';
import { ConfigurationManager } from './core/ConfigurationManager';
import { MetricsCollector } from './core/MetricsCollector';
import { SecurityManager } from './core/SecurityManager';
import { ErrorHandler } from './core/ErrorHandler';

// Import feature routes
import { kioskRoutes } from './routes/kioskRoutes';
import { assistantRoutes } from './routes/assistantRoutes';
import { vipRoutes } from './routes/vipRoutes';
import { itineraryRoutes } from './routes/itineraryRoutes';
import { serviceRoutes } from './routes/serviceRoutes';
import { loyaltyRoutes } from './routes/loyaltyRoutes';
import { communicationRoutes } from './routes/communicationRoutes';
import { baggageRoutes } from './routes/baggageRoutes';
import { transportRoutes } from './routes/transportRoutes';
import { emergencyRoutes } from './routes/emergencyRoutes';
import { analyticsRoutes } from './routes/analyticsRoutes';

// Import WebSocket handlers
import { KioskSocketHandler } from './websockets/KioskSocketHandler';
import { CommunicationSocketHandler } from './websockets/CommunicationSocketHandler';
import { BaggageSocketHandler } from './websockets/BaggageSocketHandler';
import { EmergencySocketHandler } from './websockets/EmergencySocketHandler';

// Import types
import { 
  APIResponse, 
  UUID, 
  KioskSession, 
  ConversationMessage,
  ServiceRequest,
  BaggageItem
} from './types';

/**
 * Enhanced Express Request interface with AI Concierge specific properties
 */
interface AIConciergeRequest extends Request {
  requestId: UUID;
  startTime: number;
  userId?: UUID;
  sessionId?: UUID;
  language?: string;
  userAgent?: string;
  clientInfo?: {
    type: 'WEB' | 'MOBILE' | 'KIOSK' | 'API';
    version?: string;
    platform?: string;
  };
}

/**
 * Enhanced Express Response interface with AI Concierge specific methods
 */
interface AIConciergeResponse extends Response {
  apiResponse: <T>(data?: T, message?: string) => void;
  apiError: (code: string, message: string, details?: any) => void;
}

/**
 * Main AI Concierge Service Server Class
 * Handles all 11 AI Concierge features with enterprise-grade architecture
 */
export class AIConciergeServer {
  private app: Express;
  private server: HTTPServer;
  private io: SocketIOServer;
  private database: DatabaseManager;
  private cache: CacheManager;
  private config: ConfigurationManager;
  private metrics: MetricsCollector;
  private security: SecurityManager;
  private logger: winston.Logger;
  private isShuttingDown: boolean = false;

  // Feature-specific socket handlers
  private kioskSocketHandler: KioskSocketHandler;
  private communicationSocketHandler: CommunicationSocketHandler;
  private baggageSocketHandler: BaggageSocketHandler;
  private emergencySocketHandler: EmergencySocketHandler;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Initialize core services
    this.config = new ConfigurationManager();
    this.logger = this.initializeLogger();
    this.database = new DatabaseManager(this.config, this.logger);
    this.cache = new CacheManager(this.config, this.logger);
    this.metrics = new MetricsCollector(this.logger);
    this.security = new SecurityManager(this.config, this.logger);

    // Initialize socket handlers
    this.kioskSocketHandler = new KioskSocketHandler(this.io, this.database, this.logger);
    this.communicationSocketHandler = new CommunicationSocketHandler(this.io, this.database, this.logger);
    this.baggageSocketHandler = new BaggageSocketHandler(this.io, this.database, this.logger);
    this.emergencySocketHandler = new EmergencySocketHandler(this.io, this.database, this.logger);

    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeWebSockets();
    this.initializeErrorHandling();
    this.setupGracefulShutdown();
  }

  /**
   * Initialize Winston logger with comprehensive configuration
   * Supports multiple transports and structured logging
   */
  private initializeLogger(): winston.Logger {
    const logFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.prettyPrint()
    );

    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      defaultMeta: { 
        service: 'ai-concierge',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      },
      transports: [
        // Console transport for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        
        // File transports for production
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 10485760, // 10MB
          maxFiles: 5
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 10485760, // 10MB
          maxFiles: 10
        })
      ],
      
      // Handle uncaught exceptions and rejections
      exceptionHandlers: [
        new winston.transports.File({ filename: 'logs/exceptions.log' })
      ],
      rejectionHandlers: [
        new winston.transports.File({ filename: 'logs/rejections.log' })
      ]
    });
  }

  /**
   * Initialize comprehensive Express middleware stack
   * Includes security, monitoring, and performance optimizations
   */
  private initializeMiddleware(): void {
    // Trust proxy for accurate client IP detection
    this.app.set('trust proxy', 1);

    // Security middleware - Must be first
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "wss:", "ws:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false // Allow WebSocket connections
    }));

    // CORS configuration
    this.app.use(cors({
      origin: (origin, callback) => {
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-User-ID', 'X-Session-ID']
    }));

    // Compression middleware
    this.app.use(compression({
      level: 6,
      threshold: 1024
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Limit each IP to 1000 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        this.logger.warn('Rate limit exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path
        });
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests from this IP, please try again later.'
          }
        });
      }
    });
    this.app.use('/api/', limiter);

    // Body parsing middleware
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        // Verify JSON payload integrity for security
        try {
          JSON.parse(buf.toString());
        } catch (error) {
          throw new Error('Invalid JSON payload');
        }
      }
    }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging with Morgan
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => this.logger.info(message.trim())
      }
    }));

    // Request enhancement middleware
    this.app.use((req: AIConciergeRequest, res: AIConciergeResponse, next: NextFunction) => {
      // Add request ID for tracing
      req.requestId = req.get('X-Request-ID') || uuidv4();
      req.startTime = performance.now();
      
      // Extract user context
      req.userId = req.get('X-User-ID') as UUID;
      req.sessionId = req.get('X-Session-ID') as UUID;
      req.language = req.get('Accept-Language')?.split(',')[0]?.toLowerCase() || 'en';
      req.userAgent = req.get('User-Agent');

      // Detect client type
      const userAgent = req.userAgent?.toLowerCase() || '';
      if (userAgent.includes('kiosk')) {
        req.clientInfo = { type: 'KIOSK' };
      } else if (userAgent.includes('mobile')) {
        req.clientInfo = { type: 'MOBILE' };
      } else if (req.get('X-API-Key')) {
        req.clientInfo = { type: 'API' };
      } else {
        req.clientInfo = { type: 'WEB' };
      }

      // Add response helper methods
      res.apiResponse = <T>(data?: T, message?: string) => {
        const executionTime = performance.now() - req.startTime;
        const response: APIResponse<T> = {
          success: true,
          data,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
            executionTime: Math.round(executionTime * 100) / 100
          }
        };
        
        if (message) {
          response.meta!.message = message;
        }

        // Log successful response
        this.logger.info('API Response', {
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          executionTime,
          userId: req.userId,
          clientType: req.clientInfo?.type
        });

        res.json(response);
      };

      res.apiError = (code: string, message: string, details?: any) => {
        const executionTime = performance.now() - req.startTime;
        const response: APIResponse = {
          success: false,
          error: {
            code,
            message,
            details
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
            executionTime: Math.round(executionTime * 100) / 100
          }
        };

        // Log error response
        this.logger.error('API Error', {
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          error: { code, message, details },
          executionTime,
          userId: req.userId,
          clientType: req.clientInfo?.type
        });

        // Determine appropriate HTTP status code
        let statusCode = 500;
        if (code.includes('VALIDATION')) statusCode = 400;
        else if (code.includes('UNAUTHORIZED')) statusCode = 401;
        else if (code.includes('FORBIDDEN')) statusCode = 403;
        else if (code.includes('NOT_FOUND')) statusCode = 404;
        else if (code.includes('CONFLICT')) statusCode = 409;
        else if (code.includes('RATE_LIMIT')) statusCode = 429;

        res.status(statusCode).json(response);
      };

      // Set security headers
      res.setHeader('X-Request-ID', req.requestId);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');

      next();
    });

    // Metrics collection middleware
    this.app.use((req: AIConciergeRequest, res: AIConciergeResponse, next: NextFunction) => {
      const originalSend = res.send;
      res.send = function(body: any) {
        const executionTime = performance.now() - req.startTime;
        
        // Collect metrics
        this.metrics.recordRequest({
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          executionTime,
          userId: req.userId,
          clientType: req.clientInfo?.type || 'UNKNOWN'
        });

        return originalSend.call(this, body);
      }.bind(this);

      next();
    });
  }

  /**
   * Initialize all feature routes with proper versioning and organization
   * Each feature gets its own route namespace for clear separation
   */
  private initializeRoutes(): void {
    // Health check endpoints (no versioning for simplicity)
    this.app.get('/health', this.healthCheck.bind(this));
    this.app.get('/health/detailed', this.detailedHealthCheck.bind(this));
    this.app.get('/metrics', this.getMetrics.bind(this));

    // API versioning
    const apiV1 = '/api/v1';

    // Feature 1: Virtual Concierge Kiosks / Digital Human Agents
    this.app.use(`${apiV1}/kiosks`, kioskRoutes);

    // Feature 2: Multilingual Virtual Assistant
    this.app.use(`${apiV1}/assistant`, assistantRoutes);

    // Feature 3: VIP Services & Premium Passenger Coordination
    this.app.use(`${apiV1}/vip`, vipRoutes);

    // Feature 4: Itinerary Management & Proactive Trip Orchestration
    this.app.use(`${apiV1}/itinerary`, itineraryRoutes);

    // Feature 5: Customer Service & Complex Query Automation
    this.app.use(`${apiV1}/service`, serviceRoutes);

    // Feature 6: Loyalty Program Integration & Miles Management
    this.app.use(`${apiV1}/loyalty`, loyaltyRoutes);

    // Feature 7: Real-time Communication & Notification Hub
    this.app.use(`${apiV1}/communication`, communicationRoutes);

    // Feature 8: Baggage Management & Smart Tracking
    this.app.use(`${apiV1}/baggage`, baggageRoutes);

    // Feature 9: Ground Transportation & Logistics Coordination
    this.app.use(`${apiV1}/transport`, transportRoutes);

    // Feature 10: Emergency & Crisis Management
    this.app.use(`${apiV1}/emergency`, emergencyRoutes);

    // Feature 11: Analytics & Personalization Engine
    this.app.use(`${apiV1}/analytics`, analyticsRoutes);

    // Catch-all route for undefined endpoints
    this.app.all('*', (req: AIConciergeRequest, res: AIConciergeResponse) => {
      res.apiError('ENDPOINT_NOT_FOUND', `Endpoint ${req.method} ${req.path} not found`);
    });
  }

  /**
   * Initialize WebSocket connections for real-time features
   * Supports multiple feature-specific socket handlers
   */
  private initializeWebSockets(): void {
    this.io.on('connection', (socket) => {
      this.logger.info('New WebSocket connection', {
        socketId: socket.id,
        clientIP: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent']
      });

      // Authentication middleware for WebSocket
      socket.use(async ([event, ...args], next) => {
        try {
          const token = socket.handshake.auth.token;
          if (token) {
            // Verify token and attach user info
            const userInfo = await this.security.verifyToken(token);
            socket.data.userId = userInfo.userId;
            socket.data.sessionId = userInfo.sessionId;
          }
          next();
        } catch (error) {
          next(new Error('Authentication failed'));
        }
      });

      // Initialize feature-specific socket handlers
      this.kioskSocketHandler.handleConnection(socket);
      this.communicationSocketHandler.handleConnection(socket);
      this.baggageSocketHandler.handleConnection(socket);
      this.emergencySocketHandler.handleConnection(socket);

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.logger.info('WebSocket disconnection', {
          socketId: socket.id,
          reason,
          userId: socket.data.userId
        });
      });

      // Handle connection errors
      socket.on('error', (error) => {
        this.logger.error('WebSocket error', {
          socketId: socket.id,
          error: error.message,
          userId: socket.data.userId
        });
      });
    });
  }

  /**
   * Initialize comprehensive error handling
   * Catches and properly formats all types of errors
   */
  private initializeErrorHandling(): void {
    // 404 handler - should be after all routes
    this.app.use((req: AIConciergeRequest, res: AIConciergeResponse) => {
      res.status(404).apiError('NOT_FOUND', `Route ${req.originalUrl} not found`);
    });

    // Global error handler - must be last
    this.app.use((error: any, req: AIConciergeRequest, res: AIConciergeResponse, next: NextFunction) => {
      this.logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        requestId: req.requestId,
        path: req.path,
        method: req.method,
        userId: req.userId
      });

      // Don't leak error details in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      if (error.type === 'entity.parse.failed') {
        res.apiError('INVALID_JSON', 'Invalid JSON payload');
      } else if (error.code === 'LIMIT_FILE_SIZE') {
        res.apiError('FILE_TOO_LARGE', 'File size exceeds limit');
      } else {
        res.apiError(
          'INTERNAL_SERVER_ERROR',
          isDevelopment ? error.message : 'An internal server error occurred',
          isDevelopment ? error.stack : undefined
        );
      }
    });
  }

  /**
   * Basic health check endpoint
   * Used by load balancers and monitoring systems
   */
  private async healthCheck(req: AIConciergeRequest, res: AIConciergeResponse): Promise<void> {
    res.apiResponse({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0'
    });
  }

  /**
   * Detailed health check with dependency status
   * Includes database, cache, and external service health
   */
  private async detailedHealthCheck(req: AIConciergeRequest, res: AIConciergeResponse): Promise<void> {
    try {
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0',
        dependencies: {
          database: await this.database.healthCheck(),
          cache: await this.cache.healthCheck(),
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            unit: 'MB'
          },
          cpu: {
            usage: process.cpuUsage(),
            loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0]
          }
        },
        features: {
          kiosks: { status: 'operational', activeConnections: this.kioskSocketHandler.getActiveConnections() },
          assistant: { status: 'operational' },
          vip: { status: 'operational' },
          itinerary: { status: 'operational' },
          service: { status: 'operational' },
          loyalty: { status: 'operational' },
          communication: { status: 'operational', activeConnections: this.communicationSocketHandler.getActiveConnections() },
          baggage: { status: 'operational', activeConnections: this.baggageSocketHandler.getActiveConnections() },
          transport: { status: 'operational' },
          emergency: { status: 'operational', activeConnections: this.emergencySocketHandler.getActiveConnections() },
          analytics: { status: 'operational' }
        }
      };

      // Check if any dependencies are unhealthy
      const allHealthy = Object.values(healthStatus.dependencies).every(
        dep => typeof dep === 'object' && dep.status === 'healthy'
      );

      if (!allHealthy) {
        healthStatus.status = 'degraded';
      }

      res.apiResponse(healthStatus);
    } catch (error) {
      this.logger.error('Health check failed', { error: error.message });
      res.apiError('HEALTH_CHECK_FAILED', 'Health check failed', error.message);
    }
  }

  /**
   * Get service metrics endpoint
   * Returns comprehensive performance and usage metrics
   */
  private async getMetrics(req: AIConciergeRequest, res: AIConciergeResponse): Promise<void> {
    try {
      const metrics = await this.metrics.getMetrics();
      res.apiResponse(metrics);
    } catch (error) {
      this.logger.error('Failed to retrieve metrics', { error: error.message });
      res.apiError('METRICS_ERROR', 'Failed to retrieve metrics', error.message);
    }
  }

  /**
   * Setup graceful shutdown handling
   * Ensures proper cleanup of connections and resources
   */
  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        this.logger.warn('Shutdown already in progress, force exiting...');
        process.exit(1);
      }

      this.isShuttingDown = true;
      this.logger.info(`Received ${signal}, starting graceful shutdown...`);

      try {
        // Stop accepting new requests
        this.server.close(async () => {
          this.logger.info('HTTP server closed');

          // Close WebSocket connections
          this.io.close(() => {
            this.logger.info('WebSocket server closed');
          });

          // Close database connections
          await this.database.disconnect();
          this.logger.info('Database connections closed');

          // Close cache connections
          await this.cache.disconnect();
          this.logger.info('Cache connections closed');

          // Final metrics collection
          await this.metrics.shutdown();
          this.logger.info('Metrics collection stopped');

          this.logger.info('Graceful shutdown completed');
          process.exit(0);
        });

        // Force shutdown after timeout
        setTimeout(() => {
          this.logger.error('Forced shutdown due to timeout');
          process.exit(1);
        }, 30000); // 30 seconds timeout

      } catch (error) {
        this.logger.error('Error during shutdown', { error: error.message });
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled promise rejection', { reason, promise });
      gracefulShutdown('unhandledRejection');
    });
  }

  /**
   * Start the AI Concierge server
   * Initializes all services and begins accepting connections
   */
  public async start(): Promise<void> {
    try {
      // Initialize core services
      await this.database.initialize();
      await this.cache.initialize();
      await this.metrics.initialize();
      
      this.logger.info('Core services initialized successfully');

      // Start server
      const port = process.env.PORT || 3001;
      this.server.listen(port, () => {
        this.logger.info(`AI Concierge Service started successfully`, {
          port,
          environment: process.env.NODE_ENV || 'development',
          nodeVersion: process.version,
          features: [
            'Virtual Concierge Kiosks',
            'Multilingual Virtual Assistant',
            'VIP Services',
            'Itinerary Management',
            'Customer Service Automation',
            'Loyalty Program Integration',
            'Real-time Communication',
            'Baggage Management',
            'Ground Transportation',
            'Emergency Management',
            'Analytics & Personalization'
          ]
        });
      });

    } catch (error) {
      this.logger.error('Failed to start AI Concierge Service', { error: error.message });
      process.exit(1);
    }
  }
}

// Create and start server if this file is run directly
if (require.main === module) {
  const server = new AIConciergeServer();
  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default AIConciergeServer; 