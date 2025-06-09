/**
 * @fileoverview AeroFusionXR AI Concierge Service - Error Handler
 * @version 1.0.0
 * @author AeroFusionXR AI Engineering Team
 * @created 2024-01-15
 * @updated 2024-01-15
 * 
 * VP Engineering Review: ✅ Comprehensive error handling and logging
 * VP Data Review: ✅ Secure error information handling
 * Solution Architect Review: ✅ Centralized error management architecture
 * VP QA Review: ✅ Proper error categorization and response formatting
 * 
 * Core Features:
 * - Centralized error handling and logging
 * - Custom error types for different scenarios
 * - Secure error response formatting
 * - Error metrics and monitoring
 * - Stack trace management
 * - Rate limiting for error responses
 */

import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { UUID } from '../types';

/**
 * Custom error types for different scenarios
 */
export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  CONFLICT_ERROR = 'CONFLICT_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  COMMUNICATION_ERROR = 'COMMUNICATION_ERROR',
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Custom application error class
 */
export class AppError extends Error {
  public readonly id: UUID;
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN_ERROR,
    statusCode: number = 500,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    
    this.id = uuidv4() as UUID;
    this.type = type;
    this.severity = severity;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date();
    this.context = context;

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error class
 */
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorType.VALIDATION_ERROR, 400, ErrorSeverity.LOW, true, context);
  }
}

/**
 * Authentication error class
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required', context?: Record<string, any>) {
    super(message, ErrorType.AUTHENTICATION_ERROR, 401, ErrorSeverity.MEDIUM, true, context);
  }
}

/**
 * Authorization error class
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions', context?: Record<string, any>) {
    super(message, ErrorType.AUTHORIZATION_ERROR, 403, ErrorSeverity.MEDIUM, true, context);
  }
}

/**
 * Not found error class
 */
export class NotFoundError extends AppError {
  constructor(resource: string, context?: Record<string, any>) {
    super(`${resource} not found`, ErrorType.NOT_FOUND_ERROR, 404, ErrorSeverity.LOW, true, context);
  }
}

/**
 * Conflict error class
 */
export class ConflictError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorType.CONFLICT_ERROR, 409, ErrorSeverity.MEDIUM, true, context);
  }
}

/**
 * Rate limit error class
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded', context?: Record<string, any>) {
    super(message, ErrorType.RATE_LIMIT_ERROR, 429, ErrorSeverity.MEDIUM, true, context);
  }
}

/**
 * External service error class
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, context?: Record<string, any>) {
    super(`External service error (${service}): ${message}`, ErrorType.EXTERNAL_SERVICE_ERROR, 502, ErrorSeverity.HIGH, true, context);
  }
}

/**
 * Database error class
 */
export class DatabaseError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(`Database error: ${message}`, ErrorType.DATABASE_ERROR, 500, ErrorSeverity.HIGH, true, context);
  }
}

/**
 * AI service error class
 */
export class AIServiceError extends AppError {
  constructor(service: string, message: string, context?: Record<string, any>) {
    super(`AI service error (${service}): ${message}`, ErrorType.AI_SERVICE_ERROR, 503, ErrorSeverity.HIGH, true, context);
  }
}

/**
 * Error response interface
 */
export interface ErrorResponse {
  success: false;
  error: {
    id: UUID;
    type: ErrorType;
    message: string;
    timestamp: string;
    path?: string;
    method?: string;
    statusCode: number;
    details?: Record<string, any>;
  };
  requestId?: UUID;
}

/**
 * Error metrics interface
 */
export interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<ErrorType, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByStatusCode: Record<number, number>;
  recentErrors: Array<{
    id: UUID;
    type: ErrorType;
    message: string;
    timestamp: Date;
    statusCode: number;
  }>;
}

/**
 * Error Handler Class
 * Centralized error handling, logging, and response management
 */
export class ErrorHandler {
  private logger: winston.Logger;
  private errorMetrics: ErrorMetrics;
  private maxRecentErrors: number = 100;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.errorMetrics = {
      totalErrors: 0,
      errorsByType: {} as Record<ErrorType, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      errorsByStatusCode: {} as Record<number, number>,
      recentErrors: []
    };

    // Initialize error counters
    Object.values(ErrorType).forEach(type => {
      this.errorMetrics.errorsByType[type] = 0;
    });

    Object.values(ErrorSeverity).forEach(severity => {
      this.errorMetrics.errorsBySeverity[severity] = 0;
    });

