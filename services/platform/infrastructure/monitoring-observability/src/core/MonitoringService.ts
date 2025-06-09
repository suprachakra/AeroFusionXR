import { createLogger } from '@aerofusionxr/shared';
import { PerformanceMonitor } from '@aerofusionxr/shared';
import { SecurityService, MonitoringSecurityContext } from '../security/SecurityService';
import { MetricsService } from '../metrics/MetricsService';
import { TracingService } from '../tracing/TracingService';
import { LoggingService } from '../logging/LoggingService';
import { AlertingService } from '../alerting/AlertingService';
import { SyntheticMonitoringService } from '../synthetic/SyntheticMonitoringService';
import { DashboardService } from '../dashboards/DashboardService';
import { CacheService } from '../utils/CacheService';

// Core monitoring interfaces
export interface MetricDefinition {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  description: string;
  labels?: string[];
  buckets?: number[]; // for histograms
  objectives?: { [key: number]: number }; // for summaries
}

export interface MetricValue {
  name: string;
  value: number;
  labels?: { [key: string]: string | number };
  timestamp?: Date;
}

export interface TraceSpan {
  traceID: string;
  spanID: string;
  parentSpanID?: string;
  operationName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  tags?: { [key: string]: any };
  logs?: {
    timestamp: Date;
    fields: { [key: string]: any };
  }[];
  status: 'ok' | 'error' | 'timeout';
}

export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  service: string;
  message: string;
  traceID?: string;
  spanID?: string;
  requestID?: string;
  metadata?: { [key: string]: any };
  kubernetes?: {
    pod: string;
    namespace: string;
    node: string;
  };
}

export interface AlertRule {
  alertName: string;
  expr: string; // PromQL expression
  for: string; // duration
  severity: 'critical' | 'warning' | 'info';
  labels?: { [key: string]: string };
  annotations?: { [key: string]: string };
}

export interface AlertInstance {
  alertName: string;
  state: 'pending' | 'firing' | 'inactive';
  value: number;
  labels: { [key: string]: string };
  annotations: { [key: string]: string };
  activeAt?: Date;
  resolvedAt?: Date;
}

export interface SyntheticTest {
  testID: string;
  name: string;
  type: 'http' | 'websocket' | 'database' | 'api_flow';
  target: string;
  interval: string; // cron expression
  timeout: number;
  expected: {
    statusCode?: number;
    responseTime?: number;
    content?: string;
  };
  enabled: boolean;
}

export interface SyntheticResult {
  testID: string;
  testName: string;
  timestamp: Date;
  success: boolean;
  responseTime: number;
  statusCode?: number;
  error?: string;
  metadata?: any;
}

export interface DashboardDefinition {
  dashboardID: string;
  title: string;
  description: string;
  tags: string[];
  panels: {
    panelID: string;
    title: string;
    type: 'graph' | 'singlestat' | 'table' | 'heatmap';
    targets: {
      expr: string; // PromQL query
      legendFormat?: string;
    }[];
    gridPos: {
      x: number;
      y: number;
      w: number;
      h: number;
    };
  }[];
}

export interface MonitoringStats {
  metricsCollected: number;
  tracesCollected: number;
  logsIndexed: number;
  alertsFired: number;
  syntheticTestsExecuted: number;
  syntheticTestsSuccessful: number;
  avgMetricIngestionRate: number;
  avgTraceIngestionRate: number;
  avgLogIngestionRate: number;
  storageUsage: {
    prometheus: number; // GB
    elasticsearch: number; // GB
    jaeger: number; // GB
  };
}

export interface ServiceHealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastChecked: Date;
  responseTime: number;
  details?: any;
}

// Error classes
export class MonitoringError extends Error {
  constructor(message: string, public code: string, public component?: string) {
    super(message);
    this.name = 'MonitoringError';
  }
}

export class MetricNotFoundError extends MonitoringError {
  constructor(metricName: string) {
    super(`Metric not found: ${metricName}`, 'METRIC_NOT_FOUND');
  }
}

