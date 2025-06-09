/**
 * @fileoverview AI Concierge Service - Configuration Manager
 * @version 1.0.0
 * @author AeroFusionXR AI Engineering Team
 * @created 2024-01-15
 * @updated 2024-01-15
 * 
 * Centralized configuration management for all AI Concierge features.
 * Handles environment variables, validation, and configuration defaults.
 * 
 * Features:
 * - Environment variable validation
 * - Type-safe configuration access
 * - Default value management
 * - Configuration hot-reloading
 * - Secure credential handling
 */

import * as dotenv from 'dotenv';
import { SupportedLanguage } from '../types';

// Load environment variables
dotenv.config();

/**
 * Database configuration interface
 */
interface DatabaseConfig {
  uri: string;
  maxPoolSize: number;
  minPoolSize: number;
  maxIdleTimeMS: number;
  serverSelectionTimeoutMS: number;
  socketTimeoutMS: number;
  heartbeatFrequencyMS: number;
  retryAttempts: number;
  retryDelay: number;
  healthCheckInterval: number;
}

/**
 * Redis cache configuration interface
 */
interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  ttl: number;
  maxRetries: number;
  retryDelayOnFailover: number;
}

/**
 * Server configuration interface
 */
interface ServerConfig {
  port: number;
  host: string;
  environment: 'development' | 'staging' | 'production';
  logLevel: string;
  corsOrigins: string[];
  rateLimitWindow: number;
  rateLimitMax: number;
  bodyLimit: string;
}

/**
 * AI service configuration interface
 */
interface AIConfig {
  openai: {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  azure: {
    speechKey: string;
    speechRegion: string;
    translatorKey: string;
    translatorRegion: string;
  };
  defaultLanguage: SupportedLanguage;
  supportedLanguages: SupportedLanguage[];
}

/**
 * External service configuration interface
 */
interface ExternalServicesConfig {
  twilio: {
    accountSid: string;
    authToken: string;
    fromNumber: string;
  };
  email: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    fromAddress: string;
  };
  whatsapp: {
    businessAccountId: string;
    accessToken: string;
    webhookVerifyToken: string;
  };
}

/**
 * Security configuration interface
 */
interface SecurityConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptRounds: number;
  encryptionKey: string;
  allowedOrigins: string[];
  apiKeyHeader: string;
}

/**
 * Feature flags configuration interface
 */
interface FeatureFlags {
  kioskEnabled: boolean;
  vipServicesEnabled: boolean;
  baggageTrackingEnabled: boolean;
  emergencyManagementEnabled: boolean;
  analyticsEnabled: boolean;
  realTimeNotificationsEnabled: boolean;
  multilingualSupportEnabled: boolean;
}

/**
 * Complete application configuration interface
 */
interface AppConfig {
  server: ServerConfig;
  database: DatabaseConfig;
  cache: CacheConfig;
  ai: AIConfig;
  externalServices: ExternalServicesConfig;
  security: SecurityConfig;
  features: FeatureFlags;
}

/**
 * Configuration Manager Class
 * Provides centralized, type-safe access to all application configuration
 */
export class ConfigurationManager {
  private config: AppConfig;
  private isInitialized: boolean = false;

  constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
    this.isInitialized = true;
  }

  /**
   * Load configuration from environment variables with defaults
   */
  private loadConfiguration(): AppConfig {
    return {
      server: {
        port: parseInt(process.env.PORT || '3001'),
        host: process.env.HOST || '0.0.0.0',
        environment: (process.env.NODE_ENV as any) || 'development',
        logLevel: process.env.LOG_LEVEL || 'info',
        corsOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
        rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '1000'),
        bodyLimit: process.env.BODY_LIMIT || '10mb'
      },

      database: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-concierge',
        maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || '20'),
        minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE || '5'),
        maxIdleTimeMS: parseInt(process.env.DB_MAX_IDLE_TIME || '30000'),
        serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT || '5000'),
        socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT || '45000'),
        heartbeatFrequencyMS: parseInt(process.env.DB_HEARTBEAT_FREQUENCY || '10000'),
        retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS || '3'),
        retryDelay: parseInt(process.env.DB_RETRY_DELAY || '2000'),
        healthCheckInterval: parseInt(process.env.DB_HEALTH_CHECK_INTERVAL || '30000')
      },

      cache: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'ai-concierge:',
        ttl: parseInt(process.env.REDIS_TTL || '3600'), // 1 hour
        maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
        retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100')
      },

      ai: {
        openai: {
          apiKey: process.env.OPENAI_API_KEY || '',
          model: process.env.OPENAI_MODEL || 'gpt-4',
          maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2048'),
          temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7')
        },
        azure: {
          speechKey: process.env.AZURE_SPEECH_KEY || '',
          speechRegion: process.env.AZURE_SPEECH_REGION || 'eastus',
          translatorKey: process.env.AZURE_TRANSLATOR_KEY || '',
          translatorRegion: process.env.AZURE_TRANSLATOR_REGION || 'global'
        },
        defaultLanguage: (process.env.DEFAULT_LANGUAGE as SupportedLanguage) || 'en',
        supportedLanguages: (process.env.SUPPORTED_LANGUAGES?.split(',') as SupportedLanguage[]) || 
          ['en', 'ar', 'fr', 'de', 'es', 'it', 'ru', 'zh', 'ja', 'ko', 'hi', 'ur']
      },

      externalServices: {
        twilio: {
          accountSid: process.env.TWILIO_ACCOUNT_SID || '',
          authToken: process.env.TWILIO_AUTH_TOKEN || '',
          fromNumber: process.env.TWILIO_FROM_NUMBER || ''
        },
        email: {
          host: process.env.EMAIL_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.EMAIL_PORT || '587'),
          secure: process.env.EMAIL_SECURE === 'true',
          user: process.env.EMAIL_USER || '',
          password: process.env.EMAIL_PASSWORD || '',
          fromAddress: process.env.EMAIL_FROM || 'noreply@aerofusionxr.com'
        },
        whatsapp: {
          businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
          accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
          webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || ''
        }
      },

      security: {
        jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
        encryptionKey: process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key-here',
        allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        apiKeyHeader: process.env.API_KEY_HEADER || 'X-API-Key'
      },

      features: {
        kioskEnabled: process.env.FEATURE_KIOSK_ENABLED !== 'false',
        vipServicesEnabled: process.env.FEATURE_VIP_SERVICES_ENABLED !== 'false',
        baggageTrackingEnabled: process.env.FEATURE_BAGGAGE_TRACKING_ENABLED !== 'false',
        emergencyManagementEnabled: process.env.FEATURE_EMERGENCY_MANAGEMENT_ENABLED !== 'false',
        analyticsEnabled: process.env.FEATURE_ANALYTICS_ENABLED !== 'false',
        realTimeNotificationsEnabled: process.env.FEATURE_REAL_TIME_NOTIFICATIONS_ENABLED !== 'false',
        multilingualSupportEnabled: process.env.FEATURE_MULTILINGUAL_SUPPORT_ENABLED !== 'false'
      }
    };
  }

  /**
   * Validate critical configuration values
   */
  private validateConfiguration(): void {
    const errors: string[] = [];

    // Validate server configuration
    if (this.config.server.port < 1 || this.config.server.port > 65535) {
      errors.push('Invalid server port. Must be between 1 and 65535.');
    }

    // Validate database configuration
    if (!this.config.database.uri) {
      errors.push('Database URI is required.');
    }

    // Validate AI service keys in production
    if (this.config.server.environment === 'production') {
      if (!this.config.ai.openai.apiKey) {
        errors.push('OpenAI API key is required in production.');
      }
      if (!this.config.ai.azure.speechKey) {
        errors.push('Azure Speech key is required in production.');
      }
    }

    // Validate security configuration
    if (this.config.server.environment === 'production') {
      if (this.config.security.jwtSecret === 'your-super-secret-jwt-key-change-in-production') {
        errors.push('JWT secret must be changed in production.');
      }
      if (this.config.security.encryptionKey === 'your-32-character-encryption-key-here') {
        errors.push('Encryption key must be changed in production.');
      }
    }

    // Validate external service configuration for enabled features
    if (this.config.features.realTimeNotificationsEnabled) {
      if (!this.config.externalServices.twilio.accountSid && !this.config.externalServices.email.user) {
        errors.push('At least one notification service (Twilio or Email) must be configured when real-time notifications are enabled.');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * Get server configuration
   */
  public getServerConfig(): ServerConfig {
    return { ...this.config.server };
  }

  /**
   * Get database configuration
   */
  public getDatabaseConfig(): DatabaseConfig {
    return { ...this.config.database };
  }

  /**
   * Get cache configuration
   */
  public getCacheConfig(): CacheConfig {
    return { ...this.config.cache };
  }

  /**
   * Get AI service configuration
   */
  public getAIConfig(): AIConfig {
    return { ...this.config.ai };
  }

  /**
   * Get external services configuration
   */
  public getExternalServicesConfig(): ExternalServicesConfig {
    return { ...this.config.externalServices };
  }

  /**
   * Get security configuration
   */
  public getSecurityConfig(): SecurityConfig {
    return { ...this.config.security };
  }

  /**
   * Get feature flags
   */
  public getFeatureFlags(): FeatureFlags {
    return { ...this.config.features };
  }

  /**
   * Get complete configuration
   */
  public getConfig(): AppConfig {
    return JSON.parse(JSON.stringify(this.config)); // Deep clone
  }

  /**
   * Check if a specific feature is enabled
   */
  public isFeatureEnabled(feature: keyof FeatureFlags): boolean {
    return this.config.features[feature];
  }

  /**
   * Get environment name
   */
  public getEnvironment(): string {
    return this.config.server.environment;
  }

  /**
   * Check if running in production
   */
  public isProduction(): boolean {
    return this.config.server.environment === 'production';
  }

  /**
   * Check if running in development
   */
  public isDevelopment(): boolean {
    return this.config.server.environment === 'development';
  }

  /**
   * Get configuration value by path (dot notation)
   */
  public get(path: string): any {
    return path.split('.').reduce((obj, key) => obj?.[key], this.config);
  }

  /**
   * Check if configuration is initialized
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Reload configuration from environment variables
   * Useful for hot-reloading in development
   */
  public reload(): void {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  /**
   * Get sanitized configuration for logging (removes sensitive data)
   */
  public getSanitizedConfig(): Partial<AppConfig> {
    const sanitized = JSON.parse(JSON.stringify(this.config));
    
    // Remove sensitive information
    if (sanitized.ai?.openai?.apiKey) {
      sanitized.ai.openai.apiKey = '***REDACTED***';
    }
    if (sanitized.ai?.azure?.speechKey) {
      sanitized.ai.azure.speechKey = '***REDACTED***';
    }
    if (sanitized.ai?.azure?.translatorKey) {
      sanitized.ai.azure.translatorKey = '***REDACTED***';
    }
    if (sanitized.security?.jwtSecret) {
      sanitized.security.jwtSecret = '***REDACTED***';
    }
    if (sanitized.security?.encryptionKey) {
      sanitized.security.encryptionKey = '***REDACTED***';
    }
    if (sanitized.externalServices?.twilio?.authToken) {
      sanitized.externalServices.twilio.authToken = '***REDACTED***';
    }
    if (sanitized.externalServices?.email?.password) {
      sanitized.externalServices.email.password = '***REDACTED***';
    }
    if (sanitized.cache?.password) {
      sanitized.cache.password = '***REDACTED***';
    }

    return sanitized;
  }
} 