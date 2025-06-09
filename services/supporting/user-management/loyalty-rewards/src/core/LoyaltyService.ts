import { createLogger } from '@aerofusionxr/shared';
import { PerformanceMonitor } from '@aerofusionxr/shared';
import { SecurityService, LoyaltySecurityContext } from '../security/SecurityService';
import { PointsService } from '../points/PointsService';
import { TierService } from '../tiers/TierService';
import { RewardsService } from '../rewards/RewardsService';
import { ReferralService } from '../referrals/ReferralService';
import { TransactionService } from '../transactions/TransactionService';
import { NotificationService } from '../notifications/NotificationService';
import { CacheService } from '../utils/CacheService';
import { Pool } from 'pg';
import * as Redis from 'redis';
import axios from 'axios';
import crypto from 'crypto';

// Core loyalty interfaces
export interface UserLoyalty {
  userID: string;
  pointsBalance: number;
  tierID: string;
  tierName: string;
  lastUpdated: Date;
  joinDate: Date;
  lifetimePoints: number;
  yearPoints: number;
}

export interface LoyaltyTier {
  tierID: string;
  tierName: string;
  minPoints: number;
  maxPoints: number;
  benefitDescription: string[];
  badgeIconURL: string;
  multiplier: number;
  perks: {
    loungeAccess: boolean;
    priorityBoarding: boolean;
    freeWifi: boolean;
    expressLane: boolean;
    bonusPoints: number;
  };
}

export interface LoyaltyTransaction {
  txnID: string;
  userID: string;
  type: 'earn' | 'redeem' | 'expire' | 'bonus' | 'referral';
  points: number;
  source: string;
  timestamp: Date;
  details: {
    merchant?: string;
    amount?: number;
    rewardID?: string;
    referrerID?: string;
    campaignID?: string;
    metadata?: any;
  };
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
}

export interface Reward {
  rewardID: string;
  tierID: string;
  rewardName: { [locale: string]: string };
  description: { [locale: string]: string };
  pointsCost: number;
  quantityAvailable: number;
  quantityRedeemed: number;
  imageURL: string;
  category: string;
  tags: string[];
  validFrom: Date;
  validUntil: Date;
  restrictions?: {
    maxPerUser?: number;
    cooldownDays?: number;
    eligibleSegments?: string[];
  };
  metadata?: any;
}

export interface RewardRedemption {
  redemptionID: string;
  userID: string;
  rewardID: string;
  pointsCost: number;
  redeemedAt: Date;
  status: 'reserved' | 'claimed' | 'expired' | 'cancelled';
  expiryDate: Date;
  voucherCode?: string;
  claimedAt?: Date;
  metadata?: any;
}

export interface EarnPointsRequest {
  userID: string;
  points: number;
  source: string;
  details: {
    merchant?: string;
    amount?: number;
    transactionID?: string;
    campaignID?: string;
    metadata?: any;
  };
}

export interface RedeemPointsRequest {
  userID: string;
  rewardID: string;
  pointsCost: number;
  metadata?: any;
}

export interface LoyaltyQueryRequest {
  userID?: string;
  tierID?: string;
  type?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  includeExpired?: boolean;
}

export interface LoyaltyStats {
  totalUsers: number;
  totalPoints: number;
  totalTransactions: number;
  totalRedemptions: number;
  tierDistribution: { [tierID: string]: number };
  topRewards: Array<{
    rewardID: string;
    rewardName: string;
    redemptionCount: number;
  }>;
  recentActivity: Array<{
    date: string;
    pointsEarned: number;
    pointsRedeemed: number;
    newUsers: number;
  }>;
  avgPointsPerUser: number;
  redemptionRate: number;
}

// Core interfaces and types
export interface LoyaltyAccount {
  userID: string;
  pointsBalance: number;
  lifetimePoints: number;
  tierID: string;
  updatedAt: Date;
}

