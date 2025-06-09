import { AppError, ErrorCode } from '../../../ai-concierge/src/shared/errors/index';
import { createLogger } from '@aerofusionxr/shared';
import { PerformanceMonitor } from '@aerofusionxr/shared';
import { SecurityService } from '../security/SecurityService';
import { ARVRBridgeService } from '../../../ar-vr-bridge/src/core/ARVRBridgeService';

// Catalog interfaces
export interface ProductSearchRequest {
  q: string;
  categoryID?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: 'price' | 'relevance' | 'popularity';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ProductSearchResponse {
  totalCount: number;
  page: number;
  limit: number;
  products: ProductSummary[];
}

export interface ProductSummary {
  productID: string;
  name: Record<string, string>; // localized names
  price: number;
  currency: string;
  stock: number;
  thumbnailURL: string;
  model3DURLs: Model3DURLs;
  categoryIDs: string[];
}

export interface Model3DURLs {
  high?: string;
  med?: string;
  low?: string;
}

export interface ProductDetails {
  productID: string;
  name: Record<string, string>;
  description: Record<string, string>;
  basePrice: number;
  currency: string;
  categoryIDs: string[];
  thumbnailURL: string;
  mediaAssets: MediaAsset[];
  inventory: InventoryInfo;
  metadata: ProductMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaAsset {
  assetID: string;
  assetType: 'thumbnail' | 'model3D' | 'video' | 'image';
  lod: 'high' | 'med' | 'low';
  assetURL: string;
  checksum: string;
  updatedAt: Date;
}

export interface InventoryInfo {
  availableQty: number;
  reservedQty: number;
  updatedAt: Date;
}

export interface ProductMetadata {
  brand?: string;
  weight?: number;
  dimensions?: ProductDimensions;
  materials?: string[];
  colors?: string[];
  dietary?: DietaryInfo;
}

export interface ProductDimensions {
  width: number;
  height: number;
  depth: number;
  unit: string;
}

export interface DietaryInfo {
  calories?: number;
  allergens?: string[];
  glutenFree?: boolean;
  vegan?: boolean;
  vegetarian?: boolean;
}

export interface MenuResponse {
  cafeID: string;
  name: Record<string, string>;
  items: MenuItem[];
}

export interface MenuItem {
  itemID: string;
  name: Record<string, string>;
  description: Record<string, string>;
  price: number;
  currency: string;
  calories?: number;
  thumbnailURL: string;
  model3DURLs: Model3DURLs;
  stock: number;
  dietary?: DietaryInfo;
}

export interface CatalogSnapshot {
  snapshotID: string;
  categoryID: string;
  version: number;
  manifestURL: string;
  createdAt: Date;
  productCount: number;
  sizeBytes: number;
}

export interface BulkUpdateRequest {
  updates: ProductUpdate[];
}

export interface ProductUpdate {
  productID: string;
  newPrice?: number;
  newCurrency?: string;
  newStock?: number;
  operation: 'update' | 'delete';
}

export interface BulkUpdateResponse {
  updatedCount: number;
  invalidRecords: InvalidRecord[];
  processedAt: Date;
}

export interface InvalidRecord {
  productID: string;
  reason: string;
}

export interface InventoryUpdateEvent {
  productID: string;
  newQty: number;
  location: string;
  timestamp: Date;
  source: 'pos' | 'warehouse' | 'manual';
}

export interface SearchFilter {
  field: string;
  value: any;
  operator: 'eq' | 'gt' | 'lt' | 'in' | 'contains';
}

export interface Category {
  categoryID: string;
  name: Record<string, string>;
  parentID?: string;
  subcategories: string[];
  productCount: number;
}

// Catalog-specific error types
export class CatalogSearchError extends AppError {
  readonly statusCode = 503;
  readonly errorCode = ErrorCode.SERVICE_UNAVAILABLE;
  readonly isOperational = true;

