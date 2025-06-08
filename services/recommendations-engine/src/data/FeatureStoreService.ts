import { createLogger } from '@aerofusionxr/shared';
import { UserProfile } from '../core/RecommendationEngine';

export interface UserEmbedding {
  userID: string;
  embedding: number[];
  lastUpdated: Date;
  version: string;
}

export interface ItemEmbedding {
  skuID: string;
  embedding: number[];
  lastUpdated: Date;
  version: string;
}

export interface FeatureVector {
  id: string;
  features: { [key: string]: number };
  metadata?: { [key: string]: any };
}

export class FeatureStoreService {
  private logger: Logger;
  private userEmbeddings: Map<string, UserEmbedding>;
  private itemEmbeddings: Map<string, ItemEmbedding>;
  private userProfiles: Map<string, UserProfile>;

  constructor() {
    this.logger = new Logger('FeatureStoreService');
    this.userEmbeddings = new Map();
    this.itemEmbeddings = new Map();
    this.userProfiles = new Map();
    
    this.initializeMockData();
  }

  private initializeMockData(): void {
    // Initialize mock user embeddings
    this.createMockUserEmbeddings();
    
    // Initialize mock item embeddings
    this.createMockItemEmbeddings();
    
    // Initialize mock user profiles
    this.createMockUserProfiles();
    
    this.logger.info('Mock feature store data initialized', {
      userEmbeddings: this.userEmbeddings.size,
      itemEmbeddings: this.itemEmbeddings.size,
      userProfiles: this.userProfiles.size
    });
  }

  private createMockUserEmbeddings(): void {
    const mockUsers = ['user_123', 'user_456', 'user_789'];
    
    mockUsers.forEach(userID => {
      const embedding = this.generateRandomEmbedding(128);
      this.userEmbeddings.set(userID, {
        userID,
        embedding,
        lastUpdated: new Date(),
        version: '1.0.0'
      });
    });
  }

  private createMockItemEmbeddings(): void {
    const mockItems = [
      'sunglass_002', 'perfume_005', 'perfume_010', 'bag_042',
      'headphones_001', 'watch_003', 'jewelry_007', 'electronics_009'
    ];
    
    mockItems.forEach(skuID => {
      const embedding = this.generateRandomEmbedding(128);
      this.itemEmbeddings.set(skuID, {
        skuID,
        embedding,
        lastUpdated: new Date(),
        version: '1.0.0'
      });
    });
  }

  private createMockUserProfiles(): void {
    const mockProfiles: UserProfile[] = [
      {
        userID: 'user_123',
        loyaltyTier: 'Gold',
        recentPurchases: [
          { skuID: 'perfume_005', timestamp: '2025-06-02T12:30:00Z', amount: 120, currency: 'USD' },
          { skuID: 'sunglass_002', timestamp: '2025-05-28T09:15:00Z', amount: 250, currency: 'USD' }
        ],
        recentViews: [
          { skuID: 'perfume_010', timestamp: '2025-06-05T08:45:00Z', context: '2DViewer', duration: 45 },
          { skuID: 'bag_042', timestamp: '2025-06-04T18:20:00Z', context: 'AROverlay', duration: 30 }
        ],
        preferredBrands: ['Gucci', 'Prada'],
        preferredCategories: ['perfume', 'sunglasses'],
        currency: 'USD',
        locale: 'en-US',
        accessibility: { accessType: 'default' }
      },
      {
        userID: 'user_456',
        loyaltyTier: 'Platinum',
        recentPurchases: [
          { skuID: 'headphones_001', timestamp: '2025-06-01T14:20:00Z', amount: 350, currency: 'USD' },
          { skuID: 'watch_003', timestamp: '2025-05-25T16:45:00Z', amount: 800, currency: 'USD' }
        ],
        recentViews: [
          { skuID: 'electronics_009', timestamp: '2025-06-05T10:30:00Z', context: 'Search', duration: 60 },
          { skuID: 'jewelry_007', timestamp: '2025-06-03T14:10:00Z', context: 'Category', duration: 25 }
        ],
        preferredBrands: ['Apple', 'Sony', 'Rolex'],
        preferredCategories: ['electronics', 'watches', 'jewelry'],
        currency: 'USD',
        locale: 'en-US',
        accessibility: { accessType: 'default' }
      }
    ];

    mockProfiles.forEach(profile => {
      this.userProfiles.set(profile.userID, profile);
    });
  }

  private generateRandomEmbedding(dimension: number): number[] {
    const embedding: number[] = [];
    for (let i = 0; i < dimension; i++) {
      // Generate random values between -1 and 1
      embedding.push((Math.random() - 0.5) * 2);
    }
    
    // Normalize the embedding vector
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      return embedding.map(val => val / norm);
    }
    
