import { createLogger } from '@aerofusionxr/shared';
import { PerformanceMonitor } from '@aerofusionxr/shared';
import { SecurityService, NotificationSecurityContext, NotificationAuditEvent } from '../security/SecurityService';
import { TemplateEngine, TemplateRenderContext } from '../templates/TemplateEngine';
import { PushProvider, PushRequest, PushResult } from '../providers/PushProvider';
import { EmailProvider, EmailRequest, EmailResult } from '../providers/EmailProvider';
import { PushService } from '../push/PushService';
import { InAppMessageService } from '../inapp/InAppMessageService';
import { TemplateService } from '../templates/TemplateService';
import { SchedulerService } from '../scheduler/SchedulerService';
import { GeoFenceService } from '../geofence/GeoFenceService';
import { WebSocketService } from '../websocket/WebSocketService';
import { CacheService } from '../utils/CacheService';
import { DeviceTokenService } from '../providers/DeviceTokenService';
import { PushProviderService } from '../providers/PushProviderService';
import { EmailProviderService } from '../providers/EmailProviderService';
import { QueueService } from '../queue/QueueService';
import { MetricsService } from '../metrics/MetricsService';

// Core notification interfaces
export interface UserDeviceToken {
  userID: string;
  deviceToken: string;
  platform: 'android' | 'ios';
  lastRegisteredAt: Date;
  isActive: boolean;
}

export interface UserNotificationPreferences {
  userID: string;
  enablePush: boolean;
  enableEmail: boolean;
  enableInApp: boolean;
  enableSMS: boolean;
  doNotDisturb: {
    enabled: boolean;
    startTime?: string; // "22:00"
    endTime?: string;   // "08:00"
    timezone?: string;  // "UTC"
  };
  locale: string;
  email?: string;
  phoneNumber?: string;
}

export interface NotificationTemplate {
  templateID: string;
  channel: 'push' | 'email' | 'inApp' | 'sms';
  locale: string;
  titleTemplate: string;
  bodyTemplate: string;
  actionURLTemplate?: string;
}

export interface NotificationRequest {
  userID: string;
  templateID: string;
  channels: ('push' | 'email' | 'inApp' | 'sms')[];
  context: TemplateRenderContext;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduledAt?: Date;
  expiresAt?: Date;
}

export interface NotificationResult {
  notificationID: string;
  userID: string;
  templateID: string;
  channels: {
    channel: string;
    success: boolean;
    messageID?: string;
    error?: string;
  }[];
  totalChannels: number;
  successChannels: number;
  failureChannels: number;
  sentAt: Date;
}