export interface Tier {
  tierID: string;
  tierName: string;
  thresholdPoints: number;
  monthlyFeeMinor: number;
  multiplier: number;
  benefits: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface Campaign {
  campaignID: string;
  name: string;
  description?: string;
  startAt: Date;
  endAt: Date;
  rules: any;
  status: 'active' | 'inactive' | 'expired';
  createdAt: Date;
  updatedAt: Date;
}

export interface UserTierHistory {
  historyID: number;
  userID: string;
  oldTierID: string;
  newTierID: string;
  changedAt: Date;
}

export interface UserProfile {
  userID: string;
  preferences: {
    categories: Record<string, number>;
    brands: Record<string, number>;
    priceRange: { min: number; max: number };
    loyaltyTier: string;
  };
  behavior: {
    avgSessionDuration: number;
    purchaseFrequency: number;
    avgOrderValue: number;
    preferredTimeSlots: string[];
    devicePreference: string;
  };
  demographics: {
    ageGroup?: string;
    locale: string;
    timezone: string;
  };
  lastUpdated: Date;
}

export interface PointsEarnedEvent {
  eventID?: string;
  userID: string;
  orderID?: string;
  amountMinor?: number;
  currency?: string;
  pointsAward?: number;
  source: string;
  category?: string;
}

export interface TransferPointsRequest {
  userID: string;
  targetProgram: string;
  points: number;
  idempotencyKey?: string;
}

export interface CreateCampaignRequest {
  campaignID: string;
  name: string;
  description?: string;
  startAt: Date;
  endAt: Date;
  rules: {
    multiplier: number;
    applicableCategories?: string[];
    daysOfWeek?: number[];
    minSpendMinor?: number;
  };
}

export interface FeedbackEvent {
  feedbackID: string;
  userID: string;
  itemID: string;
  feedbackType: 'like' | 'dislike' | 'not_interested' | 'purchased' | 'clicked';
  timestamp: Date;
  context?: string;
  metadata?: any;
}

// Custom error classes
export class LoyaltyError extends Error {
  constructor(message: string, public code: string, public statusCode: number = 500) {
    super(message);
    this.name = 'LoyaltyError';
  }
}

export class InsufficientPointsError extends LoyaltyError {
  constructor(available: number, requested: number) {
    super(`Insufficient points: available ${available}, requested ${requested}`, 'INSUFFICIENT_POINTS', 400);
  }
}

export class UserNotFoundError extends LoyaltyError {
  constructor(userID: string) {
    super(`User not found: ${userID}`, 'USER_NOT_FOUND', 404);
  }
}

export class CampaignNotFoundError extends LoyaltyError {
  constructor(campaignID: string) {
    super(`Campaign not found: ${campaignID}`, 'CAMPAIGN_NOT_FOUND', 404);
  }
}

export class InvalidCampaignRulesError extends LoyaltyError {
  constructor(reason: string) {
    super(`Invalid campaign rules: ${reason}`, 'INVALID_CAMPAIGN_RULES', 400);
  }
}

export class PartnerAPIError extends LoyaltyError {
  constructor(partner: string, reason: string) {
    super(`Partner API error (${partner}): ${reason}`, 'PARTNER_API_ERROR', 502);
  }
}

export interface LoyaltyConfig {
  database: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
  };
  redis: {
    url: string;
    cacheTTL: {
      balance: number;
      tierStatus: number;
      campaigns: number;
    };
  };
  business: {
    pointsConversionRate: number; // 1 point = $0.01
    tierThresholds: Record<string, number>;
    tierMultipliers: Record<string, number>;
    pointExpiryMonths: number;
    defaultTier: string;
  };
  partners: {
    airlines: Record<string, {
      apiUrl: string;
      apiKey: string;
      conversionRate: number;
    }>;
  };
  kafka: {
    brokers: string[];
    topics: {
      orderPaid: string;
      xrEngagement: string;
      pointsRedeemed: string;
      tierUpgraded: string;
      pointsExpired: string;
    };
  };
  features: {
    enableExpiry: boolean;
    enablePartnerTransfer: boolean;
    enableCampaigns: boolean;
    enableXRPoints: boolean;
  };
  notifications: {
    sendOnEarn: boolean;
    sendOnRedeem: boolean;
    sendOnTierChange: boolean;
    sendOnExpiryReminder: boolean;
  };
}

export class LoyaltyService {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private securityService: SecurityService;
  private pointsService: PointsService;
  private tierService: TierService;
  private rewardsService: RewardsService;
  private referralService: ReferralService;
  private transactionService: TransactionService;
  private notificationService: NotificationService;
  private cacheService: CacheService;
  private dbPool: Pool;
  private redisClient: Redis.RedisClientType;
  private config: LoyaltyConfig;