  constructor(message: string, context: any) {
    super(message, context);
  }
}

export class ProductNotFoundError extends AppError {
  readonly statusCode = 404;
  readonly errorCode = ErrorCode.RESOURCE_NOT_FOUND;
  readonly isOperational = true;

  constructor(message: string, context: any) {
    super(message, context);
  }
}

export class CatalogServiceError extends AppError {
  readonly statusCode = 503;
  readonly errorCode = ErrorCode.SERVICE_UNAVAILABLE;
  readonly isOperational = true;

  constructor(message: string, context: any) {
    super(message, context);
  }
}

/**
 * Retail & F&B Catalog Backend Service
 * Provides centralized catalog management with search, inventory, and media assets
 */
export class CatalogService {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private securityService: SecurityService;
  private bridgeService: ARVRBridgeService;
  private productCache: Map<string, ProductDetails>;
  private searchCache: Map<string, ProductSearchResponse>;
  private inventoryCache: Map<string, InventoryInfo>;
  private categoryCache: Map<string, Category>;

  constructor() {
    this.logger = new Logger('CatalogService');
    this.performanceMonitor = new PerformanceMonitor();
    this.securityService = new SecurityService();
    this.bridgeService = new ARVRBridgeService();
    this.productCache = new Map();
    this.searchCache = new Map();
    this.inventoryCache = new Map();
    this.categoryCache = new Map();
  }

  /**
   * Search products with filters and pagination
   */
  async searchProducts(request: ProductSearchRequest): Promise<ProductSearchResponse> {
    const startTime = Date.now();

    try {
      this.logger.debug('Searching products', { request });

      // Validate request
      await this.validateSearchRequest(request);

      // Generate cache key
      const cacheKey = this.generateSearchCacheKey(request);

      // Check cache first
      if (this.searchCache.has(cacheKey)) {
        const cachedResult = this.searchCache.get(cacheKey)!;
        this.logger.debug('Search results served from cache', { cacheKey });
        return cachedResult;
      }

      // Perform search in Elasticsearch
      const searchResults = await this.performElasticsearchQuery(request);

      // Cache results
      this.searchCache.set(cacheKey, searchResults);

      // Set cache TTL (in real implementation, would use Redis with TTL)
      setTimeout(() => {
        this.searchCache.delete(cacheKey);
      }, 120000); // 2 minutes

      const searchTime = Date.now() - startTime;
      await this.performanceMonitor.recordMetric('catalog_search_time', searchTime);

      this.logger.info('Product search completed', {
        query: request.q,
        totalResults: searchResults.totalCount,
        searchTime
      });

      return searchResults;

    } catch (error) {
      this.logger.error('Product search failed', {
        request,
        error: error.message
      });

      throw new CatalogSearchError('Product search failed', {
        request,
        originalError: error.message
      });
    }
  }

  /**
   * Get product details by ID
   */
  async getProductDetails(productID: string, locale?: string): Promise<ProductDetails> {
    const startTime = Date.now();

    try {
      this.logger.debug('Fetching product details', { productID, locale });

      // Check cache first
      const cacheKey = `${productID}_${locale || 'en'}`;
      if (this.productCache.has(cacheKey)) {
        return this.productCache.get(cacheKey)!;
      }

      // Fetch from database
      const product = await this.fetchProductFromDatabase(productID);
      if (!product) {
        throw new ProductNotFoundError('Product not found', { productID });
      }

      // Get latest inventory
      const inventory = await this.getInventoryInfo(productID);
      product.inventory = inventory;

      // Cache the result
      this.productCache.set(cacheKey, product);

      const fetchTime = Date.now() - startTime;
      await this.performanceMonitor.recordMetric('catalog_product_detail_time', fetchTime);

      this.logger.info('Product details retrieved', {
        productID,
        fetchTime
      });

      return product;

    } catch (error) {
      this.logger.error('Failed to get product details', {
        productID,
        error: error.message
      });

      if (error instanceof ProductNotFoundError) {
        throw error;
      }

      throw new CatalogServiceError('Product details fetch failed', {
        productID,
        originalError: error.message
      });
    }
  }

