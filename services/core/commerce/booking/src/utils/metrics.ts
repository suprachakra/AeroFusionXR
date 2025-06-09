/**
 * Metrics Client for Booking Service
 * ==================================
 * 
 * Prometheus metrics collection and reporting for comprehensive observability.
 */

import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

export class MetricsClient {
  private counters: Map<string, Counter> = new Map();
  private histograms: Map<string, Histogram> = new Map();
  private gauges: Map<string, Gauge> = new Map();

  constructor() {
    // Collect default Node.js metrics
    collectDefaultMetrics({ register });
    
    // Initialize booking-specific metrics
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // Flight search metrics
    this.counters.set('flight_search.cache_hit', new Counter({
      name: 'booking_flight_search_cache_hits_total',
      help: 'Total number of flight search cache hits'
    }));

    this.counters.set('flight_search.success', new Counter({
      name: 'booking_flight_search_success_total',
      help: 'Total number of successful flight searches'
    }));

    this.counters.set('flight_search.error', new Counter({
      name: 'booking_flight_search_errors_total',
      help: 'Total number of flight search errors'
    }));

    this.histograms.set('flight_search.duration', new Histogram({
      name: 'booking_flight_search_duration_ms',
      help: 'Flight search duration in milliseconds',
      buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000]
    }));

    this.histograms.set('flight_search.results_count', new Histogram({
      name: 'booking_flight_search_results_count',
      help: 'Number of flight search results',
      buckets: [0, 5, 10, 25, 50, 100, 250, 500]
    }));

    // Booking metrics
    this.counters.set('booking.created', new Counter({
      name: 'booking_bookings_created_total',
      help: 'Total number of bookings created'
    }));

    this.counters.set('booking.creation_error', new Counter({
      name: 'booking_creation_errors_total',
      help: 'Total number of booking creation errors'
    }));

    this.counters.set('booking.cancelled', new Counter({
      name: 'booking_bookings_cancelled_total',
      help: 'Total number of bookings cancelled'
    }));

    this.counters.set('booking.cancellation_error', new Counter({
      name: 'booking_cancellation_errors_total',
      help: 'Total number of booking cancellation errors'
    }));

    this.histograms.set('booking.creation_duration', new Histogram({
      name: 'booking_creation_duration_ms',
      help: 'Booking creation duration in milliseconds',
      buckets: [100, 250, 500, 1000, 2500, 5000, 10000]
    }));

    this.histograms.set('booking.cancellation_duration', new Histogram({
      name: 'booking_cancellation_duration_ms',
      help: 'Booking cancellation duration in milliseconds',
      buckets: [100, 250, 500, 1000, 2500, 5000]
    }));

    // Payment metrics
    this.counters.set('payment.success', new Counter({
      name: 'booking_payments_success_total',
      help: 'Total number of successful payments'
    }));

    this.counters.set('payment.error', new Counter({
      name: 'booking_payments_errors_total',
      help: 'Total number of payment errors'
    }));

    this.counters.set('payment.fraud_detected', new Counter({
      name: 'booking_payments_fraud_detected_total',
      help: 'Total number of payments flagged for fraud'
    }));

    this.histograms.set('payment.processing_duration', new Histogram({
      name: 'booking_payment_processing_duration_ms',
      help: 'Payment processing duration in milliseconds',
      buckets: [500, 1000, 2500, 5000, 10000, 15000, 30000]
    }));

    this.histograms.set('payment.amount', new Histogram({
      name: 'booking_payment_amounts',
      help: 'Payment amounts in base currency',
      buckets: [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000]
    }));

    this.histograms.set('cancellation.refund_amount', new Histogram({
      name: 'booking_refund_amounts',
      help: 'Refund amounts in base currency',
      buckets: [0, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
    }));

    // Event metrics
    this.counters.set('events.booking_created', new Counter({
      name: 'booking_events_booking_created_total',
      help: 'Total booking created events'
    }));

    this.counters.set('events.payment_completed', new Counter({
      name: 'booking_events_payment_completed_total',
      help: 'Total payment completed events'
    }));

    this.counters.set('events.booking_cancelled', new Counter({
      name: 'booking_events_booking_cancelled_total',
      help: 'Total booking cancelled events'
    }));

    // Register all metrics
    this.counters.forEach(counter => register.registerMetric(counter));
    this.histograms.forEach(histogram => register.registerMetric(histogram));
    this.gauges.forEach(gauge => register.registerMetric(gauge));
  }

  /**
   * Increment a counter metric
   */
  public increment(name: string, value: number = 1): void {
    const counter = this.counters.get(name);
    if (counter) {
      counter.inc(value);
    } else {
      console.warn(`Counter metric not found: ${name}`);
    }
  }

  /**
   * Record a histogram observation
   */
  public histogram(name: string, value: number): void {
    const histogram = this.histograms.get(name);
    if (histogram) {
      histogram.observe(value);
    } else {
      console.warn(`Histogram metric not found: ${name}`);
    }
  }

  /**
   * Set a gauge value
   */
  public gauge(name: string, value: number): void {
    const gauge = this.gauges.get(name);
    if (gauge) {
      gauge.set(value);
    } else {
      console.warn(`Gauge metric not found: ${name}`);
    }
  }

  /**
   * Get metrics in Prometheus format
   */
  public async getMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * Clear all metrics (useful for testing)
   */
  public clear(): void {
    register.clear();
  }
} 