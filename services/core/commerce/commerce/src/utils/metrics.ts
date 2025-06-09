import client from 'prom-client';

// Initialize Prometheus registry
const registry = new client.Registry();

// Add default metrics (memory, CPU, etc.)
client.collectDefaultMetrics({ register: registry });

class Metrics {
  private registry: client.Registry;

  constructor() {
    this.registry = registry;
  }

  createCounter(options: client.CounterConfiguration<string>): client.Counter<string> {
    const counter = new client.Counter(options);
    this.registry.registerMetric(counter);
    return counter;
  }

  createGauge(options: client.GaugeConfiguration<string>): client.Gauge<string> {
    const gauge = new client.Gauge(options);
    this.registry.registerMetric(gauge);
    return gauge;
  }

  createHistogram(options: client.HistogramConfiguration<string>): client.Histogram<string> {
    const histogram = new client.Histogram(options);
    this.registry.registerMetric(histogram);
    return histogram;
  }

  createSummary(options: client.SummaryConfiguration<string>): client.Summary<string> {
    const summary = new client.Summary(options);
    this.registry.registerMetric(summary);
    return summary;
  }

  async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }

  resetMetrics(): void {
    this.registry.resetMetrics();
  }

  clearMetrics(): void {
    this.registry.clear();
  }

  // Pre-defined metrics
  readonly httpRequestDuration = this.createHistogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
  });

  readonly httpRequestTotal = this.createCounter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
  });

  readonly httpRequestErrors = this.createCounter({
    name: 'http_request_errors_total',
    help: 'Total number of HTTP request errors',
    labelNames: ['method', 'route', 'error_type']
  });

  readonly databaseOperationDuration = this.createHistogram({
    name: 'database_operation_duration_seconds',
    help: 'Duration of database operations in seconds',
    labelNames: ['operation', 'collection'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
  });

  readonly databaseOperationErrors = this.createCounter({
    name: 'database_operation_errors_total',
    help: 'Total number of database operation errors',
    labelNames: ['operation', 'collection', 'error_type']
  });

  readonly activeConnections = this.createGauge({
    name: 'active_connections',
    help: 'Number of active connections',
    labelNames: ['type']
  });

  readonly memoryUsage = this.createGauge({
    name: 'memory_usage_bytes',
    help: 'Memory usage in bytes',
    labelNames: ['type']
  });

  readonly cpuUsage = this.createGauge({
    name: 'cpu_usage_percent',
    help: 'CPU usage percentage',
    labelNames: ['type']
  });

  // Update system metrics
  updateSystemMetrics(): void {
    const memoryUsage = process.memoryUsage();
    this.memoryUsage.set({ type: 'rss' }, memoryUsage.rss);
    this.memoryUsage.set({ type: 'heapTotal' }, memoryUsage.heapTotal);
    this.memoryUsage.set({ type: 'heapUsed' }, memoryUsage.heapUsed);
    this.memoryUsage.set({ type: 'external' }, memoryUsage.external);

    // CPU usage is more complex and might require additional libraries
    // This is a simplified example
    const startUsage = process.cpuUsage();
    setTimeout(() => {
      const endUsage = process.cpuUsage(startUsage);
      const userCPUUsage = endUsage.user / 1000000; // Convert to seconds
      const systemCPUUsage = endUsage.system / 1000000;
      
      this.cpuUsage.set({ type: 'user' }, userCPUUsage);
      this.cpuUsage.set({ type: 'system' }, systemCPUUsage);
    }, 100);
  }
}

// Export singleton instance
export const metrics = new Metrics(); 