  /**
   * Get menu for F&B establishment
   */
  async getMenu(cafeID: string, locale?: string): Promise<MenuResponse> {
    try {
      this.logger.debug('Fetching menu', { cafeID, locale });

      // Get cafe information
      const cafe = await this.getCafeInfo(cafeID);
      
      // Get menu items
      const menuItems = await this.getMenuItems(cafeID, locale);

      const menu: MenuResponse = {
        cafeID,
        name: cafe.name,
        items: menuItems
      };

      await this.performanceMonitor.recordMetric('catalog_menu_requests', 1, {
        cafeID,
        itemCount: menuItems.length
      });

      this.logger.info('Menu retrieved successfully', {
        cafeID,
        itemCount: menuItems.length
      });

      return menu;

    } catch (error) {
      this.logger.error('Failed to get menu', {
        cafeID,
        error: error.message
      });

      throw new CatalogServiceError('Menu fetch failed', {
        cafeID,
        originalError: error.message
      });
    }
  }

  /**
   * Create catalog snapshot for offline use
   */
  async createSnapshot(categoryID: string): Promise<string> {
    try {
      this.logger.info('Creating catalog snapshot', { categoryID });

      // Generate snapshot ID
      const snapshotID = `snap_${categoryID}_${Date.now()}`;

      // Get all products in category
      const products = await this.getProductsByCategory(categoryID);

      // Generate manifest
      const manifest = await this.generateSnapshotManifest(products);

      // Get next version for snapshot
      const nextVersion = await this.getNextSnapshotVersion(categoryID);

      // Store snapshot metadata
      const snapshot: CatalogSnapshot = {
        snapshotID,
        categoryID,
        version: nextVersion,
        manifestURL: `https://cdn.example.com/snapshots/${categoryID}/${nextVersion}.json`,
        createdAt: new Date(),
        productCount: products.length,
        sizeBytes: JSON.stringify(manifest).length
      };

      // Store snapshot (in real implementation, would save to database and CDN)
      await this.storeSnapshot(snapshot, manifest);

      await this.performanceMonitor.recordMetric('catalog_snapshots_created', 1, {
        categoryID,
        productCount: products.length
      });

      this.logger.info('Catalog snapshot created', {
        snapshotID,
        categoryID,
        productCount: products.length,
        sizeBytes: snapshot.sizeBytes
      });

      return snapshotID;

    } catch (error) {
      this.logger.error('Failed to create snapshot', {
        categoryID,
        error: error.message
      });

      throw new CatalogServiceError('Snapshot creation failed', {
        categoryID,
        originalError: error.message
      });
    }
  }

  /**
   * Get catalog snapshot
   */
  async getSnapshot(categoryID: string, version?: number): Promise<CatalogSnapshot> {
    try {
      this.logger.debug('Fetching catalog snapshot', { categoryID, version });

      const snapshot = await this.fetchSnapshot(categoryID, version);
      if (!snapshot) {
        throw new ProductNotFoundError('Snapshot not found', { categoryID, version });
      }

      return snapshot;

    } catch (error) {
      this.logger.error('Failed to get snapshot', {
        categoryID,
        version,
        error: error.message
      });

      throw new CatalogServiceError('Snapshot fetch failed', {
        categoryID,
        version,
        originalError: error.message
      });
    }
  }

