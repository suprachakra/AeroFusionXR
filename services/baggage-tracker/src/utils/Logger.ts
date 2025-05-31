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

  constructor() {
    this.logger = createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      ),
      defaultMeta: {
        service: 'baggage-tracker',
        version: process.env.SERVICE_VERSION || 'unknown'
      },
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.printf(({ timestamp, level, message, ...meta }: {
              timestamp: string;
              level: string;
              message: string;
              [key: string]: any;
            }) => {
              return `${timestamp} ${level}: ${message} ${JSON.stringify(meta)}`;
            })
          )
        })
      ]
    });

    // Add error tracking
    this.logger.on('error', (error: Error) => {
      metrics.increment('logger_errors', { error: error.message });
    });
  }

  public info(message: string, meta?: LogMeta): void {
    this.logger.info(message, meta);
    metrics.increment('log_events', { level: 'info' });
  }

  public warn(message: string, meta?: LogMeta): void {
    this.logger.warn(message, meta);
    metrics.increment('log_events', { level: 'warn' });
  }

  public error(message: string, error?: Error | unknown, meta?: LogMeta): void {
    const errorMeta = error instanceof Error ? {
      error: {
        message: error.message,
        stack: error.stack,
        ...meta
      }
    } : meta;

    this.logger.error(message, errorMeta);
    metrics.increment('log_events', { level: 'error' });
  }

  public debug(message: string, meta?: LogMeta): void {
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
    return (req: RequestWithHeaders, res: ResponseWithEvents, next: () => void) => {
      const start = Date.now();

      // Log request
      this.info('Incoming request', {
        method: req.method,
        url: req.url,
        headers: {
          'user-agent': req.get('user-agent'),
          'x-request-id': req.get('x-request-id')
        }
      });

      // Log response
      res.on('finish', () => {
        const duration = Date.now() - start;
        const level = res.statusCode >= 400 ? 'error' : 'info';

        this[level]('Request completed', {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration,
          'x-request-id': req.get('x-request-id')
        });

        // Record request duration metric
        metrics.gauge('http_request_duration_ms', duration, {
          method: req.method,
          status: res.statusCode.toString()
        });
      });

      next();
    };
  }

  public createErrorLogger() {
    return (err: Error, req: RequestWithHeaders, res: ResponseWithEvents, next: (error?: Error) => void) => {
      this.error('Request error', err, {
        method: req.method,
        url: req.url,
        'x-request-id': req.get('x-request-id')
      });
      next(err);
    };
  }

  // Add structured logging helpers
  public logBaggageEvent(tagId: string, eventType: string, success: boolean): void {
    this.info('Baggage event processed', {
      component: 'tracking',
      tagId,
      eventType,
      success,
    });
  }

  public logAlert(tagId: string, alertType: string, severity: string): void {
    this.warn('Baggage alert generated', {
      component: 'alerts',
      tagId,
      alertType,
      severity,
    });
  }

  public logZoneCheck(tagId: string, zone: string, isValid: boolean): void {
    this.debug('Zone check completed', {
      component: 'zones',
      tagId,
      zone,
      isValid,
    });
  }
} 