/**
 * @file Integration tests for ProductService
 * @description Tests the ProductService functionality with in-memory MongoDB and Redis
 */

import { describe, expect, test, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection } from 'mongoose';
import { ProductService } from '../../../services/commerce/src/services/ProductService';
import { Cache } from '../../../services/commerce/src/utils/Cache';
import Redis from 'ioredis-mock';
import { Logger } from '../../../services/commerce/src/utils/Logger';

// Test data types
interface TestProduct {
  name: string;
  price: number;
  categories: string[];
  tags: string[];
  inventory: {
    available: number;
    backorder?: boolean;
  };
}

describe('ProductService Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let productService: ProductService;
  let cache: Cache;
  let mockLogger: jest.Mocked<Logger>;

  // Sample test products
  const testProducts: TestProduct[] = [
    {
      name: 'Test Product 1',
      price: 100,
      categories: ['electronics'],
      tags: ['new'],
      inventory: { available: 10 }
    },
    {
      name: 'Test Product 2',
      price: 200,
      categories: ['electronics'],
      tags: ['premium'],
      inventory: { available: 0 }
    }
  ];

  beforeAll(async () => {
    try {
      // Setup in-memory MongoDB
      mongoServer = await MongoMemoryServer.create();
      await mongoose.connect(mongoServer.getUri());

      // Setup mock Redis cache
      const redisMock = new Redis();
      cache = new Cache(redisMock as any);

      // Setup mock logger
      mockLogger = {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      } as unknown as jest.Mocked<Logger>;
      
      productService = new ProductService(cache);
    } catch (error) {
      console.error('Test setup failed:', error);
      throw error;
    }
  });

  beforeEach(async () => {
    // Clean up database before each test
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    try {
      await mongoose.disconnect();
      await mongoServer.stop();
    } catch (error) {
      console.error('Test teardown failed:', error);
      throw error;
    }
  });

  describe('Product Search', () => {
    beforeEach(async () => {
      await mongoose.connection.collection('products').insertMany(testProducts);
    });

    test('should return correct results with filters', async () => {
      const results = await productService.searchProducts({
        categories: ['electronics'],
        inStock: true,
        priceRange: { min: 0, max: 150 }
      });

      expect(results.products).toHaveLength(1);
      expect(results.products[0].name).toBe('Test Product 1');
      expect(results.total).toBe(1);
    });

    test('should handle empty search results', async () => {
      const results = await productService.searchProducts({
        categories: ['non-existent'],
      });

      expect(results.products).toHaveLength(0);
      expect(results.total).toBe(0);
    });

    test('should handle invalid price range gracefully', async () => {
      const results = await productService.searchProducts({
        priceRange: { min: -100, max: -50 }
      });

      expect(results.products).toHaveLength(0);
      expect(results.total).toBe(0);
    });
  });

  describe('Product Cache', () => {
    test('should return cached product', async () => {
      const productId = new mongoose.Types.ObjectId().toString();
      const testProduct = {
        _id: productId,
        name: 'Cached Product',
        price: 100
      };

      await cache.set(`product:${productId}`, testProduct);
      const product = await productService.getProductById(productId);

      expect(product).toBeDefined();
      expect(product?.name).toBe('Cached Product');
    });

    test('should handle cache miss gracefully', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const product = await productService.getProductById(nonExistentId);

      expect(product).toBeNull();
    });
  });

  describe('Inventory Management', () => {
    test('should correctly decrement stock', async () => {
      const product = await mongoose.connection.collection('products').insertOne({
        name: 'Inventory Test Product',
        inventory: { available: 10 }
      });

      const success = await productService.updateInventory(
        product.insertedId.toString(),
        3,
        'decrement'
      );

      expect(success).toBe(true);

      const updatedProduct = await mongoose.connection.collection('products').findOne({
        _id: product.insertedId
      });

      expect(updatedProduct?.inventory.available).toBe(7);
    });

    test('should prevent negative inventory', async () => {
      const product = await mongoose.connection.collection('products').insertOne({
        name: 'Low Stock Product',
        inventory: { available: 5 }
      });

      const success = await productService.updateInventory(
        product.insertedId.toString(),
        10,
        'decrement'
      );

      expect(success).toBe(false);

      const unchangedProduct = await mongoose.connection.collection('products').findOne({
        _id: product.insertedId
      });

      expect(unchangedProduct?.inventory.available).toBe(5);
    });
  });
}); 