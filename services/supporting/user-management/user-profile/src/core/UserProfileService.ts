import { AppError, ErrorCode } from '../../../ai-concierge/src/shared/errors/index';
import { createLogger } from '@aerofusionxr/shared';
import { PerformanceMonitor } from '@aerofusionxr/shared';
import { SecurityService } from '../security/SecurityService';
import { ARVRBridgeService } from '../../../ar-vr-bridge/src/core/ARVRBridgeService';

// User Profile interfaces
export interface UserProfile {
  userID: string;
  email: string;
  authProvider: 'email' | 'google' | 'apple';
  displayName?: string;
  avatarURL?: string;
  preferredLanguage: string;
  preferredCurrency: string;
  preferredTerminal?: string;
  loyaltyMember: boolean;
  loyaltyTier?: string;
  loyaltyPoints: number;
  accessibility: AccessibilitySettings;
  savedPaymentMethods: PaymentMethod[];
  notificationPreferences: NotificationPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccessibilitySettings {
  highContrast: boolean;
  speechRate: number;
  fontSize: 'small' | 'medium' | 'large';
}

export interface PaymentMethod {
  paymentMethodID: string;
  last4: string;
  type: string;
  expiry: string;
}

export interface NotificationPreferences {
  emailOffers: boolean;
  pushPromotions: boolean;
  smsAlerts: boolean;
}

export interface UserPreferences {
  userID: string;
  favoriteCategories: string[];
  travelFrequency: 'occasional' | 'frequent' | 'business';
  averageSpend: number;
  interests: string[];
  updatedAt: Date;
}

export interface SignupRequest {
  email: string;
  password: string;
  displayName?: string;
}

export interface SignupResponse {
  userID: string;
  message: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  userID: string;
  displayName?: string;
}

export interface ProfileUpdateRequest {
  displayName?: string;
  preferredLanguage?: string;
  preferredCurrency?: string;
  preferredTerminal?: string;
  accessibility?: Partial<AccessibilitySettings>;
  notificationPreferences?: Partial<NotificationPreferences>;
}

export interface LoyaltyLinkRequest {
  loyaltyCardNumber: string;
}

export interface LoyaltyLinkResponse {
  message: string;
  loyaltyTier: string;
  pointsBalance: number;
}

export interface LoyaltyUpgradeRequest {
  pointsToRedeem: number;
}

export interface LoyaltyUpgradeResponse {
  newPointsBalance: number;
  newTier: string;
}

export interface PaymentMethodRequest {
  paymentMethodToken: string;
}

export interface PaymentMethodResponse {
  paymentMethodID: string;
  last4: string;
  brand: string;
  expiry: string;
}

export interface PreferencesRequest {
  favoriteCategories?: string[];
  travelFrequency?: 'occasional' | 'frequent' | 'business';
  averageSpend?: number;
  interests?: string[];
}

export interface RecommendationRequest {
  limit?: number;
  category?: string;
}

export interface RecommendationResponse {
  recommendations: ProductRecommendation[];
}

export interface ProductRecommendation {
  sku: string;
  name: string;
  thumbnailURL: string;
  price: number;
  relevanceScore: number;
}

export interface ProfileEvent {
  eventID: string;
  eventType: 'profileUpdated' | 'preferencesUpdated' | 'notificationPrefUpdated';
  userID: string;
  updatedFields?: string[];
  timestamp: Date;
  metadata?: any;
}

// Profile-specific error types
export class UserNotFoundError extends AppError {
  readonly statusCode = 404;
  readonly errorCode = ErrorCode.BUSINESS_RULE_VIOLATION;
  readonly isOperational = true;

  constructor(message: string, context: any) {
    super(message, context);
  }
}

export class EmailAlreadyExistsError extends AppError {
  readonly statusCode = 409;
  readonly errorCode = ErrorCode.BUSINESS_RULE_VIOLATION;
  readonly isOperational = true;

  constructor(message: string, context: any) {
    super(message, context);
  }
}

export class InvalidCredentialsError extends AppError {
  readonly statusCode = 401;
  readonly errorCode = ErrorCode.BUSINESS_RULE_VIOLATION;
  readonly isOperational = true;

