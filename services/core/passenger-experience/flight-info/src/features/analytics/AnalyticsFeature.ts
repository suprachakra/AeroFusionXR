import { createLogger, createPerformanceMonitor, PerformanceMonitor } from '@aerofusionxr/shared';

// Core analytics interfaces
export interface FlightOverviewMetrics {
  totalFlights: number;
  onTimePerformance: number; // percentage
  averageDelay: number; // minutes
  cancellationRate: number; // percentage
  passengerCount: number;
  revenue: {
    amount: number;
    currency: string;
  };
}

export interface FlightPerformanceData {
  date: string;
  airline: string;
  flightNumber?: string;
  onTimeFlights: number;
  delayedFlights: number;
  cancelledFlights: number;
  averageDelay: number;
  passengerCount: number;
}

export interface PassengerEngagementData {
  date: string;
  appUsage: number;
  notificationOpens: number;
  serviceRequests: number;
  satisfactionScore: number;
}

export interface FlightAlertData {
  date: string;
  airline: string;
  delays: number;
  cancellations: number;
  gateChanges: number;
  weatherImpacts: number;
}

export interface NotificationStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  byType: {
    gateChange: number;
    delay: number;
    boarding: number;
    cancellation: number;
  };
}

export interface RevenueData {
  date: string;
  ticketSales: number;
  ancillaryRevenue: number;
  totalRevenue: number;
  passengerCount: number;
  revenuePerPassenger: number;
}

export interface AnalyticsQuery {
  startDate: string;
  endDate: string;
  airline?: string;
  terminal?: string;
  flightNumber?: string;
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
  type: 'delay_spike' | 'cancellation_rate' | 'passenger_complaint' | 'system_failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  metric: string;
  value: number;
  threshold?: number;
  timestamp: Date;
  acknowledged: boolean;
  flightNumber?: string;
  airline?: string;
}

export interface ExportRequest {
  reportType: 'flight_performance' | 'passenger_engagement' | 'revenue' | 'notifications' | 'alerts';
  startDate: string;
  endDate: string;
  format: 'csv' | 'xlsx';
  filters?: { [key: string]: any };
}

export interface RealTimeMetrics {
  activeFlights: number;
  delayedFlights: number;
  cancelledFlights: number;
  averageDelay: number;
  passengerCount: number;
  gateChanges: number;
  lastUpdated: Date;
}

/**
 * Analytics Feature Module
 * Consolidated from dashboard-analytics service into flight-info
 * 
 * Features:
 * - Flight performance analytics and KPI tracking
 * - Passenger engagement and satisfaction metrics
 * - Real-time operational dashboards
 * - Revenue and business intelligence reporting
 * - Notification effectiveness analytics
 * - Predictive analytics for delays and disruptions
 * - Data export and visualization capabilities
 */
export class AnalyticsFeature {
  private logger = createLogger('flight-info.analytics');
  private performanceMonitor = createPerformanceMonitor('analytics');
  private queryCache: Map<string, { data: any; timestamp: number }> = new Map();
  
  // Configuration
  private readonly CACHE_TTL_MINUTES = 15;
  private readonly DEFAULT_LIMIT = 50;
  private readonly MAX_LIMIT = 1000;

  constructor() {
    this.logger.info('Analytics Feature initialized');
  }

