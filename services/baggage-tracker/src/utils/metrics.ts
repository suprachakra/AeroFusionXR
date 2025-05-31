import { Counter, Gauge, Histogram, Registry } from 'prom-client';

class MetricsClient {
  private registry: Registry;
  private counters: Map<string, Counter<string>>;
  private gauges: Map<string, Gauge<string>>;
  private histograms: Map<string, Histogram<string>>;

  constructor() {
    this.registry = new Registry();
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();

    // Add default labels
    this.registry.setDefaultLabels({
      service: 'baggage-tracker',
      version: process.env.SERVICE_VERSION ?? 'unknown'
    });
  }

  public createCounter(options: {
    name: string;
    help: string;
    labelNames?: string[];
  }): Counter<string> {
    const counter = new Counter({
      name: options.name,
      help: options.help,
      labelNames: options.labelNames || []
    });

    this.registry.registerMetric(counter);
    this.counters.set(options.name, counter);
    return counter;
  }

  public createGauge(options: {
    name: string;
    help: string;
    labelNames?: string[];
  }): Gauge<string> {
    const gauge = new Gauge({
      name: options.name,
      help: options.help,
      labelNames: options.labelNames || []
    });

    this.registry.registerMetric(gauge);
    this.gauges.set(options.name, gauge);
    return gauge;
  }

  public createHistogram(options: {
    name: string;
    help: string;
    labelNames?: string[];
    buckets?: number[];
  }): Histogram<string> {
    const histogram = new Histogram({
      name: options.name,
      help: options.help,
      labelNames: options.labelNames || [],
      buckets: options.buckets || [0.1, 0.5, 1, 2, 5]
    });

    this.registry.registerMetric(histogram);
    this.histograms.set(options.name, histogram);
    return histogram;
  }

  public increment(name: string, labels?: Record<string, string | number>): void {
    let counter = this.counters.get(name);
    
    if (!counter) {
      counter = this.createCounter({
        name,
        help: `Counter for ${name}`
      });
    }

    counter.inc(labels || {});
  }

  public gauge(name: string, value: number, labels?: Record<string, string | number>): void {
    let gauge = this.gauges.get(name);
    
    if (!gauge) {
      gauge = this.createGauge({
        name,
        help: `Gauge for ${name}`
      });
    }

    gauge.set(labels || {}, value);
  }

  public async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  public clearMetrics(): void {
    this.registry.clear();
  }
}

export const metrics = new MetricsClient(); 