  /**
   * Bulk update products
   */
  async bulkUpdateProducts(request: BulkUpdateRequest): Promise<BulkUpdateResponse> {
    const startTime = Date.now();

    try {
      this.logger.info('Processing bulk update', {
        updateCount: request.updates.length
      });

      const response: BulkUpdateResponse = {
        updatedCount: 0,
        invalidRecords: [],
        processedAt: new Date()
      };

      // Process updates in batches
      const batchSize = 100;
      for (let i = 0; i < request.updates.length; i += batchSize) {
        const batch = request.updates.slice(i, i + batchSize);
        const batchResult = await this.processBatch(batch);
        
        response.updatedCount += batchResult.updatedCount;
        response.invalidRecords.push(...batchResult.invalidRecords);
      }

      // Clear relevant caches
      this.clearProductCaches();

      const updateTime = Date.now() - startTime;
      await this.performanceMonitor.recordMetric('catalog_bulk_update_time', updateTime);

      this.logger.info('Bulk update completed', {
        totalUpdates: request.updates.length,
        successful: response.updatedCount,
        invalid: response.invalidRecords.length,
        updateTime
      });

      return response;

    } catch (error) {
      this.logger.error('Bulk update failed', {
        updateCount: request.updates.length,
        error: error.message
      });

      throw new CatalogServiceError('Bulk update failed', {
        updateCount: request.updates.length,
        originalError: error.message
      });
    }
  }

  /**
   * Process inventory update event
   */
  async processInventoryUpdate(event: InventoryUpdateEvent): Promise<void> {
    try {
      this.logger.debug('Processing inventory update', {
        productID: event.productID,
        newQty: event.newQty,
        source: event.source
      });

      // Update inventory in database
      await this.updateInventoryInDatabase(event);

      // Update cache
      const inventoryInfo: InventoryInfo = {
        availableQty: event.newQty,
        reservedQty: 0, // Would be fetched from database
        updatedAt: event.timestamp
      };
      this.inventoryCache.set(event.productID, inventoryInfo);

      // Clear product cache to force fresh data
      this.clearProductCache(event.productID);

      // Update search cache if product is now out of stock
      if (event.newQty === 0) {
        this.updateSearchCacheForOutOfStock(event.productID);
      }

      await this.performanceMonitor.recordMetric('catalog_inventory_updates', 1, {
        source: event.source
      });

      this.logger.info('Inventory updated successfully', {
        productID: event.productID,
        newQty: event.newQty,
        source: event.source
      });

    } catch (error) {
      this.logger.error('Failed to process inventory update', {
        productID: event.productID,
        error: error.message
      });

      throw new CatalogServiceError('Inventory update failed', {
        productID: event.productID,
        originalError: error.message
      });
    }
  }

  // Private helper methods
  private async validateSearchRequest(request: ProductSearchRequest): Promise<void> {
    if (!request.q || request.q.trim().length === 0) {
      throw new CatalogSearchError('Search query is required', { request });
    }

    if (request.limit && (request.limit < 1 || request.limit > 50)) {
      throw new CatalogSearchError('Limit must be between 1 and 50', { request });
    }

    if (request.page && request.page < 1) {
      throw new CatalogSearchError('Page must be greater than 0', { request });
    }
  }

  private generateSearchCacheKey(request: ProductSearchRequest): string {
    const keyData = {
      q: request.q,
      categoryID: request.categoryID,
      minPrice: request.minPrice,
      maxPrice: request.maxPrice,
      inStock: request.inStock,
      sortBy: request.sortBy,
      order: request.order,
      page: request.page || 1,
      limit: request.limit || 20
    };

    return `search_${btoa(JSON.stringify(keyData))}`;
  }