  constructor(message: string, context: any) {
    super(message, context);
  }
}

export class UnsupportedLanguageError extends AppError {
  readonly statusCode = 400;
  readonly errorCode = ErrorCode.BUSINESS_RULE_VIOLATION;
  readonly isOperational = true;

  constructor(message: string, context: any) {
    super(message, context);
  }
}

export class LoyaltyServiceError extends AppError {
  readonly statusCode = 503;
  readonly errorCode = ErrorCode.SERVICE_UNAVAILABLE;
  readonly isOperational = true;

  constructor(message: string, context: any) {
    super(message, context);
  }
}

export class PaymentServiceError extends AppError {
  readonly statusCode = 503;
  readonly errorCode = ErrorCode.SERVICE_UNAVAILABLE;
  readonly isOperational = true;

  constructor(message: string, context: any) {
    super(message, context);
  }
}

export class ProfileServiceError extends AppError {
  readonly statusCode = 503;
  readonly errorCode = ErrorCode.SERVICE_UNAVAILABLE;
  readonly isOperational = true;

  constructor(message: string, context: any) {
    super(message, context);
  }
}

/**
 * User Profile & Personalization Engine Service
 * Provides comprehensive user profile management, personalization, and recommendations
 */
export class UserProfileService {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private securityService: SecurityService;
  private bridgeService: ARVRBridgeService;
  private profilesCache: Map<string, UserProfile>;
  private preferencesCache: Map<string, UserPreferences>;
  private recommendationsCache: Map<string, ProductRecommendation[]>;
  private supportedLanguages: Set<string>;
  private supportedCurrencies: Set<string>;

  constructor() {
    this.logger = new Logger('UserProfileService');
    this.performanceMonitor = new PerformanceMonitor();
    this.securityService = new SecurityService();
    this.bridgeService = new ARVRBridgeService();
    this.profilesCache = new Map();
    this.preferencesCache = new Map();
    this.recommendationsCache = new Map();
    this.supportedLanguages = new Set(['en-US', 'fr-FR', 'ar-AE', 'zh-CN', 'es-ES', 'de-DE']);
    this.supportedCurrencies = new Set(['USD', 'EUR', 'AED', 'GBP', 'JPY']);

    // Initialize mock data
    this.initializeMockData();
  }