export interface InAppMessage {
  messageID: string;
  userID: string;
  title: string;
  body: string;
  actionURL?: string;
  priority: string;
  isRead: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

export interface DeviceToken {
  userID: string;
  platform: 'android' | 'ios' | 'web';
  token: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebPushSubscription {
  userID: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferences {
  userID: string;
  channelsEnabled: {
    push: boolean;
    email: boolean;
    inApp: boolean;
  };
  dndStart: string; // "HH:mm" format
  dndEnd: string;   // "HH:mm" format
  locales: string[];
  lastUpdated: Date;
}

export interface NotificationLog {
  logID: string;
  messageID: string;
  userID: string;
  channel: 'push' | 'inApp';
  templateKey: string;
  status: 'sent' | 'delivered' | 'failed' | 'skipped' | 'opened';
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  error?: string;
  createdAt: Date;
}

export interface ScheduledNotification {
  scheduleID: string;
  userID: string;
  templateKey: string;
  data: any;
  scheduleAt: Date;
  geoFence?: GeoFenceCondition;
  status: 'scheduled' | 'sent' | 'failed' | 'cancelled';
  sentAt?: Date;
  createdAt: Date;
}

export interface GeoFenceCondition {
  terminal?: string;
  gate?: string;
  latitude?: number;
  longitude?: number;
  radius: number; // meters
}

export interface SendPushRequest {
  userID: string;
  channel: 'push';
  templateKey: string;
  data?: any;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  scheduleAt?: Date;
  geoFence?: GeoFenceCondition;
  ttl?: number;
}

export interface SendInAppRequest {
  userID: string;
  templateKey: string;
  data?: any;
  actionURL?: string;
  scheduleAt?: Date;
  expiresAt?: Date;
}

export interface NotificationMetrics {
  date: string;
  channel: 'push' | 'inApp';
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalFailed: number;
}

export interface RegisterTokenRequest {
  userID: string;
  platform: 'android' | 'ios' | 'web';
  token: string;
}

export interface RegisterWebPushRequest {
  userID: string;
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
}

export interface NotificationStats {
  totalUsers: number;
  totalPushTokens: number;
  totalWebPushSubscriptions: number;
  totalMessagesSent: number;
  totalMessagesDelivered: number;
  deliveryRate: number;
  openRate: number;
  averageDeliveryTime: number;
}

export interface NotificationRecord {
  notificationID: string;
  userID: string;
  type: 'transactional' | 'promotional' | 'system';
  templateKey: string;
  payload: any;
  messages: {
    title: string;
    body: string;
    actionURL?: string;
  };
  channels: string[];
  status: {
    push?: 'queued' | 'sent' | 'delivered' | 'failed' | 'skipped' | 'expired';
    email?: 'queued' | 'sent' | 'delivered' | 'failed' | 'skipped' | 'expired';
    inApp?: 'unread' | 'read' | 'expired';
  };
  createdAt: Date;
  expiresAt: Date;
  campaignID?: string;
}

export interface NotificationMetric {
  metricID: string;
  notificationID: string;
  eventType: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
  channel: 'push' | 'email' | 'inApp';
  timestamp: Date;
  details?: any;
}

export interface CampaignMetrics {
  campaignID: string;
  metrics: NotificationStats;
  recipientCount: number;
  startTime: Date;
  endTime?: Date;
}

// Error classes
export class NotificationError extends Error {
  constructor(message: string, public code: string, public userID?: string) {
    super(message);
    this.name = 'NotificationError';
  }
}

export class NoDeviceTokenError extends NotificationError {
  constructor(userID: string) {
    super(`No device token found for user: ${userID}`, 'NO_DEVICE_TOKEN', userID);
  }
}

export class InvalidSubscriptionError extends NotificationError {
  constructor(message: string) {
    super(`Invalid web push subscription: ${message}`, 'INVALID_SUBSCRIPTION');
  }
}

export class TemplateNotFoundError extends NotificationError {
  constructor(templateID: string) {
    super(`Notification template not found: ${templateID}`, 'TEMPLATE_NOT_FOUND');
  }
}

export class UserNotFoundError extends NotificationError {
  constructor(userID: string) {
    super(`User not found: ${userID}`, 'USER_NOT_FOUND', userID);
  }
}

export class DoNotDisturbError extends NotificationError {
  constructor(userID: string) {
    super(`User has do-not-disturb enabled: ${userID}`, 'DO_NOT_DISTURB', userID);
  }
}

export class NotificationService {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private securityService: SecurityService;
  private templateEngine: TemplateEngine;
  private pushProvider: PushProvider;
  private emailProvider: EmailProvider;
  private pushService: PushService;
  private inAppMessageService: InAppMessageService;
  private templateService: TemplateService;
  private schedulerService: SchedulerService;
  private geoFenceService: GeoFenceService;
  private webSocketService: WebSocketService;
  private cacheService: CacheService;
  private deviceTokenService: DeviceTokenService;
  private pushProviderService: PushProviderService;
  private emailProviderService: EmailProviderService;
  private queueService: QueueService;
  private metricsService: MetricsService;

  // Mock data stores (in real implementation, these would be database services)
  private mockUserPreferences: Map<string, UserNotificationPreferences> = new Map();
  private mockUserDevices: Map<string, UserDeviceToken[]> = new Map();
  private mockTemplates: Map<string, NotificationTemplate> = new Map();
  private mockInAppMessages: Map<string, InAppMessage[]> = new Map();

  constructor() {
    this.logger = new Logger('NotificationService');
    this.performanceMonitor = new PerformanceMonitor();
    this.securityService = new SecurityService();
    this.templateEngine = new TemplateEngine();
    this.pushProvider = new PushProvider();
    this.emailProvider = new EmailProvider();
    this.pushService = new PushService();
    this.inAppMessageService = new InAppMessageService();
    this.templateService = new TemplateService();
    this.schedulerService = new SchedulerService();
    this.geoFenceService = new GeoFenceService();
    this.webSocketService = new WebSocketService();
    this.cacheService = new CacheService();
    this.deviceTokenService = new DeviceTokenService();
    this.pushProviderService = new PushProviderService();
    this.emailProviderService = new EmailProviderService();
    this.queueService = new QueueService();
    this.metricsService = new MetricsService();

    this.initializeMockData();
  }

  /**
   * Send notification to user across specified channels
   */
  async sendNotification(request: NotificationRequest, context: NotificationSecurityContext): Promise<NotificationResult> {
    const startTime = Date.now();
    const notificationID = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      this.logger.info('Processing notification request', {
        notificationID,
        userID: request.userID,
        templateID: request.templateID,
        channels: request.channels,
        priority: request.priority,
        scheduledAt: request.scheduledAt,
        expiresAt: request.expiresAt
      });

      // Validate request
      await this.validateNotificationRequest(request, context);

      // Check if notification is expired
      if (request.expiresAt && request.expiresAt < new Date()) {
        throw new NotificationError('Notification has expired', 'NOTIFICATION_EXPIRED', request.userID);
      }

      // Get user preferences
      const userPreferences = await this.getUserPreferences(request.userID);
      if (!userPreferences) {
        throw new UserNotFoundError(request.userID);
      }

      // Check do-not-disturb settings
      if (await this.isDoNotDisturbActive(userPreferences)) {
        if (request.priority !== 'urgent') {
          throw new DoNotDisturbError(request.userID);
        }
      }

      // Filter channels based on user preferences
      const enabledChannels = this.filterEnabledChannels(request.channels, userPreferences);
      
      if (enabledChannels.length === 0) {
        this.logger.warn('No enabled channels for user', {
          userID: request.userID,
          requestedChannels: request.channels,
          userPreferences: {
            enablePush: userPreferences.enablePush,
            enableEmail: userPreferences.enableEmail,
            enableInApp: userPreferences.enableInApp,
            enableSMS: userPreferences.enableSMS
          }
        });
      }

      // Get template
      const template = await this.getTemplate(request.templateID, userPreferences.locale);
      if (!template) {
        throw new TemplateNotFoundError(request.templateID);
      }

      // Send to each enabled channel
      const channelResults = await this.sendToChannels(
        enabledChannels,
        template,
        request.context,
        userPreferences,
        context
      );

      const result: NotificationResult = {
        notificationID,
        userID: request.userID,
        templateID: request.templateID,
        channels: channelResults,
        totalChannels: channelResults.length,
        successChannels: channelResults.filter(r => r.success).length,
        failureChannels: channelResults.filter(r => !r.success).length,
        sentAt: new Date()
      };

      // Record metrics
      await this.performanceMonitor.recordMetric('notification_send_duration', Date.now() - startTime, {
        priority: request.priority,
        channels: channelResults.length,
        success: result.successChannels > 0 ? 1 : 0
      });

      // Audit log
      await this.securityService.auditNotificationAction({
        userID: request.userID,
        action: 'notification_send',
        channel: channelResults.map(r => r.channel).join(','),
        templateID: request.templateID,
        timestamp: new Date(),
        success: result.successChannels > 0
      });

      this.logger.info('Notification sent successfully', {
        notificationID,
        userID: request.userID,
        successChannels: result.successChannels,
        failureChannels: result.failureChannels,
        duration: Date.now() - startTime
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to send notification', {
        notificationID,
        userID: request.userID,
        error: error.message,
        duration: Date.now() - startTime
      });

      // Audit log failure
      await this.securityService.auditNotificationAction({
        userID: request.userID,
        action: 'notification_send',
        channel: request.channels.join(','),
        templateID: request.templateID,
        timestamp: new Date(),
        success: false,
        errorDetails: error.message
      });

      throw error;
    }
  }

  /**
   * Send notifications to multiple channels
   */
  private async sendToChannels(
    channels: string[],
    template: NotificationTemplate,
    context: TemplateRenderContext,
    userPreferences: UserNotificationPreferences,
    securityContext: NotificationSecurityContext
  ): Promise<{ channel: string; success: boolean; messageID?: string; error?: string }[]> {
    
    const results = [];
    
    for (const channel of channels) {
      try {
        // Create channel-specific template
        const channelTemplate = { ...template, channel: channel as any };
        
        // Render template
        const rendered = await this.templateEngine.render(channelTemplate, context);
        
        let channelResult;
        
        switch (channel) {
          case 'push':
            channelResult = await this.sendPushNotification(rendered, userPreferences, securityContext);
            break;
          case 'email':
            channelResult = await this.sendEmailNotification(rendered, userPreferences, securityContext);
            break;
          case 'inApp':
            channelResult = await this.sendInAppNotification(rendered, userPreferences, securityContext);
            break;
          case 'sms':
            channelResult = await this.sendSMSNotification(rendered, userPreferences, securityContext);
            break;
          default:
            throw new Error(`Unsupported channel: ${channel}`);
        }

        results.push({
          channel,
          success: channelResult.success,
          messageID: channelResult.messageID,
          error: channelResult.error
        });

      } catch (error) {
        this.logger.error(`Failed to send ${channel} notification`, {
          userID: userPreferences.userID,
          error: error.message
        });

        results.push({
          channel,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(
    rendered: any,
    userPreferences: UserNotificationPreferences,
    context: NotificationSecurityContext
  ): Promise<{ success: boolean; messageID?: string; error?: string }> {
    
    // Validate security
    await this.securityService.validateNotificationSend(userPreferences.userID, 'push', context);

    // Get user devices
    const devices = this.mockUserDevices.get(userPreferences.userID) || [];
    const activeDevices = devices.filter(d => d.isActive);

    if (activeDevices.length === 0) {
      return { success: false, error: 'No active devices found' };
    }

    // Send to all devices
    const pushRequests: PushRequest[] = activeDevices.map(device => ({
      deviceToken: device.deviceToken,
      platform: device.platform,
      title: rendered.title,
      body: rendered.body,
      data: rendered.actionURL ? { actionURL: rendered.actionURL } : undefined
    }));

    const pushResults = await this.pushProvider.sendBatch(pushRequests);
    const successCount = pushResults.filter(r => r.success).length;

    if (successCount > 0) {
      return { 
        success: true, 
        messageID: pushResults.find(r => r.success)?.messageID 
      };
    } else {
      return { 
        success: false, 
        error: pushResults[0]?.error || 'All push notifications failed' 
      };
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    rendered: any,
    userPreferences: UserNotificationPreferences,
    context: NotificationSecurityContext
  ): Promise<{ success: boolean; messageID?: string; error?: string }> {
    
    // Validate security
    await this.securityService.validateNotificationSend(userPreferences.userID, 'email', context);

    if (!userPreferences.email) {
      return { success: false, error: 'No email address configured' };
    }

    const emailRequest: EmailRequest = {
      to: userPreferences.email,
      subject: rendered.title,
      htmlBody: rendered.body,
      actionURL: rendered.actionURL
    };

    const emailResult = await this.emailProvider.send(emailRequest);
    
    return {
      success: emailResult.success,
      messageID: emailResult.messageID,
      error: emailResult.error
    };
  }

  /**
   * Send in-app notification
   */
  private async sendInAppNotification(
    rendered: any,
    userPreferences: UserNotificationPreferences,
    context: NotificationSecurityContext
  ): Promise<{ success: boolean; messageID?: string; error?: string }> {
    
    // Validate security
    await this.securityService.validateNotificationSend(userPreferences.userID, 'inApp', context);

    const messageID = `inapp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const inAppMessage: InAppMessage = {
      messageID,
      userID: userPreferences.userID,
      title: rendered.title,
      body: rendered.body,
      actionURL: rendered.actionURL,
      priority: 'normal',
      isRead: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };

    // Store in-app message
    const userMessages = this.mockInAppMessages.get(userPreferences.userID) || [];
    userMessages.push(inAppMessage);
    this.mockInAppMessages.set(userPreferences.userID, userMessages);

    this.logger.debug('In-app message created', {
      messageID,
      userID: userPreferences.userID,
      title: rendered.title.substring(0, 50)
    });

    return { success: true, messageID };
  }

  /**
   * Send SMS notification (mock implementation)
   */
  private async sendSMSNotification(
    rendered: any,
    userPreferences: UserNotificationPreferences,
    context: NotificationSecurityContext
  ): Promise<{ success: boolean; messageID?: string; error?: string }> {
    
    // Validate security
    await this.securityService.validateNotificationSend(userPreferences.userID, 'sms', context);

    if (!userPreferences.phoneNumber) {
      return { success: false, error: 'No phone number configured' };
    }

    // Mock SMS sending (in real implementation, would use Twilio)
    const messageID = `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.debug('SMS sent (mock)', {
      messageID,
      to: userPreferences.phoneNumber.substring(0, 5) + '***',
      body: rendered.body.substring(0, 50)
    });

    return { success: true, messageID };
  }

  /**
   * Register device token for push notifications
   */
  async registerDevice(
    userID: string,
    deviceToken: string,
    platform: 'android' | 'ios',
    context: NotificationSecurityContext
  ): Promise<void> {
    
    // Validate security
    await this.securityService.validateDeviceRegistration(userID, deviceToken, platform, context);

    const device: UserDeviceToken = {
      userID,
      deviceToken,
      platform,
      lastRegisteredAt: new Date(),
      isActive: true
    };

    // Store device
    const userDevices = this.mockUserDevices.get(userID) || [];
    
    // Remove existing device with same token
    const filteredDevices = userDevices.filter(d => d.deviceToken !== deviceToken);
    filteredDevices.push(device);
    
    this.mockUserDevices.set(userID, filteredDevices);

    // Audit log
    await this.securityService.auditNotificationAction({
      userID,
      action: 'device_registration',
      channel: 'push',
      deviceToken,
      timestamp: new Date(),
      success: true
    });

    this.logger.info('Device registered successfully', {
      userID,
      platform,
      tokenLength: deviceToken.length
    });
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(
    userID: string,
    preferences: Partial<UserNotificationPreferences>,
    context: NotificationSecurityContext
  ): Promise<void> {
    
    // Security validation
    await this.securityService.authenticateNotificationRequest(userID, 'mock_token', 'profile.write');

    const existingPreferences = this.mockUserPreferences.get(userID) || this.getDefaultPreferences(userID);
    const updatedPreferences = { ...existingPreferences, ...preferences, userID };

    this.mockUserPreferences.set(userID, updatedPreferences);

    // Audit log
    await this.securityService.auditNotificationAction({
      userID,
      action: 'preferences_update',
      channel: 'system',
      timestamp: new Date(),
      success: true
    });

    this.logger.info('User preferences updated', {
      userID,
      updatedFields: Object.keys(preferences)
    });
  }

  /**
   * Get in-app messages for user
   */
  async getInAppMessages(userID: string, limit: number = 50): Promise<InAppMessage[]> {
    const messages = this.mockInAppMessages.get(userID) || [];
    
    // Filter out expired messages
    const now = new Date();
    const validMessages = messages.filter(m => !m.expiresAt || m.expiresAt > now);
    
    // Sort by creation date (newest first)
    validMessages.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return validMessages.slice(0, limit);
  }

  /**
   * Mark in-app message as read
   */
  async markMessageAsRead(userID: string, messageID: string): Promise<void> {
    const messages = this.mockInAppMessages.get(userID) || [];
    const message = messages.find(m => m.messageID === messageID);
    
    if (message) {
      message.isRead = true;
      this.mockInAppMessages.set(userID, messages);
      
      this.logger.debug('Message marked as read', {
        userID,
        messageID
      });
    }
  }

  /**
   * Helper methods
   */
  private async validateNotificationRequest(request: NotificationRequest, context: NotificationSecurityContext): Promise<void> {
    if (!request.userID || !request.templateID || !request.channels || request.channels.length === 0) {
      throw new NotificationError('Invalid notification request', 'INVALID_REQUEST');
    }

    // Validate channels
    const validChannels = ['push', 'email', 'inApp', 'sms'];
    for (const channel of request.channels) {
      if (!validChannels.includes(channel)) {
        throw new NotificationError(`Invalid channel: ${channel}`, 'INVALID_CHANNEL');
      }
    }

    // Security validation
    await this.securityService.validateNotificationSend(request.userID, 'system', context);
  }

  private async getUserPreferences(userID: string): Promise<UserNotificationPreferences | null> {
    return this.mockUserPreferences.get(userID) || null;
  }

  private async getTemplate(templateID: string, locale: string): Promise<NotificationTemplate | null> {
    const key = `${templateID}_${locale}`;
    return this.mockTemplates.get(key) || this.mockTemplates.get(`${templateID}_en-US`) || null;
  }

  private async isDoNotDisturbActive(preferences: UserNotificationPreferences): Promise<boolean> {
    if (!preferences.doNotDisturb.enabled) {
      return false;
    }

    // Mock DND check (in real implementation, would check timezone and current time)
    return false; // For demo, DND is never active
  }

  private filterEnabledChannels(requestedChannels: string[], preferences: UserNotificationPreferences): string[] {
    return requestedChannels.filter(channel => {
      switch (channel) {
        case 'push': return preferences.enablePush;
        case 'email': return preferences.enableEmail;
        case 'inApp': return preferences.enableInApp;
        case 'sms': return preferences.enableSMS;
        default: return false;
      }
    });
  }

  private getDefaultPreferences(userID: string): UserNotificationPreferences {
    return {
      userID,
      enablePush: true,
      enableEmail: true,
      enableInApp: true,
      enableSMS: false,
      doNotDisturb: { enabled: false },
      locale: 'en-US'
    };
  }

  private async initializeMockData(): void {
    // Mock templates
    this.mockTemplates.set('welcome_en-US', {
      templateID: 'welcome',
      channel: 'push',
      locale: 'en-US',
      titleTemplate: 'Welcome to AeroFusionXR, {{userName}}!',
      bodyTemplate: 'Get ready to experience the future of aviation with AR/VR technology.',
      actionURLTemplate: 'https://app.aerofusionxr.com/onboarding'
    });

    this.mockTemplates.set('booking_confirmation_en-US', {
      templateID: 'booking_confirmation',
      channel: 'email',
      locale: 'en-US',
      titleTemplate: 'Booking Confirmed - Flight {{flightNumber}}',
      bodyTemplate: 'Your flight from {{departure}} to {{arrival}} on {{departureDate}} has been confirmed. Booking reference: {{bookingReference}}',
      actionURLTemplate: 'https://app.aerofusionxr.com/booking/{{bookingReference}}'
    });

    // Mock user preferences
    this.mockUserPreferences.set('user_123', {
      userID: 'user_123',
      enablePush: true,
      enableEmail: true,
      enableInApp: true,
      enableSMS: false,
      doNotDisturb: { enabled: false },
      locale: 'en-US',
      email: 'user@example.com',
      phoneNumber: '+1234567890'
    });

    this.logger.debug('Mock data initialized');
  }

  /**
   * Get notification service status
   */
  async getServiceStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    providers: any;
    metrics: any;
  }> {
    const pushStatus = await this.pushProvider.getStatus();
    const emailStatus = await this.emailProvider.getStatus();
    
    const allProviders = [
      pushStatus.fcm.available,
      pushStatus.apns.available,
      emailStatus.available
    ];
    
    const healthyProviders = allProviders.filter(p => p).length;
    const totalProviders = allProviders.length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyProviders === totalProviders) {
      status = 'healthy';
    } else if (healthyProviders > 0) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      providers: {
        push: pushStatus,
        email: emailStatus
      },
      metrics: {
        avgSendDuration: this.performanceMonitor.getAverageMetric('notification_send_duration'),
        totalSent: this.performanceMonitor.getMetricCount('notification_send_duration')
      }
    };
  }

  /**
   * Initialize the service and start background processes
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing NotificationService');

      // Initialize all sub-services
      await this.pushService.initialize();
      await this.inAppMessageService.initialize();
      await this.templateService.initialize();
      await this.schedulerService.initialize();
      await this.geoFenceService.initialize();
      await this.webSocketService.initialize();

      // Start scheduler
      this.schedulerService.start();

      // Start geo-fence monitoring
      this.geoFenceService.start();

      this.logger.info('NotificationService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize NotificationService', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Register device token for push notifications
   */
  async registerDeviceToken(
    request: RegisterTokenRequest,
    context: NotificationSecurityContext
  ): Promise<{ status: string }> {
    const startTime = Date.now();

    try {
      this.logger.info('Registering device token', {
        userID: request.userID,
        platform: request.platform
      });

      // Validate access
      await this.securityService.validateNotificationRequest('notify.write', context);

      // Validate userID matches JWT
      if (context.userID !== request.userID) {
        throw new NotificationError('User ID mismatch', 'USER_ID_MISMATCH', request.userID);
      }

      // Register token
      await this.pushService.registerToken({
        userID: request.userID,
        platform: request.platform,
        token: request.token
      });

      // Clear cache
      await this.clearUserCache(request.userID);

      // Record metrics
      await this.performanceMonitor.recordTiming('token_registration_duration', startTime, {
        userID: request.userID,
        platform: request.platform
      });

      await this.performanceMonitor.recordMetric('token_registrations', 1, {
        platform: request.platform
      });

      this.logger.info('Device token registered successfully', {
        userID: request.userID,
        platform: request.platform,
        duration: Date.now() - startTime
      });

      return { status: 'registered' };

    } catch (error) {
      this.logger.error('Failed to register device token', {
        userID: request.userID,
        platform: request.platform,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('token_registration_errors', 1, {
        userID: request.userID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Register web push subscription
   */
  async registerWebPushSubscription(
    request: RegisterWebPushRequest,
    context: NotificationSecurityContext
  ): Promise<{ status: string }> {
    const startTime = Date.now();

    try {
      this.logger.info('Registering web push subscription', {
        userID: request.userID
      });

      // Validate access
      await this.securityService.validateNotificationRequest('notify.write', context);

      // Validate userID matches JWT
      if (context.userID !== request.userID) {
        throw new NotificationError('User ID mismatch', 'USER_ID_MISMATCH', request.userID);
      }

      // Validate subscription format
      if (!request.subscription.endpoint || !request.subscription.keys.p256dh || !request.subscription.keys.auth) {
        throw new InvalidSubscriptionError('Missing required subscription fields');
      }

      // Register subscription
      await this.pushService.registerWebPushSubscription({
        userID: request.userID,
        endpoint: request.subscription.endpoint,
        p256dhKey: request.subscription.keys.p256dh,
        authKey: request.subscription.keys.auth
      });

      // Clear cache
      await this.clearUserCache(request.userID);

      // Record metrics
      await this.performanceMonitor.recordTiming('web_push_registration_duration', startTime, {
        userID: request.userID
      });

      await this.performanceMonitor.recordMetric('web_push_registrations', 1);

      this.logger.info('Web push subscription registered successfully', {
        userID: request.userID,
        duration: Date.now() - startTime
      });

      return { status: 'registered' };

    } catch (error) {
      this.logger.error('Failed to register web push subscription', {
        userID: request.userID,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('web_push_registration_errors', 1, {
        userID: request.userID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Send push notification
   */
  async sendPushNotification(
    request: SendPushRequest,
    context: NotificationSecurityContext
  ): Promise<{ status: string; messageIDs?: string[]; scheduledAt?: Date }> {
    const startTime = Date.now();

    try {
      this.logger.info('Sending push notification', {
        userID: request.userID,
        templateKey: request.templateKey,
        hasSchedule: !!request.scheduleAt,
        hasGeoFence: !!request.geoFence
      });

      // Validate access
      await this.securityService.validateNotificationRequest('notify.write', context);

      // Check user preferences
      const preferences = await this.getUserPreferences(request.userID);
      if (!preferences.pushEnabled) {
        this.logger.info('Push notifications disabled for user', { userID: request.userID });
        return { status: 'skipped' };
      }

      // Check quiet hours
      const isQuietHours = await this.isInQuietHours(request.userID, preferences);
      if (isQuietHours && request.priority !== 'critical') {
        if (request.scheduleAt) {
          this.logger.info('User in quiet hours, message already scheduled', { userID: request.userID });
          return { status: 'skipped' };
        } else {
          // Schedule for end of quiet hours
          const scheduledAt = await this.calculateQuietHoursEnd(request.userID, preferences);
          return await this.scheduleNotification({
            userID: request.userID,
            templateKey: request.templateKey,
            data: request.data,
            scheduleAt: scheduledAt,
            geoFence: request.geoFence
          }, context);
        }
      }

      // Handle scheduling
      if (request.scheduleAt && request.scheduleAt > new Date()) {
        return await this.scheduleNotification({
          userID: request.userID,
          templateKey: request.templateKey,
          data: request.data,
          scheduleAt: request.scheduleAt,
          geoFence: request.geoFence
        }, context);
      }

      // Handle geo-fencing
      if (request.geoFence) {
        return await this.setupGeoFencedNotification(request, context);
      }

      // Send immediately
      const result = await this.sendImmediatePush(request, context);

      // Record metrics
      await this.performanceMonitor.recordTiming('push_send_duration', startTime, {
        userID: request.userID,
        templateKey: request.templateKey
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to send push notification', {
        userID: request.userID,
        templateKey: request.templateKey,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('push_send_errors', 1, {
        userID: request.userID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Send in-app message
   */
  async sendInAppMessage(
    request: SendInAppRequest,
    context: NotificationSecurityContext
  ): Promise<{ status: string; messageID?: string }> {
    const startTime = Date.now();

    try {
      this.logger.info('Sending in-app message', {
        userID: request.userID,
        templateKey: request.templateKey,
        hasSchedule: !!request.scheduleAt
      });

      // Validate access
      await this.securityService.validateNotificationRequest('notify.write', context);

      // Check user preferences
      const preferences = await this.getUserPreferences(request.userID);
      if (!preferences.inAppEnabled) {
        this.logger.info('In-app messages disabled for user', { userID: request.userID });
        return { status: 'skipped' };
      }

      // Handle scheduling
      if (request.scheduleAt && request.scheduleAt > new Date()) {
        // Schedule the in-app message
        const scheduleID = await this.schedulerService.scheduleInAppMessage({
          userID: request.userID,
          templateKey: request.templateKey,
          data: request.data,
          scheduleAt: request.scheduleAt,
          expiresAt: request.expiresAt
        });

        return { status: 'scheduled', messageID: scheduleID };
      }

      // Get user's locale for template resolution
      const userLocale = await this.getUserLocale(request.userID);

      // Resolve template
      const template = await this.templateService.resolveTemplate(
        request.templateKey,
        userLocale,
        request.data || {}
      );

      if (!template) {
        throw new TemplateNotFoundError(request.templateKey, userLocale);
      }

      // Create in-app message
      const messageID = await this.inAppMessageService.createMessage({
        userID: request.userID,
        title: template.title,
        body: template.body,
        templateKey: request.templateKey,
        actionURL: request.actionURL || template.actionURL,
        imageURL: template.imageURL,
        expiresAt: request.expiresAt || new Date(Date.now() + this.IN_APP_MESSAGE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      });

      // Try to deliver immediately via WebSocket if user is online
      const delivered = await this.webSocketService.deliverMessage(request.userID, {
        messageID,
        title: template.title,
        body: template.body,
        actionURL: request.actionURL || template.actionURL,
        imageURL: template.imageURL
      });

      if (delivered) {
        await this.inAppMessageService.markAsDelivered(messageID);
      }

      // Record metrics
      await this.performanceMonitor.recordTiming('inapp_send_duration', startTime, {
        userID: request.userID,
        templateKey: request.templateKey
      });

      await this.performanceMonitor.recordMetric('inapp_messages_sent', 1, {
        templateKey: request.templateKey,
        delivered: delivered ? 'yes' : 'no'
      });

      this.logger.info('In-app message sent successfully', {
        userID: request.userID,
        messageID,
        templateKey: request.templateKey,
        delivered,
        duration: Date.now() - startTime
      });

      return { status: delivered ? 'delivered' : 'queued', messageID };

    } catch (error) {
      this.logger.error('Failed to send in-app message', {
        userID: request.userID,
        templateKey: request.templateKey,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('inapp_send_errors', 1, {
        userID: request.userID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get user's notification preferences
   */
  async getNotificationPreferences(
    userID: string,
    context: NotificationSecurityContext
  ): Promise<NotificationPreferences> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting notification preferences', { userID });

      // Validate access
      await this.securityService.validateNotificationRequest('notify.read', context);

      // Validate userID matches JWT
      if (context.userID !== userID) {
        throw new NotificationError('User ID mismatch', 'USER_ID_MISMATCH', userID);
      }

      const preferences = await this.getUserPreferences(userID);

      // Record metrics
      await this.performanceMonitor.recordTiming('preferences_retrieval_duration', startTime, {
        userID
      });

      return preferences;

    } catch (error) {
      this.logger.error('Failed to get notification preferences', {
        userID,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('preferences_retrieval_errors', 1, {
        userID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Update user's notification preferences
   */
  async updateNotificationPreferences(
    userID: string,
    preferences: Partial<NotificationPreferences>,
    context: NotificationSecurityContext
  ): Promise<{ status: string }> {
    const startTime = Date.now();

    try {
      this.logger.info('Updating notification preferences', {
        userID,
        pushEnabled: preferences.pushEnabled,
        inAppEnabled: preferences.inAppEnabled
      });

      // Validate access
      await this.securityService.validateNotificationRequest('notify.write', context);

      // Validate userID matches JWT
      if (context.userID !== userID) {
        throw new NotificationError('User ID mismatch', 'USER_ID_MISMATCH', userID);
      }

      // Update preferences
      await this.updateUserPreferences(userID, preferences);

      // Clear cache
      await this.clearUserCache(userID);

      // Record metrics
      await this.performanceMonitor.recordTiming('preferences_update_duration', startTime, {
        userID
      });

      await this.performanceMonitor.recordMetric('preferences_updates', 1);

      this.logger.info('Notification preferences updated successfully', {
        userID,
        duration: Date.now() - startTime
      });

      return { status: 'updated' };

    } catch (error) {
      this.logger.error('Failed to update notification preferences', {
        userID,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('preferences_update_errors', 1, {
        userID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get pending in-app messages for a user
   */
  async getPendingInAppMessages(
    userID: string,
    context: NotificationSecurityContext
  ): Promise<InAppMessage[]> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting pending in-app messages', { userID });

      // Validate access
      await this.securityService.validateNotificationRequest('notify.read', context);

      // Validate userID matches JWT
      if (context.userID !== userID) {
        throw new NotificationError('User ID mismatch', 'USER_ID_MISMATCH', userID);
      }

      const messages = await this.inAppMessageService.getPendingMessages(userID);

      // Mark as delivered
      for (const message of messages) {
        await this.inAppMessageService.markAsDelivered(message.messageID);
      }

      // Record metrics
      await this.performanceMonitor.recordTiming('pending_messages_duration', startTime, {
        userID
      });

      await this.performanceMonitor.recordMetric('pending_messages_retrieved', messages.length, {
        userID
      });

      return messages;

    } catch (error) {
      this.logger.error('Failed to get pending in-app messages', {
        userID,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('pending_messages_errors', 1, {
        userID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Acknowledge an in-app message
   */
  async acknowledgeInAppMessage(
    messageID: string,
    context: NotificationSecurityContext
  ): Promise<{ status: string }> {
    const startTime = Date.now();

    try {
      this.logger.debug('Acknowledging in-app message', { messageID });

      // Validate access
      await this.securityService.validateNotificationRequest('notify.write', context);

      await this.inAppMessageService.acknowledgeMessage(messageID);

      // Record metrics
      await this.performanceMonitor.recordTiming('message_acknowledgment_duration', startTime, {
        messageID
      });

      await this.performanceMonitor.recordMetric('messages_acknowledged', 1);

      this.logger.debug('In-app message acknowledged successfully', {
        messageID,
        duration: Date.now() - startTime
      });

      return { status: 'acknowledged' };

    } catch (error) {
      this.logger.error('Failed to acknowledge in-app message', {
        messageID,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('message_acknowledgment_errors', 1, {
        messageID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get notification metrics (admin only)
   */
  async getNotificationMetrics(
    dateFrom: Date,
    dateTo: Date,
    context: NotificationSecurityContext
  ): Promise<{ metrics: NotificationMetrics[]; summary: any }> {
    const startTime = Date.now();

    try {
      this.logger.info('Getting notification metrics', { dateFrom, dateTo });

      // Validate admin access
      await this.securityService.validateNotificationRequest('notify.admin', context);

      const metrics = await this.getMetricsData(dateFrom, dateTo);
      const summary = await this.calculateMetricsSummary(metrics);

      // Record metrics
      await this.performanceMonitor.recordTiming('metrics_retrieval_duration', startTime);

      this.logger.info('Notification metrics retrieved successfully', {
        metricsCount: metrics.length,
        duration: Date.now() - startTime
      });

      return { metrics, summary };

    } catch (error) {
      this.logger.error('Failed to get notification metrics', {
        dateFrom,
        dateTo,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('metrics_retrieval_errors', 1, {
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async sendImmediatePush(
    request: SendPushRequest,
    context: NotificationSecurityContext
  ): Promise<{ status: string; messageIDs: string[] }> {
    // Get user's locale
    const userLocale = await this.getUserLocale(request.userID);

    // Resolve template
    const template = await this.templateService.resolveTemplate(
      request.templateKey,
      userLocale,
      request.data || {}
    );

    if (!template) {
      throw new TemplateNotFoundError(request.templateKey, userLocale);
    }

    // Get device tokens
    const tokens = await this.pushService.getDeviceTokens(request.userID);
    if (tokens.length === 0) {
      // Fallback to in-app if no tokens
      await this.sendInAppMessage({
        userID: request.userID,
        templateKey: request.templateKey,
        data: request.data
      }, context);
      return { status: 'fallback_to_inapp', messageIDs: [] };
    }

    // Send to all devices
    const messageIDs: string[] = [];
    for (const token of tokens) {
      try {
        const messageID = await this.pushService.sendPush({
          token: token.token,
          platform: token.platform,
          title: template.title,
          body: template.body,
          actionURL: template.actionURL,
          imageURL: template.imageURL,
          priority: request.priority || template.priority,
          ttl: request.ttl || template.ttl || this.DEFAULT_TTL_SECONDS
        });

        messageIDs.push(messageID);

        // Log notification
        await this.logNotification({
          messageID,
          userID: request.userID,
          channel: 'push',
          templateKey: request.templateKey,
          status: 'sent'
        });

        await this.performanceMonitor.recordMetric('push_messages_sent', 1, {
          platform: token.platform,
          templateKey: request.templateKey
        });

      } catch (error) {
        this.logger.error('Failed to send push to device', {
          userID: request.userID,
          platform: token.platform,
          error: error.message
        });

        await this.performanceMonitor.recordMetric('push_send_device_errors', 1, {
          platform: token.platform,
          errorType: error.constructor.name
        });
      }
    }

    return { status: 'sent', messageIDs };
  }

  private async scheduleNotification(
    request: {
      userID: string;
      templateKey: string;
      data?: any;
      scheduleAt: Date;
      geoFence?: GeoFenceCondition;
    },
    context: NotificationSecurityContext
  ): Promise<{ status: string; scheduledAt: Date }> {
    const scheduleID = await this.schedulerService.scheduleNotification({
      userID: request.userID,
      templateKey: request.templateKey,
      data: request.data,
      scheduleAt: request.scheduleAt,
      geoFence: request.geoFence
    });

    this.logger.info('Notification scheduled', {
      scheduleID,
      userID: request.userID,
      scheduledAt: request.scheduleAt
    });

    return { status: 'scheduled', scheduledAt: request.scheduleAt };
  }

  private async setupGeoFencedNotification(
    request: SendPushRequest,
    context: NotificationSecurityContext
  ): Promise<{ status: string }> {
    await this.geoFenceService.setupGeoFence({
      userID: request.userID,
      templateKey: request.templateKey,
      data: request.data,
      condition: request.geoFence!
    });

    this.logger.info('Geo-fenced notification setup', {
      userID: request.userID,
      templateKey: request.templateKey,
      geoFence: request.geoFence
    });

    return { status: 'geo_fenced' };
  }

  private async getUserPreferences(userID: string): Promise<NotificationPreferences> {
    const cacheKey = `preferences:${userID}`;
    const cached = await this.cacheService.get<NotificationPreferences>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database (implementation would go here)
    const preferences: NotificationPreferences = {
      userID,
      channelsEnabled: {
        push: true,
        email: true,
        inApp: true
      },
      dndStart: '22:00',
      dndEnd: '07:00',
      locales: ['en-SG'],
      lastUpdated: new Date()
    };

    await this.cacheService.set(cacheKey, preferences, this.CACHE_TTL_SECONDS);
    return preferences;
  }

  private async updateUserPreferences(userID: string, updates: Partial<NotificationPreferences>): Promise<void> {
    // Implementation would update database
    this.logger.debug('Updating user preferences in database', { userID, updates });
  }

  private async getUserLocale(userID: string): Promise<string> {
    // Implementation would fetch user's locale from user service
    return 'en-SG'; // Default locale
  }

  private async isInQuietHours(userID: string, preferences: NotificationPreferences): Promise<boolean> {
    // Implementation would check current time against quiet hours
    return false; // Simplified for now
  }

  private async calculateQuietHoursEnd(userID: string, preferences: NotificationPreferences): Promise<Date> {
    // Implementation would calculate when quiet hours end
    return new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours from now
  }

  private async logNotification(log: Partial<NotificationLog>): Promise<void> {
    // Implementation would save to database
    this.logger.debug('Logging notification', log);
  }

  private async getMetricsData(dateFrom: Date, dateTo: Date): Promise<NotificationMetrics[]> {
    // Implementation would query metrics from database
    return [];
  }

  private async calculateMetricsSummary(metrics: NotificationMetrics[]): Promise<any> {
    // Implementation would calculate summary statistics
    return {
      totalSent: metrics.reduce((sum, m) => sum + m.totalSent, 0),
      totalDelivered: metrics.reduce((sum, m) => sum + m.totalDelivered, 0),
      totalOpened: metrics.reduce((sum, m) => sum + m.totalOpened, 0)
    };
  }

  private async clearUserCache(userID: string): Promise<void> {
    const cacheKeys = [
      `preferences:${userID}`,
      `tokens:${userID}`,
      `messages:${userID}`
    ];

    await Promise.all(cacheKeys.map(key => this.cacheService.delete(key)));
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    dependencies: { [key: string]: boolean };
    metrics: any;
  }> {
    const [pushHealth, inAppHealth, templateHealth, schedulerHealth, webSocketHealth] = await Promise.all([
      this.pushService.getHealth(),
      this.inAppMessageService.getHealth(),
      this.templateService.getHealth(),
      this.schedulerService.getHealth(),
      this.webSocketService.getHealth()
    ]);

    const healthyServices = [
      pushHealth.available,
      inAppHealth.available,
      templateHealth.available,
      schedulerHealth.available,
      webSocketHealth.available
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
        push: pushHealth.available,
        inApp: inAppHealth.available,
        templates: templateHealth.available,
        scheduler: schedulerHealth.available,
        webSocket: webSocketHealth.available
      },
      metrics: {
        avgSendDuration: this.performanceMonitor.getAverageMetric('notification_send_duration'),
        avgInAppSendTime: this.performanceMonitor.getMetricStats('inapp_send_duration')?.avg || 0,
        totalPushSent: this.performanceMonitor.getMetricStats('push_messages_sent')?.sum || 0,
        totalInAppSent: this.performanceMonitor.getMetricStats('inapp_messages_sent')?.sum || 0,
        totalTokenRegistrations: this.performanceMonitor.getMetricStats('token_registrations')?.sum || 0
      }
    };
  }
} 
