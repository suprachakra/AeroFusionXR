/**
 * @fileoverview Enterprise Error Handling Framework
 * @version 1.0.0
 * @author AeroFusionXR Engineering Team
 * 
 * Provides standardized error handling with proper HTTP status codes,
 * error categorization, and structured error responses for enterprise applications.
 */

export enum ErrorCode {
  // Validation Errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST_FORMAT = 'INVALID_REQUEST_FORMAT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_VALUE = 'INVALID_FIELD_VALUE',

  // Authentication Errors (401)
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN',
  MISSING_CREDENTIALS = 'MISSING_CREDENTIALS',

  // Authorization Errors (403)
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  ACCESS_DENIED = 'ACCESS_DENIED',
  RESOURCE_FORBIDDEN = 'RESOURCE_FORBIDDEN',

  // Not Found Errors (404)
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  ENDPOINT_NOT_FOUND = 'ENDPOINT_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  BOOKING_NOT_FOUND = 'BOOKING_NOT_FOUND',

  // Conflict Errors (409)
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION',

  // Business Logic Errors (422)
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // Server Errors (500)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',

  // Service Unavailable (503)
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  MAINTENANCE_MODE = 'MAINTENANCE_MODE',
  DEPENDENCY_UNAVAILABLE = 'DEPENDENCY_UNAVAILABLE',
}

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  correlationId?: string;
  userAgent?: string;
  ip?: string;
  endpoint?: string;
  method?: string;
  timestamp?: string;
  additionalData?: Record<string, unknown>;
}

export interface ErrorDetails {
  field?: string;
  value?: unknown;
  constraint?: string;
  message?: string;
}

/**
 * Base class for all application errors
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorCode: ErrorCode;
  abstract readonly isOperational: boolean;

  public readonly context: ErrorContext;
  public readonly details: ErrorDetails[];
  public readonly timestamp: string;

  constructor(
    message: string,
    context: ErrorContext = {},
    details: ErrorDetails[] = []
  ) {
    super(message);
    this.name = this.constructor.name;
    this.context = {
      ...context,
      timestamp: new Date().toISOString(),
    };
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Capture stack trace if available
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON response format
   */
  public toJSON(): object {
    return {
      success: false,
      error: {
        code: this.errorCode,
        message: this.message,
        statusCode: this.statusCode,
        details: this.details.length > 0 ? this.details : undefined,
      },
      meta: {
        timestamp: this.timestamp,
        requestId: this.context.requestId,
        correlationId: this.context.correlationId,
      },
    };
  }
}

/**
 * Validation Error (400)
 */
export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly errorCode = ErrorCode.VALIDATION_ERROR;
  readonly isOperational = true;

  constructor(
    message: string = 'Validation failed',
    context: ErrorContext = {},
    details: ErrorDetails[] = []
  ) {
    super(message, context, details);
  }

  static requiredField(field: string, context: ErrorContext = {}): ValidationError {
    return new ValidationError(
      `Required field '${field}' is missing`,
      context,
      [{ field, constraint: 'required', message: 'This field is required' }]
    );
  }

  static invalidValue(field: string, value: unknown, constraint: string, context: ErrorContext = {}): ValidationError {
    return new ValidationError(
      `Invalid value for field '${field}'`,
      context,
      [{ field, value, constraint, message: `Value does not meet constraint: ${constraint}` }]
    );
  }
}

/**
 * Authentication Error (401)
 */
export class AuthenticationError extends AppError {
  readonly statusCode = 401;
  readonly errorCode = ErrorCode.AUTHENTICATION_FAILED;
  readonly isOperational = true;

  constructor(
    message: string = 'Authentication failed',
    context: ErrorContext = {},
    details: ErrorDetails[] = []
  ) {
    super(message, context, details);
  }

  static invalidToken(context: ErrorContext = {}): AuthenticationError {
    return new AuthenticationError('Invalid or malformed token', context);
  }

  static expiredToken(context: ErrorContext = {}): AuthenticationError {
    return new AuthenticationError('Token has expired', context);
  }

  static missingCredentials(context: ErrorContext = {}): AuthenticationError {
    return new AuthenticationError('Missing authentication credentials', context);
  }
}

/**
 * Authorization Error (403)
 */
export class AuthorizationError extends AppError {
  readonly statusCode = 403;
  readonly errorCode = ErrorCode.INSUFFICIENT_PERMISSIONS;
  readonly isOperational = true;

  constructor(
    message: string = 'Insufficient permissions',
    context: ErrorContext = {},
    details: ErrorDetails[] = []
  ) {
    super(message, context, details);
  }

  static accessDenied(resource: string, action: string, context: ErrorContext = {}): AuthorizationError {
    return new AuthorizationError(
      `Access denied to ${action} ${resource}`,
      context,
      [{ field: 'resource', value: resource, constraint: action }]
    );
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly errorCode = ErrorCode.RESOURCE_NOT_FOUND;
  readonly isOperational = true;

  constructor(
    message: string = 'Resource not found',
    context: ErrorContext = {},
    details: ErrorDetails[] = []
  ) {
    super(message, context, details);
  }

  static resource(type: string, id: string, context: ErrorContext = {}): NotFoundError {
    return new NotFoundError(
      `${type} with ID '${id}' not found`,
      context,
      [{ field: 'id', value: id, constraint: 'exists' }]
    );
  }

  static endpoint(path: string, method: string, context: ErrorContext = {}): NotFoundError {
    return new NotFoundError(
      `Endpoint ${method} ${path} not found`,
      context,
      [{ field: 'endpoint', value: `${method} ${path}` }]
    );
  }
}

/**
 * Conflict Error (409)
 */
export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly errorCode = ErrorCode.RESOURCE_ALREADY_EXISTS;
  readonly isOperational = true;

