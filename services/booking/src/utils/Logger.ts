/**
 * Logger Utility for Booking Service
 * ==================================
 * 
 * Winston-based structured logging with multiple transports and formats.
 */

import { createLogger, format, transports, Logger as WinstonLogger } from 'winston';
import { metrics } from './metrics';

interface LogMeta {
  [key: string]: any;
}

interface RequestWithHeaders {
  method: string;
  url: string;
  get(header: string): string | undefined;
}

interface ResponseWithEvents {
  statusCode: number;
  on(event: string, callback: () => void): void;
}

export class Logger {
  private logger: WinstonLogger;
  private serviceName: string;

  constructor(serviceName: string = 'booking-service') {
    this.serviceName = serviceName;
    this.logger = createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json(),
        format.printf(({ timestamp, level, message, service, ...meta }) => {
          return JSON.stringify({
            timestamp,
            level,
            service: service || this.serviceName,
            message,
            ...meta
          });
        })
      ),
      defaultMeta: {
        service: this.serviceName
      },
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple()
          )
        })
      ]
    });

    // Add file transport in production
    if (process.env.NODE_ENV === 'production') {
      this.logger.add(new transports.File({
        filename: 'logs/error.log',
        level: 'error'
      }));
      
      this.logger.add(new transports.File({
        filename: 'logs/combined.log'
      }));
    }

    // Add error tracking
    this.logger.on('error', (error: Error) => {
      metrics.increment('logger_errors', { error: error.message });
    });
  }

  public info(message: string, meta?: any): void {
    this.logger.info(message, meta);
    metrics.increment('log_events', { level: 'info' });
  }

  public warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
    metrics.increment('log_events', { level: 'warn' });
  }

  public error(message: string, error?: Error | any): void {
    this.logger.error(message, { error: error?.message || error, stack: error?.stack });
    metrics.increment('log_events', { level: 'error' });
  }

  public debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
    metrics.increment('log_events', { level: 'debug' });
  }

  public child(defaultMeta: LogMeta): Logger {
    const childLogger = new Logger();
    childLogger.logger.defaultMeta = {
      ...childLogger.logger.defaultMeta,
      ...defaultMeta
    };
    return childLogger;
  }

  public createRequestLogger() {
    return (req: any, res: any, next: any) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.info('HTTP Request', {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      });
      
      next();
    };
  }

  public createErrorLogger() {
    return (err: Error, req: any, res: any, next: any) => {
      this.error('HTTP Error', {
        error: err.message,
        stack: err.stack,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      
      next(err);
    };
  }

  // Add structured logging helpers
  public logBookingEvent(bookingId: string, eventType: string, success: boolean): void {
    this.info('Booking event processed', {
      component: 'bookings',
      bookingId,
      eventType,
      success,
    });
  }

  public logPaymentEvent(bookingId: string, paymentStatus: string, amount: number): void {
    this.info('Payment event processed', {
      component: 'payments',
      bookingId,
      paymentStatus,
      amount,
    });
  }

  public logFlightSearch(criteria: Record<string, any>, resultsCount: number): void {
    this.debug('Flight search completed', {
      component: 'search',
      criteria,
      resultsCount,
    });
  }
} 