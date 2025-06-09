/**
 * MetricsClient.ts
 * Handles Prometheus metrics collection and reporting
 */

import { Registry, Counter, Gauge, Histogram } from 'prom-client';
import { createLogger } from '@aerofusionxr/shared';

export class MetricsClient {
  private registry: Registry;
  private counters: Map<string, Counter>;
  private gauges: Map<string, Gauge>;
  private histograms: Map<string, Histogram>;
  private logger: Logger;

  constructor(logger: Logger) {
    this.registry = new Registry();
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.logger = logger;

    // Add default metrics
    this.registry.setDefaultLabels({
      service: 'wayfinding',
      version: process.env.SERVICE_VERSION || 'unknown'
    });

    // Register Node.js metrics
    this.registerNodeMetrics();
  }

  /**
   * Defines a new counter metric
   */
  public defineCounter(name: string, help: string, labelNames: string[] = []): void {
    try {
      const counter = new Counter({
        name: this.formatMetricName(name),
        help,
        labelNames,
        registers: [this.registry]
      });
      this.counters.set(name, counter);
    } catch (error) {
      this.logger.error('Error defining counter metric', { name, error });
    }
  }

  /**
   * Defines a new gauge metric
   */
  public defineGauge(name: string, help: string, labelNames: string[] = []): void {
    try {
      const gauge = new Gauge({
        name: this.formatMetricName(name),
        help,
        labelNames,
        registers: [this.registry]
      });
      this.gauges.set(name, gauge);
    } catch (error) {
      this.logger.error('Error defining gauge metric', { name, error });
    }
  }

  /**
   * Defines a new histogram metric
   */
  public defineHistogram(
    name: string,
    help: string,
    labelNames: string[] = [],
    buckets: number[] = [0.1, 0.5, 1, 2, 5]
  ): void {
    try {
      const histogram = new Histogram({
        name: this.formatMetricName(name),
        help,
        labelNames,
        buckets,
        registers: [this.registry]
      });
      this.histograms.set(name, histogram);
    } catch (error) {
      this.logger.error('Error defining histogram metric', { name, error });
    }
  }

  /**
   * Increments a counter metric
   */
  public increment(name: string, labels: Record<string, string> = {}, value = 1): void {
    try {
      const counter = this.counters.get(name);
      if (counter) {
        counter.inc(labels, value);
      } else {
        this.logger.warn('Counter not found', { name });
      }
    } catch (error) {
      this.logger.error('Error incrementing counter', { name, error });
    }
  }

  /**
   * Sets a gauge metric value
   */
  public gauge(name: string, value: number, labels: Record<string, string> = {}): void {
    try {
      const gauge = this.gauges.get(name);
      if (gauge) {
        gauge.set(labels, value);
      } else {
        this.logger.warn('Gauge not found', { name });
      }
    } catch (error) {
      this.logger.error('Error setting gauge', { name, error });
    }
  }

  /**
   * Records a histogram observation
   */
  public histogram(name: string, value: number, labels: Record<string, string> = {}): void {
    try {
      const histogram = this.histograms.get(name);
      if (histogram) {
        histogram.observe(labels, value);
      } else {
        this.logger.warn('Histogram not found', { name });
      }
    } catch (error) {
      this.logger.error('Error recording histogram', { name, error });
    }
  }

  /**
   * Gets all registered metrics
   */
  public async getMetrics(): Promise<string> {
    try {
      return await this.registry.metrics();
    } catch (error) {
      this.logger.error('Error getting metrics', error);
      throw error;
    }
  }

  /**
   * Resets all metrics
   */
  public resetMetrics(): void {
    try {
      this.registry.resetMetrics();
    } catch (error) {
      this.logger.error('Error resetting metrics', error);
    }
  }

  /**
   * Removes a single metric
   */
  public removeMetric(name: string): void {
    try {
      this.registry.removeSingleMetric(this.formatMetricName(name));
      this.counters.delete(name);
      this.gauges.delete(name);
      this.histograms.delete(name);
    } catch (error) {
      this.logger.error('Error removing metric', { name, error });
    }
  }

  private formatMetricName(name: string): string {
    return `wayfinding_${name.replace(/\./g, '_')}`;
  }

  private registerNodeMetrics(): void {
    try {
      // Memory metrics
      this.defineGauge('process_heap_used', 'Node.js heap usage');
      this.defineGauge('process_heap_total', 'Node.js total heap size');
      
      // Event loop metrics
      this.defineHistogram('event_loop_lag', 'Node.js event loop lag');
      
      // GC metrics
      this.defineCounter('gc_runs', 'Number of garbage collection runs', ['type']);
      this.defineHistogram('gc_duration', 'Garbage collection duration', ['type']);

      // Start collection
      this.startNodeMetricsCollection();
    } catch (error) {
      this.logger.error('Error registering Node metrics', error);
    }
  }

  private startNodeMetricsCollection(): void {
    // Collect memory metrics
    setInterval(() => {
      const used = process.memoryUsage();
      this.gauge('process_heap_used', used.heapUsed);
      this.gauge('process_heap_total', used.heapTotal);
    }, 5000);

    // Collect event loop metrics
    let lastCheck = process.hrtime.bigint();
    setInterval(() => {
      const now = process.hrtime.bigint();
      const lag = Number(now - lastCheck - BigInt(500_000_000)) / 1_000_000;
      this.histogram('event_loop_lag', Math.max(0, lag));
      lastCheck = now;
    }, 500);
  }
} 