  constructor(
    message: string = 'Resource conflict',
    context: ErrorContext = {},
    details: ErrorDetails[] = []
  ) {
    super(message, context, details);
  }

  static duplicateEntry(field: string, value: unknown, context: ErrorContext = {}): ConflictError {
    return new ConflictError(
      `Duplicate value for field '${field}'`,
      context,
      [{ field, value, constraint: 'unique' }]
    );
  }
}

/**
 * Business Logic Error (422)
 */
export class BusinessRuleError extends AppError {
  readonly statusCode = 422;
  readonly errorCode = ErrorCode.BUSINESS_RULE_VIOLATION;
  readonly isOperational = true;

  constructor(
    message: string = 'Business rule violation',
    context: ErrorContext = {},
    details: ErrorDetails[] = []
  ) {
    super(message, context, details);
  }

  static invalidStateTransition(
    from: string, 
    to: string, 
    context: ErrorContext = {}
  ): BusinessRuleError {
    return new BusinessRuleError(
      `Invalid state transition from '${from}' to '${to}'`,
      context,
      [{ field: 'state', value: { from, to }, constraint: 'valid_transition' }]
    );
  }

  static quotaExceeded(resource: string, limit: number, context: ErrorContext = {}): BusinessRuleError {
    return new BusinessRuleError(
      `Quota exceeded for ${resource}. Limit: ${limit}`,
      context,
      [{ field: 'quota', value: limit, constraint: 'limit' }]
    );
  }
}

/**
 * Rate Limit Error (429)
 */
export class RateLimitError extends AppError {
  readonly statusCode = 429;
  readonly errorCode = ErrorCode.RATE_LIMIT_EXCEEDED;
  readonly isOperational = true;

  constructor(
    message: string = 'Rate limit exceeded',
    context: ErrorContext = {},
    details: ErrorDetails[] = []
  ) {
    super(message, context, details);
  }

  static tooManyRequests(
    limit: number, 
    window: string, 
    retryAfter?: number, 
    context: ErrorContext = {}
  ): RateLimitError {
    return new RateLimitError(
      `Too many requests. Limit: ${limit} per ${window}${retryAfter ? `. Retry after ${retryAfter} seconds` : ''}`,
      context,
      [{ 
        field: 'rate_limit', 
        value: { limit, window, retryAfter }, 
        constraint: 'rate_limit' 
      }]
    );
  }
}

/**
 * Internal Server Error (500)
 */
export class InternalServerError extends AppError {
  readonly statusCode = 500;
  readonly errorCode = ErrorCode.INTERNAL_SERVER_ERROR;
  readonly isOperational = false;

  constructor(
    message: string = 'Internal server error',
    context: ErrorContext = {},
    details: ErrorDetails[] = []
  ) {
    super(message, context, details);
  }

  static database(operation: string, context: ErrorContext = {}): InternalServerError {
    return new InternalServerError(
      `Database operation failed: ${operation}`,
      context,
      [{ field: 'operation', value: operation, constraint: 'database_error' }]
    );
  }

  static externalService(service: string, context: ErrorContext = {}): InternalServerError {
    return new InternalServerError(
      `External service error: ${service}`,
      context,
      [{ field: 'service', value: service, constraint: 'external_service_error' }]
    );
  }
}

/**
 * Service Unavailable Error (503)
 */
export class ServiceUnavailableError extends AppError {
  readonly statusCode = 503;
  readonly errorCode = ErrorCode.SERVICE_UNAVAILABLE;
  readonly isOperational = true;

  constructor(
    message: string = 'Service temporarily unavailable',
    context: ErrorContext = {},
    details: ErrorDetails[] = []
  ) {
    super(message, context, details);
  }

  static maintenance(estimatedDuration?: string, context: ErrorContext = {}): ServiceUnavailableError {
    const message = estimatedDuration 
      ? `Service under maintenance. Estimated duration: ${estimatedDuration}`
      : 'Service under maintenance';
    
    return new ServiceUnavailableError(
      message,
      context,
      estimatedDuration ? [{ field: 'maintenance', value: estimatedDuration }] : []
    );
  }

  static dependencyUnavailable(dependency: string, context: ErrorContext = {}): ServiceUnavailableError {
    return new ServiceUnavailableError(
      `Required dependency unavailable: ${dependency}`,
      context,
      [{ field: 'dependency', value: dependency, constraint: 'unavailable' }]
    );
  }
}

/**
 * Error utility functions
 */
export class ErrorUtils {
  /**
   * Check if error is operational (expected and can be handled gracefully)
   */
  static isOperationalError(error: unknown): boolean {
    if (error instanceof AppError) {
      return error.isOperational;
    }
    return false;
  }

  /**
   * Extract error context from request
   */
  static extractContext(req: any): ErrorContext {
    return {
      requestId: req.headers['x-request-id'] || req.id,
      correlationId: req.headers['x-correlation-id'],
      userId: req.user?.id,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection?.remoteAddress,
      endpoint: req.originalUrl || req.url,
      method: req.method,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Sanitize error for logging (remove sensitive data)
   */
  static sanitizeForLogging(error: AppError): object {
    const sanitized = { ...error.toJSON() };
    
    // Remove potentially sensitive data
    if (sanitized.error?.details) {
      sanitized.error.details = (sanitized.error.details as ErrorDetails[]).map(detail => ({
        ...detail,
        value: detail.field?.toLowerCase().includes('password') ? '[REDACTED]' : detail.value,
      }));
    }

    return sanitized;
  }
}

// Export all error types for easy importing
export {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  RateLimitError,
  InternalServerError,
  ServiceUnavailableError,
}; 