import { createLogger } from '@aerofusionxr/shared';
import { UserProfile } from '../core/RecommendationEngine';

export interface OfferProfile {
  offerID: string;
  type: 'percentage' | 'fixed' | 'bundle';
  title: string;
  description: string;
  applicableCategories: string[];
  applicableSKUs: string[];
  requiredQuantity?: number;
  freeQuantity?: number;
  discountPercentage?: number;
  discountAmount?: number;
  startTime: Date;
  endTime: Date;
  applicableLoyaltyTiers: string[];
  maxRedemptionsPerUser: number;
  offerCode: string;
}

export interface OfferEligibility {
  userID: string;
  offerID: string;
  isEligible: boolean;
  reason?: string;
  redemptionsUsed: number;
}

export class OfferService {
  private logger: Logger;
  private offers: Map<string, OfferProfile>;
  private userRedemptions: Map<string, Map<string, number>>;

  constructor() {
    this.logger = new Logger('OfferService');
    this.offers = new Map();
    this.userRedemptions = new Map();
    
    this.initializeMockOffers();
  }

  private initializeMockOffers(): void {
    // Mock offers for demonstration
    const offers: OfferProfile[] = [
      {
        offerID: 'BUNDLE_PERF_0625',
        type: 'bundle',
        title: 'Perfume Bundle: Buy 2 Get 1 Free',
        description: 'Select any 3 perfumes; pay only for 2. Valid until June 30, 2025.',
        applicableCategories: ['perfume'],
        applicableSKUs: [],
        requiredQuantity: 2,
        freeQuantity: 1,
        startTime: new Date('2025-06-01T00:00:00Z'),
        endTime: new Date('2025-06-30T23:59:59Z'),
        applicableLoyaltyTiers: ['Silver', 'Gold', 'Platinum'],
        maxRedemptionsPerUser: 1,
        offerCode: 'BUNDLE0625'
      },
      {
        offerID: 'PERC_SUN_15',
        type: 'percentage',
        title: '15% Off Sunglasses',
        description: 'Apply code SUN15 at checkout to get 15% off any sunglass purchase.',
        applicableCategories: ['sunglasses'],
        applicableSKUs: [],
        requiredQuantity: 1,
        discountPercentage: 15,
        startTime: new Date('2025-06-01T00:00:00Z'),
        endTime: new Date('2025-06-15T23:59:59Z'),
        applicableLoyaltyTiers: ['Bronze', 'Silver', 'Gold', 'Platinum'],
        maxRedemptionsPerUser: 3,
        offerCode: 'SUN15'
      },
      {
        offerID: 'FIXED_ELECTRONICS_50',
        type: 'fixed',
        title: '$50 Off Electronics',
        description: 'Get $50 off when you spend $200 or more on electronics.',
        applicableCategories: ['electronics', 'headphones'],
        applicableSKUs: [],
        requiredQuantity: 1,
        discountAmount: 50,
        startTime: new Date('2025-06-01T00:00:00Z'),
        endTime: new Date('2025-07-31T23:59:59Z'),
        applicableLoyaltyTiers: ['Gold', 'Platinum'],
        maxRedemptionsPerUser: 1,
        offerCode: 'ELECTRONICS50'
      }
    ];

    offers.forEach(offer => {
      this.offers.set(offer.offerID, offer);
    });

    this.logger.info('Mock offers initialized', {
      offerCount: this.offers.size
    });
  }

  async getApplicableOffers(userProfile: UserProfile): Promise<OfferProfile[]> {
    try {
      const now = new Date();
      const applicableOffers: OfferProfile[] = [];

      for (const offer of this.offers.values()) {
        // Check if offer is currently active
        if (now < offer.startTime || now > offer.endTime) {
          continue;
        }

        // Check loyalty tier eligibility
        if (!offer.applicableLoyaltyTiers.includes(userProfile.loyaltyTier)) {
          continue;
        }

        // Check redemption limit
        const userRedemptions = this.getUserRedemptions(userProfile.userID);
        const redemptionsUsed = userRedemptions.get(offer.offerID) || 0;
        if (redemptionsUsed >= offer.maxRedemptionsPerUser) {
          continue;
        }

        applicableOffers.push(offer);
      }

      this.logger.debug('Applicable offers retrieved', {
        userID: userProfile.userID,
        loyaltyTier: userProfile.loyaltyTier,
        applicableCount: applicableOffers.length
      });

      return applicableOffers;
    } catch (error) {
      this.logger.error('Failed to get applicable offers', {
        userID: userProfile.userID,
        error: error.message
      });
      return [];
    }
  }

  async getOffersByContext(context: string, userProfile: UserProfile): Promise<OfferProfile[]> {
    try {
      const applicableOffers = await this.getApplicableOffers(userProfile);
      
      // Filter by context (e.g., category-specific offers)
      return applicableOffers.filter(offer => {
        if (context.startsWith('CATEGORY:')) {
          const category = context.replace('CATEGORY:', '');
          return offer.applicableCategories.includes(category);
        }
        return true; // Return all for other contexts
      });
    } catch (error) {
      this.logger.error('Failed to get offers by context', {
        context,
        userID: userProfile.userID,
        error: error.message
      });
      return [];
    }
  }

