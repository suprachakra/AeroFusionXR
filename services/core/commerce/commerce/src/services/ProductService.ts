import { Model } from 'mongoose';
import { createLogger } from '@aerofusionxr/shared';
import { metrics } from '../utils/metrics';
import { Product, ProductModel } from '../models/Product';
import { Cache } from '../utils/Cache';

export interface SearchFilters {
  query?: string;
  categories?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  tags?: string[];
  inStock?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
}

export class ProductService {
  private logger: Logger;
  private cache: Cache;

  // Metrics
  private readonly searchLatencyHistogram = metrics.createHistogram({
    name: 'product_search_latency_seconds',
    help: 'Time taken to search products',
    labelNames: ['has_filters']
  });

  private readonly cacheHitCounter = metrics.createCounter({
    name: 'product_cache_hits_total',
    help: 'Total number of product cache hits'
  });

  private readonly cacheMissCounter = metrics.createCounter({
    name: 'product_cache_misses_total',
    help: 'Total number of product cache misses'
  });

  constructor(cache: Cache) {
    this.logger = createLogger('commerce-product');
    this.cache = cache;
  }

  private buildSearchQuery(filters: SearchFilters) {
    const query: any = {};

    if (filters.query) {
      query.$or = [
        { name: new RegExp(filters.query, 'i') },
        { description: new RegExp(filters.query, 'i') },
        { sku: new RegExp(filters.query, 'i') }
      ];
    }

    if (filters.categories?.length) {
      query.categories = { $in: filters.categories };
    }

    if (filters.tags?.length) {
      query.tags = { $in: filters.tags };
    }

    if (filters.priceRange) {
      query.price = {
        $gte: filters.priceRange.min,
        $lte: filters.priceRange.max
      };
    }

    if (filters.inStock !== undefined) {
      if (filters.inStock) {
        query.$or = [
          { 'inventory.available': { $gt: 0 } },
          { 'inventory.backorder': true }
        ];
      } else {
        query['inventory.available'] = 0;
        query['inventory.backorder'] = false;
      }
    }

    return query;
  }

  async searchProducts(filters: SearchFilters): Promise<SearchResult> {
    const startTime = Date.now();
    const hasFilters = Object.keys(filters).length > 0;

    try {
      const page = filters.page || 1;
      const limit = Math.min(filters.limit || 20, 100);
      const skip = (page - 1) * limit;

      // Try cache first
      const cacheKey = `products:${JSON.stringify(filters)}`;
      const cached = await this.cache.get(cacheKey);

      if (cached) {
        this.cacheHitCounter.inc();
        return cached as SearchResult;
      }

      this.cacheMissCounter.inc();

      // Build query
      const query = this.buildSearchQuery(filters);
      const sort: any = {};

      if (filters.sortBy) {
        sort[filters.sortBy] = filters.sortOrder === 'desc' ? -1 : 1;
      } else {
        sort.createdAt = -1;
      }

      // Execute query
      const [products, total] = await Promise.all([
        ProductModel.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        ProductModel.countDocuments(query)
      ]);

      const result: SearchResult = {
        products,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };

      // Cache results
      await this.cache.set(cacheKey, result, 300); // 5 minutes TTL

      const latency = (Date.now() - startTime) / 1000;
      this.searchLatencyHistogram.observe({ has_filters: hasFilters }, latency);

      return result;
    } catch (error) {
      this.logger.error('Product search failed:', error);
      throw error;
    }
  }

  async getProductById(id: string): Promise<Product | null> {
    try {
      const cacheKey = `product:${id}`;
      const cached = await this.cache.get(cacheKey);

      if (cached) {
        this.cacheHitCounter.inc();
        return cached as Product;
      }

      this.cacheMissCounter.inc();

      const product = await ProductModel.findById(id).lean();
      if (product) {
        await this.cache.set(cacheKey, product, 300);
      }

      return product;
    } catch (error) {
      this.logger.error('Product retrieval failed:', error);
      throw error;
    }
  }

  async updateInventory(
    productId: string,
    quantity: number,
    operation: 'increment' | 'decrement'
  ): Promise<boolean> {
    try {
      const update = {
        $inc: {
          'inventory.available': operation === 'increment' ? quantity : -quantity
        }
      };

      const result = await ProductModel.updateOne(
        {
          _id: productId,
          'inventory.available': operation === 'decrement' ? { $gte: quantity } : { $gte: 0 }
        },
        update
      );

      if (result.modifiedCount > 0) {
        await this.cache.delete(`product:${productId}`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Inventory update failed:', error);
      throw error;
    }
  }

  async getRelatedProducts(productId: string, limit: number = 5): Promise<Product[]> {
    try {
      const product = await this.getProductById(productId);
      if (!product) return [];

      const query = {
        _id: { $ne: productId },
        $or: [
          { categories: { $in: product.categories } },
          { tags: { $in: product.tags } }
        ]
      };

      return await ProductModel.find(query)
        .limit(limit)
        .lean();
    } catch (error) {
      this.logger.error('Related products fetch failed:', error);
      throw error;
    }
  }
} 
