import { createLogger } from '@aerofusionxr/shared';
import { PerformanceMonitor } from '@aerofusionxr/shared';
import { SecurityService, AnalyticsSecurityContext } from '../security/SecurityService';
import { DataWarehouseService } from '../data/DataWarehouseService';
import { StreamProcessorService } from '../streaming/StreamProcessorService';
import { ETLService } from '../etl/ETLService';
import { ExportService } from '../export/ExportService';
import { MetricsAggregationService } from '../metrics/MetricsAggregationService';

// Core analytics interfaces
export interface OverviewMetrics {
  revenue: {
    amount: number;
    currency: string;
  };
  MAU: number;
  DAU: number;
  avgSessionDuration: number; // seconds
}

export interface UserEngagementData {
  date: string;
  impressions: number;
  videoPlays: number;
  clicks: number;
  conversionRate?: number;
}

export interface SalesData {
  date: string;
  revenue: number;
  orders: number;
  channel?: string;
}

export interface LoyaltyStats {
  earnedTotal: number;
  redeemedTotal: number;
  byTier: Array<{
    tierID: string;
    earned: number;
    redeemed: number;
  }>;
}

export interface NotificationStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed?: number;
}

export interface OfflineSyncStats {
  date: string;
  success: number;
  failure: number;
  failureRate?: number;
}

export interface FlightAlertData {
  date: string;
  airline: string;
  delays: number;
  cancellations: number;
}

export interface XRUsageData {
  date: string;
  poiID?: string;
  impressions: number;
  videoPlays: number;
  clicks: number;
  conversionRate?: number;
}

export interface CampaignMetrics {
  campaignID: string;
  metrics: {
    sent: { [channel: string]: number };
    delivered: { [channel: string]: number };
    opened: { [channel: string]: number };
    clicked: { [channel: string]: number };
    failed: { [channel: string]: number };
  };
  recipientCount: number;
  startTime: Date;
  endTime?: Date;
}

export interface ExportRequest {
  reportType: 'sales' | 'loyalty' | 'xrUsage' | 'notifications' | 'offlineSync' | 'flightAlerts';
  startDate: string;
  endDate: string;
  format: 'csv' | 'xlsx';
  filters?: { [key: string]: any };
}

export interface AnalyticsQuery {
  startDate: string;
  endDate: string;
  segment?: string;
  channel?: string;
  poiID?: string;
  airline?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface DashboardAlert {
  alertID: string;
  type: 'anomaly' | 'threshold' | 'failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  metric: string;
  value: number;
  threshold?: number;
  timestamp: Date;
  acknowledged: boolean;
}

// Error classes
export class AnalyticsError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'AnalyticsError';
  }
}

export class InvalidDateRangeError extends AnalyticsError {
  constructor(startDate: string, endDate: string) {
    super(`Invalid date range: ${startDate} to ${endDate}`, 'INVALID_DATE_RANGE', {
      startDate,
      endDate
    });
  }
}

export class DataWarehouseConnectionError extends AnalyticsError {
  constructor(details: any) {
    super('Failed to connect to data warehouse', 'DW_CONNECTION_FAIL', details);
  }
}

export class ExportTooLargeError extends AnalyticsError {
  constructor(estimatedSize: number, maxSize: number) {
    super(`Export too large: ${estimatedSize} > ${maxSize}`, 'EXPORT_TOO_LARGE', {
      estimatedSize,
      maxSize
    });
  }
}

export class ETLJobFailureError extends AnalyticsError {
  constructor(jobName: string, details: any) {
    super(`ETL job failed: ${jobName}`, 'ETL_FAILURE', { jobName, ...details });
  }
}

export class AnalyticsService {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private securityService: SecurityService;
  private dataWarehouseService: DataWarehouseService;
  private streamProcessorService: StreamProcessorService;
  private etlService: ETLService;
  private exportService: ExportService;
  private metricsAggregationService: MetricsAggregationService;

