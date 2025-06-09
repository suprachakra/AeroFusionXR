import { createLogger } from '@aerofusionxr/shared';
import { PerformanceMonitor } from '@aerofusionxr/shared';
import { SecurityService, RecommendationSecurityContext } from '../security/SecurityService';
import { MLInferenceService } from '../ml/MLInferenceService';
import { OfferService } from '../offers/OfferService';
import { FeatureStoreService } from '../data/FeatureStoreService';
import { CacheService } from '../utils/CacheService';

// Core recommendation interfaces
export interface UserProfile {
  userID: string;
  loyaltyTier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  recentPurchases: PurchaseHistory[];
  recentViews: ViewHistory[];
  preferredBrands: string[];
  preferredCategories: string[];
  currency: string;
  locale: string;
  accessibility: {
    accessType: 'default' | 'wheelchair' | 'stroller';
  };
}

export interface PurchaseHistory {
  skuID: string;
  timestamp: string;
  amount: number;
  currency: string;
}

export interface ViewHistory {
  skuID: string;
  timestamp: string;
  context: 'AROverlay' | '2DViewer' | 'Search' | 'Category';
  duration?: number;
}

export interface ItemProfile {
  skuID: string;
  category: string;
  brand: string;
  price: number;
  currency: string;
  popularityScore: number;
  recentSalesCount: number;
  rating: number;
  has3D: boolean;
  stockAvailable: boolean;
  tags: string[];
  poiLocations?: string[];
}

export interface RecommendationRequest {
  userID: string;
  context: 'HOMEPAGE' | 'POI' | 'ROUTE' | 'CATEGORY' | 'SEARCH';
  contextData?: {
    poiID?: string;
    startNode?: string;
    endNode?: string;
    category?: string;
    query?: string;
  };
  limit?: number;
  includeOffers?: boolean;
}

export interface RecommendationResult {
  skuID: string;
  title: string;
  thumbnailURL: string;
  price: number;
  currency: string;
  has3D: boolean;
  hasOffer: boolean;
  offerCode?: string;
  relevanceScore: number;
  reasonCode: string;
}

export interface ContextualFactors {
  timeOfDay: number; // 0-23
  dayOfWeek: number; // 0-6
  terminalID: string;
  proximityToPOI?: string;
  flightStatus?: string;
  weatherCondition?: string;
}

// Error classes
export class RecommendationError extends Error {
  constructor(message: string, public code: string, public userID?: string) {
    super(message);
    this.name = 'RecommendationError';
  }
}

export class UserNotFoundError extends RecommendationError {
  constructor(userID: string) {
    super(`User not found: ${userID}`, 'USER_NOT_FOUND', userID);
  }
}

export class MLInferenceError extends RecommendationError {
  constructor(userID: string, error: string) {
    super(`ML inference failed: ${error}`, 'ML_INFERENCE_ERROR', userID);
  }
}

export class InsufficientDataError extends RecommendationError {
  constructor(userID: string) {
    super(`Insufficient data for user: ${userID}`, 'INSUFFICIENT_DATA', userID);
  }
}

export class RecommendationEngine {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private securityService: SecurityService;
  private mlInferenceService: MLInferenceService;
  private offerService: OfferService;
  private featureStoreService: FeatureStoreService;
  private cacheService: CacheService;

  // Configuration
  private readonly MIN_RELEVANCE_THRESHOLD = 0.5;
  private readonly MIN_DISTINCT_BRANDS = 2;
  private readonly CACHE_TTL_SECONDS = 300; // 5 minutes
  private readonly MAX_CANDIDATES = 1000;

  constructor() {
    this.logger = new Logger('RecommendationEngine');
    this.performanceMonitor = new PerformanceMonitor('RecommendationEngine');
    this.securityService = new SecurityService();
    this.mlInferenceService = new MLInferenceService();
    this.offerService = new OfferService();
    this.featureStoreService = new FeatureStoreService();
    this.cacheService = new CacheService();
  }