export class TraceNotFoundError extends MonitoringError {
  constructor(traceID: string) {
    super(`Trace not found: ${traceID}`, 'TRACE_NOT_FOUND');
  }
}

export class AlertRuleInvalidError extends MonitoringError {
  constructor(ruleName: string, reason: string) {
    super(`Invalid alert rule '${ruleName}': ${reason}`, 'ALERT_RULE_INVALID');
  }
}

export class SyntheticTestFailedError extends MonitoringError {
  constructor(testID: string, error: string) {
    super(`Synthetic test failed '${testID}': ${error}`, 'SYNTHETIC_TEST_FAILED');
  }
}

export class DashboardNotFoundError extends MonitoringError {
  constructor(dashboardID: string) {
    super(`Dashboard not found: ${dashboardID}`, 'DASHBOARD_NOT_FOUND');
  }
}

export class MonitoringService {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private securityService: SecurityService;
  private metricsService: MetricsService;
  private tracingService: TracingService;
  private loggingService: LoggingService;
  private alertingService: AlertingService;
  private syntheticMonitoringService: SyntheticMonitoringService;
  private dashboardService: DashboardService;
  private cacheService: CacheService;

  // Configuration
  private readonly METRICS_RETENTION_DAYS = 30;
  private readonly TRACES_RETENTION_DAYS = 7;
  private readonly LOGS_RETENTION_DAYS = 90;
  private readonly CACHE_TTL_SECONDS = 300; // 5 minutes
  private readonly SYNTHETIC_TEST_TIMEOUT = 30000; // 30 seconds
  private readonly ALERT_EVALUATION_INTERVAL = 30; // 30 seconds

  constructor() {
    this.logger = new Logger('MonitoringService');
    this.performanceMonitor = new PerformanceMonitor('MonitoringService');
    this.securityService = new SecurityService();
    this.metricsService = new MetricsService();
    this.tracingService = new TracingService();
    this.loggingService = new LoggingService();
    this.alertingService = new AlertingService();
    this.syntheticMonitoringService = new SyntheticMonitoringService();
    this.dashboardService = new DashboardService();
    this.cacheService = new CacheService();
  }

