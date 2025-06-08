export interface EmailRequest {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  actionURL?: string;
  from?: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageID?: string;
  error?: string;
  bounced?: boolean;
}

export interface SMTPConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
}

export interface SendGridConfig {
  apiKey: string;
  fromAddress: string;
  replyTo: string;
}

export class EmailProvider {
  private logger: any;
  private smtpConfig: SMTPConfig;
  private sendGridConfig: SendGridConfig;
  private provider: 'smtp' | 'sendgrid';

  constructor() {
    // Mock logger
    this.logger = {
      debug: (msg: string, ctx?: any) => console.debug(`[EmailProvider] ${msg}`, ctx),
      info: (msg: string, ctx?: any) => console.info(`[EmailProvider] ${msg}`, ctx),
      warn: (msg: string, ctx?: any) => console.warn(`[EmailProvider] ${msg}`, ctx),
      error: (msg: string, ctx?: any) => console.error(`[EmailProvider] ${msg}`, ctx)
    };

    // Mock configuration - in real implementation, these would come from environment
    this.smtpConfig = {
      host: 'smtp.sendgrid.net',
      port: 587,
      user: 'apikey',
      password: 'mock_sendgrid_api_key',
      secure: false
    };

    this.sendGridConfig = {
      apiKey: 'mock_sendgrid_api_key',
      fromAddress: 'noreply@aerofusionxr.com',
      replyTo: 'support@aerofusionxr.com'
    };

    // Default to SendGrid for better deliverability
    this.provider = 'sendgrid';
  }

