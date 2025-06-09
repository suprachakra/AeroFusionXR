import { createLogger, createPerformanceMonitor, PerformanceMonitor } from '@aerofusionxr/shared';

// Core notification interfaces
export interface UserDeviceToken {
  userID: string;
  deviceToken: string;
  platform: 'android' | 'ios' | 'web';
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

export interface TemplateRenderContext {
  flightNumber?: string;
  gate?: string;
  departure?: string;
  arrival?: string;
  status?: string;
  delay?: number;
  userName?: string;
  [key: string]: any;
}

export interface FlightNotificationRequest {
  userID: string;
  flightNumber: string;
  notificationType: 'gate_change' | 'delay' | 'boarding' | 'departure' | 'arrival' | 'cancellation';
  channels: ('push' | 'email' | 'inApp' | 'sms')[];
  flightData: {
    gate?: string;
    newGate?: string;
    delay?: number;
    status?: string;
    departure?: string;
    arrival?: string;
    boardingTime?: Date;
  };
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface GeoFenceCondition {
  terminal?: string;
  gate?: string;
  latitude?: number;
  longitude?: number;
  radius: number; // meters
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

export interface NotificationMetrics {
  date: string;
  channel: 'push' | 'inApp' | 'email' | 'sms';
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalFailed: number;
  flightNotifications: {
    gateChanges: number;
    delays: number;
    boardingAlerts: number;
    cancellations: number;
  };
}

/**
 * Notification Feature Module
 * Consolidated from notifications service into flight-info
 * 
 * Features:
 * - Flight-specific notifications (gate changes, delays, boarding alerts)
 * - Multi-channel delivery (push, email, in-app, SMS)
 * - User preference management and do-not-disturb settings
 * - Template-based messaging with localization
 * - Geo-fenced notifications for terminal/gate proximity
 * - Real-time delivery tracking and metrics
 * - Scheduled and triggered notifications
 */
export class NotificationFeature {
  private logger = createLogger('flight-info.notifications');
  private performanceMonitor = createPerformanceMonitor('notifications');
  private mockUserPreferences: Map<string, UserNotificationPreferences> = new Map();
  private mockUserDevices: Map<string, UserDeviceToken[]> = new Map();
  private mockTemplates: Map<string, NotificationTemplate> = new Map();
  private mockInAppMessages: Map<string, InAppMessage[]> = new Map();
  private scheduledNotifications: Map<string, ScheduledNotification> = new Map();

  constructor() {
    this.logger.info('Notification Feature initialized');
    this.initializeMockData();
  }

  /**
   * Send flight-specific notification to user
   * @param request - Flight notification request with flight data
   */
  async sendFlightNotification(request: FlightNotificationRequest): Promise<NotificationResult> {
    const timer = this.performanceMonitor.startTimer('send_flight_notification');
    
    try {
      this.logger.info('Sending flight notification', {
        userID: request.userID,
        flightNumber: request.flightNumber,
        type: request.notificationType,
        channels: request.channels
      });

      // Get user preferences
      const userPreferences = await this.getUserPreferences(request.userID);
      if (!userPreferences) {
        throw new Error(`User preferences not found: ${request.userID}`);
      }

      // Check do-not-disturb settings
      if (await this.isDoNotDisturbActive(userPreferences)) {
        this.logger.info('Notification skipped due to do-not-disturb', {
          userID: request.userID
        });
        
        timer.end(false);
        return this.createSkippedResult(request);
      }

      // Get appropriate template
      const templateID = this.getFlightNotificationTemplate(request.notificationType);
      const template = await this.getTemplate(templateID, userPreferences.locale);
      if (!template) {
        throw new Error(`Template not found: ${templateID}`);
      }

      // Create render context
      const context: TemplateRenderContext = {
        flightNumber: request.flightNumber,
        gate: request.flightData.gate,
        newGate: request.flightData.newGate,
        departure: request.flightData.departure,
        arrival: request.flightData.arrival,
        status: request.flightData.status,
        delay: request.flightData.delay,
        userName: userPreferences.email?.split('@')[0] || 'Passenger'
      };

      // Filter enabled channels
      const enabledChannels = this.filterEnabledChannels(request.channels, userPreferences);

      // Send to each channel
      const channelResults = await this.sendToChannels(
        enabledChannels,
        template,
        context,
        userPreferences
      );

      // Create result
      const result: NotificationResult = {
        notificationID: `flight_notif_${Date.now()}`,
        userID: request.userID,
        templateID,
        channels: channelResults,
        totalChannels: channelResults.length,
        successChannels: channelResults.filter(r => r.success).length,
        failureChannels: channelResults.filter(r => !r.success).length,
        sentAt: new Date()
      };

      this.performanceMonitor.recordMetric('flight_notification_sent', 1, {
        type: request.notificationType,
        channels: enabledChannels.length,
        success: result.successChannels > 0
      });

      this.logger.info('Flight notification sent successfully', {
        notificationID: result.notificationID,
        successChannels: result.successChannels,
        failureChannels: result.failureChannels
      });

      timer.end(true);
      return result;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to send flight notification', {
        userID: request.userID,
        flightNumber: request.flightNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Send general notification using template
   * @param request - General notification request
   */
  async sendNotification(request: NotificationRequest): Promise<NotificationResult> {
    const timer = this.performanceMonitor.startTimer('send_notification');
    
    try {
      this.logger.info('Sending notification', {
        userID: request.userID,
        templateID: request.templateID,
        channels: request.channels
      });

      // Get user preferences
      const userPreferences = await this.getUserPreferences(request.userID);
      if (!userPreferences) {
        throw new Error(`User preferences not found: ${request.userID}`);
      }

      // Check do-not-disturb settings
      if (await this.isDoNotDisturbActive(userPreferences)) {
        this.logger.info('Notification skipped due to do-not-disturb', {
          userID: request.userID
        });
        
        timer.end(false);
        return this.createSkippedResult(request);
      }

      // Get template
      const template = await this.getTemplate(request.templateID, userPreferences.locale);
      if (!template) {
        throw new Error(`Template not found: ${request.templateID}`);
      }

      // Filter enabled channels
      const enabledChannels = this.filterEnabledChannels(request.channels, userPreferences);

      // Send to each channel
      const channelResults = await this.sendToChannels(
        enabledChannels,
        template,
        request.context,
        userPreferences
      );

      // Create result
      const result: NotificationResult = {
        notificationID: `notif_${Date.now()}`,
        userID: request.userID,
        templateID: request.templateID,
        channels: channelResults,
        totalChannels: channelResults.length,
        successChannels: channelResults.filter(r => r.success).length,
        failureChannels: channelResults.filter(r => !r.success).length,
        sentAt: new Date()
      };

      this.performanceMonitor.recordMetric('notification_sent', 1, {
        templateID: request.templateID,
        channels: enabledChannels.length,
        success: result.successChannels > 0
      });

      timer.end(true);
      return result;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to send notification', {
        userID: request.userID,
        templateID: request.templateID,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Register device token for push notifications
   * @param userID - User identifier
   * @param deviceToken - Device push token
   * @param platform - Device platform
   */
  async registerDevice(userID: string, deviceToken: string, platform: 'android' | 'ios' | 'web'): Promise<void> {
    const timer = this.performanceMonitor.startTimer('register_device');
    
    try {
      this.logger.info('Registering device token', { userID, platform });

      // Get existing devices for user
      let userDevices = this.mockUserDevices.get(userID) || [];

      // Remove existing token for this device/platform
      userDevices = userDevices.filter(d => d.deviceToken !== deviceToken);

      // Add new token
      const newDevice: UserDeviceToken = {
        userID,
        deviceToken,
        platform,
        lastRegisteredAt: new Date(),
        isActive: true
      };

      userDevices.push(newDevice);
      this.mockUserDevices.set(userID, userDevices);

      this.performanceMonitor.recordMetric('device_registered', 1, {
        platform,
        userDeviceCount: userDevices.length
      });

      this.logger.info('Device token registered successfully', {
        userID,
        platform,
        totalDevices: userDevices.length
      });

      timer.end(true);

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to register device token', {
        userID,
        platform,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update user notification preferences
   * @param userID - User identifier
   * @param preferences - Updated preferences
   */
  async updateUserPreferences(userID: string, preferences: Partial<UserNotificationPreferences>): Promise<void> {
    const timer = this.performanceMonitor.startTimer('update_preferences');
    
    try {
      this.logger.info('Updating user preferences', { userID });

      // Get existing preferences or create default
      const existingPreferences = this.mockUserPreferences.get(userID) || this.getDefaultPreferences(userID);

      // Merge with updates
      const updatedPreferences: UserNotificationPreferences = {
        ...existingPreferences,
        ...preferences
      };

      // Store updated preferences
      this.mockUserPreferences.set(userID, updatedPreferences);

      this.performanceMonitor.recordMetric('preferences_updated', 1, { userID });

      this.logger.info('User preferences updated successfully', {
        userID,
        enablePush: updatedPreferences.enablePush,
        enableEmail: updatedPreferences.enableEmail,
        enableInApp: updatedPreferences.enableInApp
      });

      timer.end(true);

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to update user preferences', {
        userID,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get in-app messages for user
   * @param userID - User identifier
   * @param limit - Maximum number of messages to return
   */
  async getInAppMessages(userID: string, limit: number = 50): Promise<InAppMessage[]> {
    const timer = this.performanceMonitor.startTimer('get_inapp_messages');
    
    try {
      const messages = this.mockInAppMessages.get(userID) || [];
      
      // Sort by creation date (newest first) and limit
      const sortedMessages = messages
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);

      this.performanceMonitor.recordMetric('inapp_messages_retrieved', sortedMessages.length, {
        userID,
        totalMessages: messages.length
      });

      timer.end(true);
      return sortedMessages;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get in-app messages', {
        userID,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Mark in-app message as read
   * @param userID - User identifier
   * @param messageID - Message identifier
   */
  async markMessageAsRead(userID: string, messageID: string): Promise<void> {
    const timer = this.performanceMonitor.startTimer('mark_message_read');
    
    try {
      const messages = this.mockInAppMessages.get(userID) || [];
      const message = messages.find(m => m.messageID === messageID);
      
      if (message) {
        message.isRead = true;
        this.performanceMonitor.recordMetric('message_marked_read', 1, { userID });
        this.logger.debug('Message marked as read', { userID, messageID });
      }

      timer.end(true);

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to mark message as read', {
        userID,
        messageID,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Schedule a notification for future delivery
   * @param request - Notification request
   * @param scheduledAt - When to send the notification
   */
  async scheduleNotification(request: NotificationRequest, scheduledAt: Date): Promise<string> {
    const timer = this.performanceMonitor.startTimer('schedule_notification');
    
    try {
      const scheduleID = `schedule_${Date.now()}`;
      
      const scheduledNotification: ScheduledNotification = {
        scheduleID,
        userID: request.userID,
        templateKey: request.templateID,
        data: request.context,
        scheduleAt: scheduledAt,
        status: 'scheduled',
        createdAt: new Date()
      };

      this.scheduledNotifications.set(scheduleID, scheduledNotification);

      // In real implementation, this would use a job scheduler
      setTimeout(async () => {
        try {
          await this.sendNotification(request);
          scheduledNotification.status = 'sent';
          scheduledNotification.sentAt = new Date();
        } catch (error) {
          scheduledNotification.status = 'failed';
          this.logger.error('Scheduled notification failed', {
            scheduleID,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }, scheduledAt.getTime() - Date.now());

      this.performanceMonitor.recordMetric('notification_scheduled', 1, {
        userID: request.userID,
        templateID: request.templateID
      });

      timer.end(true);
      return scheduleID;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to schedule notification', {
        userID: request.userID,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Private helper methods

  private getFlightNotificationTemplate(type: string): string {
    const templates = {
      'gate_change': 'flight_gate_change',
      'delay': 'flight_delay',
      'boarding': 'flight_boarding',
      'departure': 'flight_departure',
      'arrival': 'flight_arrival',
      'cancellation': 'flight_cancellation'
    };
    
    return templates[type] || 'flight_general';
  }

  private async getUserPreferences(userID: string): Promise<UserNotificationPreferences | null> {
    return this.mockUserPreferences.get(userID) || this.getDefaultPreferences(userID);
  }

  private async getTemplate(templateID: string, locale: string): Promise<NotificationTemplate | null> {
    return this.mockTemplates.get(`${templateID}_${locale}`) || this.mockTemplates.get(`${templateID}_en`);
  }

  private async isDoNotDisturbActive(preferences: UserNotificationPreferences): Promise<boolean> {
    if (!preferences.doNotDisturb.enabled) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const startTime = preferences.doNotDisturb.startTime || '22:00';
    const endTime = preferences.doNotDisturb.endTime || '08:00';
    
    // Simple time range check (doesn't handle timezone properly - would need proper implementation)
    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      return currentTime >= startTime || currentTime <= endTime;
    }
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

  private async sendToChannels(
    channels: string[],
    template: NotificationTemplate,
    context: TemplateRenderContext,
    userPreferences: UserNotificationPreferences
  ): Promise<{ channel: string; success: boolean; messageID?: string; error?: string }[]> {
    const results = [];

    for (const channel of channels) {
      try {
        const rendered = this.renderTemplate(template, context);
        const result = await this.sendToChannel(channel, rendered, userPreferences);
        results.push({ channel, ...result });
      } catch (error) {
        results.push({
          channel,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  private renderTemplate(template: NotificationTemplate, context: TemplateRenderContext): any {
    // Simple template rendering - in real implementation, this would use a proper template engine
    let title = template.titleTemplate;
    let body = template.bodyTemplate;
    let actionURL = template.actionURLTemplate;

    for (const [key, value] of Object.entries(context)) {
      const placeholder = `{{${key}}}`;
      title = title.replace(new RegExp(placeholder, 'g'), String(value || ''));
      body = body.replace(new RegExp(placeholder, 'g'), String(value || ''));
      if (actionURL) {
        actionURL = actionURL.replace(new RegExp(placeholder, 'g'), String(value || ''));
      }
    }

    return { title, body, actionURL };
  }

  private async sendToChannel(
    channel: string,
    rendered: any,
    userPreferences: UserNotificationPreferences
  ): Promise<{ success: boolean; messageID?: string; error?: string }> {
    switch (channel) {
      case 'push':
        return this.sendPushNotification(rendered, userPreferences);
      case 'email':
        return this.sendEmailNotification(rendered, userPreferences);
      case 'inApp':
        return this.sendInAppNotification(rendered, userPreferences);
      case 'sms':
        return this.sendSMSNotification(rendered, userPreferences);
      default:
        return { success: false, error: `Unknown channel: ${channel}` };
    }
  }

  private async sendPushNotification(rendered: any, userPreferences: UserNotificationPreferences): Promise<{ success: boolean; messageID?: string; error?: string }> {
    // Mock push notification sending
    const userDevices = this.mockUserDevices.get(userPreferences.userID) || [];
    const activeDevices = userDevices.filter(d => d.isActive);

    if (activeDevices.length === 0) {
      return { success: false, error: 'No active devices found' };
    }

    // Simulate sending to all devices
    const messageID = `push_${Date.now()}`;
    
    this.logger.debug('Push notification sent', {
      userID: userPreferences.userID,
      deviceCount: activeDevices.length,
      title: rendered.title
    });

    return { success: true, messageID };
  }

  private async sendEmailNotification(rendered: any, userPreferences: UserNotificationPreferences): Promise<{ success: boolean; messageID?: string; error?: string }> {
    if (!userPreferences.email) {
      return { success: false, error: 'No email address configured' };
    }

    // Mock email sending
    const messageID = `email_${Date.now()}`;
    
    this.logger.debug('Email notification sent', {
      userID: userPreferences.userID,
      email: userPreferences.email,
      subject: rendered.title
    });

    return { success: true, messageID };
  }

  private async sendInAppNotification(rendered: any, userPreferences: UserNotificationPreferences): Promise<{ success: boolean; messageID?: string; error?: string }> {
    const messageID = `inapp_${Date.now()}`;
    
    const message: InAppMessage = {
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
    userMessages.push(message);
    this.mockInAppMessages.set(userPreferences.userID, userMessages);

    this.logger.debug('In-app notification created', {
      userID: userPreferences.userID,
      messageID,
      title: rendered.title
    });

    return { success: true, messageID };
  }

  private async sendSMSNotification(rendered: any, userPreferences: UserNotificationPreferences): Promise<{ success: boolean; messageID?: string; error?: string }> {
    if (!userPreferences.phoneNumber) {
      return { success: false, error: 'No phone number configured' };
    }

    // Mock SMS sending
    const messageID = `sms_${Date.now()}`;
    
    this.logger.debug('SMS notification sent', {
      userID: userPreferences.userID,
      phoneNumber: userPreferences.phoneNumber,
      message: rendered.body
    });

    return { success: true, messageID };
  }

  private createSkippedResult(request: NotificationRequest | FlightNotificationRequest): NotificationResult {
    return {
      notificationID: `skipped_${Date.now()}`,
      userID: request.userID,
      templateID: 'templateID' in request ? request.templateID : this.getFlightNotificationTemplate(request.notificationType),
      channels: request.channels.map(channel => ({
        channel,
        success: false,
        error: 'Skipped due to do-not-disturb'
      })),
      totalChannels: request.channels.length,
      successChannels: 0,
      failureChannels: request.channels.length,
      sentAt: new Date()
    };
  }

  private getDefaultPreferences(userID: string): UserNotificationPreferences {
    return {
      userID,
      enablePush: true,
      enableEmail: true,
      enableInApp: true,
      enableSMS: false,
      doNotDisturb: {
        enabled: false
      },
      locale: 'en'
    };
  }

  private initializeMockData(): void {
    // Initialize flight notification templates
    const templates = [
      {
        templateID: 'flight_gate_change',
        channel: 'push' as const,
        locale: 'en',
        titleTemplate: 'Gate Change - {{flightNumber}}',
        bodyTemplate: 'Your flight {{flightNumber}} gate has changed from {{gate}} to {{newGate}}',
        actionURLTemplate: '/flights/{{flightNumber}}'
      },
      {
        templateID: 'flight_delay',
        channel: 'push' as const,
        locale: 'en',
        titleTemplate: 'Flight Delayed - {{flightNumber}}',
        bodyTemplate: 'Your flight {{flightNumber}} is delayed by {{delay}} minutes. New departure time: {{departure}}',
        actionURLTemplate: '/flights/{{flightNumber}}'
      },
      {
        templateID: 'flight_boarding',
        channel: 'push' as const,
        locale: 'en',
        titleTemplate: 'Now Boarding - {{flightNumber}}',
        bodyTemplate: 'Flight {{flightNumber}} is now boarding at gate {{gate}}. Please proceed to your gate.',
        actionURLTemplate: '/flights/{{flightNumber}}'
      },
      {
        templateID: 'flight_departure',
        channel: 'push' as const,
        locale: 'en',
        titleTemplate: 'Flight Departed - {{flightNumber}}',
        bodyTemplate: 'Flight {{flightNumber}} has departed from gate {{gate}} to {{arrival}}',
        actionURLTemplate: '/flights/{{flightNumber}}'
      },
      {
        templateID: 'flight_cancellation',
        channel: 'push' as const,
        locale: 'en',
        titleTemplate: 'Flight Cancelled - {{flightNumber}}',
        bodyTemplate: 'We regret to inform you that flight {{flightNumber}} has been cancelled. Please contact customer service.',
        actionURLTemplate: '/support'
      }
    ];

    templates.forEach(template => {
      this.mockTemplates.set(`${template.templateID}_${template.locale}`, template);
    });

    this.logger.debug('Mock notification templates initialized', {
      templateCount: templates.length
    });
  }
} 