    return embedding;
  }

  async getUserEmbedding(userID: string): Promise<number[]> {
    try {
      const userEmbedding = this.userEmbeddings.get(userID);
      if (!userEmbedding) {
        // Generate default embedding for new users
        const defaultEmbedding = this.generateRandomEmbedding(128);
        
        this.userEmbeddings.set(userID, {
          userID,
          embedding: defaultEmbedding,
          lastUpdated: new Date(),
          version: '1.0.0'
        });
        
        this.logger.info('Generated default embedding for new user', { userID });
        return defaultEmbedding;
      }
      
      return userEmbedding.embedding;
    } catch (error) {
      this.logger.error('Failed to get user embedding', {
        userID,
        error: error.message
      });
      throw error;
    }
  }

  async getItemEmbedding(skuID: string): Promise<number[]> {
    try {
      const itemEmbedding = this.itemEmbeddings.get(skuID);
      if (!itemEmbedding) {
        // Generate default embedding for new items
        const defaultEmbedding = this.generateRandomEmbedding(128);
        
        this.itemEmbeddings.set(skuID, {
          skuID,
          embedding: defaultEmbedding,
          lastUpdated: new Date(),
          version: '1.0.0'
        });
        
        this.logger.debug('Generated default embedding for new item', { skuID });
        return defaultEmbedding;
      }
      
      return itemEmbedding.embedding;
    } catch (error) {
      this.logger.error('Failed to get item embedding', {
        skuID,
        error: error.message
      });
      throw error;
    }
  }

  async getUserProfile(userID: string): Promise<UserProfile | null> {
    try {
      const profile = this.userProfiles.get(userID);
      if (!profile) {
        this.logger.warn('User profile not found', { userID });
        return null;
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

  async updateUserEmbedding(userID: string, embedding: number[]): Promise<void> {
    try {
      const userEmbedding: UserEmbedding = {
        userID,
        embedding,
        lastUpdated: new Date(),
        version: '1.0.0'
      };
      
      this.userEmbeddings.set(userID, userEmbedding);
      
      this.logger.debug('User embedding updated', {
        userID,
        embeddingDimension: embedding.length
      });
    } catch (error) {
      this.logger.error('Failed to update user embedding', {
        userID,
        error: error.message
      });
      throw error;
    }
  }

  async updateItemEmbedding(skuID: string, embedding: number[]): Promise<void> {
    try {
      const itemEmbedding: ItemEmbedding = {
        skuID,
        embedding,
        lastUpdated: new Date(),
        version: '1.0.0'
      };
      
      this.itemEmbeddings.set(skuID, itemEmbedding);
      
      this.logger.debug('Item embedding updated', {
        skuID,
        embeddingDimension: embedding.length
      });
    } catch (error) {
      this.logger.error('Failed to update item embedding', {
        skuID,
        error: error.message
      });
      throw error;
    }
  }

  async updateUserProfile(userID: string, profile: UserProfile): Promise<void> {
    try {
      this.userProfiles.set(userID, profile);
      
      this.logger.debug('User profile updated', {
        userID,
        loyaltyTier: profile.loyaltyTier,
        locale: profile.locale
      });
    } catch (error) {
      this.logger.error('Failed to update user profile', {
        userID,
        error: error.message
      });
      throw error;
    }
  }

  async batchGetItemEmbeddings(skuIDs: string[]): Promise<Map<string, number[]>> {
    try {
      const embeddings = new Map<string, number[]>();
      
      for (const skuID of skuIDs) {
        const embedding = await this.getItemEmbedding(skuID);
        embeddings.set(skuID, embedding);
      }
      
      this.logger.debug('Batch item embeddings retrieved', {
        requestedCount: skuIDs.length,
        retrievedCount: embeddings.size
      });
      
      return embeddings;
    } catch (error) {
      this.logger.error('Failed to batch get item embeddings', {
        skuIDCount: skuIDs.length,
        error: error.message
      });
      throw error;
    }
  }

  async computeUserItemSimilarity(userID: string, skuID: string): Promise<number> {
    try {
      const userEmbedding = await this.getUserEmbedding(userID);
      const itemEmbedding = await this.getItemEmbedding(skuID);
      
      return this.cosineSimilarity(userEmbedding, itemEmbedding);
    } catch (error) {
      this.logger.error('Failed to compute user-item similarity', {
        userID,
        skuID,
        error: error.message
      });
      return 0;
    }
  }

  private cosineSimilarity(vectorA: number[], vectorB: number[]): number {
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

  async getHealth(): Promise<{ available: boolean; stats?: any }> {
    try {
      const stats = {
        userEmbeddings: this.userEmbeddings.size,
        itemEmbeddings: this.itemEmbeddings.size,
        userProfiles: this.userProfiles.size,
        memoryUsage: this.estimateMemoryUsage()
      };

      return {
        available: true,
        stats
      };
    } catch (error) {
      this.logger.error('Feature store health check failed', {
        error: error.message
      });
      return {
        available: false
      };
    }
  }

  private estimateMemoryUsage(): { userEmbeddings: string; itemEmbeddings: string; total: string } {
    const userEmbeddingSize = this.userEmbeddings.size * 128 * 8; // 128 floats * 8 bytes
    const itemEmbeddingSize = this.itemEmbeddings.size * 128 * 8;
    const totalSize = userEmbeddingSize + itemEmbeddingSize;
    
    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return {
      userEmbeddings: formatBytes(userEmbeddingSize),
      itemEmbeddings: formatBytes(itemEmbeddingSize),
      total: formatBytes(totalSize)
    };
  }
} 