  /**
   * Send email notification
   */
  async send(request: EmailRequest): Promise<EmailResult> {
    try {
      this.logger.debug('Sending email notification', {
        to: this.maskEmail(request.to),
        subject: request.subject.substring(0, 50) + (request.subject.length > 50 ? '...' : ''),
        bodyLength: request.htmlBody.length,
        hasActionURL: !!request.actionURL
      });

      // Validate request
      this.validateEmailRequest(request);

      // Add default values
      const emailRequest = {
        ...request,
        from: request.from || this.sendGridConfig.fromAddress,
        replyTo: request.replyTo || this.sendGridConfig.replyTo,
        textBody: request.textBody || this.htmlToText(request.htmlBody)
      };

      // Route to appropriate provider
      switch (this.provider) {
        case 'sendgrid':
          return await this.sendViaSendGrid(emailRequest);
        case 'smtp':
          return await this.sendViaSMTP(emailRequest);
        default:
          throw new Error(`Unsupported email provider: ${this.provider}`);
      }

    } catch (error) {
      this.logger.error('Failed to send email notification', {
        to: this.maskEmail(request.to),
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send email via SendGrid API
   */
  private async sendViaSendGrid(request: EmailRequest & { from: string; replyTo: string; textBody: string }): Promise<EmailResult> {
    try {
      // Prepare SendGrid payload
      const payload = {
        personalizations: [
          {
            to: [{ email: request.to }],
            subject: request.subject
          }
        ],
        from: { email: request.from },
        reply_to: { email: request.replyTo },
        content: [
          {
            type: 'text/plain',
            value: request.textBody
          },
          {
            type: 'text/html',
            value: request.htmlBody
          }
        ],
        tracking_settings: {
          click_tracking: { enable: true },
          open_tracking: { enable: true },
          subscription_tracking: { enable: false }
        },
        custom_args: {
          notification_type: 'automated',
          sent_at: new Date().toISOString()
        }
      };

      this.logger.debug('SendGrid payload prepared', {
        to: this.maskEmail(request.to),
        payloadSize: JSON.stringify(payload).length
      });

      // Mock SendGrid API call
      const mockResponse = await this.mockSendGridRequest(payload);

      if (mockResponse.success) {
        this.logger.info('SendGrid email sent successfully', {
          messageID: mockResponse.messageID,
          to: this.maskEmail(request.to)
        });

        return {
          success: true,
          messageID: mockResponse.messageID
        };
      } else {
        // Handle SendGrid-specific errors
        if (mockResponse.error === 'Invalid Email' || mockResponse.error === 'Bounced') {
          this.logger.warn('Email address invalid or bounced', {
            error: mockResponse.error,
            to: this.maskEmail(request.to)
          });

          return {
            success: false,
            error: mockResponse.error,
            bounced: true
          };
        }

        return {
          success: false,
          error: mockResponse.error
        };
      }

    } catch (error) {
      this.logger.error('SendGrid request failed', {
        error: error.message
      });

      return {
        success: false,
        error: `SendGrid error: ${error.message}`
      };
    }
  }

  /**
   * Send email via SMTP
   */
  private async sendViaSMTP(request: EmailRequest & { from: string; replyTo: string; textBody: string }): Promise<EmailResult> {
    try {
      // Prepare SMTP message
      const message = {
        from: request.from,
        to: request.to,
        replyTo: request.replyTo,
        subject: request.subject,
        text: request.textBody,
        html: request.htmlBody,
        headers: {
          'X-Mailer': 'AeroFusionXR-Notifications',
          'X-Notification-Type': 'automated'
        }
      };

      this.logger.debug('SMTP message prepared', {
        to: this.maskEmail(request.to),
        messageSize: JSON.stringify(message).length
      });

      // Mock SMTP send
      const mockResponse = await this.mockSMTPSend(message);

      if (mockResponse.success) {
        this.logger.info('SMTP email sent successfully', {
          messageID: mockResponse.messageID,
          to: this.maskEmail(request.to)
        });

        return {
          success: true,
          messageID: mockResponse.messageID
        };
      } else {
        // Handle SMTP-specific errors
        if (mockResponse.error === 'Mailbox Full' || mockResponse.error === 'User Unknown') {
          this.logger.warn('SMTP delivery failed', {
            error: mockResponse.error,
            to: this.maskEmail(request.to)
          });

          return {
            success: false,
            error: mockResponse.error,
            bounced: true
          };
        }

        return {
          success: false,
          error: mockResponse.error
        };
      }

    } catch (error) {
      this.logger.error('SMTP request failed', {
        error: error.message
      });

      return {
        success: false,
        error: `SMTP error: ${error.message}`
      };
    }
  }

  /**
   * Validate email request
   */
  private validateEmailRequest(request: EmailRequest): void {
    if (!request.to || !this.isValidEmail(request.to)) {
      throw new Error('Valid recipient email address is required');
    }

    if (!request.subject || request.subject.trim().length === 0) {
      throw new Error('Subject is required');
    }

    if (!request.htmlBody || request.htmlBody.trim().length === 0) {
      throw new Error('HTML body is required');
    }

    // Check subject length
    if (request.subject.length > 255) {
      throw new Error('Subject too long (max 255 characters)');
    }

    // Check body size (1MB limit)
    if (request.htmlBody.length > 1024 * 1024) {
      throw new Error('Email body too large (max 1MB)');
    }

    // Validate from address if provided
    if (request.from && !this.isValidEmail(request.from)) {
      throw new Error('Invalid from email address');
    }

    // Validate reply-to address if provided
    if (request.replyTo && !this.isValidEmail(request.replyTo)) {
      throw new Error('Invalid reply-to email address');
    }
  }

  /**
   * Validate email address format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Convert HTML to plain text
   */
  private htmlToText(html: string): string {
    // Basic HTML to text conversion
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  /**
   * Mask email address for logging
   */
  private maskEmail(email: string): string {
    const [username, domain] = email.split('@');
    if (!username || !domain) return email;
    
    const maskedUsername = username.length <= 2 
      ? username 
      : username.substring(0, 2) + '*'.repeat(username.length - 2);
    
    return `${maskedUsername}@${domain}`;
  }

  /**
   * Mock SendGrid API request
   */
  private async mockSendGridRequest(payload: any): Promise<{ success: boolean; messageID?: string; error?: string }> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 200));

    // Mock different response scenarios
    const scenarios = [
      { probability: 0.88, response: { success: true, messageID: `sg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` } },
      { probability: 0.03, response: { success: false, error: 'Invalid Email' } },
      { probability: 0.02, response: { success: false, error: 'Bounced' } },
      { probability: 0.02, response: { success: false, error: 'Rate Limit Exceeded' } },
      { probability: 0.02, response: { success: false, error: 'Blocked' } },
      { probability: 0.03, response: { success: false, error: 'Internal Server Error' } }
    ];

    const random = Math.random();
    let cumulative = 0;

    for (const scenario of scenarios) {
      cumulative += scenario.probability;
      if (random <= cumulative) {
        return scenario.response;
      }
    }

    // Default success case
    return { success: true, messageID: `sg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
  }

  /**
   * Mock SMTP send
   */
  private async mockSMTPSend(message: any): Promise<{ success: boolean; messageID?: string; error?: string }> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Mock different response scenarios
    const scenarios = [
      { probability: 0.85, response: { success: true, messageID: `smtp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` } },
      { probability: 0.04, response: { success: false, error: 'User Unknown' } },
      { probability: 0.03, response: { success: false, error: 'Mailbox Full' } },
      { probability: 0.02, response: { success: false, error: 'Connection Timeout' } },
      { probability: 0.02, response: { success: false, error: 'Relay Access Denied' } },
      { probability: 0.02, response: { success: false, error: 'Message Too Large' } },
      { probability: 0.02, response: { success: false, error: 'Temporary Failure' } }
    ];

    const random = Math.random();
    let cumulative = 0;

    for (const scenario of scenarios) {
      cumulative += scenario.probability;
      if (random <= cumulative) {
        return scenario.response;
      }
    }

    // Default success case
    return { success: true, messageID: `smtp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
  }

  /**
   * Batch send emails
   */
  async sendBatch(requests: EmailRequest[]): Promise<EmailResult[]> {
    this.logger.info('Sending batch emails', {
      batchSize: requests.length
    });

    const results: EmailResult[] = [];
    const batchSize = 50; // Process in smaller chunks for emails

    for (let i = 0; i < requests.length; i += batchSize) {
      const chunk = requests.slice(i, i + batchSize);
      const chunkPromises = chunk.map(request => this.send(request));
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);

      this.logger.debug('Email batch chunk processed', {
        chunkIndex: Math.floor(i / batchSize) + 1,
        chunkSize: chunk.length,
        successCount: chunkResults.filter(r => r.success).length
      });

      // Add delay between chunks to respect rate limits
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const bouncedCount = results.filter(r => r.bounced).length;

    this.logger.info('Batch emails completed', {
      totalRequests: requests.length,
      successCount,
      failureCount: requests.length - successCount,
      bouncedCount
    });

    return results;
  }

  /**
   * Get provider status
   */
  async getStatus(): Promise<{
    provider: string;
    available: boolean;
    latency?: number;
  }> {
    const latency = await this.checkProviderStatus();

    return {
      provider: this.provider,
      available: latency !== null,
      latency: latency || undefined
    };
  }

  private async checkProviderStatus(): Promise<number | null> {
    try {
      const start = Date.now();
      
      if (this.provider === 'sendgrid') {
        // Mock SendGrid status check
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        // Mock SMTP status check
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      
      return Date.now() - start;
    } catch {
      return null;
    }
  }

  /**
   * Switch email provider (for failover)
   */
  switchProvider(provider: 'smtp' | 'sendgrid'): void {
    this.logger.info('Switching email provider', {
      from: this.provider,
      to: provider
    });
    
    this.provider = provider;
  }

  /**
   * Get delivery statistics (mock)
   */
  async getDeliveryStats(timeframe: 'hour' | 'day' | 'week'): Promise<{
    sent: number;
    delivered: number;
    bounced: number;
    opened: number;
    clicked: number;
  }> {
    // Mock delivery statistics
    const baseStats = {
      hour: { sent: 150, delivered: 145, bounced: 3, opened: 65, clicked: 12 },
      day: { sent: 2400, delivered: 2280, bounced: 45, opened: 980, clicked: 180 },
      week: { sent: 18500, delivered: 17650, bounced: 320, opened: 7200, clicked: 1350 }
    };

    return baseStats[timeframe];
  }
} 