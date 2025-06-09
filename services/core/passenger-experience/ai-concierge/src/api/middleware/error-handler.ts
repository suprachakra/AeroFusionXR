/**
 * @fileoverview Enterprise Error Handling Middleware
 * @version 1.0.0
 * @author AeroFusionXR Engineering Team
 * 
 * Provides centralized error handling with standardized responses,
 * proper logging, and error categorization for enterprise applications.
 */

import { Request, Response, NextFunction } from 'express';
import winston from 'winston';

/**
 * Standard API Response Interface
 */
export interface StandardApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    statusCode: number;
    details?: unknown[];
    stack?: string;
  };
  meta: {
    timestamp: string;
    requestId: string;
    correlationId?: string;
    version: string;
  };
}

/**
 * Error context extraction interface
 */
export interface ErrorContext {
  requestId: string;
  correlationId?: string;
  userId?: string;
  userAgent?: string;
  ip?: string;
  endpoint: string;
  method: string;
  timestamp: string;
}

/**
 * Enterprise Error Handler Class
 */
export class ErrorHandler {
  private logger: winston.Logger;
  private isDevelopment: boolean;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  /**
   * Express error handling middleware
   */
  public handleError = (
    error: any,
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const context = this.extractContext(req);
    const standardizedError = this.standardizeError(error, context);

    // Log the error
    this.logError(error, context);

    // Send response
    res.status(standardizedError.error!.statusCode).json(standardizedError);
  };