  // Configuration
  private readonly SUPPORTED_LOCALES = ['en-SG', 'zh-CN', 'ar-AE', 'ms-MY', 'ta-SG'];
  private readonly DEFAULT_LOCALE = 'en-SG';
  private readonly BALANCE_CACHE_TTL = 60; // 1 minute
  private readonly REWARDS_CACHE_TTL = 300; // 5 minutes
  private readonly TIER_CACHE_TTL = 3600; // 1 hour
  private readonly LOW_BALANCE_THRESHOLD = 100;
  private readonly MAX_POINTS_PER_TRANSACTION = 10000;
  private readonly REDEMPTION_EXPIRY_DAYS = 30;

  constructor(config: LoyaltyConfig) {
    this.config = config;
    this.logger = new Logger('LoyaltyService');
    this.performanceMonitor = new PerformanceMonitor('LoyaltyService');
    this.securityService = new SecurityService();
    this.pointsService = new PointsService();
    this.tierService = new TierService();
    this.rewardsService = new RewardsService();
    this.referralService = new ReferralService();
    this.transactionService = new TransactionService();
    this.notificationService = new NotificationService();
    this.cacheService = new CacheService();
    
  }

  /**
   * Initialize the loyalty service
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing LoyaltyService');

      // Initialize all sub-services
      await this.pointsService.initialize();
      await this.tierService.initialize();
      await this.rewardsService.initialize();
      await this.referralService.initialize();
      await this.transactionService.initialize();
      await this.notificationService.initialize();

      // Start background jobs
      await this.startPointsExpirationJob();
      await this.startTierRecalculationJob();
      await this.startRewardsSyncJob();

      this.logger.info('LoyaltyService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize LoyaltyService', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get user loyalty balance and tier information
   */
  async getBalance(
    userID: string,
    context: LoyaltySecurityContext
  ): Promise<{
    userID: string;
    pointsBalance: number;
    tierID: string;
    tierName: string;
    tierBenefits: string[];
    nextTier?: {
      tierID: string;
      tierName: string;
      minPoints: number;
    };
    progressToNextTier: number;
  }> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting loyalty balance', { userID });

      // Validate access
      await this.securityService.validateLoyaltyRequest('loyalty.read', context);

      // Check cache first
      const cacheKey = `loyalty:balance:${userID}`;
      const cachedBalance = await this.cacheService.get(cacheKey);
      if (cachedBalance) {
        return cachedBalance;
      }

      // Get user loyalty record
      const userLoyalty = await this.pointsService.getUserLoyalty(userID);
      if (!userLoyalty) {
        throw new UserNotFoundError(userID);
      }

      // Get tier information
      const currentTier = await this.tierService.getTierById(userLoyalty.tierID);
      if (!currentTier) {
        throw new TierNotFoundError(userLoyalty.tierID);
      }

      // Get next tier
      const nextTier = await this.tierService.getNextTier(userLoyalty.pointsBalance);

      // Calculate progress to next tier
      let progressToNextTier = 100;
      if (nextTier) {
        const currentTierPoints = userLoyalty.pointsBalance - currentTier.minPoints;
        const pointsToNext = nextTier.minPoints - currentTier.minPoints;
        progressToNextTier = Math.round((currentTierPoints / pointsToNext) * 100);
      }

      const result = {
        userID: userLoyalty.userID,
        pointsBalance: userLoyalty.pointsBalance,
        tierID: userLoyalty.tierID,
        tierName: currentTier.tierName,
        tierBenefits: currentTier.benefitDescription,
        nextTier: nextTier ? {
          tierID: nextTier.tierID,
          tierName: nextTier.tierName,
          minPoints: nextTier.minPoints
        } : undefined,
        progressToNextTier
      };

      // Cache the result
      await this.cacheService.set(cacheKey, result, this.BALANCE_CACHE_TTL);

