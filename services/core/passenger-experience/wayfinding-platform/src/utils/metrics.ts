import { Counter, Gauge, Histogram, Registry } from 'prom-client';
import { MetricsClient } from '../types';

class PrometheusMetricsClient implements MetricsClient {
  private registry: Registry;
  private counters: Map<string, Counter<string>>;
  private gauges: Map<string, Gauge<string>>;
  private histograms: Map<string, Histogram<string>>;

  constructor() {
    this.registry = new Registry();
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();

    // Add default metrics
    this.registry.setDefaultLabels({
      service: 'wayfinding',
      version: process.env.SERVICE_VERSION ?? 'unknown'
    });
  }

  public createHistogram(options: {
    name: string;
    help: string;
    labelNames?: string[];
    buckets?: number[];
  }) {
    const histogram = new Histogram({
      name: options.name,
      help: options.help,
      labelNames: options.labelNames || [],
      buckets: options.buckets || [0.1, 0.5, 1, 2, 5]
    });

    this.registry.registerMetric(histogram);
    this.histograms.set(options.name, histogram);

    return {
      observe: (labels: Record<string, string | number>, value: number) => {
        histogram.observe(labels, value);
      }
    };
  }

  public createGauge(options: {
    name: string;
    help: string;
    labelNames?: string[];
  }) {
    const gauge = new Gauge({
      name: options.name,
      help: options.help,
      labelNames: options.labelNames || []
    });

    this.registry.registerMetric(gauge);
    this.gauges.set(options.name, gauge);

    return {
      set: (labels: Record<string, string | number>, value: number) => {
        gauge.set(labels, value);
      }
    };
  }

  public increment(name: string, labels?: Record<string, string | number>): void {
    let counter = this.counters.get(name);
    
    if (!counter) {
      counter = new Counter({
        name,
        help: `Counter for ${name}`,
        labelNames: labels ? Object.keys(labels) : []
      });
      this.registry.registerMetric(counter);
      this.counters.set(name, counter);
    }

    counter.inc(labels || {});
  }

  public gauge(name: string, value: number, labels?: Record<string, string | number>): void {
    let gauge = this.gauges.get(name);
    
    if (!gauge) {
      gauge = new Gauge({
        name,
        help: `Gauge for ${name}`,
        labelNames: labels ? Object.keys(labels) : []
      });
      this.registry.registerMetric(gauge);
      this.gauges.set(name, gauge);
    }

    gauge.set(labels || {}, value);
  }

  public getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}

export const metrics = new PrometheusMetricsClient(); 