  // Configuration
  private readonly DEFAULT_LOCALE = 'en-SG';
  private readonly SUPPORTED_SEGMENTS = ['All', 'Bronze', 'Silver', 'Gold', 'Platinum'];
  private readonly SUPPORTED_CHANNELS = ['All', 'App', 'Web', 'InApp'];
  private readonly MAX_EXPORT_ROWS = 1000000;
  private readonly DEFAULT_LIMIT = 50;
  private readonly MAX_LIMIT = 1000;
  private readonly CACHE_TTL_MINUTES = 15;

  // Caching
  private queryCache: Map<string, { data: any; timestamp: number }> = new Map();

  constructor() {
    this.logger = new Logger('AnalyticsService');
    this.performanceMonitor = new PerformanceMonitor('AnalyticsService');
    this.securityService = new SecurityService();
    this.dataWarehouseService = new DataWarehouseService();
    this.streamProcessorService = new StreamProcessorService();
    this.etlService = new ETLService();
    this.exportService = new ExportService();
    this.metricsAggregationService = new MetricsAggregationService();
  }

  /**
   * Initialize the analytics service
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing AnalyticsService');

      // Initialize all sub-services
      await this.dataWarehouseService.initialize();
      await this.streamProcessorService.initialize();
      await this.etlService.initialize();
      await this.exportService.initialize();
      await this.metricsAggregationService.initialize();

      // Start background processes
      await this.startETLScheduler();
      await this.startStreamProcessing();
      await this.startAnomalyDetection();

      this.logger.info('AnalyticsService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize AnalyticsService', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get overview metrics
   */
  async getOverview(
    query: Pick<AnalyticsQuery, 'startDate' | 'endDate'>,
    context: AnalyticsSecurityContext
  ): Promise<OverviewMetrics> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting overview metrics', {
        startDate: query.startDate,
        endDate: query.endDate
      });

      // Validate access
      await this.securityService.validateAnalyticsRequest('analytics.read', context);

      // Validate date range
      this.validateDateRange(query.startDate, query.endDate);

      // Check cache
      const cacheKey = `overview:${query.startDate}:${query.endDate}`;
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }

      // Query data warehouse
      const [revenue, mau, dau, avgSessionDuration] = await Promise.all([
        this.getRevenueMetrics(query.startDate, query.endDate),
        this.getMonthlyActiveUsers(query.startDate, query.endDate),
        this.getDailyActiveUsers(),
        this.getAverageSessionDuration(query.startDate, query.endDate)
      ]);

      const overview: OverviewMetrics = {
        revenue,
        MAU: mau,
        DAU: dau,
        avgSessionDuration
      };

      // Cache result
      this.setCachedResult(cacheKey, overview);

      // Record metrics
      await this.performanceMonitor.recordTiming('get_overview_duration', startTime);
      await this.performanceMonitor.recordMetric('overview_requests', 1);

      this.logger.info('Overview metrics retrieved successfully', {
        startDate: query.startDate,
        endDate: query.endDate,
        duration: Date.now() - startTime
      });

      return overview;

    } catch (error) {
      this.logger.error('Failed to get overview metrics', {
        startDate: query.startDate,
        endDate: query.endDate,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('overview_errors', 1, {
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get user engagement data
   */
  async getUserEngagement(
    query: AnalyticsQuery,
    context: AnalyticsSecurityContext
  ): Promise<UserEngagementData[]> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting user engagement data', query);

      // Validate access
      await this.securityService.validateAnalyticsRequest('analytics.read', context);

      // Validate parameters
      this.validateDateRange(query.startDate, query.endDate);
      this.validateSegment(query.segment);

      // Check cache
      const cacheKey = `engagement:${JSON.stringify(query)}`;
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }

      // Query data warehouse
      const sql = `
        SELECT 
          date,
          COUNT(DISTINCT userID) FILTER (WHERE eventType='impression') AS impressions,
          COUNT(DISTINCT userID) FILTER (WHERE eventType='videoPlay') AS videoPlays,
          COUNT(DISTINCT userID) FILTER (WHERE eventType='click') AS clicks
        FROM fact_xr_engagement
        ${query.segment && query.segment !== 'All' ? 'JOIN dim_user ON fact_xr_engagement.userID = dim_user.userID' : ''}
        WHERE date BETWEEN $1 AND $2
        ${query.segment && query.segment !== 'All' ? 'AND dim_user.segment = $3' : ''}
        GROUP BY date 
        ORDER BY date ASC
      `;

      const params = [query.startDate, query.endDate];
      if (query.segment && query.segment !== 'All') {
        params.push(query.segment);
      }

      const results = await this.dataWarehouseService.query(sql, params);

      const engagementData: UserEngagementData[] = results.map((row: any) => ({
        date: row.date,
        impressions: parseInt(row.impressions) || 0,
        videoPlays: parseInt(row.videoplays) || 0,
        clicks: parseInt(row.clicks) || 0,
        conversionRate: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0
      }));

      // Cache result
      this.setCachedResult(cacheKey, engagementData);

      // Record metrics
      await this.performanceMonitor.recordTiming('get_user_engagement_duration', startTime);
      await this.performanceMonitor.recordMetric('engagement_requests', 1);

      return engagementData;

    } catch (error) {
      this.logger.error('Failed to get user engagement data', {
        query,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('engagement_errors', 1, {
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get sales data
   */
  async getSales(
    query: AnalyticsQuery,
    context: AnalyticsSecurityContext
  ): Promise<SalesData[]> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting sales data', query);

      // Validate access
      await this.securityService.validateAnalyticsRequest('analytics.read', context);

      // Validate parameters
      this.validateDateRange(query.startDate, query.endDate);
      this.validateChannel(query.channel);

      // Check cache
      const cacheKey = `sales:${JSON.stringify(query)}`;
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }

      // Query data warehouse
      const sql = `
        SELECT 
          date, 
          SUM(total_amount) AS revenue, 
          SUM(total_orders) AS orders
        FROM fact_sales_daily
        WHERE date BETWEEN $1 AND $2
        ${query.channel && query.channel !== 'All' ? 'AND channel = $3' : ''}
        GROUP BY date 
        ORDER BY date ASC
      `;

      const params = [query.startDate, query.endDate];
      if (query.channel && query.channel !== 'All') {
        params.push(query.channel);
      }

      const results = await this.dataWarehouseService.query(sql, params);

      const salesData: SalesData[] = results.map((row: any) => ({
        date: row.date,
        revenue: parseFloat(row.revenue) || 0,
        orders: parseInt(row.orders) || 0,
        channel: query.channel
      }));

      // Cache result
      this.setCachedResult(cacheKey, salesData);

      // Record metrics
      await this.performanceMonitor.recordTiming('get_sales_duration', startTime);
      await this.performanceMonitor.recordMetric('sales_requests', 1);

      return salesData;

    } catch (error) {
      this.logger.error('Failed to get sales data', {
        query,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('sales_errors', 1, {
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get XR usage data
   */
  async getXRUsage(
    query: AnalyticsQuery,
    context: AnalyticsSecurityContext
  ): Promise<XRUsageData[]> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting XR usage data', query);

      // Validate access
      await this.securityService.validateAnalyticsRequest('analytics.read', context);

      // Validate parameters
      this.validateDateRange(query.startDate, query.endDate);

      // Check cache
      const cacheKey = `xr_usage:${JSON.stringify(query)}`;
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }

      // Query data warehouse
      const sql = `
        SELECT 
          date,
          ${query.poiID ? 'poiID,' : ''}
          SUM(CASE WHEN eventType = 'impression' THEN userCount ELSE 0 END) AS impressions,
          SUM(CASE WHEN eventType = 'videoPlay' THEN userCount ELSE 0 END) AS videoPlays,
          SUM(CASE WHEN eventType = 'click' THEN userCount ELSE 0 END) AS clicks
        FROM fact_xr_engagement
        WHERE date BETWEEN $1 AND $2
        ${query.poiID ? 'AND poiID = $3' : ''}
        GROUP BY date${query.poiID ? ', poiID' : ''}
        ORDER BY date ASC
      `;

      const params = [query.startDate, query.endDate];
      if (query.poiID) {
        params.push(query.poiID);
      }

      const results = await this.dataWarehouseService.query(sql, params);

      const xrData: XRUsageData[] = results.map((row: any) => ({
        date: row.date,
        poiID: row.poiid,
        impressions: parseInt(row.impressions) || 0,
        videoPlays: parseInt(row.videoplays) || 0,
        clicks: parseInt(row.clicks) || 0,
        conversionRate: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0
      }));

      // Cache result
      this.setCachedResult(cacheKey, xrData);

      // Record metrics
      await this.performanceMonitor.recordTiming('get_xr_usage_duration', startTime);
      await this.performanceMonitor.recordMetric('xr_usage_requests', 1);

      return xrData;

    } catch (error) {
      this.logger.error('Failed to get XR usage data', {
        query,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('xr_usage_errors', 1, {
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get loyalty statistics
   */
  async getLoyaltyStats(
    query: Pick<AnalyticsQuery, 'startDate' | 'endDate'>,
    context: AnalyticsSecurityContext
  ): Promise<LoyaltyStats> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting loyalty statistics', query);

      // Validate access
      await this.securityService.validateAnalyticsRequest('analytics.read', context);

      // Validate parameters
      this.validateDateRange(query.startDate, query.endDate);

      // Check cache
      const cacheKey = `loyalty:${query.startDate}:${query.endDate}`;
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }

      // Query totals
      const totalsSql = `
        SELECT 
          SUM(CASE WHEN type = 'earn' THEN earned ELSE 0 END) AS earnedTotal,
          SUM(CASE WHEN type = 'redeem' THEN redeemed ELSE 0 END) AS redeemedTotal
        FROM fact_loyalty_daily
        WHERE date BETWEEN $1 AND $2
      `;

      const tiersSql = `
        SELECT 
          tierID,
          SUM(CASE WHEN type = 'earn' THEN earned ELSE 0 END) AS earned,
          SUM(CASE WHEN type = 'redeem' THEN redeemed ELSE 0 END) AS redeemed
        FROM fact_loyalty_daily
        WHERE date BETWEEN $1 AND $2
        GROUP BY tierID 
        ORDER BY tierID
      `;

      const [totalsResult, tiersResult] = await Promise.all([
        this.dataWarehouseService.query(totalsSql, [query.startDate, query.endDate]),
        this.dataWarehouseService.query(tiersSql, [query.startDate, query.endDate])
      ]);

      const loyaltyStats: LoyaltyStats = {
        earnedTotal: parseInt(totalsResult[0]?.earnedtotal) || 0,
        redeemedTotal: parseInt(totalsResult[0]?.redeemedtotal) || 0,
        byTier: tiersResult.map((row: any) => ({
          tierID: row.tierid,
          earned: parseInt(row.earned) || 0,
          redeemed: parseInt(row.redeemed) || 0
        }))
      };

      // Cache result
      this.setCachedResult(cacheKey, loyaltyStats);

      // Record metrics
      await this.performanceMonitor.recordTiming('get_loyalty_stats_duration', startTime);
      await this.performanceMonitor.recordMetric('loyalty_stats_requests', 1);

      return loyaltyStats;

    } catch (error) {
      this.logger.error('Failed to get loyalty statistics', {
        query,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('loyalty_stats_errors', 1, {
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(
    query: AnalyticsQuery,
    context: AnalyticsSecurityContext
  ): Promise<NotificationStats> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting notification statistics', query);

      // Validate access
      await this.securityService.validateAnalyticsRequest('analytics.read', context);

      // Validate parameters
      this.validateDateRange(query.startDate, query.endDate);

      // Check cache
      const cacheKey = `notifications:${JSON.stringify(query)}`;
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }

      // Query data warehouse
      const sql = `
        SELECT 
          SUM(CASE WHEN eventType = 'sent' THEN count ELSE 0 END) AS sent,
          SUM(CASE WHEN eventType = 'delivered' THEN count ELSE 0 END) AS delivered,
          SUM(CASE WHEN eventType = 'opened' THEN count ELSE 0 END) AS opened,
          SUM(CASE WHEN eventType = 'clicked' THEN count ELSE 0 END) AS clicked,
          SUM(CASE WHEN eventType = 'failed' THEN count ELSE 0 END) AS failed
        FROM fact_notifications_daily
        WHERE date BETWEEN $1 AND $2
        ${query.channel && query.channel !== 'All' ? 'AND channel = $3' : ''}
      `;

      const params = [query.startDate, query.endDate];
      if (query.channel && query.channel !== 'All') {
        params.push(query.channel);
      }

      const results = await this.dataWarehouseService.query(sql, params);
      const row = results[0] || {};

      const notificationStats: NotificationStats = {
        sent: parseInt(row.sent) || 0,
        delivered: parseInt(row.delivered) || 0,
        opened: parseInt(row.opened) || 0,
        clicked: parseInt(row.clicked) || 0,
        failed: parseInt(row.failed) || 0
      };

      // Cache result
      this.setCachedResult(cacheKey, notificationStats);

      // Record metrics
      await this.performanceMonitor.recordTiming('get_notification_stats_duration', startTime);
      await this.performanceMonitor.recordMetric('notification_stats_requests', 1);

      return notificationStats;

    } catch (error) {
      this.logger.error('Failed to get notification statistics', {
        query,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('notification_stats_errors', 1, {
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get offline sync statistics
   */
  async getOfflineSyncStats(
    query: Pick<AnalyticsQuery, 'startDate' | 'endDate'>,
    context: AnalyticsSecurityContext
  ): Promise<OfflineSyncStats[]> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting offline sync statistics', query);

      // Validate access
      await this.securityService.validateAnalyticsRequest('analytics.read', context);

      // Validate parameters
      this.validateDateRange(query.startDate, query.endDate);

      // Check cache
      const cacheKey = `offline_sync:${query.startDate}:${query.endDate}`;
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }

      // Query data warehouse
      const sql = `
        SELECT 
          date,
          SUM(CASE WHEN status = 'success' THEN count ELSE 0 END) AS success,
          SUM(CASE WHEN status = 'failure' THEN count ELSE 0 END) AS failure
        FROM fact_offline_sync_daily
        WHERE date BETWEEN $1 AND $2
        GROUP BY date 
        ORDER BY date ASC
      `;

      const results = await this.dataWarehouseService.query(sql, [query.startDate, query.endDate]);

      const syncStats: OfflineSyncStats[] = results.map((row: any) => {
        const success = parseInt(row.success) || 0;
        const failure = parseInt(row.failure) || 0;
        const total = success + failure;
        
        return {
          date: row.date,
          success,
          failure,
          failureRate: total > 0 ? (failure / total) * 100 : 0
        };
      });

      // Cache result
      this.setCachedResult(cacheKey, syncStats);

      // Record metrics
      await this.performanceMonitor.recordTiming('get_offline_sync_stats_duration', startTime);
      await this.performanceMonitor.recordMetric('offline_sync_stats_requests', 1);

      return syncStats;

    } catch (error) {
      this.logger.error('Failed to get offline sync statistics', {
        query,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('offline_sync_stats_errors', 1, {
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get flight alerts data
   */
  async getFlightAlerts(
    query: AnalyticsQuery,
    context: AnalyticsSecurityContext
  ): Promise<FlightAlertData[]> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting flight alerts data', query);

      // Validate access
      await this.securityService.validateAnalyticsRequest('analytics.read', context);

      // Validate parameters
      this.validateDateRange(query.startDate, query.endDate);

      // Check cache
      const cacheKey = `flight_alerts:${JSON.stringify(query)}`;
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }

      // Query data warehouse
      const sql = `
        SELECT 
          date, 
          airline, 
          delays, 
          cancellations
        FROM fact_flight_alerts_daily
        WHERE date BETWEEN $1 AND $2
        ${query.airline ? 'AND airline = $3' : ''}
        ORDER BY date ASC, airline ASC
        ${query.limit ? `LIMIT ${query.limit}` : ''}
        ${query.offset ? `OFFSET ${query.offset}` : ''}
      `;

      const params = [query.startDate, query.endDate];
      if (query.airline) {
        params.push(query.airline);
      }

      const results = await this.dataWarehouseService.query(sql, params);

      const flightAlerts: FlightAlertData[] = results.map((row: any) => ({
        date: row.date,
        airline: row.airline,
        delays: parseInt(row.delays) || 0,
        cancellations: parseInt(row.cancellations) || 0
      }));

      // Cache result
      this.setCachedResult(cacheKey, flightAlerts);

      // Record metrics
      await this.performanceMonitor.recordTiming('get_flight_alerts_duration', startTime);
      await this.performanceMonitor.recordMetric('flight_alerts_requests', 1);

      return flightAlerts;

    } catch (error) {
      this.logger.error('Failed to get flight alerts data', {
        query,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('flight_alerts_errors', 1, {
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Export analytics data
   */
  async exportData(
    request: ExportRequest,
    context: AnalyticsSecurityContext
  ): Promise<{ downloadURL: string; filename: string }> {
    const startTime = Date.now();

    try {
      this.logger.info('Exporting analytics data', {
        reportType: request.reportType,
        format: request.format,
        startDate: request.startDate,
        endDate: request.endDate
      });

      // Validate access
      await this.securityService.validateAnalyticsRequest('analytics.export', context);

      // Validate parameters
      this.validateDateRange(request.startDate, request.endDate);
      this.validateExportRequest(request);

      // Estimate export size
      const estimatedRows = await this.estimateExportSize(request);
      if (estimatedRows > this.MAX_EXPORT_ROWS) {
        throw new ExportTooLargeError(estimatedRows, this.MAX_EXPORT_ROWS);
      }

      // Generate export
      const exportResult = await this.exportService.generateExport(request);

      // Record metrics
      await this.performanceMonitor.recordTiming('export_data_duration', startTime, {
        reportType: request.reportType,
        format: request.format
      });

      await this.performanceMonitor.recordMetric('exports_generated', 1, {
        reportType: request.reportType,
        format: request.format
      });

      this.logger.info('Data export completed successfully', {
        reportType: request.reportType,
        format: request.format,
        filename: exportResult.filename,
        duration: Date.now() - startTime
      });

      return exportResult;

    } catch (error) {
      this.logger.error('Failed to export analytics data', {
        reportType: request.reportType,
        format: request.format,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('export_errors', 1, {
        reportType: request.reportType,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get campaign metrics
   */
  async getCampaignMetrics(
    campaignID: string,
    context: AnalyticsSecurityContext
  ): Promise<CampaignMetrics> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting campaign metrics', { campaignID });

      // Validate access
      await this.securityService.validateAnalyticsRequest('analytics.read', context);

      // Check cache
      const cacheKey = `campaign:${campaignID}`;
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }

      // Query campaign metrics
      const metrics = await this.fetchCampaignMetrics(campaignID);

      // Cache result
      this.setCachedResult(cacheKey, metrics);

      // Record metrics
      await this.performanceMonitor.recordTiming('get_campaign_metrics_duration', startTime);

      return metrics;

    } catch (error) {
      this.logger.error('Failed to get campaign metrics', {
        campaignID,
        error: error.message,
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Get dashboard alerts
   */
  async getDashboardAlerts(
    context: AnalyticsSecurityContext
  ): Promise<DashboardAlert[]> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting dashboard alerts');

      // Validate access
      await this.securityService.validateAnalyticsRequest('analytics.read', context);

      // Get active alerts
      const alerts = await this.getActiveAlerts();

      // Record metrics
      await this.performanceMonitor.recordTiming('get_dashboard_alerts_duration', startTime);

      return alerts;

    } catch (error) {
      this.logger.error('Failed to get dashboard alerts', {
        error: error.message,
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private validateDateRange(startDate: string, endDate: string): void {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new InvalidDateRangeError(startDate, endDate);
    }

    if (start > end) {
      throw new InvalidDateRangeError(startDate, endDate);
    }

    if (start > now || end > now) {
      throw new InvalidDateRangeError(startDate, endDate);
    }
  }

  private validateSegment(segment?: string): void {
    if (segment && !this.SUPPORTED_SEGMENTS.includes(segment)) {
      throw new AnalyticsError(`Unsupported segment: ${segment}`, 'INVALID_SEGMENT');
    }
  }

  private validateChannel(channel?: string): void {
    if (channel && !this.SUPPORTED_CHANNELS.includes(channel)) {
      throw new AnalyticsError(`Unsupported channel: ${channel}`, 'INVALID_CHANNEL');
    }
  }

  private validateExportRequest(request: ExportRequest): void {
    const validReportTypes = ['sales', 'loyalty', 'xrUsage', 'notifications', 'offlineSync', 'flightAlerts'];
    if (!validReportTypes.includes(request.reportType)) {
      throw new AnalyticsError(`Invalid report type: ${request.reportType}`, 'INVALID_REPORT_TYPE');
    }

    const validFormats = ['csv', 'xlsx'];
    if (!validFormats.includes(request.format)) {
      throw new AnalyticsError(`Invalid format: ${request.format}`, 'INVALID_FORMAT');
    }
  }

  private getCachedResult(key: string): any {
    const cached = this.queryCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < (this.CACHE_TTL_MINUTES * 60 * 1000)) {
      return cached.data;
    }
    return null;
  }

  private setCachedResult(key: string, data: any): void {
    this.queryCache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Clean up old cache entries
    if (this.queryCache.size > 1000) {
      const oldestKey = this.queryCache.keys().next().value;
      this.queryCache.delete(oldestKey);
    }
  }

  private async startETLScheduler(): Promise<void> {
    // Start daily ETL jobs
    await this.etlService.scheduleJob('daily_aggregation', '0 2 * * *', async () => {
      await this.runDailyAggregation();
    });

    // Start dimension refresh
    await this.etlService.scheduleJob('dimension_refresh', '0 3 * * 0', async () => {
      await this.refreshDimensions();
    });
  }

  private async startStreamProcessing(): Promise<void> {
    // Start real-time stream processing
    await this.streamProcessorService.startProcessing();
  }

  private async startAnomalyDetection(): Promise<void> {
    // Start anomaly detection for alerts
    setInterval(async () => {
      await this.detectAnomalies();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private async runDailyAggregation(): Promise<void> {
    try {
      this.logger.info('Starting daily aggregation');
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      await Promise.all([
        this.aggregateSalesData(dateStr),
        this.aggregateLoyaltyData(dateStr),
        this.aggregateXREngagementData(dateStr),
        this.aggregateNotificationData(dateStr),
        this.aggregateOfflineSyncData(dateStr),
        this.aggregateFlightAlertData(dateStr)
      ]);

      this.logger.info('Daily aggregation completed successfully');
    } catch (error) {
      this.logger.error('Daily aggregation failed', { error: error.message });
      throw new ETLJobFailureError('daily_aggregation', { error: error.message });
    }
  }

  private async refreshDimensions(): Promise<void> {
    try {
      this.logger.info('Starting dimension refresh');
      
      await Promise.all([
        this.refreshPOIDimension(),
        this.refreshUserDimension(),
        this.refreshAirlineDimension(),
        this.refreshLoyaltyTierDimension(),
        this.refreshDateDimension()
      ]);

      this.logger.info('Dimension refresh completed successfully');
    } catch (error) {
      this.logger.error('Dimension refresh failed', { error: error.message });
      throw new ETLJobFailureError('dimension_refresh', { error: error.message });
    }
  }

  private async detectAnomalies(): Promise<void> {
    try {
      // Detect anomalies in key metrics
      const alerts: DashboardAlert[] = [];

      // Check offline sync failure rate
      const syncStats = await this.getOfflineSyncStats({
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
      }, { userID: 'system' } as AnalyticsSecurityContext);

      for (const stat of syncStats) {
        if (stat.failureRate && stat.failureRate > 5) {
          alerts.push({
            alertID: this.generateAlertID(),
            type: 'threshold',
            severity: 'high',
            title: 'High Offline Sync Failure Rate',
            description: `Offline sync failure rate is ${stat.failureRate.toFixed(1)}% on ${stat.date}`,
            metric: 'offline_sync_failure_rate',
            value: stat.failureRate,
            threshold: 5,
            timestamp: new Date(),
            acknowledged: false
          });
        }
      }

      // Store alerts
      for (const alert of alerts) {
        await this.storeAlert(alert);
      }

    } catch (error) {
      this.logger.error('Anomaly detection failed', { error: error.message });
    }
  }

  // Mock methods that would integrate with actual data sources
  private async getRevenueMetrics(startDate: string, endDate: string): Promise<{ amount: number; currency: string }> {
    // Implementation would query fact_sales_daily
    return { amount: 152345.67, currency: 'SGD' };
  }

  private async getMonthlyActiveUsers(startDate: string, endDate: string): Promise<number> {
    // Implementation would query fact_xr_engagement for unique users
    return 52340;
  }

  private async getDailyActiveUsers(): Promise<number> {
    // Implementation would query today's unique users
    return 11234;
  }

  private async getAverageSessionDuration(startDate: string, endDate: string): Promise<number> {
    // Implementation would query session data
    return 320; // seconds
  }

  private async estimateExportSize(request: ExportRequest): Promise<number> {
    // Implementation would estimate row count based on date range and filters
    return 50000;
  }

  private async fetchCampaignMetrics(campaignID: string): Promise<CampaignMetrics> {
    // Implementation would aggregate notification metrics by campaign
    return {
      campaignID,
      metrics: {
        sent: { push: 10000, email: 0, inApp: 10000 },
        delivered: { push: 9800, email: 0, inApp: 10000 },
        opened: { push: 4500, email: 0, inApp: 5200 },
        clicked: { push: 1200, email: 0, inApp: 800 },
        failed: { push: 200, email: 0, inApp: 0 }
      },
      recipientCount: 10000,
      startTime: new Date(),
      endTime: new Date()
    };
  }

  private async getActiveAlerts(): Promise<DashboardAlert[]> {
    // Implementation would query alerts table
    return [];
  }

  private async aggregateSalesData(date: string): Promise<void> {
    // Implementation would aggregate raw sales data
  }

  private async aggregateLoyaltyData(date: string): Promise<void> {
    // Implementation would aggregate raw loyalty data
  }

  private async aggregateXREngagementData(date: string): Promise<void> {
    // Implementation would aggregate raw XR events
  }

  private async aggregateNotificationData(date: string): Promise<void> {
    // Implementation would aggregate raw notification metrics
  }

  private async aggregateOfflineSyncData(date: string): Promise<void> {
    // Implementation would aggregate raw sync events
  }

  private async aggregateFlightAlertData(date: string): Promise<void> {
    // Implementation would aggregate raw flight status events
  }

  private async refreshPOIDimension(): Promise<void> {
    // Implementation would refresh POI dimension table
  }

  private async refreshUserDimension(): Promise<void> {
    // Implementation would refresh user dimension table
  }

  private async refreshAirlineDimension(): Promise<void> {
    // Implementation would refresh airline dimension table
  }

  private async refreshLoyaltyTierDimension(): Promise<void> {
    // Implementation would refresh loyalty tier dimension table
  }

  private async refreshDateDimension(): Promise<void> {
    // Implementation would refresh date dimension table
  }

  private async storeAlert(alert: DashboardAlert): Promise<void> {
    // Implementation would store alert in database
  }

  private generateAlertID(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    dependencies: { [key: string]: boolean };
    metrics: any;
  }> {
    const [
      dwHealth,
      streamHealth,
      etlHealth,
      exportHealth
    ] = await Promise.all([
      this.dataWarehouseService.getHealth(),
      this.streamProcessorService.getHealth(),
      this.etlService.getHealth(),
      this.exportService.getHealth()
    ]);

    const healthyServices = [
      dwHealth.available,
      streamHealth.available,
      etlHealth.available,
      exportHealth.available
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
        dataWarehouse: dwHealth.available,
        streamProcessor: streamHealth.available,
        etl: etlHealth.available,
        export: exportHealth.available
      },
      metrics: {
        avgQueryTime: this.performanceMonitor.getMetricStats('get_overview_duration')?.avg || 0,
        dailyQueries: this.performanceMonitor.getMetricStats('overview_requests')?.sum || 0,
        cacheHitRate: this.calculateCacheHitRate(),
        lastETLRun: await this.etlService.getLastRunTime()
      }
    };
  }

  private calculateCacheHitRate(): number {
    // Calculate cache hit rate based on cache usage
    return 85.5; // Mock value
  }
} 
