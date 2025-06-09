import { createLogger, createPerformanceMonitor, PerformanceMonitor } from '@aerofusionxr/shared';

// Core localization interfaces
export interface LocalizedString {
  stringKey: string;
  locale: string;
  text: string;
  lastUpdated: Date;
}

export interface LocaleFormat {
  locale: string;
  dateFormat: string;
  timeFormat: string;
  numberFormat: NumberFormat;
  currencyFormat: CurrencyFormat;
  textDirection: 'LTR' | 'RTL';
  createdAt: Date;
  updatedAt: Date;
}

export interface NumberFormat {
  decimalSep: string;
  thousandSep: string;
}

export interface CurrencyFormat {
  symbolPos: 'before' | 'after';
  symbol: string;
}

export interface LocaleVoiceMapping {
  locale: string;
  ttsVoice: string;
  sttModel: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StringsRequest {
  locale: string;
  keys?: string[];
  namespace?: string;
}

export interface StringsResponse {
  locale: string;
  strings: Record<string, string>;
  fallbackStrings?: Record<string, string>;
}

export interface TranslationsUpdateRequest {
  locale: string;
  translations: Record<string, string>;
  namespace?: string;
}

export interface TranslationsUpdateResponse {
  updated: string[];
  failed: string[];
  locale: string;
}

export interface FormatUpdateRequest {
  dateFormat: string;
  timeFormat: string;
  numberFormat: NumberFormat;
  currencyFormat: CurrencyFormat;
  textDirection: 'LTR' | 'RTL';
}

export interface VoiceMappingRequest {
  ttsVoice: string;
  sttModel: string;
}

export interface UserLocaleUpdateRequest {
  locale: string;
  timezone?: string;
  dateFormat?: string;
  timeFormat?: string;
}

export interface UserLocaleUpdateResponse {
  userID: string;
  locale: string;
  timezone?: string;
  message: string;
}

export interface LocaleInfo {
  locale: string;
  name: string;
  nativeName: string;
  isRTL: boolean;
  isSupported: boolean;
  completeness: number; // percentage of translated strings
}

export interface TranslationStats {
  totalStrings: number;
  translatedStrings: number;
  pendingTranslations: number;
  completeness: number;
  lastUpdated: Date;
}

/**
 * Localization Feature Module
 * Consolidated from localization service into user-profile
 * 
 * Features:
 * - Multi-language string management and translation
 * - Locale-specific formatting (dates, numbers, currency)
 * - Right-to-left (RTL) language support
 * - Voice and speech recognition mapping
 * - User locale preferences management
 * - Translation completeness tracking
 * - Fallback language support
 * - Dynamic string loading and caching
 */
export class LocalizationFeature {
  private logger = createLogger('user-profile.localization');
  private performanceMonitor = createPerformanceMonitor('localization');
  private stringsCache: Map<string, Record<string, string>> = new Map();
  private formatsCache: Map<string, LocaleFormat> = new Map();
  private voiceMappingsCache: Map<string, LocaleVoiceMapping> = new Map();
  
  // Configuration
  private readonly supportedLocales = new Set(['en', 'zh', 'ms', 'ta', 'hi', 'ja', 'ko', 'th', 'vi', 'id', 'ar']);
  private readonly defaultLocale = 'en';
  private readonly fallbackLocale = 'en';
  private readonly CACHE_TTL_MINUTES = 60;

  constructor() {
    this.logger.info('Localization Feature initialized');
    this.initializeMockData();
  }