  /**
   * Create new user account
   */
  async signupUser(request: SignupRequest): Promise<SignupResponse> {
    const startTime = Date.now();

    try {
      this.logger.debug('Creating new user account', {
        email: request.email,
        displayName: request.displayName
      });

      // Validate email format
      if (!this.isValidEmail(request.email)) {
        throw new ProfileServiceError('Invalid email format', { email: request.email });
      }

      // Check if email already exists
      const existingProfile = await this.findProfileByEmail(request.email);
      if (existingProfile) {
        throw new EmailAlreadyExistsError('Email already registered', { email: request.email });
      }

      // Validate password strength
      if (!this.isValidPassword(request.password)) {
        throw new ProfileServiceError('Password does not meet requirements', {});
      }

      // Create user profile
      const userID = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const hashedPassword = await this.hashPassword(request.password);

      const profile: UserProfile = {
        userID,
        email: request.email,
        authProvider: 'email',
        displayName: request.displayName,
        preferredLanguage: 'en-US',
        preferredCurrency: 'USD',
        loyaltyMember: false,
        loyaltyPoints: 0,
        accessibility: {
          highContrast: false,
          speechRate: 1.0,
          fontSize: 'medium'
        },
        savedPaymentMethods: [],
        notificationPreferences: {
          emailOffers: true,
          pushPromotions: true,
          smsAlerts: false
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store profile (in real implementation, would encrypt sensitive fields)
      this.profilesCache.set(userID, profile);

      // Store authentication (mock implementation)
      await this.storeAuthCredentials(userID, request.email, hashedPassword);

      // Send verification email
      await this.sendVerificationEmail(request.email, userID);

      // Log profile creation event
      await this.publishProfileEvent({
        eventID: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        eventType: 'profileUpdated',
        userID,
        updatedFields: ['created'],
        timestamp: new Date()
      });

      const signupTime = Date.now() - startTime;
      await this.performanceMonitor.recordMetric('profile_signup_time', signupTime);

      this.logger.info('User account created successfully', {
        userID,
        email: request.email,
        signupTime
      });

      return {
        userID,
        message: 'Verification email sent.'
      };

    } catch (error) {
      this.logger.error('Failed to create user account', {
        email: request.email,
        error: error.message
      });

      if (error instanceof EmailAlreadyExistsError || error instanceof ProfileServiceError) {
        throw error;
      }

      throw new ProfileServiceError('Account creation failed', {
        email: request.email,
        originalError: error.message
      });
    }
  }

  /**
   * Authenticate user login
   */
  async loginUser(request: LoginRequest): Promise<LoginResponse> {
    const startTime = Date.now();

    try {
      this.logger.debug('Authenticating user login', {
        email: request.email
      });

      // Find user profile
      const profile = await this.findProfileByEmail(request.email);
      if (!profile) {
        throw new InvalidCredentialsError('Invalid credentials', {});
      }

      // Verify password
      const passwordValid = await this.verifyPassword(request.password, profile.userID);
      if (!passwordValid) {
        throw new InvalidCredentialsError('Invalid credentials', {});
      }

      // Generate JWT token
      const token = await this.generateJWTToken(profile);

      // Update last login
      profile.updatedAt = new Date();
      this.profilesCache.set(profile.userID, profile);

      const loginTime = Date.now() - startTime;
      await this.performanceMonitor.recordMetric('profile_login_time', loginTime);

      this.logger.info('User login successful', {
        userID: profile.userID,
        email: request.email,
        loginTime
      });

      return {
        token,
        userID: profile.userID,
        displayName: profile.displayName
      };

    } catch (error) {
      this.logger.error('Failed to authenticate user', {
        email: request.email,
        error: error.message
      });

      if (error instanceof InvalidCredentialsError) {
        throw error;
      }

      throw new ProfileServiceError('Login failed', {
        email: request.email,
        originalError: error.message
      });
    }
  }

  /**
   * Get user profile
   */
  async getProfile(userID: string): Promise<UserProfile> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting user profile', { userID });

      // Check cache first
      let profile = this.profilesCache.get(userID);
      
      if (!profile) {
        // In real implementation, would load from database
        throw new UserNotFoundError('Profile not found', { userID });
      }

      // Refresh loyalty data if user is a member
      if (profile.loyaltyMember) {
        try {
          const loyaltyData = await this.getLoyaltyData(userID);
          profile.loyaltyTier = loyaltyData.tier;
          profile.loyaltyPoints = loyaltyData.points;
          profile.updatedAt = new Date();
          this.profilesCache.set(userID, profile);
        } catch (error) {
          this.logger.warn('Failed to refresh loyalty data', {
            userID,
            error: error.message
          });
        }
      }

      const profileTime = Date.now() - startTime;
      await this.performanceMonitor.recordMetric('profile_get_time', profileTime);

      this.logger.info('Profile retrieved successfully', {
        userID,
        profileTime
      });

      return { ...profile }; // Return copy to prevent mutations

    } catch (error) {
      this.logger.error('Failed to get profile', {
        userID,
        error: error.message
      });

      if (error instanceof UserNotFoundError) {
        throw error;
      }

      throw new ProfileServiceError('Failed to get profile', {
        userID,
        originalError: error.message
      });
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userID: string, request: ProfileUpdateRequest): Promise<UserProfile> {
    const startTime = Date.now();

    try {
      this.logger.debug('Updating user profile', {
        userID,
        updates: Object.keys(request)
      });

      const profile = this.profilesCache.get(userID);
      if (!profile) {
        throw new UserNotFoundError('Profile not found', { userID });
      }

      // Validate updates
      if (request.preferredLanguage && !this.supportedLanguages.has(request.preferredLanguage)) {
        throw new UnsupportedLanguageError('Unsupported language', { 
          language: request.preferredLanguage 
        });
      }

      if (request.preferredCurrency && !this.supportedCurrencies.has(request.preferredCurrency)) {
        throw new ProfileServiceError('Unsupported currency', { 
          currency: request.preferredCurrency 
        });
      }

      if (request.accessibility?.speechRate && 
          (request.accessibility.speechRate < 0.8 || request.accessibility.speechRate > 1.5)) {
        throw new ProfileServiceError('Speech rate out of range', { 
          speechRate: request.accessibility.speechRate 
        });
      }

      // Apply updates
      const updatedFields: string[] = [];
      
      if (request.displayName !== undefined) {
        profile.displayName = request.displayName;
        updatedFields.push('displayName');
      }

      if (request.preferredLanguage) {
        profile.preferredLanguage = request.preferredLanguage;
        updatedFields.push('preferredLanguage');
      }

      if (request.preferredCurrency) {
        profile.preferredCurrency = request.preferredCurrency;
        updatedFields.push('preferredCurrency');
      }

      if (request.preferredTerminal) {
        profile.preferredTerminal = request.preferredTerminal;
        updatedFields.push('preferredTerminal');
      }

      if (request.accessibility) {
        profile.accessibility = {
          ...profile.accessibility,
          ...request.accessibility
        };
        updatedFields.push('accessibility');
      }

      if (request.notificationPreferences) {
        profile.notificationPreferences = {
          ...profile.notificationPreferences,
          ...request.notificationPreferences
        };
        updatedFields.push('notificationPreferences');
      }

      profile.updatedAt = new Date();
      this.profilesCache.set(userID, profile);

      // Publish profile updated event
      await this.publishProfileEvent({
        eventID: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        eventType: 'profileUpdated',
        userID,
        updatedFields,
        timestamp: new Date()
      });

      const updateTime = Date.now() - startTime;
      await this.performanceMonitor.recordMetric('profile_update_time', updateTime);

      this.logger.info('Profile updated successfully', {
        userID,
        updatedFields,
        updateTime
      });

      return { ...profile };

    } catch (error) {
      this.logger.error('Failed to update profile', {
        userID,
        error: error.message
      });

      if (error instanceof UserNotFoundError || 
          error instanceof UnsupportedLanguageError || 
          error instanceof ProfileServiceError) {
        throw error;
      }

      throw new ProfileServiceError('Profile update failed', {
        userID,
        originalError: error.message
      });
    }
  }

  /**
   * Link loyalty account
   */
  async linkLoyalty(userID: string, request: LoyaltyLinkRequest): Promise<LoyaltyLinkResponse> {
    try {
      this.logger.debug('Linking loyalty account', {
        userID,
        loyaltyCardNumber: request.loyaltyCardNumber
      });

      const profile = this.profilesCache.get(userID);
      if (!profile) {
        throw new UserNotFoundError('Profile not found', { userID });
      }

      // Verify loyalty card with Loyalty Service
      const loyaltyData = await this.verifyLoyaltyCard(request.loyaltyCardNumber, userID);

      // Update profile
      profile.loyaltyMember = true;
      profile.loyaltyTier = loyaltyData.tier;
      profile.loyaltyPoints = loyaltyData.points;
      profile.updatedAt = new Date();
      this.profilesCache.set(userID, profile);

      // Publish profile updated event
      await this.publishProfileEvent({
        eventID: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        eventType: 'profileUpdated',
        userID,
        updatedFields: ['loyaltyMember', 'loyaltyTier', 'loyaltyPoints'],
        timestamp: new Date()
      });

      this.logger.info('Loyalty account linked successfully', {
        userID,
        loyaltyTier: loyaltyData.tier,
        pointsBalance: loyaltyData.points
      });

      return {
        message: 'Loyalty account linked successfully.',
        loyaltyTier: loyaltyData.tier,
        pointsBalance: loyaltyData.points
      };

    } catch (error) {
      this.logger.error('Failed to link loyalty account', {
        userID,
        loyaltyCardNumber: request.loyaltyCardNumber,
        error: error.message
      });

      if (error instanceof UserNotFoundError) {
        throw error;
      }

      throw new LoyaltyServiceError('Loyalty link failed', {
        userID,
        originalError: error.message
      });
    }
  }

  /**
   * Upgrade loyalty tier
   */
  async upgradeLoyalty(userID: string, request: LoyaltyUpgradeRequest): Promise<LoyaltyUpgradeResponse> {
    try {
      this.logger.debug('Upgrading loyalty tier', {
        userID,
        pointsToRedeem: request.pointsToRedeem
      });

      const profile = this.profilesCache.get(userID);
      if (!profile) {
        throw new UserNotFoundError('Profile not found', { userID });
      }

      if (!profile.loyaltyMember) {
        throw new LoyaltyServiceError('User is not a loyalty member', { userID });
      }

      if (profile.loyaltyPoints < request.pointsToRedeem) {
        throw new LoyaltyServiceError('Insufficient points', {
          available: profile.loyaltyPoints,
          requested: request.pointsToRedeem
        });
      }

      // Process redemption with Loyalty Service
      const redemptionResult = await this.redeemLoyaltyPoints(userID, request.pointsToRedeem);

      // Update profile
      profile.loyaltyPoints = redemptionResult.newPointsBalance;
      profile.loyaltyTier = redemptionResult.newTier;
      profile.updatedAt = new Date();
      this.profilesCache.set(userID, profile);

      // Publish profile updated event
      await this.publishProfileEvent({
        eventID: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        eventType: 'profileUpdated',
        userID,
        updatedFields: ['loyaltyPoints', 'loyaltyTier'],
        timestamp: new Date(),
        metadata: { pointsRedeemed: request.pointsToRedeem }
      });

      this.logger.info('Loyalty tier upgraded successfully', {
        userID,
        pointsRedeemed: request.pointsToRedeem,
        newTier: redemptionResult.newTier,
        newBalance: redemptionResult.newPointsBalance
      });

      return {
        newPointsBalance: redemptionResult.newPointsBalance,
        newTier: redemptionResult.newTier
      };

    } catch (error) {
      this.logger.error('Failed to upgrade loyalty tier', {
        userID,
        pointsToRedeem: request.pointsToRedeem,
        error: error.message
      });

      if (error instanceof UserNotFoundError || error instanceof LoyaltyServiceError) {
        throw error;
      }

      throw new LoyaltyServiceError('Loyalty upgrade failed', {
        userID,
        originalError: error.message
      });
    }
  }

  /**
   * Add payment method
   */
  async addPaymentMethod(userID: string, request: PaymentMethodRequest): Promise<PaymentMethodResponse> {
    try {
      this.logger.debug('Adding payment method', {
        userID,
        paymentMethodToken: request.paymentMethodToken
      });

      const profile = this.profilesCache.get(userID);
      if (!profile) {
        throw new UserNotFoundError('Profile not found', { userID });
      }

      // Create payment method with Payment Service
      const paymentMethod = await this.createPaymentMethod(userID, request.paymentMethodToken);

      // Add to profile
      profile.savedPaymentMethods.push({
        paymentMethodID: paymentMethod.paymentMethodID,
        last4: paymentMethod.last4,
        type: paymentMethod.brand,
        expiry: paymentMethod.expiry
      });
      profile.updatedAt = new Date();
      this.profilesCache.set(userID, profile);

      // Publish profile updated event
      await this.publishProfileEvent({
        eventID: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        eventType: 'profileUpdated',
        userID,
        updatedFields: ['savedPaymentMethods'],
        timestamp: new Date()
      });

      this.logger.info('Payment method added successfully', {
        userID,
        paymentMethodID: paymentMethod.paymentMethodID,
        brand: paymentMethod.brand
      });

      return {
        paymentMethodID: paymentMethod.paymentMethodID,
        last4: paymentMethod.last4,
        brand: paymentMethod.brand,
        expiry: paymentMethod.expiry
      };

    } catch (error) {
      this.logger.error('Failed to add payment method', {
        userID,
        error: error.message
      });

      if (error instanceof UserNotFoundError) {
        throw error;
      }

      throw new PaymentServiceError('Payment method addition failed', {
        userID,
        originalError: error.message
      });
    }
  }

  /**
   * Remove payment method
   */
  async removePaymentMethod(userID: string, paymentMethodID: string): Promise<{ message: string }> {
    try {
      this.logger.debug('Removing payment method', {
        userID,
        paymentMethodID
      });

      const profile = this.profilesCache.get(userID);
      if (!profile) {
        throw new UserNotFoundError('Profile not found', { userID });
      }

      // Find payment method in profile
      const methodIndex = profile.savedPaymentMethods.findIndex(
        method => method.paymentMethodID === paymentMethodID
      );

      if (methodIndex === -1) {
        throw new PaymentServiceError('Payment method not found', { paymentMethodID });
      }

      // Remove from Payment Service
      await this.deletePaymentMethod(paymentMethodID);

      // Remove from profile
      profile.savedPaymentMethods.splice(methodIndex, 1);
      profile.updatedAt = new Date();
      this.profilesCache.set(userID, profile);

      // Publish profile updated event
      await this.publishProfileEvent({
        eventID: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        eventType: 'profileUpdated',
        userID,
        updatedFields: ['savedPaymentMethods'],
        timestamp: new Date()
      });

      this.logger.info('Payment method removed successfully', {
        userID,
        paymentMethodID
      });

      return { message: 'Payment method removed.' };

    } catch (error) {
      this.logger.error('Failed to remove payment method', {
        userID,
        paymentMethodID,
        error: error.message
      });

      if (error instanceof UserNotFoundError || error instanceof PaymentServiceError) {
        throw error;
      }

      throw new PaymentServiceError('Payment method removal failed', {
        userID,
        paymentMethodID,
        originalError: error.message
      });
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userID: string, request: PreferencesRequest): Promise<UserPreferences> {
    try {
      this.logger.debug('Updating user preferences', {
        userID,
        preferences: request
      });

      let preferences = this.preferencesCache.get(userID);
      
      if (!preferences) {
        preferences = {
          userID,
          favoriteCategories: [],
          travelFrequency: 'occasional',
          averageSpend: 0,
          interests: [],
          updatedAt: new Date()
        };
      }

      // Update preferences
      if (request.favoriteCategories) {
        preferences.favoriteCategories = request.favoriteCategories;
      }

      if (request.travelFrequency) {
        preferences.travelFrequency = request.travelFrequency;
      }

      if (request.averageSpend !== undefined) {
        preferences.averageSpend = request.averageSpend;
      }

      if (request.interests) {
        preferences.interests = request.interests;
      }

      preferences.updatedAt = new Date();
      this.preferencesCache.set(userID, preferences);

      // Publish preferences updated event
      await this.publishProfileEvent({
        eventID: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        eventType: 'preferencesUpdated',
        userID,
        timestamp: new Date(),
        metadata: request
      });

      this.logger.info('User preferences updated successfully', {
        userID,
        preferences: request
      });

      return { ...preferences };

    } catch (error) {
      this.logger.error('Failed to update preferences', {
        userID,
        error: error.message
      });

      throw new ProfileServiceError('Preferences update failed', {
        userID,
        originalError: error.message
      });
    }
  }

  /**
   * Get personalized recommendations
   */
  async getRecommendations(userID: string, request: RecommendationRequest): Promise<RecommendationResponse> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting personalized recommendations', {
        userID,
        limit: request.limit,
        category: request.category
      });