  /**
   * Initialize the monitoring service
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing MonitoringService');

      // Initialize all sub-services
      await this.metricsService.initialize();
      await this.tracingService.initialize();
      await this.loggingService.initialize();
      await this.alertingService.initialize();
      await this.syntheticMonitoringService.initialize();
      await this.dashboardService.initialize();

      // Start background services
      await this.startMetricCollection();
      await this.startAlertEvaluation();
      await this.startSyntheticTests();

      this.logger.info('MonitoringService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize MonitoringService', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Record a metric value
   */
  async recordMetric(
    metric: MetricValue,
    context: MonitoringSecurityContext
  ): Promise<{ status: string }> {
    const startTime = Date.now();

    try {
      this.logger.debug('Recording metric', {
        name: metric.name,
        value: metric.value,
        labels: metric.labels
      });

      // Validate access
      await this.securityService.validateMonitoringRequest('metrics.write', context);

      // Record metric
      await this.metricsService.recordMetric({
        name: metric.name,
        value: metric.value,
        labels: metric.labels || {},
        timestamp: metric.timestamp || new Date()
      });

      // Record performance
      await this.performanceMonitor.recordTiming('metric_recording_duration', startTime, {
        metricName: metric.name
      });

      await this.performanceMonitor.recordMetric('metrics_recorded', 1, {
        metricName: metric.name
      });

      return { status: 'recorded' };

    } catch (error) {
      this.logger.error('Failed to record metric', {
        name: metric.name,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('metric_recording_errors', 1, {
        metricName: metric.name,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Query metrics using PromQL
   */
  async queryMetrics(
    query: string,
    startTime?: Date,
    endTime?: Date,
    step?: string,
    context?: MonitoringSecurityContext
  ): Promise<{ data: any; status: string }> {
    const requestStart = Date.now();

    try {
      this.logger.debug('Querying metrics', {
        query,
        startTime,
        endTime,
        step
      });

      // Validate access if context provided
      if (context) {
        await this.securityService.validateMonitoringRequest('metrics.read', context);
      }

      // Check cache first
      const cacheKey = `metrics:query:${query}:${startTime?.getTime()}:${endTime?.getTime()}:${step}`;
      const cachedResult = await this.cacheService.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Query metrics
      const result = await this.metricsService.query({
        query,
        startTime,
        endTime,
        step
      });

      // Cache the result
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL_SECONDS);

      // Record performance
      await this.performanceMonitor.recordTiming('metric_query_duration', requestStart, {
        query: query.substring(0, 50) // truncate for logging
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to query metrics', {
        query,
        error: error.message,
        duration: Date.now() - requestStart
      });

      await this.performanceMonitor.recordMetric('metric_query_errors', 1, {
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Start a new trace span
   */
  async startSpan(
    operationName: string,
    parentSpanID?: string,
    tags?: { [key: string]: any },
    context?: MonitoringSecurityContext
  ): Promise<{ traceID: string; spanID: string }> {
    const startTime = Date.now();

    try {
      this.logger.debug('Starting trace span', {
        operationName,
        parentSpanID,
        tags
      });

      // Validate access if context provided
      if (context) {
        await this.securityService.validateMonitoringRequest('tracing.write', context);
      }

      // Start span
      const span = await this.tracingService.startSpan({
        operationName,
        parentSpanID,
        tags: tags || {},
        startTime: new Date()
      });

      // Record performance
      await this.performanceMonitor.recordTiming('span_start_duration', startTime, {
        operationName
      });

      await this.performanceMonitor.recordMetric('spans_started', 1, {
        operationName
      });

      return {
        traceID: span.traceID,
        spanID: span.spanID
      };

    } catch (error) {
      this.logger.error('Failed to start span', {
        operationName,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('span_start_errors', 1, {
        operationName,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Finish a trace span
   */
  async finishSpan(
    spanID: string,
    status: 'ok' | 'error' | 'timeout',
    tags?: { [key: string]: any },
    logs?: { timestamp: Date; fields: { [key: string]: any } }[],
    context?: MonitoringSecurityContext
  ): Promise<{ status: string }> {
    const startTime = Date.now();

    try {
      this.logger.debug('Finishing trace span', {
        spanID,
        status,
        tags
      });

      // Validate access if context provided
      if (context) {
        await this.securityService.validateMonitoringRequest('tracing.write', context);
      }

      // Finish span
      await this.tracingService.finishSpan({
        spanID,
        endTime: new Date(),
        status,
        tags: tags || {},
        logs: logs || []
      });

      // Record performance
      await this.performanceMonitor.recordTiming('span_finish_duration', startTime, {
        spanID
      });

      await this.performanceMonitor.recordMetric('spans_finished', 1, {
        status
      });

      return { status: 'finished' };

    } catch (error) {
      this.logger.error('Failed to finish span', {
        spanID,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('span_finish_errors', 1, {
        spanID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Query traces
   */
  async queryTraces(
    filters: {
      traceID?: string;
      service?: string;
      operation?: string;
      minDuration?: number;
      maxDuration?: number;
      startTime?: Date;
      endTime?: Date;
      limit?: number;
    },
    context: MonitoringSecurityContext
  ): Promise<{ traces: TraceSpan[]; total: number }> {
    const startTime = Date.now();

    try {
      this.logger.debug('Querying traces', {
        filters
      });

      // Validate access
      await this.securityService.validateMonitoringRequest('tracing.read', context);

      // Check cache first
      const cacheKey = `traces:query:${JSON.stringify(filters)}`;
      const cachedResult = await this.cacheService.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Query traces
      const result = await this.tracingService.queryTraces(filters);

      // Cache the result
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL_SECONDS);

      // Record performance
      await this.performanceMonitor.recordTiming('trace_query_duration', startTime, {
        service: filters.service
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to query traces', {
        filters,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('trace_query_errors', 1, {
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Index a log entry
   */
  async indexLog(
    logEntry: LogEntry,
    context?: MonitoringSecurityContext
  ): Promise<{ status: string; logID?: string }> {
    const startTime = Date.now();

    try {
      this.logger.debug('Indexing log entry', {
        level: logEntry.level,
        service: logEntry.service,
        message: logEntry.message.substring(0, 100) // truncate for logging
      });

      // Validate access if context provided
      if (context) {
        await this.securityService.validateMonitoringRequest('logs.write', context);
      }

      // Index log
      const result = await this.loggingService.indexLog({
        ...logEntry,
        timestamp: logEntry.timestamp || new Date()
      });

      // Record performance
      await this.performanceMonitor.recordTiming('log_indexing_duration', startTime, {
        service: logEntry.service,
        level: logEntry.level
      });

      await this.performanceMonitor.recordMetric('logs_indexed', 1, {
        service: logEntry.service,
        level: logEntry.level
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to index log', {
        service: logEntry.service,
        level: logEntry.level,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('log_indexing_errors', 1, {
        service: logEntry.service,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Query logs
   */
  async queryLogs(
    filters: {
      service?: string;
      level?: string;
      traceID?: string;
      message?: string;
      startTime?: Date;
      endTime?: Date;
      limit?: number;
      offset?: number;
    },
    context: MonitoringSecurityContext
  ): Promise<{ logs: LogEntry[]; total: number }> {
    const startTime = Date.now();

    try {
      this.logger.debug('Querying logs', {
        filters
      });

      // Validate access
      await this.securityService.validateMonitoringRequest('logs.read', context);

      // Check cache first
      const cacheKey = `logs:query:${JSON.stringify(filters)}`;
      const cachedResult = await this.cacheService.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Query logs
      const result = await this.loggingService.queryLogs(filters);

      // Cache the result
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL_SECONDS);

      // Record performance
      await this.performanceMonitor.recordTiming('log_query_duration', startTime, {
        service: filters.service
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to query logs', {
        filters,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('log_query_errors', 1, {
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Create alert rule
   */
  async createAlertRule(
    rule: AlertRule,
    context: MonitoringSecurityContext
  ): Promise<{ status: string }> {
    const startTime = Date.now();

    try {
      this.logger.info('Creating alert rule', {
        alertName: rule.alertName,
        severity: rule.severity
      });

      // Validate access
      await this.securityService.validateMonitoringRequest('alerts.write', context);

      // Validate rule
      await this.validateAlertRule(rule);

      // Create rule
      await this.alertingService.createRule(rule);

      // Record performance
      await this.performanceMonitor.recordTiming('alert_rule_creation_duration', startTime, {
        alertName: rule.alertName
      });

      await this.performanceMonitor.recordMetric('alert_rules_created', 1, {
        severity: rule.severity
      });

      this.logger.info('Alert rule created successfully', {
        alertName: rule.alertName,
        duration: Date.now() - startTime
      });

      return { status: 'created' };

    } catch (error) {
      this.logger.error('Failed to create alert rule', {
        alertName: rule.alertName,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('alert_rule_creation_errors', 1, {
        alertName: rule.alertName,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(
    context: MonitoringSecurityContext
  ): Promise<{ alerts: AlertInstance[]; total: number }> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting active alerts');

      // Validate access
      await this.securityService.validateMonitoringRequest('alerts.read', context);

      // Check cache first
      const cacheKey = 'active_alerts';
      const cachedResult = await this.cacheService.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Get active alerts
      const result = await this.alertingService.getActiveAlerts();

      // Cache the result for a shorter time
      await this.cacheService.set(cacheKey, result, 60); // 1 minute

      // Record performance
      await this.performanceMonitor.recordTiming('active_alerts_query_duration', startTime);

      return result;

    } catch (error) {
      this.logger.error('Failed to get active alerts', {
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('active_alerts_query_errors', 1, {
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Create synthetic test
   */
  async createSyntheticTest(
    test: SyntheticTest,
    context: MonitoringSecurityContext
  ): Promise<{ testID: string; status: string }> {
    const startTime = Date.now();

    try {
      this.logger.info('Creating synthetic test', {
        name: test.name,
        type: test.type,
        target: test.target
      });

      // Validate access
      await this.securityService.validateMonitoringRequest('synthetic.write', context);

      // Create test
      const result = await this.syntheticMonitoringService.createTest(test);

      // Record performance
      await this.performanceMonitor.recordTiming('synthetic_test_creation_duration', startTime, {
        testType: test.type
      });

      await this.performanceMonitor.recordMetric('synthetic_tests_created', 1, {
        testType: test.type
      });

      this.logger.info('Synthetic test created successfully', {
        testID: result.testID,
        name: test.name,
        duration: Date.now() - startTime
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to create synthetic test', {
        name: test.name,
        type: test.type,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('synthetic_test_creation_errors', 1, {
        testType: test.type,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Execute synthetic test
   */
  async executeSyntheticTest(
    testID: string,
    context: MonitoringSecurityContext
  ): Promise<SyntheticResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Executing synthetic test', {
        testID
      });

      // Validate access
      await this.securityService.validateMonitoringRequest('synthetic.execute', context);

      // Execute test
      const result = await this.syntheticMonitoringService.executeTest(testID);

      // Record performance
      await this.performanceMonitor.recordTiming('synthetic_test_execution_duration', startTime, {
        testID,
        success: result.success
      });

      await this.performanceMonitor.recordMetric('synthetic_tests_executed', 1, {
        testID,
        success: result.success ? 'true' : 'false'
      });

      this.logger.info('Synthetic test executed', {
        testID,
        success: result.success,
        responseTime: result.responseTime,
        duration: Date.now() - startTime
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to execute synthetic test', {
        testID,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('synthetic_test_execution_errors', 1, {
        testID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get synthetic test results
   */
  async getSyntheticTestResults(
    testID: string,
    startTime?: Date,
    endTime?: Date,
    context?: MonitoringSecurityContext
  ): Promise<{ results: SyntheticResult[]; total: number }> {
    const requestStart = Date.now();

    try {
      this.logger.debug('Getting synthetic test results', {
        testID,
        startTime,
        endTime
      });

      // Validate access if context provided
      if (context) {
        await this.securityService.validateMonitoringRequest('synthetic.read', context);
      }

      // Check cache first
      const cacheKey = `synthetic:results:${testID}:${startTime?.getTime()}:${endTime?.getTime()}`;
      const cachedResult = await this.cacheService.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Get results
      const result = await this.syntheticMonitoringService.getTestResults(testID, startTime, endTime);

      // Cache the result
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL_SECONDS);

      // Record performance
      await this.performanceMonitor.recordTiming('synthetic_results_query_duration', requestStart, {
        testID
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to get synthetic test results', {
        testID,
        error: error.message,
        duration: Date.now() - requestStart
      });

      await this.performanceMonitor.recordMetric('synthetic_results_query_errors', 1, {
        testID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Create dashboard
   */
  async createDashboard(
    dashboard: DashboardDefinition,
    context: MonitoringSecurityContext
  ): Promise<{ dashboardID: string; status: string }> {
    const startTime = Date.now();

    try {
      this.logger.info('Creating dashboard', {
        title: dashboard.title,
        panelCount: dashboard.panels.length
      });

      // Validate access
      await this.securityService.validateMonitoringRequest('dashboards.write', context);

      // Create dashboard
      const result = await this.dashboardService.createDashboard(dashboard);

      // Record performance
      await this.performanceMonitor.recordTiming('dashboard_creation_duration', startTime, {
        panelCount: dashboard.panels.length
      });

      await this.performanceMonitor.recordMetric('dashboards_created', 1);

      this.logger.info('Dashboard created successfully', {
        dashboardID: result.dashboardID,
        title: dashboard.title,
        duration: Date.now() - startTime
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to create dashboard', {
        title: dashboard.title,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('dashboard_creation_errors', 1, {
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get dashboard
   */
  async getDashboard(
    dashboardID: string,
    context: MonitoringSecurityContext
  ): Promise<DashboardDefinition> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting dashboard', {
        dashboardID
      });

      // Validate access
      await this.securityService.validateMonitoringRequest('dashboards.read', context);

      // Check cache first
      const cacheKey = `dashboard:${dashboardID}`;
      const cachedDashboard = await this.cacheService.get(cacheKey);
      if (cachedDashboard) {
        return cachedDashboard;
      }

      // Get dashboard
      const dashboard = await this.dashboardService.getDashboard(dashboardID);
      if (!dashboard) {
        throw new DashboardNotFoundError(dashboardID);
      }

      // Cache the result
      await this.cacheService.set(cacheKey, dashboard, this.CACHE_TTL_SECONDS);

      // Record performance
      await this.performanceMonitor.recordTiming('dashboard_retrieval_duration', startTime, {
        dashboardID
      });

      return dashboard;

    } catch (error) {
      this.logger.error('Failed to get dashboard', {
        dashboardID,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('dashboard_retrieval_errors', 1, {
        dashboardID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Perform health check
   */
  async performHealthCheck(
    services: string[],
    context?: MonitoringSecurityContext
  ): Promise<{ checks: ServiceHealthCheck[]; overall: 'healthy' | 'degraded' | 'unhealthy' }> {
    const startTime = Date.now();

    try {
      this.logger.debug('Performing health checks', {
        services
      });

      // Validate access if context provided
      if (context) {
        await this.securityService.validateMonitoringRequest('health.read', context);
      }

      // Perform health checks
      const checks = await Promise.all(
        services.map(async (service) => {
          const checkStart = Date.now();
          try {
            const health = await this.performSingleHealthCheck(service);
            return {
              service,
              status: 'healthy' as const,
              lastChecked: new Date(),
              responseTime: Date.now() - checkStart,
              details: health
            };
          } catch (error) {
            return {
              service,
              status: 'unhealthy' as const,
              lastChecked: new Date(),
              responseTime: Date.now() - checkStart,
              details: { error: error.message }
            };
          }
        })
      );

      // Determine overall health
      const healthyCount = checks.filter(c => c.status === 'healthy').length;
      const degradedCount = checks.filter(c => c.status === 'degraded').length;
      
      let overall: 'healthy' | 'degraded' | 'unhealthy';
      if (healthyCount === checks.length) {
        overall = 'healthy';
      } else if (healthyCount + degradedCount > checks.length / 2) {
        overall = 'degraded';
      } else {
        overall = 'unhealthy';
      }

      // Record performance
      await this.performanceMonitor.recordTiming('health_check_duration', startTime, {
        serviceCount: services.length,
        overall
      });

      await this.performanceMonitor.recordMetric('health_checks_performed', 1, {
        overall
      });

      return { checks, overall };

    } catch (error) {
      this.logger.error('Failed to perform health checks', {
        services,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('health_check_errors', 1, {
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get monitoring statistics
   */
  async getMonitoringStats(
    context: MonitoringSecurityContext
  ): Promise<MonitoringStats> {
    const startTime = Date.now();

    try {
      this.logger.info('Getting monitoring statistics');

      // Validate admin access
      await this.securityService.validateMonitoringRequest('monitoring.admin', context);

      const stats = await Promise.all([
        this.metricsService.getStats(),
        this.tracingService.getStats(),
        this.loggingService.getStats(),
        this.alertingService.getStats(),
        this.syntheticMonitoringService.getStats()
      ]);

      const monitoringStats: MonitoringStats = {
        metricsCollected: stats[0].totalMetrics,
        tracesCollected: stats[1].totalTraces,
        logsIndexed: stats[2].totalLogs,
        alertsFired: stats[3].totalAlerts,
        syntheticTestsExecuted: stats[4].totalTests,
        syntheticTestsSuccessful: stats[4].successfulTests,
        avgMetricIngestionRate: stats[0].avgIngestionRate,
        avgTraceIngestionRate: stats[1].avgIngestionRate,
        avgLogIngestionRate: stats[2].avgIngestionRate,
        storageUsage: {
          prometheus: stats[0].storageUsageGB,
          elasticsearch: stats[2].storageUsageGB,
          jaeger: stats[1].storageUsageGB
        }
      };

      // Record performance
      await this.performanceMonitor.recordTiming('monitoring_stats_duration', startTime);

      this.logger.info('Monitoring statistics retrieved successfully', {
        metricsCollected: monitoringStats.metricsCollected,
        tracesCollected: monitoringStats.tracesCollected,
        logsIndexed: monitoringStats.logsIndexed,
        duration: Date.now() - startTime
      });

      return monitoringStats;

    } catch (error) {
      this.logger.error('Failed to get monitoring statistics', {
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('monitoring_stats_errors', 1, {
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async startMetricCollection(): Promise<void> {
    this.logger.info('Starting metric collection');
    await this.metricsService.startCollection();
  }

  private async startAlertEvaluation(): Promise<void> {
    this.logger.info('Starting alert evaluation');
    await this.alertingService.startEvaluation(this.ALERT_EVALUATION_INTERVAL);
  }

  private async startSyntheticTests(): Promise<void> {
    this.logger.info('Starting synthetic tests');
    await this.syntheticMonitoringService.startScheduledTests();
  }

  private async validateAlertRule(rule: AlertRule): Promise<void> {
    // Validate PromQL expression
    if (!rule.expr || rule.expr.trim().length === 0) {
      throw new AlertRuleInvalidError(rule.alertName, 'Empty expression');
    }

    // Validate duration format
    if (!rule.for || !/^\d+(s|m|h|d)$/.test(rule.for)) {
      throw new AlertRuleInvalidError(rule.alertName, 'Invalid duration format');
    }

    // Validate severity
    if (!['critical', 'warning', 'info'].includes(rule.severity)) {
      throw new AlertRuleInvalidError(rule.alertName, 'Invalid severity level');
    }
  }

  private async performSingleHealthCheck(service: string): Promise<any> {
    // This would perform actual health checks against different services
    // For now, return a mock response
    return {
      status: 'ok',
      timestamp: new Date(),
      version: '1.0.0'
    };
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    dependencies: { [key: string]: boolean };
    metrics: any;
  }> {
    const [metricsHealth, tracingHealth, loggingHealth, alertingHealth, syntheticHealth] = await Promise.all([
      this.metricsService.getHealth(),
      this.tracingService.getHealth(),
      this.loggingService.getHealth(),
      this.alertingService.getHealth(),
      this.syntheticMonitoringService.getHealth()
    ]);

    const healthyServices = [
      metricsHealth.available,
      tracingHealth.available,
      loggingHealth.available,
      alertingHealth.available,
      syntheticHealth.available
    ].filter(s => s).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyServices === 5) {
      status = 'healthy';
    } else if (healthyServices > 3) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      dependencies: {
        metrics: metricsHealth.available,
        tracing: tracingHealth.available,
        logging: loggingHealth.available,
        alerting: alertingHealth.available,
        synthetic: syntheticHealth.available
      },
      metrics: {
        avgMetricRecordingTime: this.performanceMonitor.getMetricStats('metric_recording_duration')?.avg || 0,
        avgSpanStartTime: this.performanceMonitor.getMetricStats('span_start_duration')?.avg || 0,
        avgLogIndexingTime: this.performanceMonitor.getMetricStats('log_indexing_duration')?.avg || 0,
        totalMetricsRecorded: this.performanceMonitor.getMetricStats('metrics_recorded')?.sum || 0,
        totalSpansStarted: this.performanceMonitor.getMetricStats('spans_started')?.sum || 0,
        totalLogsIndexed: this.performanceMonitor.getMetricStats('logs_indexed')?.sum || 0
      }
    };
  }
} 
