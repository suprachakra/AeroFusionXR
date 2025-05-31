/**
 * Tracing Client for Booking Service
 * ==================================
 * 
 * OpenTelemetry distributed tracing for comprehensive observability.
 */

import { trace, Span, SpanStatusCode } from '@opentelemetry/api';

export class TracingClient {
  private tracer = trace.getTracer('booking-service', '1.0.0');

  /**
   * Start a new span
   */
  public startSpan(name: string, attributes?: Record<string, string | number | boolean>): Span {
    const span = this.tracer.startSpan(name);
    
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        span.setAttributes({ [key]: value });
      });
    }
    
    return span;
  }

  /**
   * End a span with success status
   */
  public endSpan(span: Span): void {
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
  }

  /**
   * End a span with error status
   */
  public endSpanWithError(span: Span, error: Error): void {
    span.recordException(error);
    span.setStatus({ 
      code: SpanStatusCode.ERROR, 
      message: error.message 
    });
    span.end();
  }

  /**
   * Add attributes to a span
   */
  public addAttributes(span: Span, attributes: Record<string, string | number | boolean>): void {
    span.setAttributes(attributes);
  }

  /**
   * Add an event to a span
   */
  public addEvent(span: Span, name: string, attributes?: Record<string, string | number | boolean>): void {
    span.addEvent(name, attributes);
  }
} 