  private async performElasticsearchQuery(request: ProductSearchRequest): Promise<ProductSearchResponse> {
    // Mock Elasticsearch query - in real implementation would use actual ES client
    const mockProducts: ProductSummary[] = [
      {
        productID: 'retail_watch_luxury_001',
        name: { en: 'Luxury Watch', fr: 'Montre de Luxe' },
        price: 1200.00,
        currency: 'USD',
        stock: 3,
        thumbnailURL: 'https://cdn.example.com/watches/luxury001_thumb.jpg',
        model3DURLs: {
          high: 'https://cdn.example.com/models/watches/luxury001_high.glb',
          med: 'https://cdn.example.com/models/watches/luxury001_med.glb',
          low: 'https://cdn.example.com/models/watches/luxury001_low.glb'
        },
        categoryIDs: ['watches', 'luxury', 'accessories']
      },
      {
        productID: 'retail_perfume_classic_002',
        name: { en: 'Classic Perfume', fr: 'Parfum Classique' },
        price: 89.99,
        currency: 'USD',
        stock: 15,
        thumbnailURL: 'https://cdn.example.com/perfumes/classic002_thumb.jpg',
        model3DURLs: {
          high: 'https://cdn.example.com/models/perfumes/classic002_high.glb',
          med: 'https://cdn.example.com/models/perfumes/classic002_med.glb',
          low: 'https://cdn.example.com/models/perfumes/classic002_low.glb'
        },
        categoryIDs: ['perfumes', 'beauty', 'luxury']
      }
    ];

    // Apply filters
    let filteredProducts = mockProducts;

    if (request.categoryID) {
      filteredProducts = filteredProducts.filter(p => 
        p.categoryIDs.includes(request.categoryID!)
      );
    }

    if (request.inStock) {
      filteredProducts = filteredProducts.filter(p => p.stock > 0);
    }

    if (request.minPrice) {
      filteredProducts = filteredProducts.filter(p => p.price >= request.minPrice!);
    }

    if (request.maxPrice) {
      filteredProducts = filteredProducts.filter(p => p.price <= request.maxPrice!);
    }

    // Apply pagination
    const page = request.page || 1;
    const limit = request.limit || 20;
    const startIndex = (page - 1) * limit;
    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + limit);

    return {
      totalCount: filteredProducts.length,
      page,
      limit,
      products: paginatedProducts
    };
  }

  private async fetchProductFromDatabase(productID: string): Promise<ProductDetails | null> {
    // Mock database fetch - in real implementation would query PostgreSQL
    const mockProduct: ProductDetails = {
      productID,
      name: { en: 'Luxury Watch', fr: 'Montre de Luxe' },
      description: { en: 'Premium Swiss-made luxury watch', fr: 'Montre de luxe suisse premium' },
      basePrice: 1200.00,
      currency: 'USD',
      categoryIDs: ['watches', 'luxury'],
      thumbnailURL: 'https://cdn.example.com/watches/luxury001_thumb.jpg',
      mediaAssets: [
        {
          assetID: 'asset_001',
          assetType: 'model3D',
          lod: 'high',
          assetURL: 'https://cdn.example.com/models/watches/luxury001_high.glb',
          checksum: 'sha256_placeholder',
          updatedAt: new Date()
        }
      ],
      inventory: {
        availableQty: 3,
        reservedQty: 0,
        updatedAt: new Date()
      },
      metadata: {
        brand: 'Swiss Luxury',
        weight: 150,
        dimensions: {
          width: 42,
          height: 42,
          depth: 12,
          unit: 'mm'
        },
        materials: ['stainless steel', 'sapphire crystal']
      },
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date()
    };

    return productID.includes('luxury') ? mockProduct : null;
  }

  private async getInventoryInfo(productID: string): Promise<InventoryInfo> {
    // Check cache first
    if (this.inventoryCache.has(productID)) {
      return this.inventoryCache.get(productID)!;
    }

    // Mock inventory fetch
    const inventory: InventoryInfo = {
      availableQty: Math.floor(Math.random() * 20),
      reservedQty: Math.floor(Math.random() * 5),
      updatedAt: new Date()
    };

    this.inventoryCache.set(productID, inventory);
    return inventory;
  }

  private async getCafeInfo(cafeID: string): Promise<{ name: Record<string, string> }> {
    return {
      name: { en: 'Barista Café', fr: 'Café Barista' }
    };
  }