  /**
   * Get flight overview metrics for dashboard
   * @param query - Date range and filters
   */
  async getFlightOverview(query: Pick<AnalyticsQuery, 'startDate' | 'endDate'>): Promise<FlightOverviewMetrics> {
    const timer = this.performanceMonitor.startTimer('get_flight_overview');
    
    try {
      this.logger.info('Getting flight overview metrics', {
        startDate: query.startDate,
        endDate: query.endDate
      });

      // Check cache first
      const cacheKey = `overview_${query.startDate}_${query.endDate}`;
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        timer.end(true);
        return cached;
      }

      // Mock data - in real implementation, this would query data warehouse
      const metrics: FlightOverviewMetrics = {
        totalFlights: 1250,
        onTimePerformance: 82.5,
        averageDelay: 18.5,
        cancellationRate: 2.1,
        passengerCount: 156780,
        revenue: {
          amount: 12500000,
          currency: 'USD'
        }
      };

      // Cache result
      this.setCachedResult(cacheKey, metrics);

      this.performanceMonitor.recordMetric('flight_overview_generated', 1, {
        totalFlights: metrics.totalFlights,
        onTimePerformance: metrics.onTimePerformance
      });

      this.logger.info('Flight overview metrics generated', {
        totalFlights: metrics.totalFlights,
        onTimePerformance: metrics.onTimePerformance
      });

      timer.end(true);
      return metrics;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get flight overview', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get flight performance data over time
   * @param query - Analytics query with filters
   */
  async getFlightPerformance(query: AnalyticsQuery): Promise<FlightPerformanceData[]> {
    const timer = this.performanceMonitor.startTimer('get_flight_performance');
    
    try {
      this.logger.info('Getting flight performance data', {
        startDate: query.startDate,
        endDate: query.endDate,
        airline: query.airline
      });

      // Validate date range
      this.validateDateRange(query.startDate, query.endDate);

      // Check cache
      const cacheKey = `performance_${JSON.stringify(query)}`;
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        timer.end(true);
        return cached;
      }

      // Mock data generation
      const data: FlightPerformanceData[] = this.generateMockFlightPerformanceData(query);

      // Cache result
      this.setCachedResult(cacheKey, data);

      this.performanceMonitor.recordMetric('flight_performance_retrieved', data.length, {
        airline: query.airline || 'all',
        dateRange: `${query.startDate}_${query.endDate}`
      });

      timer.end(true);
      return data;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get flight performance data', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get passenger engagement metrics
   * @param query - Analytics query with filters
   */
  async getPassengerEngagement(query: AnalyticsQuery): Promise<PassengerEngagementData[]> {
    const timer = this.performanceMonitor.startTimer('get_passenger_engagement');
    
    try {
      this.logger.info('Getting passenger engagement data', {
        startDate: query.startDate,
        endDate: query.endDate
      });

      // Validate date range
      this.validateDateRange(query.startDate, query.endDate);

      // Check cache
      const cacheKey = `engagement_${JSON.stringify(query)}`;
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        timer.end(true);
        return cached;
      }

      // Mock data generation
      const data: PassengerEngagementData[] = this.generateMockEngagementData(query);

      // Cache result
      this.setCachedResult(cacheKey, data);

      this.performanceMonitor.recordMetric('passenger_engagement_retrieved', data.length);

      timer.end(true);
      return data;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get passenger engagement data', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get flight alert data for operational monitoring
   * @param query - Analytics query with filters
   */
  async getFlightAlerts(query: AnalyticsQuery): Promise<FlightAlertData[]> {
    const timer = this.performanceMonitor.startTimer('get_flight_alerts');
    
    try {
      this.logger.info('Getting flight alert data', {
        startDate: query.startDate,
        endDate: query.endDate,
        airline: query.airline
      });

      // Validate date range
      this.validateDateRange(query.startDate, query.endDate);

      // Check cache
      const cacheKey = `alerts_${JSON.stringify(query)}`;
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        timer.end(true);
        return cached;
      }

      // Mock data generation
      const data: FlightAlertData[] = this.generateMockAlertData(query);

      // Cache result
      this.setCachedResult(cacheKey, data);

      this.performanceMonitor.recordMetric('flight_alerts_retrieved', data.length, {
        airline: query.airline || 'all'
      });

      timer.end(true);
      return data;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get flight alert data', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get notification effectiveness statistics
   * @param query - Analytics query with filters
   */
  async getNotificationStats(query: AnalyticsQuery): Promise<NotificationStats> {
    const timer = this.performanceMonitor.startTimer('get_notification_stats');
    
    try {
      this.logger.info('Getting notification statistics', {
        startDate: query.startDate,
        endDate: query.endDate
      });

      // Validate date range
      this.validateDateRange(query.startDate, query.endDate);

      // Check cache
      const cacheKey = `notif_stats_${JSON.stringify(query)}`;
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        timer.end(true);
        return cached;
      }

      // Mock data generation
      const stats: NotificationStats = {
        sent: 45680,
        delivered: 43250,
        opened: 28900,
        clicked: 12340,
        failed: 2430,
        byType: {
          gateChange: 8950,
          delay: 15670,
          boarding: 18760,
          cancellation: 2300
        }
      };

      // Cache result
      this.setCachedResult(cacheKey, stats);

      this.performanceMonitor.recordMetric('notification_stats_retrieved', 1, {
        deliveryRate: (stats.delivered / stats.sent * 100).toFixed(2),
        openRate: (stats.opened / stats.delivered * 100).toFixed(2)
      });

      timer.end(true);
      return stats;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get notification statistics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get revenue analytics data
   * @param query - Analytics query with filters
   */
  async getRevenueData(query: AnalyticsQuery): Promise<RevenueData[]> {
    const timer = this.performanceMonitor.startTimer('get_revenue_data');
    
    try {
      this.logger.info('Getting revenue data', {
        startDate: query.startDate,
        endDate: query.endDate
      });

      // Validate date range
      this.validateDateRange(query.startDate, query.endDate);

      // Check cache
      const cacheKey = `revenue_${JSON.stringify(query)}`;
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        timer.end(true);
        return cached;
      }

      // Mock data generation
      const data: RevenueData[] = this.generateMockRevenueData(query);

      // Cache result
      this.setCachedResult(cacheKey, data);

      this.performanceMonitor.recordMetric('revenue_data_retrieved', data.length);

      timer.end(true);
      return data;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get revenue data', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get real-time operational metrics
   */
  async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    const timer = this.performanceMonitor.startTimer('get_realtime_metrics');
    
    try {
      this.logger.debug('Getting real-time metrics');

      // Mock real-time data
      const metrics: RealTimeMetrics = {
        activeFlights: 127,
        delayedFlights: 23,
        cancelledFlights: 3,
        averageDelay: 22.5,
        passengerCount: 15670,
        gateChanges: 8,
        lastUpdated: new Date()
      };

      this.performanceMonitor.recordMetric('realtime_metrics_retrieved', 1, {
        activeFlights: metrics.activeFlights,
        delayedFlights: metrics.delayedFlights
      });

      timer.end(true);
      return metrics;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get real-time metrics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get dashboard alerts for operational issues
   */
  async getDashboardAlerts(): Promise<DashboardAlert[]> {
    const timer = this.performanceMonitor.startTimer('get_dashboard_alerts');
    
    try {
      this.logger.debug('Getting dashboard alerts');

      // Mock alerts data
      const alerts: DashboardAlert[] = [
        {
          alertID: 'alert_001',
          type: 'delay_spike',
          severity: 'high',
          title: 'High Delay Rate Detected',
          description: 'Delay rate has exceeded 30% in the last hour',
          metric: 'delay_rate',
          value: 32.5,
          threshold: 25,
          timestamp: new Date(Date.now() - 15 * 60 * 1000),
          acknowledged: false,
          airline: 'AA'
        },
        {
          alertID: 'alert_002',
          type: 'cancellation_rate',
          severity: 'medium',
          title: 'Increased Cancellations',
          description: 'Cancellation rate above normal for weather conditions',
          metric: 'cancellation_rate',
          value: 5.2,
          threshold: 3.0,
          timestamp: new Date(Date.now() - 45 * 60 * 1000),
          acknowledged: false
        }
      ];

      this.performanceMonitor.recordMetric('dashboard_alerts_retrieved', alerts.length, {
        criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
        unacknowledged: alerts.filter(a => !a.acknowledged).length
      });

      timer.end(true);
      return alerts;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get dashboard alerts', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Export analytics data to file
   * @param request - Export request with format and filters
   */
  async exportData(request: ExportRequest): Promise<{ downloadURL: string; filename: string }> {
    const timer = this.performanceMonitor.startTimer('export_data');
    
    try {
      this.logger.info('Exporting analytics data', {
        reportType: request.reportType,
        format: request.format,
        startDate: request.startDate,
        endDate: request.endDate
      });

      // Validate request
      this.validateExportRequest(request);

      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${request.reportType}_${timestamp}.${request.format}`;

      // Mock export process
      const downloadURL = `https://exports.aerofusionxr.com/analytics/${filename}`;

      this.performanceMonitor.recordMetric('data_exported', 1, {
        reportType: request.reportType,
        format: request.format
      });

      this.logger.info('Data export completed', {
        filename,
        downloadURL
      });

      timer.end(true);
      return { downloadURL, filename };

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to export data', {
        reportType: request.reportType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Private helper methods

  private validateDateRange(startDate: string, endDate: string): void {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format');
    }
    
    if (start >= end) {
      throw new Error('Start date must be before end date');
    }
    
    const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year
    if (end.getTime() - start.getTime() > maxRange) {
      throw new Error('Date range cannot exceed 1 year');
    }
  }

  private validateExportRequest(request: ExportRequest): void {
    const validReportTypes = ['flight_performance', 'passenger_engagement', 'revenue', 'notifications', 'alerts'];
    const validFormats = ['csv', 'xlsx'];
    
    if (!validReportTypes.includes(request.reportType)) {
      throw new Error(`Invalid report type: ${request.reportType}`);
    }
    
    if (!validFormats.includes(request.format)) {
      throw new Error(`Invalid format: ${request.format}`);
    }
    
    this.validateDateRange(request.startDate, request.endDate);
  }

  private getCachedResult(key: string): any {
    const cached = this.queryCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MINUTES * 60 * 1000) {
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

  private generateMockFlightPerformanceData(query: AnalyticsQuery): FlightPerformanceData[] {
    const data: FlightPerformanceData[] = [];
    const start = new Date(query.startDate);
    const end = new Date(query.endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      data.push({
        date: d.toISOString().split('T')[0],
        airline: query.airline || 'AA',
        onTimeFlights: Math.floor(Math.random() * 50) + 80,
        delayedFlights: Math.floor(Math.random() * 20) + 10,
        cancelledFlights: Math.floor(Math.random() * 5) + 1,
        averageDelay: Math.floor(Math.random() * 30) + 15,
        passengerCount: Math.floor(Math.random() * 5000) + 8000
      });
    }
    
    return data;
  }

  private generateMockEngagementData(query: AnalyticsQuery): PassengerEngagementData[] {
    const data: PassengerEngagementData[] = [];
    const start = new Date(query.startDate);
    const end = new Date(query.endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      data.push({
        date: d.toISOString().split('T')[0],
        appUsage: Math.floor(Math.random() * 2000) + 3000,
        notificationOpens: Math.floor(Math.random() * 1500) + 2000,
        serviceRequests: Math.floor(Math.random() * 500) + 200,
        satisfactionScore: Math.round((Math.random() * 2 + 3) * 10) / 10 // 3.0-5.0
      });
    }
    
    return data;
  }

  private generateMockAlertData(query: AnalyticsQuery): FlightAlertData[] {
    const data: FlightAlertData[] = [];
    const start = new Date(query.startDate);
    const end = new Date(query.endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      data.push({
        date: d.toISOString().split('T')[0],
        airline: query.airline || 'AA',
        delays: Math.floor(Math.random() * 25) + 5,
        cancellations: Math.floor(Math.random() * 8) + 1,
        gateChanges: Math.floor(Math.random() * 12) + 2,
        weatherImpacts: Math.floor(Math.random() * 5)
      });
    }
    
    return data;
  }

  private generateMockRevenueData(query: AnalyticsQuery): RevenueData[] {
    const data: RevenueData[] = [];
    const start = new Date(query.startDate);
    const end = new Date(query.endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const passengerCount = Math.floor(Math.random() * 5000) + 8000;
      const ticketSales = passengerCount * (Math.random() * 200 + 300);
      const ancillaryRevenue = passengerCount * (Math.random() * 50 + 25);
      
      data.push({
        date: d.toISOString().split('T')[0],
        ticketSales: Math.round(ticketSales),
        ancillaryRevenue: Math.round(ancillaryRevenue),
        totalRevenue: Math.round(ticketSales + ancillaryRevenue),
        passengerCount,
        revenuePerPassenger: Math.round((ticketSales + ancillaryRevenue) / passengerCount)
      });
    }
    
    return data;
  }
} 