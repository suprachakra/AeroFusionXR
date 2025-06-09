/**
 * TracingClient.ts
 * Handles OpenTelemetry tracing setup and management
 */

import { 
  trace,
  context,
  Span,
  SpanKind,
  SpanStatusCode,
  TraceFlags,
  Tracer
} from '@opentelemetry/api';
import { 
  NodeTracerProvider,
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor
} from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { createLogger } from '@aerofusionxr/shared';

interface TracingConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  otlpEndpoint: string;
  debug?: boolean;
}

export class TracingClient {
  private tracer: Tracer;
  private provider: NodeTracerProvider;
  private logger: Logger;

  constructor(config: TracingConfig, logger: Logger) {
    this.logger = logger;

    try {
      // Create and configure tracer provider
      this.provider = new NodeTracerProvider({
        resource: new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
          [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion,
          [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment
        })
      });

      // Configure exporters
      const otlpExporter = new OTLPTraceExporter({
        url: config.otlpEndpoint
      });

      // Add span processors
      this.provider.addSpanProcessor(
        new BatchSpanProcessor(otlpExporter)
      );

      // Add console exporter in debug mode
      if (config.debug) {
        this.provider.addSpanProcessor(
          new SimpleSpanProcessor(new ConsoleSpanExporter())
        );
      }

      // Register instrumentations
      this.registerInstrumentations();

      // Register provider
      this.provider.register();

      // Get tracer instance
      this.tracer = trace.getTracer(config.serviceName, config.serviceVersion);

      this.logger.info('Tracing initialized successfully', { 
        serviceName: config.serviceName,
        endpoint: config.otlpEndpoint
      });

    } catch (error) {
      this.logger.error('Error initializing tracing', error);
      throw error;
    }
  }

  /**
   * Starts a new span
   */
  public startSpan(
    name: string,
    options: {
      kind?: SpanKind;
      attributes?: Record<string, string | number | boolean>;
    } = {}
  ): Span {
    try {
      const span = this.tracer.startSpan(
        name,
        {
          kind: options.kind || SpanKind.INTERNAL,
          attributes: options.attributes
        },
        context.active()
      );

      // Add default attributes
      span.setAttributes({
        'service.name': process.env.SERVICE_NAME || 'wayfinding',
        'service.version': process.env.SERVICE_VERSION || 'unknown'
      });

      return span;

    } catch (error) {
      this.logger.error('Error starting span', { name, error });
      throw error;
    }
  }

  /**
   * Records an error in the current span
   */
  public recordError(error: Error, span?: Span): void {
    try {
      const activeSpan = span || trace.getSpan(context.active());
      if (activeSpan) {
        activeSpan.recordException(error);
        activeSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message
        });
      }
    } catch (error) {
      this.logger.error('Error recording span error', error);
    }
  }

  /**
   * Adds attributes to the current span
   */
  public addAttributes(
    attributes: Record<string, string | number | boolean>,
    span?: Span
  ): void {
    try {
      const activeSpan = span || trace.getSpan(context.active());
      if (activeSpan) {
        activeSpan.setAttributes(attributes);
      }
    } catch (error) {
      this.logger.error('Error adding span attributes', error);
    }
  }

  /**
   * Creates a child span and executes the provided function within its context
   */
  public async traceAsync<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    options: {
      kind?: SpanKind;
      attributes?: Record<string, string | number | boolean>;
    } = {}
  ): Promise<T> {
    const span = this.startSpan(name, options);

    try {
      return await context.with(
        trace.setSpan(context.active(), span),
        () => fn(span)
      );
    } catch (error) {
      this.recordError(error as Error, span);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Shuts down the tracer provider
   */
  public async shutdown(): Promise<void> {
    try {
      await this.provider.shutdown();
      this.logger.info('Tracing shutdown complete');
    } catch (error) {
      this.logger.error('Error shutting down tracing', error);
      throw error;
    }
  }

  private registerInstrumentations(): void {
    try {
      registerInstrumentations({
        instrumentations: [
          new ExpressInstrumentation({
            requestHook: (span, request) => {
              span.setAttribute('http.request_id', request.headers['x-request-id']);
            }
          })
        ]
      });
    } catch (error) {
      this.logger.error('Error registering instrumentations', error);
      throw error;
    }
  }
} 