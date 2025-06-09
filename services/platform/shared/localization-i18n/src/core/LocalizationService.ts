import { createLogger } from '@aerofusionxr/shared';
import { PerformanceMonitor } from '@aerofusionxr/shared';
import { SecurityService, LocalizationSecurityContext } from '../security/SecurityService';
import { TranslationService } from '../translation/TranslationService';
import { FormatService } from '../formatting/FormatService';
import { MediaLocalizationService } from '../media/MediaLocalizationService';
import { RTLLayoutService } from '../layout/RTLLayoutService';
import { CacheService } from '../utils/CacheService';

// Core localization interfaces
export interface TranslationEntry {
  id: number;
  stringKey: string;
  namespace: string;
  locale: string;
  translatedText: string;
  isFallback: boolean;
  lastUpdated: Date;
}

export interface LocaleFormats {
  locale: string;
  dateFormat: string;
  timeFormat: string;
  currencyFormat: string;
  numberFormat: string;
  firstDayOfWeek: string;
  decimalSeparator: string;
  groupingSeparator: string;
}

export interface SupportedLocale {
  locale: string;
  displayName: string;
  direction: 'LTR' | 'RTL';
  currency: string;
  dateFormat: string;
  timeFormat: string;
  enabled: boolean;
}

export interface MediaLocalization {
  mediaID: string;
  locale: string;
  videoURL?: string;
  subtitleURL?: string;
  imageURL?: string;
  lastUpdated: Date;
}

export interface LocalizationRequest {
  locale: string;
  namespace: string;
  keys?: string[];
}

export interface TranslationResponse {
  stringKey: string;
  translatedText: string;
  isFallback: boolean;
}

export interface MediaRequest {
  mediaID: string;
  locale: string;
  type?: 'video' | 'image' | 'audio';
}

export interface LocalizationStats {
  totalLocales: number;
  totalTranslations: number;
  completionRate: number;
  lastSync: Date;
  fallbackRate: number;
}

// Error classes
export class LocalizationError extends Error {
  constructor(message: string, public code: string, public locale?: string) {
    super(message);
    this.name = 'LocalizationError';
  }
}

export class UnsupportedLocaleError extends LocalizationError {
  constructor(locale: string) {
    super(`Unsupported locale: ${locale}`, 'LOCALE_UNSUPPORTED', locale);
  }
}

export class TranslationNotFoundError extends LocalizationError {
  constructor(key: string, locale: string) {
    super(`Translation not found: ${key} for locale ${locale}`, 'TRANSLATION_NOT_FOUND', locale);
  }
}

export class MediaNotLocalizedError extends LocalizationError {
  constructor(mediaID: string, locale: string) {
    super(`Media not localized: ${mediaID} for locale ${locale}`, 'MEDIA_NOT_LOCALIZED', locale);
  }
}

export class LocalizationService {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private securityService: SecurityService;
  private translationService: TranslationService;
  private formatService: FormatService;
  private mediaLocalizationService: MediaLocalizationService;
  private rtlLayoutService: RTLLayoutService;
  private cacheService: CacheService;

  // Configuration
  private readonly DEFAULT_LOCALE = 'en-SG';
  private readonly CACHE_TTL_SECONDS = 21600; // 6 hours
  private readonly MAX_KEYS_PER_REQUEST = 1000;
  private readonly SUPPORTED_LOCALES_CACHE_KEY = 'supported_locales';

  constructor() {
    this.logger = new Logger('LocalizationService');
    this.performanceMonitor = new PerformanceMonitor('LocalizationService');
    this.securityService = new SecurityService();
    this.translationService = new TranslationService();
    this.formatService = new FormatService();
    this.mediaLocalizationService = new MediaLocalizationService();
    this.rtlLayoutService = new RTLLayoutService();
    this.cacheService = new CacheService();
  }