      const cacheKey = `${userID}:${request.category || 'all'}:${request.limit || 5}`;
      
      // Check cache first
      let recommendations = this.recommendationsCache.get(cacheKey);
      
      if (!recommendations) {
        // Get user profile and preferences
        const profile = this.profilesCache.get(userID);
        const preferences = this.preferencesCache.get(userID);

        if (!profile) {
          throw new UserNotFoundError('Profile not found', { userID });
        }

        // Call Recommendation Engine
        recommendations = await this.fetchRecommendations(userID, profile, preferences, request);
        
        // Cache for 10 minutes
        this.recommendationsCache.set(cacheKey, recommendations);
        setTimeout(() => this.recommendationsCache.delete(cacheKey), 10 * 60 * 1000);
      }

      const recommendationTime = Date.now() - startTime;
      await this.performanceMonitor.recordMetric('recommendations_get_time', recommendationTime);

      this.logger.info('Recommendations retrieved successfully', {
        userID,
        recommendationCount: recommendations.length,
        recommendationTime
      });

      return { recommendations };

    } catch (error) {
      this.logger.error('Failed to get recommendations', {
        userID,
        error: error.message
      });

      if (error instanceof UserNotFoundError) {
        throw error;
      }

      // Return empty recommendations on service failure
      this.logger.warn('Returning empty recommendations due to service failure', {
        userID,
        error: error.message
      });

      return { recommendations: [] };
    }
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(userID: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    try {
      this.logger.debug('Updating notification preferences', {
        userID,
        preferences
      });

      const profile = this.profilesCache.get(userID);
      if (!profile) {
        throw new UserNotFoundError('Profile not found', { userID });
      }

      // Update preferences
      profile.notificationPreferences = {
        ...profile.notificationPreferences,
        ...preferences
      };
      profile.updatedAt = new Date();
      this.profilesCache.set(userID, profile);

      // Publish notification preferences updated event
      await this.publishProfileEvent({
        eventID: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        eventType: 'notificationPrefUpdated',
        userID,
        timestamp: new Date(),
        metadata: preferences
      });

      this.logger.info('Notification preferences updated successfully', {
        userID,
        preferences
      });

      return { ...profile.notificationPreferences };

    } catch (error) {
      this.logger.error('Failed to update notification preferences', {
        userID,
        error: error.message
      });

      if (error instanceof UserNotFoundError) {
        throw error;
      }

      throw new ProfileServiceError('Notification preferences update failed', {
        userID,
        originalError: error.message
      });
    }
  }