  /**
   * Get localized strings for a locale
   * @param request - Strings request with locale and optional keys
   */
  async getStrings(request: StringsRequest): Promise<StringsResponse> {
    const timer = this.performanceMonitor.startTimer('get_strings');
    
    try {
      this.logger.debug('Getting localized strings', {
        locale: request.locale,
        keyCount: request.keys?.length,
        namespace: request.namespace
      });

      // Validate locale
      if (!this.supportedLocales.has(request.locale)) {
        throw new Error(`Unsupported locale: ${request.locale}`);
      }

      // Get strings from cache or load
      let strings = this.stringsCache.get(request.locale);
      if (!strings) {
        strings = await this.loadStringsFromDatabase(request.locale);
        this.stringsCache.set(request.locale, strings);
        
        // Set cache expiration
        setTimeout(() => {
          this.stringsCache.delete(request.locale);
        }, this.CACHE_TTL_MINUTES * 60 * 1000);
      }

      // Filter by keys if specified
      let filteredStrings = strings;
      if (request.keys && request.keys.length > 0) {
        filteredStrings = {};
        for (const key of request.keys) {
          if (strings[key]) {
            filteredStrings[key] = strings[key];
          }
        }
      }

      // Get fallback strings for missing translations
      let fallbackStrings: Record<string, string> | undefined;
      if (request.locale !== this.fallbackLocale) {
        const fallbackData = this.stringsCache.get(this.fallbackLocale) || 
          await this.loadStringsFromDatabase(this.fallbackLocale);
        
        fallbackStrings = {};
        for (const key in filteredStrings) {
          if (!filteredStrings[key] && fallbackData[key]) {
            fallbackStrings[key] = fallbackData[key];
          }
        }
      }

      this.performanceMonitor.recordMetric('strings_retrieved', Object.keys(filteredStrings).length, {
        locale: request.locale,
        namespace: request.namespace
      });

      this.logger.debug('Localized strings retrieved', {
        locale: request.locale,
        stringCount: Object.keys(filteredStrings).length,
        fallbackCount: fallbackStrings ? Object.keys(fallbackStrings).length : 0
      });

      timer.end(true);
      return {
        locale: request.locale,
        strings: filteredStrings,
        fallbackStrings
      };

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get localized strings', {
        locale: request.locale,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update translations for a locale
   * @param request - Translation update request
   */
  async updateStrings(request: TranslationsUpdateRequest): Promise<TranslationsUpdateResponse> {
    const timer = this.performanceMonitor.startTimer('update_strings');
    
    try {
      this.logger.info('Updating translations', {
        locale: request.locale,
        translationCount: Object.keys(request.translations).length,
        namespace: request.namespace
      });

      // Validate locale
      if (!this.supportedLocales.has(request.locale)) {
        throw new Error(`Unsupported locale: ${request.locale}`);
      }

      const updated: string[] = [];
      const failed: string[] = [];

      // Process each translation
      for (const [key, value] of Object.entries(request.translations)) {
        try {
          // Sanitize translation text
          const sanitizedText = this.sanitizeTranslationText(value);
          
          // Update in cache
          let strings = this.stringsCache.get(request.locale) || {};
          strings[key] = sanitizedText;
          this.stringsCache.set(request.locale, strings);
          
          updated.push(key);
        } catch (error) {
          this.logger.warn('Failed to update translation', {
            locale: request.locale,
            key,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          failed.push(key);
        }
      }

      // Save to database (mock)
      await this.saveStringsToDatabase(request.locale, request.translations);

      this.performanceMonitor.recordMetric('strings_updated', updated.length, {
        locale: request.locale,
        failed: failed.length
      });

      this.logger.info('Translations updated', {
        locale: request.locale,
        updated: updated.length,
        failed: failed.length
      });

      timer.end(true);
      return {
        updated,
        failed,
        locale: request.locale
      };

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to update translations', {
        locale: request.locale,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get locale formatting rules
   * @param locale - Locale identifier
   */
  async getFormats(locale: string): Promise<LocaleFormat> {
    const timer = this.performanceMonitor.startTimer('get_formats');
    
    try {
      this.logger.debug('Getting locale formats', { locale });

      // Check cache
      let format = this.formatsCache.get(locale);
      if (!format) {
        format = await this.loadFormatFromDatabase(locale);
        this.formatsCache.set(locale, format);
      }

      this.performanceMonitor.recordMetric('formats_retrieved', 1, { locale });

      timer.end(true);
      return format;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get locale formats', {
        locale,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update locale formatting rules
   * @param locale - Locale identifier
   * @param request - Format update request
   */
  async updateFormats(locale: string, request: FormatUpdateRequest): Promise<LocaleFormat> {
    const timer = this.performanceMonitor.startTimer('update_formats');
    
    try {
      this.logger.info('Updating locale formats', { locale });

      // Validate format request
      this.validateFormatRequest(request);

      // Create updated format
      const format: LocaleFormat = {
        locale,
        dateFormat: request.dateFormat,
        timeFormat: request.timeFormat,
        numberFormat: request.numberFormat,
        currencyFormat: request.currencyFormat,
        textDirection: request.textDirection,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Update cache
      this.formatsCache.set(locale, format);

      // Save to database (mock)
      await this.saveFormatToDatabase(format);

      this.performanceMonitor.recordMetric('formats_updated', 1, { locale });

      this.logger.info('Locale formats updated', { locale });

      timer.end(true);
      return format;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to update locale formats', {
        locale,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get voice mapping for locale
   * @param locale - Locale identifier
   */
  async getVoiceMapping(locale: string): Promise<LocaleVoiceMapping> {
    const timer = this.performanceMonitor.startTimer('get_voice_mapping');
    
    try {
      this.logger.debug('Getting voice mapping', { locale });

      // Check cache
      let mapping = this.voiceMappingsCache.get(locale);
      if (!mapping) {
        mapping = await this.loadVoiceMappingFromDatabase(locale);
        this.voiceMappingsCache.set(locale, mapping);
      }

      this.performanceMonitor.recordMetric('voice_mapping_retrieved', 1, { locale });

      timer.end(true);
      return mapping;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get voice mapping', {
        locale,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update user's locale preference
   * @param userID - User identifier
   * @param request - Locale update request
   */
  async updateUserLocale(userID: string, request: UserLocaleUpdateRequest): Promise<UserLocaleUpdateResponse> {
    const timer = this.performanceMonitor.startTimer('update_user_locale');
    
    try {
      this.logger.info('Updating user locale', {
        userID,
        locale: request.locale,
        timezone: request.timezone
      });

      // Validate locale
      if (!this.supportedLocales.has(request.locale)) {
        throw new Error(`Unsupported locale: ${request.locale}`);
      }

      // Update user profile (mock)
      await this.updateUserProfileLocale(userID, request.locale, request.timezone);

      // Invalidate user-specific caches
      await this.invalidateUserCaches(userID, request.locale);

      this.performanceMonitor.recordMetric('user_locale_updated', 1, {
        userID,
        locale: request.locale
      });

      this.logger.info('User locale updated successfully', {
        userID,
        locale: request.locale
      });

      timer.end(true);
      return {
        userID,
        locale: request.locale,
        timezone: request.timezone,
        message: 'Locale updated successfully'
      };

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to update user locale', {
        userID,
        locale: request.locale,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Format date according to locale
   * @param date - Date to format
   * @param locale - Locale identifier
   */
  formatDate(date: Date, locale: string): string {
    try {
      const format = this.formatsCache.get(locale);
      if (!format) {
        // Use default formatting
        return new Intl.DateTimeFormat(locale).format(date);
      }

      const options = this.parseDateFormat(format.dateFormat);
      return new Intl.DateTimeFormat(locale, options).format(date);

    } catch (error) {
      this.logger.warn('Failed to format date, using fallback', {
        locale,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return new Intl.DateTimeFormat(this.fallbackLocale).format(date);
    }
  }

  /**
   * Format number according to locale
   * @param value - Number to format
   * @param locale - Locale identifier
   */
  formatNumber(value: number, locale: string): string {
    try {
      const format = this.formatsCache.get(locale);
      if (!format) {
        return new Intl.NumberFormat(locale).format(value);
      }

      // Apply custom formatting
      const formatted = new Intl.NumberFormat(locale).format(value);
      return formatted
        .replace(/,/g, format.numberFormat.thousandSep)
        .replace(/\./g, format.numberFormat.decimalSep);

    } catch (error) {
      this.logger.warn('Failed to format number, using fallback', {
        locale,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return new Intl.NumberFormat(this.fallbackLocale).format(value);
    }
  }

  /**
   * Format currency according to locale
   * @param value - Amount to format
   * @param locale - Locale identifier
   * @param currency - Currency code
   */
  formatCurrency(value: number, locale: string, currency: string): string {
    try {
      const format = this.formatsCache.get(locale);
      if (!format) {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency
        }).format(value);
      }

      const numberPart = this.formatNumber(value, locale);
      const symbol = format.currencyFormat.symbol;

      return format.currencyFormat.symbolPos === 'before' 
        ? `${symbol}${numberPart}`
        : `${numberPart}${symbol}`;

    } catch (error) {
      this.logger.warn('Failed to format currency, using fallback', {
        locale,
        currency,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return new Intl.NumberFormat(this.fallbackLocale, {
        style: 'currency',
        currency
      }).format(value);
    }
  }

  /**
   * Get text direction for locale
   * @param locale - Locale identifier
   */
  getTextDirection(locale: string): 'LTR' | 'RTL' {
    const format = this.formatsCache.get(locale);
    return format?.textDirection || 'LTR';
  }

  /**
   * Check if locale is right-to-left
   * @param locale - Locale identifier
   */
  isRTL(locale: string): boolean {
    return this.getTextDirection(locale) === 'RTL';
  }

  /**
   * Get supported locales with metadata
   */
  async getSupportedLocales(): Promise<LocaleInfo[]> {
    const timer = this.performanceMonitor.startTimer('get_supported_locales');
    
    try {
      const locales: LocaleInfo[] = [
        {
          locale: 'en',
          name: 'English',
          nativeName: 'English',
          isRTL: false,
          isSupported: true,
          completeness: 100
        },
        {
          locale: 'zh',
          name: 'Chinese',
          nativeName: '中文',
          isRTL: false,
          isSupported: true,
          completeness: 95
        },
        {
          locale: 'ms',
          name: 'Malay',
          nativeName: 'Bahasa Melayu',
          isRTL: false,
          isSupported: true,
          completeness: 90
        },
        {
          locale: 'ta',
          name: 'Tamil',
          nativeName: 'தமிழ்',
          isRTL: false,
          isSupported: true,
          completeness: 85
        },
        {
          locale: 'ar',
          name: 'Arabic',
          nativeName: 'العربية',
          isRTL: true,
          isSupported: true,
          completeness: 80
        }
      ];

      this.performanceMonitor.recordMetric('supported_locales_retrieved', locales.length);

      timer.end(true);
      return locales;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get supported locales', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get translation statistics for a locale
   * @param locale - Locale identifier
   */
  async getTranslationStats(locale: string): Promise<TranslationStats> {
    const timer = this.performanceMonitor.startTimer('get_translation_stats');
    
    try {
      this.logger.debug('Getting translation stats', { locale });

      // Mock stats calculation
      const totalStrings = 1000;
      const translatedStrings = Math.floor(totalStrings * 0.9); // 90% translated
      const pendingTranslations = totalStrings - translatedStrings;
      const completeness = (translatedStrings / totalStrings) * 100;

      const stats: TranslationStats = {
        totalStrings,
        translatedStrings,
        pendingTranslations,
        completeness,
        lastUpdated: new Date()
      };

      this.performanceMonitor.recordMetric('translation_stats_retrieved', 1, {
        locale,
        completeness
      });

      timer.end(true);
      return stats;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get translation stats', {
        locale,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Private helper methods

  private async loadStringsFromDatabase(locale: string): Promise<Record<string, string>> {
    // Mock string loading
    const mockStrings: Record<string, Record<string, string>> = {
      'en': {
        'welcome': 'Welcome',
        'goodbye': 'Goodbye',
        'flight_info': 'Flight Information',
        'gate_change': 'Gate Change',
        'boarding_now': 'Boarding Now',
        'delayed': 'Delayed',
        'cancelled': 'Cancelled',
        'on_time': 'On Time'
      },
      'zh': {
        'welcome': '欢迎',
        'goodbye': '再见',
        'flight_info': '航班信息',
        'gate_change': '登机口变更',
        'boarding_now': '正在登机',
        'delayed': '延误',
        'cancelled': '取消',
        'on_time': '准时'
      },
      'ms': {
        'welcome': 'Selamat datang',
        'goodbye': 'Selamat tinggal',
        'flight_info': 'Maklumat Penerbangan',
        'gate_change': 'Pertukaran Pintu',
        'boarding_now': 'Sedang Menaiki',
        'delayed': 'Tertunda',
        'cancelled': 'Dibatalkan',
        'on_time': 'Tepat Masa'
      }
    };

    return mockStrings[locale] || mockStrings[this.fallbackLocale];
  }

  private async saveStringsToDatabase(locale: string, translations: Record<string, string>): Promise<void> {
    // Mock save operation
    this.logger.debug('Saving translations to database', {
      locale,
      count: Object.keys(translations).length
    });
  }

  private async loadFormatFromDatabase(locale: string): Promise<LocaleFormat> {
    // Mock format loading
    const mockFormats: Record<string, LocaleFormat> = {
      'en': {
        locale: 'en',
        dateFormat: 'MM/dd/yyyy',
        timeFormat: 'HH:mm',
        numberFormat: { decimalSep: '.', thousandSep: ',' },
        currencyFormat: { symbolPos: 'before', symbol: '$' },
        textDirection: 'LTR',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      'zh': {
        locale: 'zh',
        dateFormat: 'yyyy年MM月dd日',
        timeFormat: 'HH:mm',
        numberFormat: { decimalSep: '.', thousandSep: ',' },
        currencyFormat: { symbolPos: 'before', symbol: '¥' },
        textDirection: 'LTR',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      'ar': {
        locale: 'ar',
        dateFormat: 'dd/MM/yyyy',
        timeFormat: 'HH:mm',
        numberFormat: { decimalSep: '.', thousandSep: ',' },
        currencyFormat: { symbolPos: 'after', symbol: ' ر.س' },
        textDirection: 'RTL',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };

    return mockFormats[locale] || mockFormats[this.fallbackLocale];
  }

  private async saveFormatToDatabase(format: LocaleFormat): Promise<void> {
    // Mock save operation
    this.logger.debug('Saving format to database', { locale: format.locale });
  }

  private async loadVoiceMappingFromDatabase(locale: string): Promise<LocaleVoiceMapping> {
    // Mock voice mapping
    const mockMappings: Record<string, LocaleVoiceMapping> = {
      'en': {
        locale: 'en',
        ttsVoice: 'en-US-Standard-A',
        sttModel: 'en-US',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      'zh': {
        locale: 'zh',
        ttsVoice: 'zh-CN-Standard-A',
        sttModel: 'zh-CN',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };

    return mockMappings[locale] || mockMappings[this.fallbackLocale];
  }

  private sanitizeTranslationText(text: string): string {
    // Basic sanitization
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim();
  }

  private validateFormatRequest(request: FormatUpdateRequest): void {
    if (!request.dateFormat || !request.timeFormat) {
      throw new Error('Date and time formats are required');
    }

    if (!request.numberFormat || !request.currencyFormat) {
      throw new Error('Number and currency formats are required');
    }

    if (!['LTR', 'RTL'].includes(request.textDirection)) {
      throw new Error('Text direction must be LTR or RTL');
    }
  }

  private async updateUserProfileLocale(userID: string, locale: string, timezone?: string): Promise<void> {
    // Mock user profile update
    this.logger.debug('Updating user profile locale', {
      userID,
      locale,
      timezone
    });
  }

  private async invalidateUserCaches(userID: string, newLocale: string): Promise<void> {
    // Mock cache invalidation
    this.logger.debug('Invalidating user caches', {
      userID,
      newLocale
    });
  }

  private parseDateFormat(format: string): Intl.DateTimeFormatOptions {
    // Simple format parsing
    const options: Intl.DateTimeFormatOptions = {};
    
    if (format.includes('yyyy')) options.year = 'numeric';
    if (format.includes('MM')) options.month = '2-digit';
    if (format.includes('dd')) options.day = '2-digit';
    
    return options;
  }

  private initializeMockData(): void {
    // Pre-load some common locales
    const commonLocales = ['en', 'zh', 'ms', 'ar'];
    
    commonLocales.forEach(async (locale) => {
      try {
        const strings = await this.loadStringsFromDatabase(locale);
        this.stringsCache.set(locale, strings);
        
        const format = await this.loadFormatFromDatabase(locale);
        this.formatsCache.set(locale, format);
        
        const voiceMapping = await this.loadVoiceMappingFromDatabase(locale);
        this.voiceMappingsCache.set(locale, voiceMapping);
      } catch (error) {
        this.logger.warn('Failed to initialize locale data', {
          locale,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    this.logger.debug('Mock localization data initialized', {
      localeCount: commonLocales.length
    });
  }
} 