import { createLogger } from '@aerofusionxr/shared';
import { PerformanceMonitor } from '@aerofusionxr/shared';
import { SecurityService, DashboardSecurityContext } from '../security/SecurityService';
import { AnalyticsEngine } from '../analytics/AnalyticsEngine';
import { AlertingService } from '../alerting/AlertingService';
import { ExportService } from '../export/ExportService';
import { ReportingService } from '../reporting/ReportingService';
import { DataWarehouseService } from '../data/DataWarehouseService';
import { CacheService } from '../utils/CacheService';

// Core dashboard interfaces
export interface DashboardUser {
  userID: string;
  role: 'admin' | 'merchant' | 'analyst';
  storesManaged?: string[];
  permissions: string[];
  email: string;
  name: string;
}

export interface SalesMetrics {
  period: string;
  unitsSold: number;
  revenue: number;
  currency?: string;
  storeID?: string;
  terminal?: string;
}

export interface InventoryMetrics {
  skuID: string;
  stockLevel: number;
  reorderLevel?: number;
  storeID?: string;
  lastUpdated: Date;
}

export interface XREngagementMetrics {
  metric: 'tryOnConversion' | 'wayfindingUsage' | 'overlayImpressions';
  storeID?: string;
  date: string;
  value: number;
  additionalData?: any;
}

export interface RecommendationMetrics {
  date: string;
  skuID: string;
  impressions: number;
  clicks: number;
  purchases: number;
  clickThroughRate: number;
  conversionRate: number;
  storeID?: string;
}

export interface SupportMetrics {
  agentID?: string;
  date: string;
  averageResponseTimeSec?: number;
  csatScore?: number;
  totalSessions?: number;
}

export interface AlertRule {
  alertID: string;
  userID: string;
  metric: 'inventory' | 'sales' | 'xrEngagement' | 'support';
  storeID?: string;
  threshold: number;
  type: 'less_than' | 'greater_than';
  period?: string;
  enabled: boolean;
  createdAt: Date;
}

export interface MetricsRequest {
  metric: string;
  storeID?: string;
  dateFrom: string;
  dateTo: string;
  granularity?: 'daily' | 'hourly' | 'monthly';
  filters?: { [key: string]: any };
  limit?: number;
  export?: 'json' | 'csv' | 'pdf';
}

export interface DashboardOverview {
  totalSales: number;
  totalUnits: number;
  averageOrderValue: number;
  conversionRate: number;
  period: string;
  currency: string;
  alerts: AlertSummary[];
}

export interface AlertSummary {
  alertID: string;
  metric: string;
  triggeredAt: Date;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

// Error classes
export class DashboardError extends Error {
  constructor(message: string, public code: string, public userID?: string) {
    super(message);
    this.name = 'DashboardError';
  }
}

export class UnauthorizedAccessError extends DashboardError {
  constructor(userID: string, resource: string) {
    super(`Unauthorized access to ${resource}`, 'UNAUTHORIZED_ACCESS', userID);
  }
}

export class InvalidMetricError extends DashboardError {
  constructor(metric: string) {
    super(`Invalid metric: ${metric}`, 'INVALID_METRIC');
  }
}

export class DataNotFoundError extends DashboardError {
  constructor(resource: string) {
    super(`Data not found: ${resource}`, 'DATA_NOT_FOUND');
  }
}

export class DashboardService {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private securityService: SecurityService;
  private analyticsEngine: AnalyticsEngine;
  private alertingService: AlertingService;
  private exportService: ExportService;
  private reportingService: ReportingService;
  private dataWarehouseService: DataWarehouseService;
  private cacheService: CacheService;

  // Configuration
  private readonly CACHE_TTL_SECONDS = 300; // 5 minutes
  private readonly MAX_RESULTS = 1000;
  private readonly PAGINATION_LIMIT = 50;

  constructor() {
    this.logger = new Logger('DashboardService');
    this.performanceMonitor = new PerformanceMonitor('DashboardService');
    this.securityService = new SecurityService();
    this.analyticsEngine = new AnalyticsEngine();
    this.alertingService = new AlertingService();
    this.exportService = new ExportService();
    this.reportingService = new ReportingService();
    this.dataWarehouseService = new DataWarehouseService();
    this.cacheService = new CacheService();
  }