      // Record metrics
      await this.performanceMonitor.recordTiming('balance_retrieval_duration', startTime, {
        userID
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to get loyalty balance', {
        userID,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('balance_retrieval_errors', 1, {
        userID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Earn points for a user
   */
  async earnPoints(
    request: EarnPointsRequest,
    context: LoyaltySecurityContext
  ): Promise<{
    transactionID: string;
    newBalance: number;
    tierID: string;
    tierChanged: boolean;
    bonusPoints?: number;
  }> {
    const startTime = Date.now();

    try {
      this.logger.info('Earning points', {
        userID: request.userID,
        points: request.points,
        source: request.source
      });

      // Validate access
      await this.securityService.validateLoyaltyRequest('loyalty.write', context);

      // Validate request
      await this.validateEarnPointsRequest(request);

      // Check for duplicate source
      const existingTransaction = await this.transactionService.getBySource(request.source);
      if (existingTransaction) {
        throw new DuplicateTransactionError(request.source);
      }

      // Get current user state
      const userLoyalty = await this.pointsService.getUserLoyalty(request.userID);
      if (!userLoyalty) {
        // Create new loyalty account
        await this.pointsService.createUserLoyalty(request.userID);
      }

      // Calculate bonus points (tier multiplier, campaigns, etc.)
      const bonusPoints = await this.calculateBonusPoints(request);
      const totalPoints = request.points + bonusPoints;

      // Process the earn transaction
      const transaction = await this.transactionService.createTransaction({
        userID: request.userID,
        type: 'earn',
        points: totalPoints,
        source: request.source,
        details: request.details,
        status: 'completed'
      });

      // Update user balance
      const updatedUser = await this.pointsService.addPoints(request.userID, totalPoints);

      // Check for tier upgrade
      const previousTier = userLoyalty?.tierID;
      const newTier = await this.tierService.calculateTier(updatedUser.pointsBalance);
      let tierChanged = false;

      if (newTier.tierID !== previousTier) {
        await this.pointsService.updateTier(request.userID, newTier.tierID);
        tierChanged = true;

        // Send tier upgrade notification
        await this.notificationService.sendTierUpgradeNotification(
          request.userID,
          newTier.tierName,
          previousTier
        );
      }

      // Check for low balance alert trigger (if user was below threshold and now above)
      if (userLoyalty && userLoyalty.pointsBalance < this.LOW_BALANCE_THRESHOLD && 
          updatedUser.pointsBalance >= this.LOW_BALANCE_THRESHOLD) {
        await this.clearLowBalanceAlert(request.userID);
      }

      // Clear cache
      await this.clearUserCache(request.userID);

      // Send earn notification
      await this.notificationService.sendPointsEarnedNotification(
        request.userID,
        totalPoints,
        updatedUser.pointsBalance,
        request.details.merchant
      );

      // Record metrics
      await this.performanceMonitor.recordTiming('earn_points_duration', startTime, {
        userID: request.userID,
        points: totalPoints
      });

      await this.performanceMonitor.recordMetric('points_earned', totalPoints, {
        source: request.source
      });

      this.logger.info('Points earned successfully', {
        userID: request.userID,
        transactionID: transaction.txnID,
        points: totalPoints,
        newBalance: updatedUser.pointsBalance,
        tierChanged,
        duration: Date.now() - startTime
      });

      return {
        transactionID: transaction.txnID,
        newBalance: updatedUser.pointsBalance,
        tierID: newTier.tierID,
        tierChanged,
        bonusPoints: bonusPoints > 0 ? bonusPoints : undefined
      };

    } catch (error) {
      this.logger.error('Failed to earn points', {
        userID: request.userID,
        points: request.points,
        source: request.source,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('earn_points_errors', 1, {
        userID: request.userID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Redeem points for a reward
   */
  async redeemPoints(
    request: RedeemPointsRequest,
    context: LoyaltySecurityContext
  ): Promise<{
    redemptionID: string;
    newBalance: number;
    reward: {
      rewardID: string;
      rewardName: string;
      expiryDate: Date;
    };
    voucherCode?: string;
  }> {
    const startTime = Date.now();

    try {
      this.logger.info('Redeeming points', {
        userID: request.userID,
        rewardID: request.rewardID,
        pointsCost: request.pointsCost
      });

      // Validate access
      await this.securityService.validateLoyaltyRequest('loyalty.write', context);

      // Get user loyalty
      const userLoyalty = await this.pointsService.getUserLoyalty(request.userID);
      if (!userLoyalty) {
        throw new UserNotFoundError(request.userID);
      }

      // Get reward details
      const reward = await this.rewardsService.getReward(request.rewardID);
      if (!reward) {
        throw new RewardNotFoundError(request.rewardID);
      }

      // Validate reward availability
      await this.validateRewardRedemption(reward, userLoyalty, request.pointsCost);

      // Start transaction
      await this.transactionService.beginTransaction();

      try {
        // Deduct points
        await this.pointsService.deductPoints(request.userID, request.pointsCost);

        // Create redemption record
        const redemption = await this.rewardsService.createRedemption({
          userID: request.userID,
          rewardID: request.rewardID,
          pointsCost: request.pointsCost,
          expiryDate: new Date(Date.now() + (this.REDEMPTION_EXPIRY_DAYS * 24 * 60 * 60 * 1000)),
          metadata: request.metadata
        });

        // Update reward quantity
        await this.rewardsService.updateQuantity(request.rewardID, -1);

        // Create transaction record
        await this.transactionService.createTransaction({
          userID: request.userID,
          type: 'redeem',
          points: -request.pointsCost,
          source: `reward_${request.rewardID}`,
          details: {
            rewardID: request.rewardID,
            redemptionID: redemption.redemptionID
          },
          status: 'completed'
        });

        await this.transactionService.commitTransaction();

        // Get updated balance
        const updatedUser = await this.pointsService.getUserLoyalty(request.userID);

        // Check for low balance alert
        if (updatedUser.pointsBalance < this.LOW_BALANCE_THRESHOLD) {
          await this.triggerLowBalanceAlert(request.userID, updatedUser.pointsBalance);
        }

        // Clear cache
        await this.clearUserCache(request.userID);
        await this.clearRewardsCache();

        // Send redemption notification
        await this.notificationService.sendRedemptionNotification(
          request.userID,
          redemption,
          reward
        );

        // Record metrics
        await this.performanceMonitor.recordTiming('redeem_points_duration', startTime, {
          userID: request.userID,
          rewardID: request.rewardID
        });

        await this.performanceMonitor.recordMetric('points_redeemed', request.pointsCost, {
          rewardID: request.rewardID
        });

        this.logger.info('Points redeemed successfully', {
          userID: request.userID,
          redemptionID: redemption.redemptionID,
          rewardID: request.rewardID,
          pointsCost: request.pointsCost,
          newBalance: updatedUser.pointsBalance,
          duration: Date.now() - startTime
        });

        return {
          redemptionID: redemption.redemptionID,
          newBalance: updatedUser.pointsBalance,
          reward: {
            rewardID: reward.rewardID,
            rewardName: reward.rewardName[this.DEFAULT_LOCALE],
            expiryDate: redemption.expiryDate
          },
          voucherCode: redemption.voucherCode
        };

      } catch (error) {
        await this.transactionService.rollbackTransaction();
        throw error;
      }

    } catch (error) {
      this.logger.error('Failed to redeem points', {
        userID: request.userID,
        rewardID: request.rewardID,
        pointsCost: request.pointsCost,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('redeem_points_errors', 1, {
        userID: request.userID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get rewards catalog for a tier
   */
  async getRewardsCatalog(
    tierID: string,
    locale: string = this.DEFAULT_LOCALE,
    context: LoyaltySecurityContext
  ): Promise<Reward[]> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting rewards catalog', { tierID, locale });

      // Validate access
      await this.securityService.validateLoyaltyRequest('loyalty.read', context);

      // Validate inputs
      if (!this.SUPPORTED_LOCALES.includes(locale)) {
        locale = this.DEFAULT_LOCALE;
      }

      // Check cache
      const cacheKey = `rewards:catalog:${tierID}:${locale}`;
      const cachedRewards = await this.cacheService.get(cacheKey);
      if (cachedRewards) {
        return cachedRewards;
      }

      // Get rewards for tier
      const rewards = await this.rewardsService.getRewardsByTier(tierID, locale);

      // Filter active and available rewards
      const availableRewards = rewards.filter(reward => 
        reward.quantityAvailable > 0 && 
        reward.validUntil > new Date()
      );

      // Cache result
      await this.cacheService.set(cacheKey, availableRewards, this.REWARDS_CACHE_TTL);

      // Record metrics
      await this.performanceMonitor.recordTiming('rewards_catalog_duration', startTime, {
        tierID,
        locale
      });

      return availableRewards;

    } catch (error) {
      this.logger.error('Failed to get rewards catalog', {
        tierID,
        locale,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('rewards_catalog_errors', 1, {
        tierID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get user transaction history
   */
  async getTransactionHistory(
    userID: string,
    limit: number = 20,
    offset: number = 0,
    context: LoyaltySecurityContext
  ): Promise<{
    transactions: LoyaltyTransaction[];
    pagination: {
      limit: number;
      offset: number;
      total: number;
    };
  }> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting transaction history', { userID, limit, offset });

      // Validate access
      await this.securityService.validateLoyaltyRequest('loyalty.read', context);

      // Validate pagination
      limit = Math.min(limit, 50);
      offset = Math.max(offset, 0);

      // Get transactions
      const result = await this.transactionService.getUserTransactions(userID, limit, offset);

      // Record metrics
      await this.performanceMonitor.recordTiming('transaction_history_duration', startTime, {
        userID
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to get transaction history', {
        userID,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('transaction_history_errors', 1, {
        userID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get all loyalty tiers
   */
  async getTiers(
    locale: string = this.DEFAULT_LOCALE,
    context: LoyaltySecurityContext
  ): Promise<LoyaltyTier[]> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting loyalty tiers', { locale });

      // Validate access
      await this.securityService.validateLoyaltyRequest('loyalty.read', context);

      // Check cache
      const cacheKey = `loyalty:tiers:${locale}`;
      const cachedTiers = await this.cacheService.get(cacheKey);
      if (cachedTiers) {
        return cachedTiers;
      }

      // Get tiers
      const tiers = await this.tierService.getAllTiers(locale);

      // Cache result
      await this.cacheService.set(cacheKey, tiers, this.TIER_CACHE_TTL);

      // Record metrics
      await this.performanceMonitor.recordTiming('tiers_retrieval_duration', startTime, {
        locale
      });

      return tiers;

    } catch (error) {
      this.logger.error('Failed to get loyalty tiers', {
        locale,
        error: error.message,
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Get loyalty statistics (admin only)
   */
  async getLoyaltyStats(
    context: LoyaltySecurityContext
  ): Promise<LoyaltyStats> {
    const startTime = Date.now();

    try {
      this.logger.info('Getting loyalty statistics');

      // Validate admin access
      await this.securityService.validateLoyaltyRequest('loyalty.admin', context);

      const stats = await Promise.all([
        this.pointsService.getUserStats(),
        this.transactionService.getTransactionStats(),
        this.rewardsService.getRewardStats(),
        this.tierService.getTierDistribution()
      ]);

      const loyaltyStats: LoyaltyStats = {
        totalUsers: stats[0].totalUsers,
        totalPoints: stats[0].totalPoints,
        totalTransactions: stats[1].totalTransactions,
        totalRedemptions: stats[2].totalRedemptions,
        tierDistribution: stats[3],
        topRewards: stats[2].topRewards,
        recentActivity: stats[1].recentActivity,
        avgPointsPerUser: stats[0].avgPointsPerUser,
        redemptionRate: stats[2].redemptionRate
      };

      // Record metrics
      await this.performanceMonitor.recordTiming('loyalty_stats_duration', startTime);

      return loyaltyStats;

    } catch (error) {
      this.logger.error('Failed to get loyalty statistics', {
        error: error.message,
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async validateEarnPointsRequest(request: EarnPointsRequest): Promise<void> {
    if (!request.userID || request.userID.length < 3) {
      throw new LoyaltyError('Invalid user ID', 'INVALID_USER_ID');
    }

    if (!request.points || request.points <= 0 || request.points > this.MAX_POINTS_PER_TRANSACTION) {
      throw new LoyaltyError(`Invalid points amount: ${request.points}`, 'INVALID_POINTS');
    }

    if (!request.source || request.source.length < 3) {
      throw new LoyaltyError('Invalid transaction source', 'INVALID_SOURCE');
    }
  }

  private async validateRewardRedemption(
    reward: Reward,
    userLoyalty: UserLoyalty,
    pointsCost: number
  ): Promise<void> {
    // Check if user has enough points
    if (userLoyalty.pointsBalance < pointsCost) {
      throw new InsufficientPointsError(
        userLoyalty.userID,
        pointsCost,
        userLoyalty.pointsBalance
      );
    }

    // Check if reward is available
    if (reward.quantityAvailable <= 0) {
      throw new RewardOutOfStockError(reward.rewardID);
    }

    // Check if reward is not expired
    if (reward.validUntil < new Date()) {
      throw new RewardExpiredError(reward.rewardID);
    }

    // Check tier eligibility
    const userTier = await this.tierService.getTierById(userLoyalty.tierID);
    if (userTier && userTier.minPoints > reward.pointsCost) {
      throw new LoyaltyError('User tier not eligible for this reward', 'TIER_NOT_ELIGIBLE');
    }

    // Check restrictions
    if (reward.restrictions) {
      if (reward.restrictions.maxPerUser) {
        const userRedemptions = await this.rewardsService.getUserRedemptionCount(
          userLoyalty.userID,
          reward.rewardID
        );
        if (userRedemptions >= reward.restrictions.maxPerUser) {
          throw new LoyaltyError('Maximum redemptions per user exceeded', 'MAX_REDEMPTIONS_EXCEEDED');
        }
      }

      if (reward.restrictions.cooldownDays) {
        const lastRedemption = await this.rewardsService.getLastUserRedemption(
          userLoyalty.userID,
          reward.rewardID
        );
        if (lastRedemption) {
          const cooldownEnd = new Date(lastRedemption.redeemedAt.getTime() + 
            (reward.restrictions.cooldownDays * 24 * 60 * 60 * 1000));
          if (cooldownEnd > new Date()) {
            throw new LoyaltyError('Reward is in cooldown period', 'REWARD_COOLDOWN');
          }
        }
      }
    }
  }

  private async calculateBonusPoints(request: EarnPointsRequest): Promise<number> {
    let bonusPoints = 0;

    // Get user's tier multiplier
    const userLoyalty = await this.pointsService.getUserLoyalty(request.userID);
    if (userLoyalty) {
      const tier = await this.tierService.getTierById(userLoyalty.tierID);
      if (tier && tier.multiplier > 1) {
        bonusPoints += Math.floor(request.points * (tier.multiplier - 1));
      }
    }

    // Check for active campaigns
    if (request.details.campaignID) {
      const campaignBonus = await this.pointsService.getCampaignBonus(
        request.details.campaignID,
        request.userID
      );
      bonusPoints += campaignBonus;
    }

    // Check for merchant multipliers
    if (request.details.merchant) {
      const merchantBonus = await this.pointsService.getMerchantBonus(
        request.details.merchant,
        request.points
      );
      bonusPoints += merchantBonus;
    }

    return bonusPoints;
  }

  private async triggerLowBalanceAlert(userID: string, balance: number): Promise<void> {
    const alertKey = `loyalty:low_alert_sent:${userID}`;
    const alreadySent = await this.cacheService.get(alertKey);
    
    if (!alreadySent) {
      await this.notificationService.sendLowBalanceNotification(userID, balance);
      await this.cacheService.set(alertKey, 'true', 86400); // 24 hour TTL
    }
  }

  private async clearLowBalanceAlert(userID: string): Promise<void> {
    const alertKey = `loyalty:low_alert_sent:${userID}`;
    await this.cacheService.delete(alertKey);
  }

  private async clearUserCache(userID: string): Promise<void> {
    const patterns = [
      `loyalty:balance:${userID}`,
      `loyalty:transactions:${userID}:*`
    ];
    await Promise.all(patterns.map(pattern => this.cacheService.deletePattern(pattern)));
  }

  private async clearRewardsCache(): Promise<void> {
    await this.cacheService.deletePattern('rewards:catalog:*');
  }

  private async startPointsExpirationJob(): Promise<void> {
    // Implementation for points expiration background job
    this.logger.info('Started points expiration job');
  }

  private async startTierRecalculationJob(): Promise<void> {
    // Implementation for tier recalculation background job
    this.logger.info('Started tier recalculation job');
  }

  private async startRewardsSyncJob(): Promise<void> {
    // Implementation for rewards catalog sync job
    this.logger.info('Started rewards sync job');
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    dependencies: { [key: string]: boolean };
    metrics: any;
  }> {
    const [pointsHealth, tiersHealth, rewardsHealth, transactionsHealth] = await Promise.all([
      this.pointsService.getHealth(),
      this.tierService.getHealth(),
      this.rewardsService.getHealth(),
      this.transactionService.getHealth()
    ]);

    const healthyServices = [
      pointsHealth.available,
      tiersHealth.available,
      rewardsHealth.available,
      transactionsHealth.available
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
        points: pointsHealth.available,
        tiers: tiersHealth.available,
        rewards: rewardsHealth.available,
        transactions: transactionsHealth.available
      },
      metrics: {
        avgEarnTime: this.performanceMonitor.getMetricStats('earn_points_duration')?.avg || 0,
        avgRedeemTime: this.performanceMonitor.getMetricStats('redeem_points_duration')?.avg || 0,
        totalPointsEarned: this.performanceMonitor.getMetricStats('points_earned')?.sum || 0,
        totalPointsRedeemed: this.performanceMonitor.getMetricStats('points_redeemed')?.sum || 0
      }
    };
  }
} 
