import { Schema, model, Document } from 'mongoose';
import { createLogger } from '@aerofusionxr/shared';
import { metrics } from '../utils/metrics';

export interface Promotion extends Document {
  code: string;
  type: 'percentage' | 'fixed' | 'bogo';
  value: number;
  minPurchase?: number;
  startDate: Date;
  endDate: Date;
  maxUses?: number;
  currentUses: number;
  productIds?: string[];
  metadata: Record<string, any>;
  isActive: boolean;
}

const PromotionSchema = new Schema<Promotion>({
  code: { type: String, required: true, unique: true, uppercase: true },
  type: { type: String, required: true, enum: ['percentage', 'fixed', 'bogo'] },
  value: { type: Number, required: true, min: 0 },
  minPurchase: { type: Number, min: 0 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  maxUses: { type: Number, min: 1 },
  currentUses: { type: Number, default: 0, min: 0 },
  productIds: [{ type: String }],
  metadata: { type: Map, of: Schema.Types.Mixed },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

export const PromotionModel = model<Promotion>('Promotion', PromotionSchema);

export class PromotionService {
  private logger: Logger;

  // Metrics
  private readonly promotionUsageCounter = metrics.createCounter({
    name: 'promotion_usage_total',
    help: 'Total number of promotion uses',
    labelNames: ['code', 'type']
  });

  private readonly promotionErrorCounter = metrics.createCounter({
    name: 'promotion_errors_total',
    help: 'Total number of promotion errors',
    labelNames: ['error_type']
  });

  constructor() {
    this.logger = new Logger();
  }

  async validatePromotion(
    code: string,
    subtotal: number,
    productIds?: string[]
  ): Promise<Promotion | null> {
    try {
      const promotion = await PromotionModel.findOne({ code: code.toUpperCase() });
      
      if (!promotion || !promotion.isActive) {
        return null;
      }

      const now = new Date();
      if (now < promotion.startDate || now > promotion.endDate) {
        return null;
      }

      if (promotion.maxUses && promotion.currentUses >= promotion.maxUses) {
        return null;
      }

      if (promotion.minPurchase && subtotal < promotion.minPurchase) {
        return null;
      }

      if (promotion.productIds?.length && productIds?.length) {
        const hasValidProduct = productIds.some(id => 
          promotion.productIds!.includes(id)
        );
        if (!hasValidProduct) {
          return null;
        }
      }

      return promotion;
    } catch (error) {
      this.logger.error('Promotion validation failed:', error);
      this.promotionErrorCounter.inc({ error_type: (error as Error).name });
      return null;
    }
  }

  async calculateDiscount(
    promotion: Promotion,
    subtotal: number,
    items: Array<{ productId: string; price: number; quantity: number }>
  ): Promise<number> {
    try {
      let discount = 0;

      switch (promotion.type) {
        case 'percentage':
          discount = subtotal * (promotion.value / 100);
          break;

        case 'fixed':
          discount = Math.min(promotion.value, subtotal);
          break;

        case 'bogo':
          if (promotion.productIds?.length) {
            const eligibleItems = items.filter(item =>
              promotion.productIds!.includes(item.productId)
            );
            
            for (const item of eligibleItems) {
              const freeItems = Math.floor(item.quantity / 2);
              discount += freeItems * item.price;
            }
          }
          break;
      }

      this.promotionUsageCounter.inc({
        code: promotion.code,
        type: promotion.type
      });

      return Math.min(discount, subtotal);
    } catch (error) {
      this.logger.error('Discount calculation failed:', error);
      this.promotionErrorCounter.inc({ error_type: (error as Error).name });
      return 0;
    }
  }

  async usePromotion(promotionId: string): Promise<boolean> {
    try {
      const result = await PromotionModel.updateOne(
        { _id: promotionId },
        { $inc: { currentUses: 1 } }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      this.logger.error('Promotion usage update failed:', error);
      this.promotionErrorCounter.inc({ error_type: (error as Error).name });
      return false;
    }
  }

  async createPromotion(promotion: Partial<Promotion>): Promise<Promotion> {
    try {
      return await PromotionModel.create(promotion);
    } catch (error) {
      this.logger.error('Promotion creation failed:', error);
      this.promotionErrorCounter.inc({ error_type: (error as Error).name });
      throw error;
    }
  }

  async deactivatePromotion(code: string): Promise<boolean> {
    try {
      const result = await PromotionModel.updateOne(
        { code: code.toUpperCase() },
        { isActive: false }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      this.logger.error('Promotion deactivation failed:', error);
      this.promotionErrorCounter.inc({ error_type: (error as Error).name });
      return false;
    }
  }
} 