  /**
   * Get dashboard overview with key metrics
   */
  async getDashboardOverview(
    request: { storeID?: string; dateFrom: string; dateTo: string },
    context: DashboardSecurityContext
  ): Promise<DashboardOverview> {
    const startTime = Date.now();

    try {
      this.logger.info('Getting dashboard overview', {
        userID: context.userID,
        storeID: request.storeID,
        dateRange: `${request.dateFrom} to ${request.dateTo}`
      });

      // Validate access
      await this.validateDashboardAccess(context.userID, 'dashboard.read', context);

      // Filter stores based on user role
      const authorizedStoreID = await this.getAuthorizedStoreID(context.userID, request.storeID);

      // Check cache first
      const cacheKey = `overview:${context.userID}:${authorizedStoreID}:${request.dateFrom}:${request.dateTo}`;
      const cachedOverview = await this.cacheService.get<DashboardOverview>(cacheKey);
      if (cachedOverview) {
        return cachedOverview;
      }

      // Get sales metrics
      const salesData = await this.analyticsEngine.getSalesMetrics({
        storeID: authorizedStoreID,
        dateFrom: request.dateFrom,
        dateTo: request.dateTo,
        granularity: 'daily'
      });

      // Calculate totals
      const totalSales = salesData.reduce((sum, item) => sum + item.revenue, 0);
      const totalUnits = salesData.reduce((sum, item) => sum + item.unitsSold, 0);
      const averageOrderValue = totalUnits > 0 ? totalSales / totalUnits : 0;

      // Get conversion rate from XR engagement
      const xrData = await this.analyticsEngine.getXREngagementMetrics({
        metric: 'tryOnConversion',
        storeID: authorizedStoreID,
        dateFrom: request.dateFrom,
        dateTo: request.dateTo
      });

      const conversionRate = xrData.length > 0 ? xrData[0].value : 0;

      // Get recent alerts
      const recentAlerts = await this.alertingService.getRecentAlerts(context.userID, 5);

      const overview: DashboardOverview = {
        totalSales: Math.round(totalSales * 100) / 100,
        totalUnits,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        conversionRate: Math.round(conversionRate * 100) / 100,
        period: `${request.dateFrom} to ${request.dateTo}`,
        currency: 'SGD', // Default currency
        alerts: recentAlerts.map(alert => ({
          alertID: alert.alertID,
          metric: alert.metric,
          triggeredAt: alert.triggeredAt,
          description: alert.description,
          severity: this.determineSeverity(alert.metric, alert.threshold)
        }))
      };

      // Cache the result
      await this.cacheService.set(cacheKey, overview, this.CACHE_TTL_SECONDS);

      // Record metrics
      await this.performanceMonitor.recordTiming('overview_generation_duration', startTime, {
        userID: context.userID,
        storeID: authorizedStoreID
      });

      this.logger.info('Dashboard overview generated successfully', {
        userID: context.userID,
        totalSales: overview.totalSales,
        totalUnits: overview.totalUnits,
        alertCount: overview.alerts.length,
        duration: Date.now() - startTime
      });

      return overview;

    } catch (error) {
      this.logger.error('Failed to get dashboard overview', {
        userID: context.userID,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('overview_errors', 1, {
        userID: context.userID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get sales metrics with filtering and aggregation
   */
  async getSalesMetrics(
    request: MetricsRequest,
    context: DashboardSecurityContext
  ): Promise<SalesMetrics[]> {
    const startTime = Date.now();

    try {
      this.logger.info('Getting sales metrics', {
        userID: context.userID,
        storeID: request.storeID,
        dateRange: `${request.dateFrom} to ${request.dateTo}`,
        granularity: request.granularity
      });

      // Validate access and parameters
      await this.validateMetricsRequest(request, context);

      // Get authorized store ID
      const authorizedStoreID = await this.getAuthorizedStoreID(context.userID, request.storeID);

      // Check cache
      const cacheKey = this.generateCacheKey('sales', request, authorizedStoreID);
      const cachedMetrics = await this.cacheService.get<SalesMetrics[]>(cacheKey);
      if (cachedMetrics) {
        return cachedMetrics;
      }

      // Get data from analytics engine
      const salesMetrics = await this.analyticsEngine.getSalesMetrics({
        storeID: authorizedStoreID,
        dateFrom: request.dateFrom,
        dateTo: request.dateTo,
        granularity: request.granularity || 'daily',
        filters: request.filters
      });

      // Apply limit
      const limitedMetrics = salesMetrics.slice(0, request.limit || this.MAX_RESULTS);

      // Cache result
      await this.cacheService.set(cacheKey, limitedMetrics, this.CACHE_TTL_SECONDS);

      // Record metrics
      await this.performanceMonitor.recordTiming('sales_metrics_duration', startTime, {
        userID: context.userID,
        resultCount: limitedMetrics.length
      });

      this.logger.info('Sales metrics retrieved successfully', {
        userID: context.userID,
        resultCount: limitedMetrics.length,
        duration: Date.now() - startTime
      });

      return limitedMetrics;

    } catch (error) {
      this.logger.error('Failed to get sales metrics', {
        userID: context.userID,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('sales_metrics_errors', 1, {
        userID: context.userID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get inventory metrics with low stock alerts
   */
  async getInventoryMetrics(
    request: { storeID?: string; threshold?: number },
    context: DashboardSecurityContext
  ): Promise<InventoryMetrics[]> {
    const startTime = Date.now();

    try {
      this.logger.info('Getting inventory metrics', {
        userID: context.userID,
        storeID: request.storeID,
        threshold: request.threshold
      });

      // Validate access
      await this.validateDashboardAccess(context.userID, 'dashboard.read', context);

      // Get authorized store ID
      const authorizedStoreID = await this.getAuthorizedStoreID(context.userID, request.storeID);

      // Check cache
      const cacheKey = `inventory:${context.userID}:${authorizedStoreID}:${request.threshold || 10}`;
      const cachedMetrics = await this.cacheService.get<InventoryMetrics[]>(cacheKey);
      if (cachedMetrics) {
        return cachedMetrics;
      }

      // Get data from analytics engine
      const inventoryMetrics = await this.analyticsEngine.getInventoryMetrics({
        storeID: authorizedStoreID,
        threshold: request.threshold || 10
      });

      // Cache result
      await this.cacheService.set(cacheKey, inventoryMetrics, this.CACHE_TTL_SECONDS);

      // Record metrics
      await this.performanceMonitor.recordTiming('inventory_metrics_duration', startTime, {
        userID: context.userID,
        resultCount: inventoryMetrics.length
      });

      this.logger.info('Inventory metrics retrieved successfully', {
        userID: context.userID,
        resultCount: inventoryMetrics.length,
        lowStockCount: inventoryMetrics.filter(item => item.stockLevel < (request.threshold || 10)).length,
        duration: Date.now() - startTime
      });

      return inventoryMetrics;

    } catch (error) {
      this.logger.error('Failed to get inventory metrics', {
        userID: context.userID,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('inventory_metrics_errors', 1, {
        userID: context.userID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get XR engagement metrics
   */
  async getXREngagementMetrics(
    request: { metric: string; storeID?: string; dateFrom: string; dateTo: string },
    context: DashboardSecurityContext
  ): Promise<XREngagementMetrics[]> {
    const startTime = Date.now();

    try {
      this.logger.info('Getting XR engagement metrics', {
        userID: context.userID,
        metric: request.metric,
        storeID: request.storeID,
        dateRange: `${request.dateFrom} to ${request.dateTo}`
      });

      // Validate access and metric
      await this.validateDashboardAccess(context.userID, 'dashboard.read', context);
      
      const validMetrics = ['tryOnConversion', 'wayfindingUsage', 'overlayImpressions'];
      if (!validMetrics.includes(request.metric)) {
        throw new InvalidMetricError(request.metric);
      }

      // Get authorized store ID
      const authorizedStoreID = await this.getAuthorizedStoreID(context.userID, request.storeID);

      // Check cache
      const cacheKey = `xr:${request.metric}:${authorizedStoreID}:${request.dateFrom}:${request.dateTo}`;
      const cachedMetrics = await this.cacheService.get<XREngagementMetrics[]>(cacheKey);
      if (cachedMetrics) {
        return cachedMetrics;
      }

      // Get data from analytics engine
      const xrMetrics = await this.analyticsEngine.getXREngagementMetrics({
        metric: request.metric as any,
        storeID: authorizedStoreID,
        dateFrom: request.dateFrom,
        dateTo: request.dateTo
      });

      // Cache result
      await this.cacheService.set(cacheKey, xrMetrics, this.CACHE_TTL_SECONDS);

      // Record metrics
      await this.performanceMonitor.recordTiming('xr_metrics_duration', startTime, {
        userID: context.userID,
        metric: request.metric,
        resultCount: xrMetrics.length
      });

      this.logger.info('XR engagement metrics retrieved successfully', {
        userID: context.userID,
        metric: request.metric,
        resultCount: xrMetrics.length,
        duration: Date.now() - startTime
      });

      return xrMetrics;

    } catch (error) {
      this.logger.error('Failed to get XR engagement metrics', {
        userID: context.userID,
        metric: request.metric,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('xr_metrics_errors', 1, {
        userID: context.userID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Create alert rule
   */
  async createAlertRule(
    alertData: Omit<AlertRule, 'alertID' | 'createdAt'>,
    context: DashboardSecurityContext
  ): Promise<AlertRule> {
    const startTime = Date.now();

    try {
      this.logger.info('Creating alert rule', {
        userID: context.userID,
        metric: alertData.metric,
        threshold: alertData.threshold
      });

      // Validate access
      await this.validateDashboardAccess(context.userID, 'dashboard.write', context);

      // Create alert rule
      const alertRule = await this.alertingService.createAlertRule({
        ...alertData,
        userID: context.userID
      });

      // Record metrics
      await this.performanceMonitor.recordTiming('alert_creation_duration', startTime, {
        userID: context.userID,
        metric: alertData.metric
      });

      this.logger.info('Alert rule created successfully', {
        userID: context.userID,
        alertID: alertRule.alertID,
        metric: alertData.metric,
        duration: Date.now() - startTime
      });

      return alertRule;

    } catch (error) {
      this.logger.error('Failed to create alert rule', {
        userID: context.userID,
        metric: alertData.metric,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('alert_creation_errors', 1, {
        userID: context.userID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Export metrics data
   */
  async exportMetrics(
    request: MetricsRequest,
    context: DashboardSecurityContext
  ): Promise<{ downloadURL: string; filename: string }> {
    const startTime = Date.now();

    try {
      this.logger.info('Exporting metrics', {
        userID: context.userID,
        metric: request.metric,
        format: request.export,
        dateRange: `${request.dateFrom} to ${request.dateTo}`
      });

      // Validate access
      await this.validateDashboardAccess(context.userID, 'dashboard.read', context);

      // Get data based on metric type
      let data: any[];
      switch (request.metric) {
        case 'sales':
          data = await this.getSalesMetrics(request, context);
          break;
        case 'inventory':
          data = await this.getInventoryMetrics({ storeID: request.storeID }, context);
          break;
        case 'xrEngagement':
          data = await this.getXREngagementMetrics({
            metric: 'tryOnConversion',
            storeID: request.storeID,
            dateFrom: request.dateFrom,
            dateTo: request.dateTo
          }, context);
          break;
        default:
          throw new InvalidMetricError(request.metric);
      }

      // Export data
      const exportResult = await this.exportService.exportData(data, {
        format: request.export || 'csv',
        filename: `${request.metric}_report_${new Date().toISOString().split('T')[0]}`,
        userID: context.userID
      });

      // Record metrics
      await this.performanceMonitor.recordTiming('export_duration', startTime, {
        userID: context.userID,
        metric: request.metric,
        format: request.export,
        recordCount: data.length
      });

      this.logger.info('Metrics exported successfully', {
        userID: context.userID,
        metric: request.metric,
        format: request.export,
        recordCount: data.length,
        filename: exportResult.filename,
        duration: Date.now() - startTime
      });

      return exportResult;

    } catch (error) {
      this.logger.error('Failed to export metrics', {
        userID: context.userID,
        metric: request.metric,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('export_errors', 1, {
        userID: context.userID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async validateDashboardAccess(
    userID: string,
    operation: string,
    context: DashboardSecurityContext
  ): Promise<void> {
    await this.securityService.validateDashboardRequest(userID, operation, context);
  }

  private async validateMetricsRequest(
    request: MetricsRequest,
    context: DashboardSecurityContext
  ): Promise<void> {
    await this.validateDashboardAccess(context.userID, 'dashboard.read', context);

    // Validate date range
    const dateFrom = new Date(request.dateFrom);
    const dateTo = new Date(request.dateTo);
    
    if (dateFrom > dateTo) {
      throw new DashboardError('dateFrom must be before dateTo', 'INVALID_DATE_RANGE');
    }

    // Validate granularity
    if (request.granularity && !['daily', 'hourly', 'monthly'].includes(request.granularity)) {
      throw new DashboardError('Invalid granularity', 'INVALID_GRANULARITY');
    }
  }

  private async getAuthorizedStoreID(userID: string, requestedStoreID?: string): Promise<string | undefined> {
    const user = await this.securityService.getDashboardUser(userID);
    
    if (user.role === 'admin') {
      return requestedStoreID; // Admin can access any store
    }

    if (user.role === 'merchant' && user.storesManaged) {
      if (!requestedStoreID) {
        return user.storesManaged[0]; // Default to first managed store
      }
      
      if (!user.storesManaged.includes(requestedStoreID)) {
        throw new UnauthorizedAccessError(userID, `store ${requestedStoreID}`);
      }
      
      return requestedStoreID;
    }

    return undefined;
  }

  private generateCacheKey(metricType: string, request: MetricsRequest, storeID?: string): string {
    const filters = JSON.stringify(request.filters || {});
    return `${metricType}:${storeID || 'all'}:${request.dateFrom}:${request.dateTo}:${request.granularity || 'daily'}:${filters}`;
  }

  private determineSeverity(metric: string, threshold: number): 'low' | 'medium' | 'high' {
    // Simple logic to determine alert severity
    if (metric === 'inventory' && threshold < 5) return 'high';
    if (metric === 'sales' && threshold > 10000) return 'high';
    if (metric === 'support' && threshold > 300) return 'high';
    return 'medium';
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    dependencies: { [key: string]: boolean };
    metrics: any;
  }> {
    const analyticsHealth = await this.analyticsEngine.getHealth();
    const dataWarehouseHealth = await this.dataWarehouseService.getHealth();
    const cacheHealth = await this.cacheService.getHealth();
    const alertingHealth = await this.alertingService.getHealth();

    const healthyServices = [
      analyticsHealth.available,
      dataWarehouseHealth.available,
      cacheHealth.available,
      alertingHealth.available
    ].filter(s => s).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyServices === 4) {
      status = 'healthy';
    } else if (healthyServices > 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      dependencies: {
        analytics: analyticsHealth.available,
        dataWarehouse: dataWarehouseHealth.available,
        cache: cacheHealth.available,
        alerting: alertingHealth.available
      },
      metrics: {
        avgOverviewTime: this.performanceMonitor.getMetricStats('overview_generation_duration')?.avg || 0,
        cacheHitRate: this.calculateCacheHitRate(),
        totalRequests: this.performanceMonitor.getMetricStats('sales_metrics_duration')?.count || 0,
        errorRate: this.calculateErrorRate()
      }
    };
  }

  private calculateCacheHitRate(): number {
    // Implementation would track cache hits vs misses
    return 85.0; // Mock value
  }

  private calculateErrorRate(): number {
    const totalRequests = (this.performanceMonitor.getMetricStats('sales_metrics_duration')?.count || 0) +
                         (this.performanceMonitor.getMetricStats('overview_generation_duration')?.count || 0);
    const totalErrors = (this.performanceMonitor.getMetricStats('sales_metrics_errors')?.count || 0) +
                       (this.performanceMonitor.getMetricStats('overview_errors')?.count || 0);
    
    return totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
  }
} 