  async checkOfferEligibility(userID: string, offerID: string): Promise<OfferEligibility> {
    try {
      const offer = this.offers.get(offerID);
      if (!offer) {
        return {
          userID,
          offerID,
          isEligible: false,
          reason: 'Offer not found',
          redemptionsUsed: 0
        };
      }

      const now = new Date();
      const userRedemptions = this.getUserRedemptions(userID);
      const redemptionsUsed = userRedemptions.get(offerID) || 0;

      // Check if offer is expired
      if (now < offer.startTime || now > offer.endTime) {
        return {
          userID,
          offerID,
          isEligible: false,
          reason: 'Offer expired or not yet active',
          redemptionsUsed
        };
      }

      // Check redemption limit
      if (redemptionsUsed >= offer.maxRedemptionsPerUser) {
        return {
          userID,
          offerID,
          isEligible: false,
          reason: 'Redemption limit reached',
          redemptionsUsed
        };
      }

      return {
        userID,
        offerID,
        isEligible: true,
        redemptionsUsed
      };
    } catch (error) {
      this.logger.error('Failed to check offer eligibility', {
        userID,
        offerID,
        error: error.message
      });
      
      return {
        userID,
        offerID,
        isEligible: false,
        reason: 'Error checking eligibility',
        redemptionsUsed: 0
      };
    }
  }

  async redeemOffer(userID: string, offerID: string): Promise<boolean> {
    try {
      const eligibility = await this.checkOfferEligibility(userID, offerID);
      if (!eligibility.isEligible) {
        this.logger.warn('Offer redemption failed', {
          userID,
          offerID,
          reason: eligibility.reason
        });
        return false;
      }

      // Record redemption
      const userRedemptions = this.getUserRedemptions(userID);
      const currentRedemptions = userRedemptions.get(offerID) || 0;
      userRedemptions.set(offerID, currentRedemptions + 1);

      this.logger.info('Offer redeemed successfully', {
        userID,
        offerID,
        totalRedemptions: currentRedemptions + 1
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to redeem offer', {
        userID,
        offerID,
        error: error.message
      });
      return false;
    }
  }

  async createOffer(offer: OfferProfile): Promise<void> {
    try {
      this.offers.set(offer.offerID, offer);
      
      this.logger.info('Offer created', {
        offerID: offer.offerID,
        type: offer.type,
        title: offer.title
      });
    } catch (error) {
      this.logger.error('Failed to create offer', {
        offerID: offer.offerID,
        error: error.message
      });
      throw error;
    }
  }

  async updateOffer(offerID: string, updates: Partial<OfferProfile>): Promise<void> {
    try {
      const existingOffer = this.offers.get(offerID);
      if (!existingOffer) {
        throw new Error(`Offer not found: ${offerID}`);
      }

      const updatedOffer = { ...existingOffer, ...updates };
      this.offers.set(offerID, updatedOffer);

      this.logger.info('Offer updated', {
        offerID,
        updates: Object.keys(updates)
      });
    } catch (error) {
      this.logger.error('Failed to update offer', {
        offerID,
        error: error.message
      });
      throw error;
    }
  }

  async deleteOffer(offerID: string): Promise<void> {
    try {
      const deleted = this.offers.delete(offerID);
      if (!deleted) {
        throw new Error(`Offer not found: ${offerID}`);
      }

      this.logger.info('Offer deleted', { offerID });
    } catch (error) {
      this.logger.error('Failed to delete offer', {
        offerID,
        error: error.message
      });
      throw error;
    }
  }

  private getUserRedemptions(userID: string): Map<string, number> {
    if (!this.userRedemptions.has(userID)) {
      this.userRedemptions.set(userID, new Map());
    }
    return this.userRedemptions.get(userID)!;
  }

  async getOfferAnalytics(): Promise<{
    totalOffers: number;
    activeOffers: number;
    totalRedemptions: number;
    offersByType: { [type: string]: number };
  }> {
    const now = new Date();
    let activeOffers = 0;
    let totalRedemptions = 0;
    const offersByType: { [type: string]: number } = {};

    for (const offer of this.offers.values()) {
      // Count by type
      offersByType[offer.type] = (offersByType[offer.type] || 0) + 1;

      // Count active offers
      if (now >= offer.startTime && now <= offer.endTime) {
        activeOffers++;
      }
    }

    // Count total redemptions
    for (const userRedemptions of this.userRedemptions.values()) {
      for (const redemptions of userRedemptions.values()) {
        totalRedemptions += redemptions;
      }
    }

    return {
      totalOffers: this.offers.size,
      activeOffers,
      totalRedemptions,
      offersByType
    };
  }
} 
