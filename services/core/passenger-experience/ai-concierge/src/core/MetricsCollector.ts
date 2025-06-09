/**
 * @fileoverview AI Concierge Service - Metrics Collector
 * @version 1.0.0
 * @author AeroFusionXR AI Engineering Team
 * @created 2024-01-15
 * @updated 2024-01-15
 * 
 * Comprehensive metrics collection and monitoring for all AI Concierge features.
 * Tracks performance, usage patterns, and system health metrics.
 * 
 * Features:
 * - Request/response metrics
 * - Performance monitoring
 * - Feature usage tracking
 * - System resource monitoring
 * - Custom metric collection
 * - Aggregation and reporting
 */

import winston from 'winston';

/**
 * Request metrics interface
 */
interface RequestMetric {
  method: string;
  path: string;
  statusCode: number;
  executionTime: number;
  userId?: string;
  clientType: string;
}

/**
 * Feature usage metrics interface
 */
interface FeatureMetrics {
  kiosks: {
    totalSessions: number;
    averageSessionDuration: number;
    successfulResolutions: number;
    escalations: number;
    languageDistribution: Record<string, number>;
  };
  vipServices: {
    totalBookings: number;
    averageServiceTime: number;
    satisfactionRating: number;
    serviceTypes: Record<string, number>;
  };
  baggage: {
    totalTracked: number;
    averageTrackingTime: number;
    mishandledBags: number;
    successfulDeliveries: number;
  };
  assistant: {
    totalQueries: number;
    averageResponseTime: number;
    languageDistribution: Record<string, number>;
    intentAccuracy: number;
  };
  emergency: {
    totalIncidents: number;
    averageResponseTime: number;
    severityDistribution: Record<string, number>;
    resolutionRate: number;
  };
}

/**
 * System performance metrics interface
 */
interface SystemMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
    requestsPerSecond: number;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    byEndpoint: Record<string, number>;
    errorRate: number;
  };
  performance: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkLatency: number;
  };
  database: {
    connections: number;
    queryTime: number;
    slowQueries: number;
    errors: number;
  };
  cache: {
    hitRate: number;
    missRate: number;
    evictions: number;
    memoryUsage: number;
  };
}

/**
 * Aggregated metrics interface
 */
interface AggregatedMetrics {
  timestamp: string;
  period: string;
  system: SystemMetrics;
  features: FeatureMetrics;
  custom: Record<string, any>;
}

/**
 * Metrics Collector Class
 * Provides comprehensive metrics collection and monitoring capabilities
 */
