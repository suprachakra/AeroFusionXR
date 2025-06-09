export interface NotificationSecurityContext {
  userID: string;
  requestIP: string;
  userAgent: string;
  operation: string;
  timestamp: Date;
}

export interface NotificationAuditEvent {
  userID: string;
  action: string;
  channel: string;
  templateID?: string;
  deviceToken?: string;
  timestamp: Date;
  success: boolean;
  errorDetails?: string;
}

export class SecurityService {
  async authenticateNotificationRequest(userID: string, oauthToken: string, scope: string): Promise<boolean> {
    // In a real implementation, this would validate OAuth2 tokens and scopes
    console.debug(`[SECURITY] Authenticating notification request for user: ${userID}, scope: ${scope}`);
    
    if (!userID || !oauthToken) {
      throw new Error('Invalid authentication credentials');
    }
    
    // Validate scope permissions
    const validScopes = ['notifications.read', 'notifications.write', 'profile.write'];
    if (!validScopes.includes(scope)) {
      throw new Error('Invalid scope for notification operation');
    }
    
    return true;
  }

  async validateDeviceRegistration(userID: string, deviceToken: string, platform: string, context: NotificationSecurityContext): Promise<boolean> {
    console.debug(`[SECURITY] Validating device registration for user ${userID}, platform ${platform}`);
    
    // Check for suspicious device registration patterns
    if (!this.isValidDeviceToken(deviceToken, platform)) {
      throw new Error(`Invalid device token format for platform: ${platform}`);
    }
    
    // Check rate limiting for device registrations
    if (await this.checkRateLimit(userID, 'device_registration')) {
      throw new Error('Rate limit exceeded for device registrations');
    }
    
    return true;
  }

  async validateTemplateContent(templateID: string, content: string, context: NotificationSecurityContext): Promise<boolean> {
    console.debug(`[SECURITY] Validating template content for template ${templateID}`);
    
    // Check for malicious content
    if (!this.isValidTemplateContent(content)) {
      throw new Error(`Invalid or potentially dangerous template content: ${templateID}`);
    }
    
    // Check rate limiting for template operations
    if (await this.checkRateLimit(context.userID, 'template_operation')) {
      throw new Error('Rate limit exceeded for template operations');
    }
    
    return true;
  }

  async validateNotificationSend(userID: string, channel: string, context: NotificationSecurityContext): Promise<boolean> {
    console.debug(`[SECURITY] Validating notification send for user ${userID}, channel ${channel}`);
    
    // Check if user has permission for this channel
    if (!this.isValidChannel(channel)) {
      throw new Error('Invalid notification channel');
    }
    
    // Check rate limiting for notifications
    if (await this.checkRateLimit(userID, `notification_${channel}`)) {
      throw new Error(`Rate limit exceeded for ${channel} notifications`);
    }
    
    return true;
  }

  async checkRateLimit(userID: string, operation: string): Promise<boolean> {
    // In a real implementation, this would check Redis for rate limits
    // For now, return false (no rate limit exceeded)
    return false;
  }

  async auditNotificationAction(event: NotificationAuditEvent): Promise<void> {
    // In a real implementation, this would log to audit trail
    console.debug(`[AUDIT] User ${event.userID} performed ${event.action} on ${event.channel}`, {
      templateID: event.templateID,
      success: event.success,
      timestamp: event.timestamp,
      errorDetails: event.errorDetails
    });
  }

  async encryptDeviceToken(deviceToken: string): Promise<string> {
    // In a real implementation, this would use AES-256-GCM encryption
    return btoa(deviceToken);
  }

  async decryptDeviceToken(encryptedToken: string): Promise<string> {
    // In a real implementation, this would decrypt the token
    return atob(encryptedToken);
  }

  async generateNotificationToken(userID: string, action: string): Promise<string> {
    // In a real implementation, this would generate secure notification action tokens
    const timestamp = Date.now();
    return `notif_${userID}_${action}_${timestamp}`;
  }

  pseudonymizeUserID(userID: string): string {
    // Simple hash for cross-platform compatibility
    let hash = 0;
    for (let i = 0; i < userID.length; i++) {
      const char = userID.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `user_${Math.abs(hash).toString(16).substring(0, 8)}`;
  }

  sanitizeNotificationContent(content: string): string {
    // Remove potentially dangerous HTML tags and scripts
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/onload=/gi, '')
      .replace(/onerror=/gi, '')
      .trim();
  }

  isValidDeviceToken(deviceToken: string, platform: string): boolean {
    if (!deviceToken || deviceToken.trim().length === 0) {
      return false;
    }
    
    // Platform-specific validation
    if (platform === 'android') {
      // FCM tokens are typically 152+ characters
      return deviceToken.length >= 100 && /^[a-zA-Z0-9_-]+$/.test(deviceToken);
    }
    
    if (platform === 'ios') {
      // APNs tokens are typically 64+ characters
      return deviceToken.length >= 64 && /^[a-fA-F0-9]+$/.test(deviceToken);
    }
    
    return false;
  }

  isValidTemplateContent(content: string): boolean {
    if (!content || content.trim().length === 0) {
      return false;
    }
    
    if (content.length > 10000) {
      return false; // Too long
    }
    
    // Check for potentially dangerous content
    const dangerousPatterns = [
      '<script', 'javascript:', 'data:', 'vbscript:', 
      'onload=', 'onerror=', 'onclick=', 'onmouseover='
    ];
    
    const lowerContent = content.toLowerCase();
    for (const pattern of dangerousPatterns) {
      if (lowerContent.includes(pattern)) {
        return false;
      }
    }
    
    return true;
  }

  isValidChannel(channel: string): boolean {
    const validChannels = ['push', 'email', 'inApp', 'sms'];
    return validChannels.includes(channel);
  }

  validateEmailAddress(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  validatePhoneNumber(phone: string): boolean {
    // Basic international phone number validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  }

  async detectNotificationAbuse(userID: string, operation: string, frequency: number): Promise<number> {
    // Mock notification abuse detection - returns risk score 0-1
    let riskScore = 0;
    
    // High frequency operations might indicate abuse
    if (frequency > 50) riskScore += 0.2;
    if (frequency > 100) riskScore += 0.3;
    if (frequency > 200) riskScore += 0.5;
    
    // Certain operations are more sensitive
    if (operation === 'bulk_notification_send' && frequency > 10) riskScore += 0.3;
    if (operation === 'template_creation' && frequency > 5) riskScore += 0.2;
    if (operation === 'device_registration' && frequency > 20) riskScore += 0.4;
    
    return Math.min(riskScore, 1.0);
  }

  async anonymizeNotificationData(notificationData: any): Promise<any> {
    // Anonymize notification data for analytics
    const anonymized = { ...notificationData };
    
    // Replace sensitive information with anonymized versions
    if (anonymized.userID) {
      anonymized.userID = this.pseudonymizeUserID(notificationData.userID);
    }
    
    if (anonymized.deviceToken) {
      anonymized.deviceToken = '[REDACTED]';
    }
    
    if (anonymized.email) {
      anonymized.email = '[REDACTED]';
    }
    
    if (anonymized.phoneNumber) {
      anonymized.phoneNumber = '[REDACTED]';
    }
    
    // Keep non-sensitive notification metrics for analytics
    return anonymized;
  }
} 