  // Private helper methods
  private async findProfileByEmail(email: string): Promise<UserProfile | null> {
    // In real implementation, would query database
    for (const profile of this.profilesCache.values()) {
      if (profile.email === email) {
        return profile;
      }
    }
    return null;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPassword(password: string): boolean {
    // At least 8 characters, with uppercase, lowercase, and number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }

  private async hashPassword(password: string): Promise<string> {
    // Mock implementation - in real system would use bcrypt
    return `hashed_${password}_${Date.now()}`;
  }

  private async verifyPassword(password: string, userID: string): Promise<boolean> {
    // Mock implementation - in real system would verify with stored hash
    return true;
  }

  private async storeAuthCredentials(userID: string, email: string, hashedPassword: string): Promise<void> {
    // Mock implementation - in real system would store in auth database
    this.logger.debug('Auth credentials stored', { userID, email });
  }

  private async sendVerificationEmail(email: string, userID: string): Promise<void> {
    // Mock implementation - in real system would send actual email
    this.logger.debug('Verification email sent', { email, userID });
  }

  private async generateJWTToken(profile: UserProfile): Promise<string> {
    // Mock JWT generation - in real implementation would use proper JWT library
    const payload = {
      userID: profile.userID,
      email: profile.email,
      preferredLanguage: profile.preferredLanguage,
      loyaltyMember: profile.loyaltyMember,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
    };

    return `jwt_${btoa(JSON.stringify(payload))}_signature`;
  }

  private async getLoyaltyData(userID: string): Promise<{ tier: string; points: number }> {
    // Mock Loyalty Service call
    const mockTiers = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
    const tier = mockTiers[Math.floor(Math.random() * mockTiers.length)];
    const points = Math.floor(Math.random() * 50000);

    return { tier, points };
  }

  private async verifyLoyaltyCard(cardNumber: string, userID: string): Promise<{ tier: string; points: number }> {
    // Mock Loyalty Service verification
    if (cardNumber.startsWith('INVALID')) {
      throw new LoyaltyServiceError('Invalid loyalty card number', { cardNumber });
    }

    return {
      tier: 'Silver',
      points: 10250
    };
  }

  private async redeemLoyaltyPoints(userID: string, points: number): Promise<{ newPointsBalance: number; newTier: string }> {
    // Mock Loyalty Service redemption
    const currentProfile = this.profilesCache.get(userID)!;
    const newBalance = currentProfile.loyaltyPoints - points;
    
    // Mock tier calculation
    let newTier = currentProfile.loyaltyTier || 'Bronze';
    if (newBalance >= 15000) newTier = 'Gold';
    else if (newBalance >= 25000) newTier = 'Platinum';
    else if (newBalance >= 50000) newTier = 'Diamond';

    return {
      newPointsBalance: newBalance,
      newTier
    };
  }

  private async createPaymentMethod(userID: string, token: string): Promise<{ paymentMethodID: string; last4: string; brand: string; expiry: string }> {
    // Mock Payment Service call
    const brands = ['Visa', 'Mastercard', 'American Express'];
    const brand = brands[Math.floor(Math.random() * brands.length)];
    const last4 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const expiry = `${Math.floor(Math.random() * 12) + 1}/${new Date().getFullYear() + Math.floor(Math.random() * 5) + 1}`;

    return {
      paymentMethodID: `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      last4,
      brand,
      expiry
    };
  }

  private async deletePaymentMethod(paymentMethodID: string): Promise<void> {
    // Mock Payment Service call
    this.logger.debug('Payment method deleted from service', { paymentMethodID });
  }

  private async fetchRecommendations(
    userID: string, 
    profile: UserProfile, 
    preferences: UserPreferences | undefined,
    request: RecommendationRequest
  ): Promise<ProductRecommendation[]> {
    // Mock Recommendation Engine call
    const mockProducts = [
      { sku: 'frag_lancome_001', name: 'La Vie Est Belle', thumbnailURL: 'https://cdn.example.com/frag_lancome_001.jpg', price: 85.00 },
      { sku: 'elect_apple_001', name: 'iPhone 15 Pro', thumbnailURL: 'https://cdn.example.com/elect_apple_001.jpg', price: 999.00 },
      { sku: 'fash_gucci_001', name: 'Gucci Handbag', thumbnailURL: 'https://cdn.example.com/fash_gucci_001.jpg', price: 1200.00 },
      { sku: 'food_godiva_001', name: 'Godiva Chocolate Box', thumbnailURL: 'https://cdn.example.com/food_godiva_001.jpg', price: 45.00 },
      { sku: 'accs_rolex_001', name: 'Rolex Submariner', thumbnailURL: 'https://cdn.example.com/accs_rolex_001.jpg', price: 8500.00 }
    ];

    const limit = request.limit || 5;
    const selectedProducts = mockProducts
      .sort(() => Math.random() - 0.5) // Shuffle
      .slice(0, limit)
      .map(product => ({
        ...product,
        relevanceScore: Math.random() * 0.4 + 0.6 // 0.6-1.0
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    return selectedProducts;
  }

  private async publishProfileEvent(event: ProfileEvent): Promise<void> {
    // In real implementation, would publish to Kafka
    this.logger.debug('Profile event published', {
      eventID: event.eventID,
      eventType: event.eventType,
      userID: event.userID,
      updatedFields: event.updatedFields
    });
  }

  private initializeMockData(): void {
    // Initialize mock users for demo
    const mockUsers = [
      {
        userID: 'user_demo_001',
        email: 'john.doe@example.com',
        authProvider: 'email' as const,
        displayName: 'John Doe',
        preferredLanguage: 'en-US',
        preferredCurrency: 'USD',
        preferredTerminal: 'Terminal 1',
        loyaltyMember: true,
        loyaltyTier: 'Silver',
        loyaltyPoints: 10250,
        accessibility: {
          highContrast: false,
          speechRate: 1.0,
          fontSize: 'medium' as const
        },
        savedPaymentMethods: [
          {
            paymentMethodID: 'pm_demo_001',
            last4: '4242',
            type: 'Visa',
            expiry: '12/25'
          }
        ],
        notificationPreferences: {
          emailOffers: true,
          pushPromotions: false,
          smsAlerts: false
        },
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date()
      }
    ];

    for (const user of mockUsers) {
      this.profilesCache.set(user.userID, user);
    }

    // Initialize mock preferences
    const mockPreferences = [
      {
        userID: 'user_demo_001',
        favoriteCategories: ['fragrances', 'electronics'],
        travelFrequency: 'frequent' as const,
        averageSpend: 200.00,
        interests: ['luxury', 'sustainability'],
        updatedAt: new Date()
      }
    ];

    for (const pref of mockPreferences) {
      this.preferencesCache.set(pref.userID, pref);
    }

    this.logger.info('Mock profile data initialized', {
      userCount: mockUsers.length,
      preferencesCount: mockPreferences.length
    });
  }
} 