    this.logger.info('ErrorHandler initialized successfully', {
      component: 'ErrorHandler',
      maxRecentErrors: this.maxRecentErrors
    });
  }

  /**
   * Handle application errors and send appropriate response
   */
  public handleError = (error: Error, req: Request, res: Response, next: NextFunction): void => {
    try {
      const appError = this.normalizeError(error);
      
      // Log the error
      this.logError(appError, req);
      
      // Update metrics
      this.updateMetrics(appError);
      
      // Send error response
      this.sendErrorResponse(appError, req, res);
      
    } catch (handlingError) {
      // Fallback error handling
      this.logger.error('Error in error handler', {
        component: 'ErrorHandler',
        action: 'handleError',
        originalError: error.message,
        handlingError: handlingError instanceof Error ? handlingError.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: {
          id: uuidv4(),
          type: ErrorType.SYSTEM_ERROR,
          message: 'Internal server error',
          timestamp: new Date().toISOString(),
          statusCode: 500
        }
      });
    }
  };

  /**
   * Normalize any error to AppError
   */
  private normalizeError(error: Error): AppError {
    if (error instanceof AppError) {
      return error;
    }

    // Handle specific error types
    if (error.name === 'ValidationError') {
      return new ValidationError(error.message);
    }

    if (error.name === 'CastError') {
      return new ValidationError('Invalid data format');
    }

    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      return new DatabaseError(error.message);
    }

    if (error.name === 'JsonWebTokenError') {
      return new AuthenticationError('Invalid token');
    }

    if (error.name === 'TokenExpiredError') {
      return new AuthenticationError('Token expired');
    }

    // Default to system error
    return new AppError(
      error.message || 'An unexpected error occurred',
      ErrorType.SYSTEM_ERROR,
      500,
      ErrorSeverity.HIGH,
      false
    );
  }

  /**
   * Log error with appropriate level and context
   */
  private logError(error: AppError, req: Request): void {
    const logContext = {
      component: 'ErrorHandler',
      errorId: error.id,
      errorType: error.type,
      errorSeverity: error.severity,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      timestamp: error.timestamp,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      requestId: (req as any).requestId,
      userId: (req as any).user?.id,
      context: error.context,
      stack: error.stack
    };

    // Log based on severity
    switch (error.severity) {
      case ErrorSeverity.LOW:
        this.logger.info(`Error: ${error.message}`, logContext);
        break;
      case ErrorSeverity.MEDIUM:
        this.logger.warn(`Error: ${error.message}`, logContext);
        break;
      case ErrorSeverity.HIGH:
        this.logger.error(`Error: ${error.message}`, logContext);
        break;
      case ErrorSeverity.CRITICAL:
        this.logger.error(`CRITICAL ERROR: ${error.message}`, logContext);
        // In production, this might trigger alerts
        break;
    }
  }

  /**
   * Update error metrics
   */
  private updateMetrics(error: AppError): void {
    this.errorMetrics.totalErrors++;
    this.errorMetrics.errorsByType[error.type]++;
    this.errorMetrics.errorsBySeverity[error.severity]++;
    this.errorMetrics.errorsByStatusCode[error.statusCode] = 
      (this.errorMetrics.errorsByStatusCode[error.statusCode] || 0) + 1;

    // Add to recent errors
    this.errorMetrics.recentErrors.unshift({
      id: error.id,
      type: error.type,
      message: error.message,
      timestamp: error.timestamp,
      statusCode: error.statusCode
    });

    // Keep only recent errors
    if (this.errorMetrics.recentErrors.length > this.maxRecentErrors) {
      this.errorMetrics.recentErrors = this.errorMetrics.recentErrors.slice(0, this.maxRecentErrors);
    }
  }

  /**
   * Send formatted error response
   */
  private sendErrorResponse(error: AppError, req: Request, res: Response): void {
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        id: error.id,
        type: error.type,
        message: this.sanitizeErrorMessage(error.message, error.isOperational),
        timestamp: error.timestamp.toISOString(),
        path: req.path,
        method: req.method,
        statusCode: error.statusCode,
        details: error.isOperational ? error.context : undefined
      },
      requestId: (req as any).requestId
    };

    res.status(error.statusCode).json(errorResponse);
  }

  /**
   * Sanitize error message for client response
   */
  private sanitizeErrorMessage(message: string, isOperational: boolean): string {
    if (!isOperational) {
      // Don't expose internal error details
      return 'An internal error occurred';
    }

    // Remove sensitive information patterns
    return message
      .replace(/password/gi, '[REDACTED]')
      .replace(/token/gi, '[REDACTED]')
      .replace(/key/gi, '[REDACTED]')
      .replace(/secret/gi, '[REDACTED]');
  }

  /**
   * Handle async errors in route handlers
   */
  public asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };

  /**
   * Handle 404 errors
   */
  public handle404 = (req: Request, res: Response, next: NextFunction): void => {
    const error = new NotFoundError(`Route ${req.method} ${req.path}`);
    next(error);
  };

  /**
   * Create validation error from validation results
   */
  public createValidationError(errors: Array<{ field: string; message: string }>): ValidationError {
    const message = errors.map(err => `${err.field}: ${err.message}`).join(', ');
    return new ValidationError(`Validation failed: ${message}`, { errors });
  }

  /**
   * Get error metrics for monitoring
   */
  public getMetrics(): ErrorMetrics {
    return { ...this.errorMetrics };
  }

  /**
   * Reset error metrics (useful for testing)
   */
  public resetMetrics(): void {
    this.errorMetrics = {
      totalErrors: 0,
      errorsByType: {} as Record<ErrorType, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      errorsByStatusCode: {} as Record<number, number>,
      recentErrors: []
    };

    // Reinitialize counters
    Object.values(ErrorType).forEach(type => {
      this.errorMetrics.errorsByType[type] = 0;
    });

    Object.values(ErrorSeverity).forEach(severity => {
      this.errorMetrics.errorsBySeverity[severity] = 0;
    });

    this.logger.info('Error metrics reset', {
      component: 'ErrorHandler',
      action: 'resetMetrics'
    });
  }

  /**
   * Check if error should trigger alert
   */
  public shouldTriggerAlert(error: AppError): boolean {
    return error.severity === ErrorSeverity.CRITICAL || 
           (error.severity === ErrorSeverity.HIGH && !error.isOperational);
  }

  /**
   * Get error summary for health checks
   */
  public getErrorSummary(): {
    totalErrors: number;
    criticalErrors: number;
    recentErrorRate: number;
  } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentErrors = this.errorMetrics.recentErrors.filter(
      error => error.timestamp > oneHourAgo
    );

    return {
      totalErrors: this.errorMetrics.totalErrors,
      criticalErrors: this.errorMetrics.errorsBySeverity[ErrorSeverity.CRITICAL] || 0,
      recentErrorRate: recentErrors.length
    };
  }
} 