  /**
   * Async error wrapper for route handlers
   */
  public asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };

  /**
   * Not found handler
   */
  public handleNotFound = (req: Request, res: Response): void => {
    const context = this.extractContext(req);
    
    const notFoundResponse: StandardApiResponse = {
      success: false,
      error: {
        code: 'ENDPOINT_NOT_FOUND',
        message: `Endpoint ${req.method} ${req.originalUrl} not found`,
        statusCode: 404,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: context.requestId,
        correlationId: context.correlationId,
        version: process.env.APP_VERSION || '1.0.0',
      },
    };

    this.logger.warn('Endpoint not found', {
      ...context,
      statusCode: 404,
    });

    res.status(404).json(notFoundResponse);
  };

  /**
   * Extract error context from request
   */
  private extractContext(req: Request): ErrorContext {
    return {
      requestId: req.headers['x-request-id'] as string || this.generateRequestId(),
      correlationId: req.headers['x-correlation-id'] as string,
      userId: (req as any).user?.id,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      endpoint: req.originalUrl || req.url,
      method: req.method,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Standardize error into consistent format
   */
  private standardizeError(error: any, context: ErrorContext): StandardApiResponse {
    // Handle operational app errors
    if (error.isOperational && error.statusCode) {
      return {
        success: false,
        error: {
          code: error.errorCode || error.code || 'APPLICATION_ERROR',
          message: error.message,
          statusCode: error.statusCode,
          details: error.details || undefined,
          stack: this.isDevelopment ? error.stack : undefined,
        },
        meta: {
          timestamp: context.timestamp,
          requestId: context.requestId,
          correlationId: context.correlationId,
          version: process.env.APP_VERSION || '1.0.0',
        },
      };
    }

    // Handle validation errors (Joi, express-validator, etc.)
    if (error.name === 'ValidationError' || error.isJoi) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input validation failed',
          statusCode: 400,
          details: this.extractValidationDetails(error),
          stack: this.isDevelopment ? error.stack : undefined,
        },
        meta: {
          timestamp: context.timestamp,
          requestId: context.requestId,
          correlationId: context.correlationId,
          version: process.env.APP_VERSION || '1.0.0',
        },
      };
    }

    // Handle JWT errors
    if (error.name === 'JsonWebTokenError') {
      return {
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token',
          statusCode: 401,
          stack: this.isDevelopment ? error.stack : undefined,
        },
        meta: {
          timestamp: context.timestamp,
          requestId: context.requestId,
          correlationId: context.correlationId,
          version: process.env.APP_VERSION || '1.0.0',
        },
      };
    }

    // Handle MongoDB/Mongoose errors
    if (error.name === 'MongoError' || error.name === 'MongooseError') {
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: this.isDevelopment ? error.message : 'Database operation failed',
          statusCode: 500,
          stack: this.isDevelopment ? error.stack : undefined,
        },
        meta: {
          timestamp: context.timestamp,
          requestId: context.requestId,
          correlationId: context.correlationId,
          version: process.env.APP_VERSION || '1.0.0',
        },
      };
    }

    // Handle HTTP errors from axios or similar
    if (error.response && error.response.status) {
      return {
        success: false,
        error: {
          code: 'EXTERNAL_SERVICE_ERROR',
          message: 'External service request failed',
          statusCode: error.response.status >= 500 ? 502 : 400,
          details: this.isDevelopment ? error.response.data : undefined,
          stack: this.isDevelopment ? error.stack : undefined,
        },
        meta: {
          timestamp: context.timestamp,
          requestId: context.requestId,
          correlationId: context.correlationId,
          version: process.env.APP_VERSION || '1.0.0',
        },
      };
    }

    // Handle syntax errors (malformed JSON, etc.)
    if (error instanceof SyntaxError && 'body' in error) {
      return {
        success: false,
        error: {
          code: 'INVALID_REQUEST_FORMAT',
          message: 'Invalid request format',
          statusCode: 400,
          stack: this.isDevelopment ? error.stack : undefined,
        },
        meta: {
          timestamp: context.timestamp,
          requestId: context.requestId,
          correlationId: context.correlationId,
          version: process.env.APP_VERSION || '1.0.0',
        },
      };
    }

    // Default internal server error
    return {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: this.isDevelopment ? error.message : 'An unexpected error occurred',
        statusCode: 500,
        stack: this.isDevelopment ? error.stack : undefined,
      },
      meta: {
        timestamp: context.timestamp,
        requestId: context.requestId,
        correlationId: context.correlationId,
        version: process.env.APP_VERSION || '1.0.0',
      },
    };
  }

  /**
   * Extract validation error details
   */
  private extractValidationDetails(error: any): unknown[] {
    if (error.details && Array.isArray(error.details)) {
      // Joi validation errors
      return error.details.map((detail: any) => ({
        field: detail.path?.join('.'),
        value: detail.value,
        message: detail.message,
        constraint: detail.type,
      }));
    }

    if (error.errors) {
      // Mongoose validation errors
      if (Array.isArray(error.errors)) {
        return error.errors.map((err: any) => ({
          field: err.path,
          value: err.value,
          message: err.message,
          constraint: err.kind,
        }));
      }

      // Express-validator errors
      if (typeof error.errors === 'object') {
        return Object.keys(error.errors).map(field => ({
          field,
          value: error.errors[field].value,
          message: error.errors[field].message || error.errors[field].msg,
          constraint: error.errors[field].kind,
        }));
      }
    }

    return [];
  }

  /**
   * Log error with appropriate level and context
   */
  private logError(error: any, context: ErrorContext): void {
    const logData = {
      ...context,
      errorName: error.name,
      errorMessage: error.message,
      errorCode: error.code || error.errorCode,
      statusCode: error.statusCode || 500,
      stack: error.stack,
      isOperational: error.isOperational || false,
    };

    // Determine log level based on error type
    if (error.statusCode && error.statusCode < 500) {
      // Client errors (4xx) - log as warnings
      this.logger.warn('Client error occurred', logData);
    } else if (error.isOperational) {
      // Operational errors - log as errors but not critical
      this.logger.error('Operational error occurred', logData);
    } else {
      // Unexpected errors - log as critical
      this.logger.error('Unexpected error occurred', {
        ...logData,
        critical: true,
        alert: true,
      });
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Success response helper
   */
  public static successResponse<T>(
    data: T,
    message?: string,
    meta?: Partial<StandardApiResponse['meta']>
  ): StandardApiResponse<T> {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: meta?.requestId || `req_${Date.now()}`,
        correlationId: meta?.correlationId,
        version: process.env.APP_VERSION || '1.0.0',
        ...meta,
      },
    };
  }

  /**
   * Pagination response helper
   */
  public static paginatedResponse<T>(
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    },
    meta?: Partial<StandardApiResponse['meta']>
  ): StandardApiResponse<{
    items: T[];
    pagination: typeof pagination;
  }> {
    return {
      success: true,
      data: {
        items: data,
        pagination,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: meta?.requestId || `req_${Date.now()}`,
        correlationId: meta?.correlationId,
        version: process.env.APP_VERSION || '1.0.0',
        ...meta,
      },
    };
  }
}

/**
 * Create error handler instance
 */
export function createErrorHandler(logger: winston.Logger): ErrorHandler {
  return new ErrorHandler(logger);
}

/**
 * Unhandled promise rejection handler
 */
export function handleUnhandledRejection(logger: winston.Logger): void {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString(),
      critical: true,
      alert: true,
    });

    // Graceful shutdown in production
    if (process.env.NODE_ENV === 'production') {
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    }
  });
}

/**
 * Uncaught exception handler
 */
export function handleUncaughtException(logger: winston.Logger): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
      critical: true,
      alert: true,
    });

    // Force exit - application is in unknown state
    process.exit(1);
  });
} 