  private async getMenuItems(cafeID: string, locale?: string): Promise<MenuItem[]> {
    const mockItems: MenuItem[] = [
      {
        itemID: 'menu_pastrami_sandwich',
        name: { en: 'Pastrami Sandwich', fr: 'Sandwich au pastrami' },
        description: { en: 'House-made pastrami on rye', fr: 'Pastrami fait maison sur seigle' },
        price: 12.50,
        currency: 'USD',
        calories: 450,
        thumbnailURL: 'https://cdn.example.com/menu/pastrami_sandwich.jpg',
        model3DURLs: {
          high: 'https://cdn.example.com/models/menu/sandwich_high.glb',
          med: 'https://cdn.example.com/models/menu/sandwich_med.glb',
          low: 'https://cdn.example.com/models/menu/sandwich_low.glb'
        },
        stock: 5,
        dietary: {
          calories: 450,
          allergens: ['gluten', 'dairy'],
          glutenFree: false,
          vegan: false,
          vegetarian: false
        }
      }
    ];

    return mockItems;
  }

  private async getProductsByCategory(categoryID: string): Promise<ProductDetails[]> {
    // Mock category products fetch
    return [];
  }

  private async generateSnapshotManifest(products: ProductDetails[]): Promise<any> {
    return {
      version: 1,
      products: products.map(p => ({
        productID: p.productID,
        name: p.name,
        thumbnailURL: p.thumbnailURL,
        model3DURLs: p.mediaAssets
          .filter(a => a.assetType === 'model3D')
          .reduce((urls, asset) => {
            urls[asset.lod] = asset.assetURL;
            return urls;
          }, {} as any)
      }))
    };
  }

  private async getNextSnapshotVersion(categoryID: string): Promise<number> {
    // Mock version calculation
    return 1;
  }

  private async storeSnapshot(snapshot: CatalogSnapshot, manifest: any): Promise<void> {
    // Mock snapshot storage
    this.logger.debug('Snapshot stored', {
      snapshotID: snapshot.snapshotID,
      manifestSize: JSON.stringify(manifest).length
    });
  }

  private async fetchSnapshot(categoryID: string, version?: number): Promise<CatalogSnapshot | null> {
    // Mock snapshot fetch
    return {
      snapshotID: `snap_${categoryID}_${version || 1}`,
      categoryID,
      version: version || 1,
      manifestURL: `https://cdn.example.com/snapshots/${categoryID}/${version || 1}.json`,
      createdAt: new Date(),
      productCount: 100,
      sizeBytes: 1024 * 1024 // 1MB
    };
  }

  private async processBatch(updates: ProductUpdate[]): Promise<{ updatedCount: number; invalidRecords: InvalidRecord[] }> {
    let updatedCount = 0;
    const invalidRecords: InvalidRecord[] = [];

    for (const update of updates) {
      try {
        await this.validateProductUpdate(update);
        await this.applyProductUpdate(update);
        updatedCount++;
      } catch (error) {
        invalidRecords.push({
          productID: update.productID,
          reason: error.message
        });
      }
    }

    return { updatedCount, invalidRecords };
  }

  private async validateProductUpdate(update: ProductUpdate): Promise<void> {
    if (!update.productID) {
      throw new Error('Product ID is required');
    }

    if (update.newPrice && update.newPrice < 0) {
      throw new Error('Price cannot be negative');
    }

    if (update.newStock && update.newStock < 0) {
      throw new Error('Stock cannot be negative');
    }
  }

  private async applyProductUpdate(update: ProductUpdate): Promise<void> {
    // Mock update application
    this.logger.debug('Applying product update', { update });
  }

  private async updateInventoryInDatabase(event: InventoryUpdateEvent): Promise<void> {
    // Mock database update
    this.logger.debug('Updating inventory in database', { event });
  }

  private clearProductCaches(): void {
    this.productCache.clear();
    this.searchCache.clear();
  }

  private clearProductCache(productID: string): void {
    // Clear all cached variations of this product
    const keysToDelete = Array.from(this.productCache.keys())
      .filter(key => key.startsWith(productID));
    
    keysToDelete.forEach(key => this.productCache.delete(key));
  }

  private updateSearchCacheForOutOfStock(productID: string): void {
    // In real implementation, would update search index
    this.logger.debug('Updating search cache for out of stock product', { productID });
  }
} 
