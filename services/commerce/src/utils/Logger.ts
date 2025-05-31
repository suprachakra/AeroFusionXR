import winston from 'winston';
import { metrics } from './metrics';

export class Logger {
  private logger: winston.Logger;
  private context: Record<string, any>;

  // Metrics
  private readonly logCounter = metrics.createCounter({
    name: 'log_messages_total',
    help: 'Total number of log messages',
    labelNames: ['level']
  });

  constructor(context: Record<string, any> = {}) {
    this.context = context;

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: {
        service: 'commerce-service',
        ...context
      },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  private log(level: string, message: string, meta: Record<string, any> = {}) {
    this.logCounter.inc({ level });
    this.logger.log(level, message, {
      ...this.context,
      ...meta,
      timestamp: new Date().toISOString()
    });
  }

  debug(message: string, meta: Record<string, any> = {}) {
    this.log('debug', message, meta);
  }

  info(message: string, meta: Record<string, any> = {}) {
    this.log('info', message, meta);
  }

  warn(message: string, meta: Record<string, any> = {}) {
    this.log('warn', message, meta);
  }

  error(message: string, error?: Error, meta: Record<string, any> = {}) {
    this.log('error', message, {
      ...meta,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }

  withContext(context: Record<string, any>): Logger {
    return new Logger({
      ...this.context,
      ...context
    });
  }

  createRequestLogger() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.info('HTTP Request', {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration,
          ip: req.ip,
          userAgent: req.get('user-agent')
        });
      });

      next();
    };
  }

  createErrorLogger() {
    return (err: Error, req: any, res: any, next: any) => {
      this.error('Request Error', err, {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      res.status(500).json({
        error: 'Internal server error',
        requestId: req.id
      });
    };
  }
} 