  /**
   * Generate personalized recommendations for user
   */
  async getRecommendations(
    request: RecommendationRequest,
    context: RecommendationSecurityContext
  ): Promise<RecommendationResult[]> {
    const startTime = Date.now();

    try {
      this.logger.info('Generating recommendations', {
        userID: request.userID,
        context: request.context,
        limit: request.limit || 10,
        includeOffers: request.includeOffers || false
      });

      // Validate request
      await this.validateRecommendationRequest(request, context);

      // Check cache first
      const cacheKey = this.generateCacheKey(request);
      const cachedResult = await this.cacheService.get<RecommendationResult[]>(cacheKey);
      if (cachedResult) {
        await this.performanceMonitor.recordMetric('recommendation_cache_hit', 1, {
          userID: request.userID,
          context: request.context
        });
        return cachedResult;
      }

      // Get user profile and embeddings
      const userProfile = await this.getUserProfile(request.userID);
      const userEmbedding = await this.featureStoreService.getUserEmbedding(request.userID);

      // Get candidate items based on context
      const candidates = await this.getCandidateItems(request, userProfile);

      // Generate recommendations using ML inference
      const recommendations = await this.generateMLRecommendations(
        userProfile,
        userEmbedding,
        candidates,
        request
      );

      // Apply business rules
      const processedRecommendations = await this.applyBusinessRules(
        recommendations,
        userProfile,
        request
      );

      // Add offers if requested
      if (request.includeOffers) {
        await this.enrichWithOffers(processedRecommendations, userProfile);
      }

      // Cache the results
      await this.cacheService.set(cacheKey, processedRecommendations, this.CACHE_TTL_SECONDS);

      // Record metrics
      await this.performanceMonitor.recordMetric('recommendation_generation_duration', Date.now() - startTime, {
        userID: request.userID,
        context: request.context,
        candidateCount: candidates.length,
        resultCount: processedRecommendations.length
      });

      this.logger.info('Recommendations generated successfully', {
        userID: request.userID,
        context: request.context,
        resultCount: processedRecommendations.length,
        duration: Date.now() - startTime
      });

      return processedRecommendations;

    } catch (error) {
      this.logger.error('Failed to generate recommendations', {
        userID: request.userID,
        context: request.context,
        error: error.message,
        duration: Date.now() - startTime
      });

      // Record error metrics
      await this.performanceMonitor.recordMetric('recommendation_errors', 1, {
        userID: request.userID,
        context: request.context,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get candidate items based on context
   */
  private async getCandidateItems(
    request: RecommendationRequest,
    userProfile: UserProfile
  ): Promise<ItemProfile[]> {
    let candidates: ItemProfile[] = [];

    switch (request.context) {
      case 'HOMEPAGE':
        candidates = await this.getHomepageCandidates(userProfile);
        break;
      case 'POI':
        candidates = await this.getPOICandidates(request.contextData?.poiID!, userProfile);
        break;
      case 'ROUTE':
        candidates = await this.getRouteCandidates(
          request.contextData?.startNode!,
          request.contextData?.endNode!,
          userProfile
        );
        break;
      case 'CATEGORY':
        candidates = await this.getCategoryCandidates(request.contextData?.category!, userProfile);
        break;
      case 'SEARCH':
        candidates = await this.getSearchCandidates(request.contextData?.query!, userProfile);
        break;
      default:
        throw new RecommendationError('Invalid context', 'INVALID_CONTEXT', request.userID);
    }

    // Filter out of stock items
    candidates = candidates.filter(item => item.stockAvailable);

    // Limit candidates for performance
    if (candidates.length > this.MAX_CANDIDATES) {
      candidates = candidates.slice(0, this.MAX_CANDIDATES);
    }

    this.logger.debug('Candidate items retrieved', {
      userID: request.userID,
      context: request.context,
      candidateCount: candidates.length
    });

    return candidates;
  }

  /**
   * Generate ML-powered recommendations
   */
  private async generateMLRecommendations(
    userProfile: UserProfile,
    userEmbedding: number[],
    candidates: ItemProfile[],
    request: RecommendationRequest
  ): Promise<RecommendationResult[]> {
    try {
      // Get item embeddings for candidates
      const itemEmbeddings = await Promise.all(
        candidates.map(item => this.featureStoreService.getItemEmbedding(item.skuID))
      );

      // Calculate similarity scores
      const scoredItems = candidates.map((item, index) => {
        const itemEmbedding = itemEmbeddings[index];
        
        // Compute similarity score
        const similarity = this.computeCosineSimilarity(userEmbedding, itemEmbedding);
        
        // Add popularity boost
        const popularityBoost = item.popularityScore * 0.1;
        
        // Add loyalty tier bonus
        const loyaltyBonus = this.getLoyaltyBonus(userProfile.loyaltyTier, item);
        
        // Calculate final relevance score
        const relevanceScore = similarity + popularityBoost + loyaltyBonus;

        return {
          skuID: item.skuID,
          title: this.generateItemTitle(item),
          thumbnailURL: this.generateThumbnailURL(item.skuID),
          price: item.price,
          currency: item.currency,
          has3D: item.has3D,
          hasOffer: false, // Will be set later
          relevanceScore,
          reasonCode: this.generateReasonCode(similarity, popularityBoost, loyaltyBonus)
        };
      });

      // Filter by minimum relevance threshold
      const filteredItems = scoredItems.filter(
        item => item.relevanceScore >= this.MIN_RELEVANCE_THRESHOLD
      );

      // Sort by relevance score descending
      filteredItems.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Apply limit
      const limit = request.limit || 10;
      return filteredItems.slice(0, limit);

    } catch (error) {
      this.logger.error('ML recommendation generation failed', {
        userID: request.userID,
        error: error.message
      });
      throw new MLInferenceError(request.userID, error.message);
    }
  }

  /**
   * Apply business rules to recommendations
   */
  private async applyBusinessRules(
    recommendations: RecommendationResult[],
    userProfile: UserProfile,
    request: RecommendationRequest
  ): Promise<RecommendationResult[]> {
    let processedRecs = [...recommendations];

    // Ensure minimum brand diversity
    processedRecs = await this.ensureBrandDiversity(processedRecs);

    // Add exploration items if needed
    if (request.context === 'HOMEPAGE') {
      processedRecs = await this.addExplorationItems(processedRecs, userProfile);
    }

    // Apply accessibility filters
    if (userProfile.accessibility.accessType !== 'default') {
      processedRecs = await this.applyAccessibilityFilters(processedRecs, userProfile);
    }

    return processedRecs;
  }

  /**
   * Enrich recommendations with offers
   */
  private async enrichWithOffers(
    recommendations: RecommendationResult[],
    userProfile: UserProfile
  ): Promise<void> {
    try {
      const offers = await this.offerService.getApplicableOffers(userProfile);
      
      for (const rec of recommendations) {
        const applicableOffer = offers.find(offer => 
          offer.applicableSKUs.includes(rec.skuID) ||
          offer.applicableCategories.some(cat => rec.skuID.includes(cat))
        );

        if (applicableOffer) {
          rec.hasOffer = true;
          rec.offerCode = applicableOffer.offerCode;
          
          // Adjust price if percentage or fixed discount
          if (applicableOffer.type === 'percentage') {
            rec.price = rec.price * (1 - applicableOffer.discountPercentage! / 100);
          } else if (applicableOffer.type === 'fixed') {
            rec.price = Math.max(0, rec.price - applicableOffer.discountAmount!);
          }
        }
      }

    } catch (error) {
      this.logger.warn('Failed to enrich with offers', {
        error: error.message
      });
      // Continue without offers if enrichment fails
    }
  }

  /**
   * Helper methods
   */
  private async validateRecommendationRequest(
    request: RecommendationRequest,
    context: RecommendationSecurityContext
  ): Promise<void> {
    if (!request.userID || !request.context) {
      throw new RecommendationError('Invalid recommendation request', 'INVALID_REQUEST');
    }

    // Security validation
    await this.securityService.validateRecommendationRequest(request.userID, 'recommendations.read', context);
  }

  private async getUserProfile(userID: string): Promise<UserProfile> {
    try {
      // In a real implementation, this would fetch from user profile service
      const profile = await this.featureStoreService.getUserProfile(userID);
      if (!profile) {
        throw new UserNotFoundError(userID);
      }
      return profile;
    } catch (error) {
      this.logger.error('Failed to get user profile', {
        userID,
        error: error.message
      });
      throw error;
    }
  }

  private generateCacheKey(request: RecommendationRequest): string {
    const contextData = JSON.stringify(request.contextData || {});
    return `recs:${request.userID}:${request.context}:${contextData}:${request.limit || 10}`;
  }

  private computeCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private getLoyaltyBonus(loyaltyTier: string, item: ItemProfile): number {
    const bonusMap = {
      'Bronze': 0.0,
      'Silver': 0.05,
      'Gold': 0.1,
      'Platinum': 0.15
    };
    
    return bonusMap[loyaltyTier as keyof typeof bonusMap] || 0;
  }

  private generateItemTitle(item: ItemProfile): string {
    return `${item.brand} ${item.category}`;
  }

  private generateThumbnailURL(skuID: string): string {
    return `https://cdn.aerofusionxr.com/images/${skuID}_thumb.jpg`;
  }

  private generateReasonCode(similarity: number, popularity: number, loyalty: number): string {
    if (similarity > 0.8) return 'HIGHLY_SIMILAR';
    if (popularity > 0.1) return 'TRENDING';
    if (loyalty > 0.1) return 'LOYALTY_BENEFIT';
    return 'RECOMMENDED';
  }

  // Placeholder methods for different candidate selection strategies
  private async getHomepageCandidates(userProfile: UserProfile): Promise<ItemProfile[]> {
    // Implementation would fetch global popular items and user's preferred categories
    return [];
  }

  private async getPOICandidates(poiID: string, userProfile: UserProfile): Promise<ItemProfile[]> {
    // Implementation would fetch items available at specific POI
    return [];
  }

  private async getRouteCandidates(startNode: string, endNode: string, userProfile: UserProfile): Promise<ItemProfile[]> {
    // Implementation would fetch items from POIs along the route
    return [];
  }

  private async getCategoryCandidates(category: string, userProfile: UserProfile): Promise<ItemProfile[]> {
    // Implementation would fetch items in specific category
    return [];
  }

  private async getSearchCandidates(query: string, userProfile: UserProfile): Promise<ItemProfile[]> {
    // Implementation would search items matching query
    return [];
  }

  private async ensureBrandDiversity(recommendations: RecommendationResult[]): Promise<RecommendationResult[]> {
    // Implementation would ensure minimum brand diversity
    return recommendations;
  }

  private async addExplorationItems(recommendations: RecommendationResult[], userProfile: UserProfile): Promise<RecommendationResult[]> {
    // Implementation would add exploration/discovery items
    return recommendations;
  }

  private async applyAccessibilityFilters(recommendations: RecommendationResult[], userProfile: UserProfile): Promise<RecommendationResult[]> {
    // Implementation would filter based on accessibility needs
    return recommendations;
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    dependencies: { [key: string]: boolean };
    metrics: any;
  }> {
    const mlServiceHealth = await this.mlInferenceService.getHealth();
    const featureStoreHealth = await this.featureStoreService.getHealth();
    const cacheHealth = await this.cacheService.getHealth();

    const healthyServices = [
      mlServiceHealth.available,
      featureStoreHealth.available,
      cacheHealth.available
    ].filter(s => s).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyServices === 3) {
      status = 'healthy';
    } else if (healthyServices > 1) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      dependencies: {
        mlInference: mlServiceHealth.available,
        featureStore: featureStoreHealth.available,
        cache: cacheHealth.available
      },
      metrics: {
        avgInferenceTime: this.performanceMonitor.getMetricStats('recommendation_generation_duration')?.avg || 0,
        cacheHitRate: this.performanceMonitor.getMetricStats('recommendation_cache_hit')?.count || 0,
        totalRecommendations: this.performanceMonitor.getMetricStats('recommendation_generation_duration')?.count || 0
      }
    };
  }
} 