  /**
   * Get localized strings for a given locale and namespace
   */
  async getLocalizedStrings(
    request: LocalizationRequest,
    context: LocalizationSecurityContext
  ): Promise<TranslationResponse[]> {
    const startTime = Date.now();

    try {
      this.logger.info('Getting localized strings', {
        locale: request.locale,
        namespace: request.namespace,
        keyCount: request.keys?.length || 'all'
      });

      // Validate request
      await this.validateLocalizationRequest(request, context);

      // Check if locale is supported
      await this.validateSupportedLocale(request.locale);

      // Check cache first
      const cacheKey = this.generateCacheKey('strings', request.locale, request.namespace);
      const cachedTranslations = await this.cacheService.get<TranslationResponse[]>(cacheKey);
      if (cachedTranslations && !request.keys) {
        return cachedTranslations;
      }

      // Get translations from service
      const translations = await this.translationService.getTranslations({
        locale: request.locale,
        namespace: request.namespace,
        keys: request.keys,
        fallbackLocale: this.DEFAULT_LOCALE
      });

      // Convert to response format
      const response: TranslationResponse[] = translations.map(translation => ({
        stringKey: translation.stringKey,
        translatedText: translation.translatedText,
        isFallback: translation.isFallback || false
      }));

      // Cache the result if getting all keys
      if (!request.keys) {
        await this.cacheService.set(cacheKey, response, this.CACHE_TTL_SECONDS);
      }

      // Record metrics
      await this.performanceMonitor.recordTiming('string_retrieval_duration', startTime, {
        locale: request.locale,
        namespace: request.namespace,
        resultCount: response.length
      });

      await this.performanceMonitor.recordMetric('translations_served', response.length, {
        locale: request.locale,
        namespace: request.namespace
      });

      this.logger.info('Localized strings retrieved successfully', {
        locale: request.locale,
        namespace: request.namespace,
        resultCount: response.length,
        fallbackCount: response.filter(r => r.isFallback).length,
        duration: Date.now() - startTime
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to get localized strings', {
        locale: request.locale,
        namespace: request.namespace,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('string_retrieval_errors', 1, {
        locale: request.locale,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get locale-specific formatting rules
   */
  async getLocaleFormats(
    locale: string,
    context: LocalizationSecurityContext
  ): Promise<LocaleFormats> {
    const startTime = Date.now();

    try {
      this.logger.info('Getting locale formats', { locale });

      // Validate access
      await this.securityService.validateLocalizationRequest('localization.read', context);

      // Validate locale
      await this.validateSupportedLocale(locale);

      // Check cache
      const cacheKey = this.generateCacheKey('formats', locale);
      const cachedFormats = await this.cacheService.get<LocaleFormats>(cacheKey);
      if (cachedFormats) {
        return cachedFormats;
      }

      // Get formats from service
      const formats = await this.formatService.getLocaleFormats(locale);

      // Cache the result
      await this.cacheService.set(cacheKey, formats, this.CACHE_TTL_SECONDS);

      // Record metrics
      await this.performanceMonitor.recordTiming('format_retrieval_duration', startTime, {
        locale
      });

      this.logger.info('Locale formats retrieved successfully', {
        locale,
        duration: Date.now() - startTime
      });

      return formats;

    } catch (error) {
      this.logger.error('Failed to get locale formats', {
        locale,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('format_retrieval_errors', 1, {
        locale,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get localized media assets
   */
  async getLocalizedMedia(
    request: MediaRequest,
    context: LocalizationSecurityContext
  ): Promise<MediaLocalization> {
    const startTime = Date.now();

    try {
      this.logger.info('Getting localized media', {
        mediaID: request.mediaID,
        locale: request.locale,
        type: request.type
      });

      // Validate access
      await this.securityService.validateLocalizationRequest('localization.read', context);

      // Validate locale
      await this.validateSupportedLocale(request.locale);

      // Check cache
      const cacheKey = this.generateCacheKey('media', request.locale, request.mediaID);
      const cachedMedia = await this.cacheService.get<MediaLocalization>(cacheKey);
      if (cachedMedia) {
        return cachedMedia;
      }

      // Get media from service
      const media = await this.mediaLocalizationService.getLocalizedMedia({
        mediaID: request.mediaID,
        locale: request.locale,
        fallbackLocale: this.DEFAULT_LOCALE,
        type: request.type
      });

      if (!media) {
        throw new MediaNotLocalizedError(request.mediaID, request.locale);
      }

      // Cache the result
      await this.cacheService.set(cacheKey, media, this.CACHE_TTL_SECONDS);

      // Record metrics
      await this.performanceMonitor.recordTiming('media_retrieval_duration', startTime, {
        mediaID: request.mediaID,
        locale: request.locale
      });

      this.logger.info('Localized media retrieved successfully', {
        mediaID: request.mediaID,
        locale: request.locale,
        hasVideo: !!media.videoURL,
        hasSubtitles: !!media.subtitleURL,
        hasImage: !!media.imageURL,
        duration: Date.now() - startTime
      });

      return media;

    } catch (error) {
      this.logger.error('Failed to get localized media', {
        mediaID: request.mediaID,
        locale: request.locale,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('media_retrieval_errors', 1, {
        locale: request.locale,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get supported locales
   */
  async getSupportedLocales(
    context: LocalizationSecurityContext
  ): Promise<SupportedLocale[]> {
    const startTime = Date.now();

    try {
      this.logger.info('Getting supported locales');

      // Validate access
      await this.securityService.validateLocalizationRequest('localization.read', context);

      // Check cache
      const cachedLocales = await this.cacheService.get<SupportedLocale[]>(this.SUPPORTED_LOCALES_CACHE_KEY);
      if (cachedLocales) {
        return cachedLocales;
      }

      // Get from service
      const locales = await this.translationService.getSupportedLocales();

      // Cache the result
      await this.cacheService.set(this.SUPPORTED_LOCALES_CACHE_KEY, locales, this.CACHE_TTL_SECONDS);

      // Record metrics
      await this.performanceMonitor.recordTiming('supported_locales_duration', startTime);

      this.logger.info('Supported locales retrieved successfully', {
        localeCount: locales.length,
        duration: Date.now() - startTime
      });

      return locales;

    } catch (error) {
      this.logger.error('Failed to get supported locales', {
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('supported_locales_errors', 1, {
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Format number according to locale
   */
  async formatNumber(
    value: number,
    locale: string,
    options?: Intl.NumberFormatOptions
  ): Promise<string> {
    try {
      // Validate locale
      await this.validateSupportedLocale(locale);

      return await this.formatService.formatNumber(value, locale, options);
    } catch (error) {
      this.logger.error('Failed to format number', {
        value,
        locale,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Format currency according to locale
   */
  async formatCurrency(
    value: number,
    locale: string,
    currency: string
  ): Promise<string> {
    try {
      // Validate locale
      await this.validateSupportedLocale(locale);

      return await this.formatService.formatCurrency(value, locale, currency);
    } catch (error) {
      this.logger.error('Failed to format currency', {
        value,
        locale,
        currency,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Format date according to locale
   */
  async formatDate(
    date: Date,
    locale: string,
    options?: Intl.DateTimeFormatOptions
  ): Promise<string> {
    try {
      // Validate locale
      await this.validateSupportedLocale(locale);

      return await this.formatService.formatDate(date, locale, options);
    } catch (error) {
      this.logger.error('Failed to format date', {
        date: date.toISOString(),
        locale,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if locale requires RTL layout
   */
  async isRTLLocale(locale: string): Promise<boolean> {
    try {
      return await this.rtlLayoutService.isRTLLocale(locale);
    } catch (error) {
      this.logger.error('Failed to check RTL locale', {
        locale,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get RTL layout adjustments for a locale
   */
  async getRTLAdjustments(
    locale: string,
    context: LocalizationSecurityContext
  ): Promise<{ direction: 'ltr' | 'rtl'; adjustments: any }> {
    try {
      // Validate access
      await this.securityService.validateLocalizationRequest('localization.read', context);

      // Validate locale
      await this.validateSupportedLocale(locale);

      return await this.rtlLayoutService.getLayoutAdjustments(locale);
    } catch (error) {
      this.logger.error('Failed to get RTL adjustments', {
        locale,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get localization statistics
   */
  async getLocalizationStats(
    context: LocalizationSecurityContext
  ): Promise<LocalizationStats> {
    const startTime = Date.now();

    try {
      this.logger.info('Getting localization statistics');

      // Validate access (admin only)
      await this.securityService.validateLocalizationRequest('localization.admin', context);

      const stats = await this.translationService.getTranslationStats();

      // Record metrics
      await this.performanceMonitor.recordTiming('stats_retrieval_duration', startTime);

      this.logger.info('Localization statistics retrieved successfully', {
        totalLocales: stats.totalLocales,
        totalTranslations: stats.totalTranslations,
        completionRate: stats.completionRate,
        duration: Date.now() - startTime
      });

      return stats;

    } catch (error) {
      this.logger.error('Failed to get localization statistics', {
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('stats_retrieval_errors', 1, {
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Import translations from file
   */
  async importTranslations(
    fileBuffer: Buffer,
    locale: string,
    namespace: string,
    format: 'po' | 'json' | 'xlsx',
    context: LocalizationSecurityContext
  ): Promise<{ imported: number; updated: number; errors: string[] }> {
    const startTime = Date.now();

    try {
      this.logger.info('Importing translations', {
        locale,
        namespace,
        format,
        fileSize: fileBuffer.length
      });

      // Validate access (admin only)
      await this.securityService.validateLocalizationRequest('localization.write', context);

      // Validate locale
      await this.validateSupportedLocale(locale);

      const result = await this.translationService.importTranslations({
        fileBuffer,
        locale,
        namespace,
        format
      });

      // Clear cache for affected namespace
      await this.clearNamespaceCache(locale, namespace);

      // Record metrics
      await this.performanceMonitor.recordTiming('translation_import_duration', startTime, {
        locale,
        namespace,
        format
      });

      await this.performanceMonitor.recordMetric('translations_imported', result.imported, {
        locale,
        namespace
      });

      this.logger.info('Translations imported successfully', {
        locale,
        namespace,
        imported: result.imported,
        updated: result.updated,
        errors: result.errors.length,
        duration: Date.now() - startTime
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to import translations', {
        locale,
        namespace,
        format,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('translation_import_errors', 1, {
        locale,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async validateLocalizationRequest(
    request: LocalizationRequest,
    context: LocalizationSecurityContext
  ): Promise<void> {
    // Validate access
    await this.securityService.validateLocalizationRequest('localization.read', context);

    // Validate parameters
    if (!request.locale) {
      throw new LocalizationError('Locale is required', 'LOCALE_REQUIRED');
    }

    if (!request.namespace) {
      throw new LocalizationError('Namespace is required', 'NAMESPACE_REQUIRED');
    }

    if (request.keys && request.keys.length > this.MAX_KEYS_PER_REQUEST) {
      throw new LocalizationError(
        `Too many keys requested (max ${this.MAX_KEYS_PER_REQUEST})`,
        'TOO_MANY_KEYS'
      );
    }
  }

  private async validateSupportedLocale(locale: string): Promise<void> {
    const supportedLocales = await this.cacheService.get<SupportedLocale[]>(this.SUPPORTED_LOCALES_CACHE_KEY);
    
    if (supportedLocales) {
      const isSupported = supportedLocales.some(l => l.locale === locale && l.enabled);
      if (!isSupported) {
        throw new UnsupportedLocaleError(locale);
      }
    } else {
      // Fallback to service check
      const isSupported = await this.translationService.isLocaleSupported(locale);
      if (!isSupported) {
        throw new UnsupportedLocaleError(locale);
      }
    }
  }

  private generateCacheKey(...parts: string[]): string {
    return `localization:${parts.join(':')}`;
  }

  private async clearNamespaceCache(locale: string, namespace: string): Promise<void> {
    const cacheKey = this.generateCacheKey('strings', locale, namespace);
    await this.cacheService.delete(cacheKey);
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    dependencies: { [key: string]: boolean };
    metrics: any;
  }> {
    const translationHealth = await this.translationService.getHealth();
    const formatHealth = await this.formatService.getHealth();
    const mediaHealth = await this.mediaLocalizationService.getHealth();
    const cacheHealth = await this.cacheService.getHealth();

    const healthyServices = [
      translationHealth.available,
      formatHealth.available,
      mediaHealth.available,
      cacheHealth.available
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
        translation: translationHealth.available,
        formatting: formatHealth.available,
        media: mediaHealth.available,
        cache: cacheHealth.available
      },
      metrics: {
        avgStringRetrievalTime: this.performanceMonitor.getMetricStats('string_retrieval_duration')?.avg || 0,
        cacheHitRate: this.calculateCacheHitRate(),
        totalTranslationsServed: this.performanceMonitor.getMetricStats('translations_served')?.sum || 0,
        fallbackRate: this.calculateFallbackRate()
      }
    };
  }

  private calculateCacheHitRate(): number {
    // Implementation would track cache hits vs misses
    return 92.0; // Mock value
  }

  private calculateFallbackRate(): number {
    // Implementation would track fallbacks vs successful translations
    return 3.5; // Mock value
  }
} 
