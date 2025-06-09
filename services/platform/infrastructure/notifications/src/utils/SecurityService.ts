import crypto from 'crypto';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class SecurityService {
  private readonly allowedHTMLTags = [
    'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'a', 'img', 'div', 'span', 'table', 'tr', 'td', 'th'
  ];

  private readonly allowedAttributes = [
    'href', 'src', 'alt', 'title', 'style', 'class', 'id'
  ];

  /**
   * Sanitize HTML content to prevent XSS attacks
   */
  sanitizeHTML(html: string): string {
    if (!html) return '';

    // Remove script tags and their content
    let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove dangerous event handlers
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
    
    // Remove javascript: URLs
    sanitized = sanitized.replace(/javascript:/gi, '');
    
    // Remove data: URLs (except for images)
    sanitized = sanitized.replace(/data:(?!image\/)/gi, '');
    
    // Remove style tags
    sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    
    return sanitized;
  }

  /**
   * Validate email address format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format (international)
   */
  validatePhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Validate locale format (BCP 47)
   */
  validateLocale(locale: string): boolean {
    const localeRegex = /^[a-z]{2}-[A-Z]{2}$/;
    return localeRegex.test(locale);
  }

  /**
   * Validate template ID format
   */
  validateTemplateID(templateID: string): boolean {
    const templateIDRegex = /^[a-zA-Z0-9_-]+$/;
    return templateIDRegex.test(templateID);
  }

  /**
   * Validate user ID format
   */
  validateUserID(userID: string): boolean {
    const userIDRegex = /^[a-zA-Z0-9_-]{1,36}$/;
    return userIDRegex.test(userID);
  }

  /**
   * Validate device token format
   */
  validateDeviceToken(token: string, platform: string): boolean {
    if (platform === 'android') {
      // FCM tokens are typically 152+ characters
      return token.length >= 140 && /^[a-zA-Z0-9_-]+$/.test(token);
    } else if (platform === 'ios') {
      // APNs tokens are 64 hex characters
      return /^[a-fA-F0-9]{64}$/.test(token);
    }
    return false;
  }

  /**
   * Validate notification channel
   */
  validateChannel(channel: string): boolean {
    return ['push', 'email', 'inApp', 'sms'].includes(channel);
  }

  /**
   * Validate time format (HH:mm)
   */
  validateTimeFormat(time: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  /**
   * Generate HMAC signature for webhook verification
   */
  generateHMAC(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  verifyHMAC(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateHMAC(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(text: string, key: string): string {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedText: string, key: string): string {
    const algorithm = 'aes-256-gcm';
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipher(algorithm, key);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Rate limiting check
   */
  async checkRateLimit(
    identifier: string, 
    limit: number, 
    windowMs: number,
    redis: any
  ): Promise<{ allowed: boolean; remaining: number; resetTime: Date }> {
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Remove old entries
    await redis.zremrangebyscore(key, 0, windowStart);

    // Count current requests
    const currentCount = await redis.zcard(key);

    if (currentCount >= limit) {
      const oldestEntry = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const resetTime = new Date(parseInt(oldestEntry[1]) + windowMs);
      
      return {
        allowed: false,
        remaining: 0,
        resetTime
      };
    }

    // Add current request
    await redis.zadd(key, now, `${now}-${Math.random()}`);
    await redis.expire(key, Math.ceil(windowMs / 1000));

    return {
      allowed: true,
      remaining: limit - currentCount - 1,
      resetTime: new Date(now + windowMs)
    };
  }

  /**
   * Validate notification preferences
   */
  validateNotificationPreferences(preferences: any): ValidationResult {
    const errors: string[] = [];

    if (typeof preferences !== 'object' || preferences === null) {
      errors.push('Preferences must be an object');
      return { isValid: false, errors };
    }

    // Validate boolean fields
    const booleanFields = ['emailOffers', 'pushPromotions', 'smsAlerts'];
    for (const field of booleanFields) {
      if (preferences[field] !== undefined && typeof preferences[field] !== 'boolean') {
        errors.push(`${field} must be a boolean`);
      }
    }

    // Validate DND settings
    if (preferences.doNotDisturb) {
      const dnd = preferences.doNotDisturb;
      if (typeof dnd !== 'object') {
        errors.push('doNotDisturb must be an object');
      } else {
        if (!this.validateTimeFormat(dnd.start)) {
          errors.push('doNotDisturb.start must be in HH:mm format');
        }
        if (!this.validateTimeFormat(dnd.end)) {
          errors.push('doNotDisturb.end must be in HH:mm format');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate template content
   */
  validateTemplateContent(template: any): ValidationResult {
    const errors: string[] = [];

    if (!template.titleTemplate || typeof template.titleTemplate !== 'string') {
      errors.push('titleTemplate is required and must be a string');
    }

    if (!template.bodyTemplate || typeof template.bodyTemplate !== 'string') {
      errors.push('bodyTemplate is required and must be a string');
    }

    // Check for potentially dangerous template content
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(template.titleTemplate) || pattern.test(template.bodyTemplate)) {
        errors.push('Template contains potentially dangerous content');
        break;
      }
    }

    // Validate template variables
    const variablePattern = /\{\{([^}]+)\}\}/g;
    const titleVariables = [...template.titleTemplate.matchAll(variablePattern)];
    const bodyVariables = [...template.bodyTemplate.matchAll(variablePattern)];

    for (const match of [...titleVariables, ...bodyVariables]) {
      const variable = match[1].trim();
      if (!/^[a-zA-Z0-9_.]+$/.test(variable)) {
        errors.push(`Invalid template variable: ${variable}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Hash sensitive data for logging
   */
  hashForLogging(data: string): string {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex')
      .substring(0, 8);
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
} 