export class MetricsCollector {
  private logger: winston.Logger;
  private requestMetrics: RequestMetric[] = [];
  private featureMetrics: FeatureMetrics;
  private systemMetrics: SystemMetrics;
  private customMetrics: Record<string, any> = {};
  private startTime: number;
  private metricsTimer: NodeJS.Timeout | null = null;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.startTime = Date.now();
    this.featureMetrics = this.initializeFeatureMetrics();
    this.systemMetrics = this.initializeSystemMetrics();
  }

  /**
   * Initialize feature metrics with default values
   */
  private initializeFeatureMetrics(): FeatureMetrics {
    return {
      kiosks: {
        totalSessions: 0,
        averageSessionDuration: 0,
        successfulResolutions: 0,
        escalations: 0,
        languageDistribution: {}
      },
      vipServices: {
        totalBookings: 0,
        averageServiceTime: 0,
        satisfactionRating: 0,
        serviceTypes: {}
      },
      baggage: {
        totalTracked: 0,
        averageTrackingTime: 0,
        mishandledBags: 0,
        successfulDeliveries: 0
      },
      assistant: {
        totalQueries: 0,
        averageResponseTime: 0,
        languageDistribution: {},
        intentAccuracy: 0
      },
      emergency: {
        totalIncidents: 0,
        averageResponseTime: 0,
        severityDistribution: {},
        resolutionRate: 0
      }
    };
  }

  /**
   * Initialize system metrics with default values
   */
  private initializeSystemMetrics(): SystemMetrics {
    return {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0,
        requestsPerSecond: 0
      },
      errors: {
        total: 0,
        byType: {},
        byEndpoint: {},
        errorRate: 0
      },
      performance: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkLatency: 0
      },
      database: {
        connections: 0,
        queryTime: 0,
        slowQueries: 0,
        errors: 0
      },
      cache: {
        hitRate: 0,
        missRate: 0,
        evictions: 0,
        memoryUsage: 0
      }
    };
  }

  /**
   * Initialize metrics collection
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing metrics collection...');

      // Start periodic metrics aggregation
      this.startPeriodicAggregation();

      // Collect initial system metrics
      await this.collectSystemMetrics();

      this.logger.info('Metrics collection initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize metrics collection', { error: error.message });
      throw new Error(`Metrics initialization failed: ${error.message}`);
    }
  }

  /**
   * Start periodic metrics aggregation
   */
  private startPeriodicAggregation(): void {
    const interval = 60000; // 1 minute

    this.metricsTimer = setInterval(async () => {
      try {
        await this.aggregateMetrics();
        await this.collectSystemMetrics();
      } catch (error) {
        this.logger.error('Metrics aggregation failed', { error: error.message });
      }
    }, interval);

    this.logger.info('Periodic metrics aggregation started', { interval });
  }

  /**
   * Record a request metric
   */
  public recordRequest(metric: RequestMetric): void {
    try {
      this.requestMetrics.push({
        ...metric,
        timestamp: Date.now()
      } as any);

      // Update system metrics
      this.systemMetrics.requests.total++;
      
      if (metric.statusCode >= 200 && metric.statusCode < 400) {
        this.systemMetrics.requests.successful++;
      } else {
        this.systemMetrics.requests.failed++;
        this.systemMetrics.errors.total++;
        
        // Track errors by endpoint
        if (!this.systemMetrics.errors.byEndpoint[metric.path]) {
          this.systemMetrics.errors.byEndpoint[metric.path] = 0;
        }
        this.systemMetrics.errors.byEndpoint[metric.path]++;
      }

      // Update average response time
      const totalRequests = this.systemMetrics.requests.total;
      const currentAvg = this.systemMetrics.requests.averageResponseTime;
      this.systemMetrics.requests.averageResponseTime = 
        (currentAvg * (totalRequests - 1) + metric.executionTime) / totalRequests;

      // Calculate error rate
      this.systemMetrics.errors.errorRate = 
        this.systemMetrics.requests.failed / this.systemMetrics.requests.total;

      // Keep only recent metrics (last hour)
      const oneHourAgo = Date.now() - 3600000;
      this.requestMetrics = this.requestMetrics.filter(
        (m: any) => m.timestamp > oneHourAgo
      );

    } catch (error) {
      this.logger.error('Failed to record request metric', { error: error.message });
    }
  }

  /**
   * Record kiosk session metric
   */
  public recordKioskSession(sessionData: {
    duration: number;
    successful: boolean;
    escalated: boolean;
    language: string;
  }): void {
    try {
      this.featureMetrics.kiosks.totalSessions++;
      
      // Update average session duration
      const totalSessions = this.featureMetrics.kiosks.totalSessions;
      const currentAvg = this.featureMetrics.kiosks.averageSessionDuration;
      this.featureMetrics.kiosks.averageSessionDuration = 
        (currentAvg * (totalSessions - 1) + sessionData.duration) / totalSessions;

      if (sessionData.successful) {
        this.featureMetrics.kiosks.successfulResolutions++;
      }

      if (sessionData.escalated) {
        this.featureMetrics.kiosks.escalations++;
      }

      // Update language distribution
      if (!this.featureMetrics.kiosks.languageDistribution[sessionData.language]) {
        this.featureMetrics.kiosks.languageDistribution[sessionData.language] = 0;
      }
      this.featureMetrics.kiosks.languageDistribution[sessionData.language]++;

    } catch (error) {
      this.logger.error('Failed to record kiosk session metric', { error: error.message });
    }
  }

  /**
   * Record VIP service metric
   */
  public recordVIPService(serviceData: {
    serviceType: string;
    duration: number;
    satisfaction: number;
  }): void {
    try {
      this.featureMetrics.vipServices.totalBookings++;
      
      // Update average service time
      const totalBookings = this.featureMetrics.vipServices.totalBookings;
      const currentAvg = this.featureMetrics.vipServices.averageServiceTime;
      this.featureMetrics.vipServices.averageServiceTime = 
        (currentAvg * (totalBookings - 1) + serviceData.duration) / totalBookings;

      // Update satisfaction rating
      const currentSatisfaction = this.featureMetrics.vipServices.satisfactionRating;
      this.featureMetrics.vipServices.satisfactionRating = 
        (currentSatisfaction * (totalBookings - 1) + serviceData.satisfaction) / totalBookings;

      // Update service type distribution
      if (!this.featureMetrics.vipServices.serviceTypes[serviceData.serviceType]) {
        this.featureMetrics.vipServices.serviceTypes[serviceData.serviceType] = 0;
      }
      this.featureMetrics.vipServices.serviceTypes[serviceData.serviceType]++;

    } catch (error) {
      this.logger.error('Failed to record VIP service metric', { error: error.message });
    }
  }

  /**
   * Record baggage tracking metric
   */
  public recordBaggageTracking(baggageData: {
    trackingTime: number;
    successful: boolean;
    mishandled: boolean;
  }): void {
    try {
      this.featureMetrics.baggage.totalTracked++;
      
      // Update average tracking time
      const totalTracked = this.featureMetrics.baggage.totalTracked;
      const currentAvg = this.featureMetrics.baggage.averageTrackingTime;
      this.featureMetrics.baggage.averageTrackingTime = 
        (currentAvg * (totalTracked - 1) + baggageData.trackingTime) / totalTracked;

      if (baggageData.successful) {
        this.featureMetrics.baggage.successfulDeliveries++;
      }

      if (baggageData.mishandled) {
        this.featureMetrics.baggage.mishandledBags++;
      }

    } catch (error) {
      this.logger.error('Failed to record baggage tracking metric', { error: error.message });
    }
  }

  /**
   * Record assistant query metric
   */
  public recordAssistantQuery(queryData: {
    responseTime: number;
    language: string;
    intentAccuracy: number;
  }): void {
    try {
      this.featureMetrics.assistant.totalQueries++;
      
      // Update average response time
      const totalQueries = this.featureMetrics.assistant.totalQueries;
      const currentAvg = this.featureMetrics.assistant.averageResponseTime;
      this.featureMetrics.assistant.averageResponseTime = 
        (currentAvg * (totalQueries - 1) + queryData.responseTime) / totalQueries;

      // Update intent accuracy
      const currentAccuracy = this.featureMetrics.assistant.intentAccuracy;
      this.featureMetrics.assistant.intentAccuracy = 
        (currentAccuracy * (totalQueries - 1) + queryData.intentAccuracy) / totalQueries;

      // Update language distribution
      if (!this.featureMetrics.assistant.languageDistribution[queryData.language]) {
        this.featureMetrics.assistant.languageDistribution[queryData.language] = 0;
      }
      this.featureMetrics.assistant.languageDistribution[queryData.language]++;

    } catch (error) {
      this.logger.error('Failed to record assistant query metric', { error: error.message });
    }
  }

  /**
   * Record emergency incident metric
   */
  public recordEmergencyIncident(incidentData: {
    responseTime: number;
    severity: string;
    resolved: boolean;
  }): void {
    try {
      this.featureMetrics.emergency.totalIncidents++;
      
      // Update average response time
      const totalIncidents = this.featureMetrics.emergency.totalIncidents;
      const currentAvg = this.featureMetrics.emergency.averageResponseTime;
      this.featureMetrics.emergency.averageResponseTime = 
        (currentAvg * (totalIncidents - 1) + incidentData.responseTime) / totalIncidents;

      // Update severity distribution
      if (!this.featureMetrics.emergency.severityDistribution[incidentData.severity]) {
        this.featureMetrics.emergency.severityDistribution[incidentData.severity] = 0;
      }
      this.featureMetrics.emergency.severityDistribution[incidentData.severity]++;

      // Update resolution rate
      if (incidentData.resolved) {
        const resolvedIncidents = Object.values(this.featureMetrics.emergency.severityDistribution)
          .reduce((sum, count) => sum + count, 0);
        this.featureMetrics.emergency.resolutionRate = resolvedIncidents / totalIncidents;
      }

    } catch (error) {
      this.logger.error('Failed to record emergency incident metric', { error: error.message });
    }
  }

  /**
   * Record custom metric
   */
  public recordCustomMetric(name: string, value: any, tags?: Record<string, string>): void {
    try {
      if (!this.customMetrics[name]) {
        this.customMetrics[name] = [];
      }

      this.customMetrics[name].push({
        value,
        tags,
        timestamp: new Date().toISOString()
      });

      // Keep only recent custom metrics (last 24 hours)
      const oneDayAgo = Date.now() - 86400000;
      this.customMetrics[name] = this.customMetrics[name].filter(
        (m: any) => new Date(m.timestamp).getTime() > oneDayAgo
      );

    } catch (error) {
      this.logger.error('Failed to record custom metric', { name, error: error.message });
    }
  }

  /**
   * Collect system performance metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      // Memory usage
      const memoryUsage = process.memoryUsage();
      this.systemMetrics.performance.memoryUsage = 
        Math.round(memoryUsage.heapUsed / 1024 / 1024); // MB

      // CPU usage (simplified)
      const cpuUsage = process.cpuUsage();
      this.systemMetrics.performance.cpuUsage = 
        Math.round((cpuUsage.user + cpuUsage.system) / 1000000); // Convert to seconds

      // Calculate requests per second
      const uptime = (Date.now() - this.startTime) / 1000; // seconds
      this.systemMetrics.requests.requestsPerSecond = 
        Math.round(this.systemMetrics.requests.total / uptime * 100) / 100;

    } catch (error) {
      this.logger.error('Failed to collect system metrics', { error: error.message });
    }
  }

  /**
   * Aggregate metrics for reporting
   */
  private async aggregateMetrics(): Promise<void> {
    try {
      const aggregated: AggregatedMetrics = {
        timestamp: new Date().toISOString(),
        period: '1m',
        system: { ...this.systemMetrics },
        features: { ...this.featureMetrics },
        custom: { ...this.customMetrics }
      };

      // Log aggregated metrics
      this.logger.info('Metrics aggregated', {
        totalRequests: aggregated.system.requests.total,
        errorRate: aggregated.system.errors.errorRate,
        averageResponseTime: aggregated.system.requests.averageResponseTime,
        memoryUsage: aggregated.system.performance.memoryUsage
      });

    } catch (error) {
      this.logger.error('Failed to aggregate metrics', { error: error.message });
    }
  }

  /**
   * Get current metrics
   */
  public async getMetrics(): Promise<AggregatedMetrics> {
    await this.collectSystemMetrics();
    
    return {
      timestamp: new Date().toISOString(),
      period: 'current',
      system: { ...this.systemMetrics },
      features: { ...this.featureMetrics },
      custom: { ...this.customMetrics }
    };
  }

  /**
   * Get metrics for a specific feature
   */
  public getFeatureMetrics(feature: keyof FeatureMetrics): any {
    return { ...this.featureMetrics[feature] };
  }

  /**
   * Get system performance metrics
   */
  public getSystemMetrics(): SystemMetrics {
    return { ...this.systemMetrics };
  }

  /**
   * Get custom metrics
   */
  public getCustomMetrics(): Record<string, any> {
    return { ...this.customMetrics };
  }

  /**
   * Reset all metrics
   */
  public reset(): void {
    this.requestMetrics = [];
    this.featureMetrics = this.initializeFeatureMetrics();
    this.systemMetrics = this.initializeSystemMetrics();
    this.customMetrics = {};
    this.startTime = Date.now();
    
    this.logger.info('Metrics reset');
  }

  /**
   * Shutdown metrics collection
   */
  public async shutdown(): Promise<void> {
    try {
      this.logger.info('Shutting down metrics collection...');

      // Clear metrics timer
      if (this.metricsTimer) {
        clearInterval(this.metricsTimer);
        this.metricsTimer = null;
      }

      // Final metrics aggregation
      await this.aggregateMetrics();

      this.logger.info('Metrics collection shutdown completed');

    } catch (error) {
      this.logger.error('Error during metrics shutdown', { error: error.message });
      throw error;
    }
  }
} 