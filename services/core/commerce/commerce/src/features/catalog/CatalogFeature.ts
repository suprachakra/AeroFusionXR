import { createLogger, createPerformanceMonitor, PerformanceMonitor } from '@aerofusionxr/shared';

// Core catalog interfaces
export interface ProductSearchRequest {
  q: string;
  categoryID?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: 'price' | 'relevance' | 'popularity' | 'rating' | 'newest';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  filters?: SearchFilter[];
  locale?: string;
}

export interface ProductSearchResponse {
  totalCount: number;
  page: number;
  limit: number;
  products: ProductSummary[];
  facets: SearchFacet[];
  suggestions?: string[];
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
  rating: number;
  reviewCount: number;
  isOnSale: boolean;
  salePrice?: number;
  brand?: string;
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
  salePrice?: number;
  currency: string;
  categoryIDs: string[];
  thumbnailURL: string;
  mediaAssets: MediaAsset[];
  inventory: InventoryInfo;
  metadata: ProductMetadata;
  specifications: ProductSpecification[];
  reviews: ProductReview[];
  relatedProducts: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaAsset {
  assetID: string;
  assetType: 'thumbnail' | 'model3D' | 'video' | 'image' | 'ar_model';
  lod: 'high' | 'med' | 'low';
  assetURL: string;
  checksum: string;
  updatedAt: Date;
}

export interface InventoryInfo {
  availableQty: number;
  reservedQty: number;
  reorderLevel: number;
  location: string;
  updatedAt: Date;
}

export interface ProductMetadata {
  brand?: string;
  weight?: number;
  dimensions?: ProductDimensions;
  materials?: string[];
  colors?: string[];
  dietary?: DietaryInfo;
  tags?: string[];
  sku: string;
  barcode?: string;
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
  organic?: boolean;
}

export interface ProductSpecification {
  name: string;
  value: string;
  unit?: string;
}

export interface ProductReview {
  reviewID: string;
  userID: string;
  rating: number;
  title: string;
  comment: string;
  verified: boolean;
  createdAt: Date;
}

export interface Category {
  categoryID: string;
  name: Record<string, string>;
  description: Record<string, string>;
  parentID?: string;
  subcategories: string[];
  productCount: number;
  imageURL?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface SearchFilter {
  field: string;
  value: any;
  operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains' | 'range';
}

export interface SearchFacet {
  field: string;
  name: string;
  values: Array<{
    value: string;
    count: number;
    selected: boolean;
  }>;
}

export interface MenuResponse {
  cafeID: string;
  name: Record<string, string>;
  description: Record<string, string>;
  location: string;
  hours: OperatingHours;
  items: MenuItem[];
  categories: MenuCategory[];
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
  categoryID: string;
  isAvailable: boolean;
  preparationTime: number; // minutes
}

export interface MenuCategory {
  categoryID: string;
  name: Record<string, string>;
  sortOrder: number;
  isActive: boolean;
}

export interface OperatingHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export interface DayHours {
  open: string; // "HH:mm"
  close: string; // "HH:mm"
  closed: boolean;
}

export interface BulkUpdateRequest {
  updates: ProductUpdate[];
  validateOnly?: boolean;
}

export interface ProductUpdate {
  productID: string;
  newPrice?: number;
  newSalePrice?: number;
  newStock?: number;
  newStatus?: 'active' | 'inactive' | 'discontinued';
  operation: 'update' | 'delete';
}

export interface BulkUpdateResponse {
  updatedCount: number;
  invalidRecords: InvalidRecord[];
  processedAt: Date;
  validationErrors?: string[];
}

export interface InvalidRecord {
  productID: string;
  reason: string;
  field?: string;
}

export interface InventoryUpdateEvent {
  productID: string;
  newQty: number;
  location: string;
  timestamp: Date;
  source: 'pos' | 'warehouse' | 'manual' | 'api';
  reason?: string;
}

export interface CatalogAnalytics {
  totalProducts: number;
  totalCategories: number;
  outOfStockProducts: number;
  lowStockProducts: number;
  topSellingProducts: Array<{
    productID: string;
    name: string;
    salesCount: number;
    revenue: number;
  }>;
  categoryPerformance: Array<{
    categoryID: string;
    name: string;
    productCount: number;
    salesCount: number;
    revenue: number;
  }>;
}

/**
 * Catalog Feature Module
 * Consolidated from catalog-backend service into commerce
 * 
 * Features:
 * - Product catalog management and search
 * - Multi-language product information
 * - Inventory tracking and management
 * - Category hierarchy and navigation
 * - 3D model and AR asset management
 * - Menu management for F&B outlets
 * - Bulk product operations
 * - Search with faceted filtering
 * - Product recommendations
 * - Catalog analytics and reporting
 */
export class CatalogFeature {
  private logger = createLogger('commerce.catalog');
  private performanceMonitor = createPerformanceMonitor('catalog');
  private productCache: Map<string, ProductDetails> = new Map();
  private searchCache: Map<string, ProductSearchResponse> = new Map();
  private inventoryCache: Map<string, InventoryInfo> = new Map();
  private categoryCache: Map<string, Category> = new Map();
  
  // Configuration
  private readonly CACHE_TTL_MINUTES = 30;
  private readonly DEFAULT_PAGE_SIZE = 20;
  private readonly MAX_PAGE_SIZE = 100;
  private readonly SEARCH_TIMEOUT_MS = 5000;

  constructor() {
    this.logger.info('Catalog Feature initialized');
    this.initializeMockData();
  }

  /**
   * Search products with advanced filtering
   * @param request - Product search request
   */
  async searchProducts(request: ProductSearchRequest): Promise<ProductSearchResponse> {
    const timer = this.performanceMonitor.startTimer('search_products');
    
    try {
      this.logger.info('Searching products', {
        query: request.q,
        categoryID: request.categoryID,
        page: request.page,
        limit: request.limit
      });

      // Validate request
      await this.validateSearchRequest(request);

      // Check cache
      const cacheKey = this.generateSearchCacheKey(request);
      const cached = this.searchCache.get(cacheKey);
      if (cached) {
        timer.end(true);
        return cached;
      }

      // Perform search
      const response = await this.performProductSearch(request);

      // Cache result
      this.searchCache.set(cacheKey, response);
      setTimeout(() => this.searchCache.delete(cacheKey), this.CACHE_TTL_MINUTES * 60 * 1000);

      this.performanceMonitor.recordMetric('products_searched', response.products.length, {
        query: request.q,
        totalCount: response.totalCount,
        page: request.page
      });

      this.logger.info('Product search completed', {
        query: request.q,
        totalCount: response.totalCount,
        returnedCount: response.products.length
      });

      timer.end(true);
      return response;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to search products', {
        query: request.q,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get detailed product information
   * @param productID - Product identifier
   * @param locale - Language locale
   */
  async getProductDetails(productID: string, locale: string = 'en'): Promise<ProductDetails> {
    const timer = this.performanceMonitor.startTimer('get_product_details');
    
    try {
      this.logger.debug('Getting product details', { productID, locale });

      // Check cache
      const cached = this.productCache.get(productID);
      if (cached) {
        timer.end(true);
        return cached;
      }

      // Fetch product details
      const product = await this.fetchProductFromDatabase(productID);
      if (!product) {
        throw new Error(`Product not found: ${productID}`);
      }

      // Cache result
      this.productCache.set(productID, product);
      setTimeout(() => this.productCache.delete(productID), this.CACHE_TTL_MINUTES * 60 * 1000);

      this.performanceMonitor.recordMetric('product_details_retrieved', 1, {
        productID,
        locale
      });

      timer.end(true);
      return product;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get product details', {
        productID,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get menu for F&B outlet
   * @param cafeID - Cafe identifier
   * @param locale - Language locale
   */
  async getMenu(cafeID: string, locale: string = 'en'): Promise<MenuResponse> {
    const timer = this.performanceMonitor.startTimer('get_menu');
    
    try {
      this.logger.info('Getting menu', { cafeID, locale });

      // Mock menu data
      const menu: MenuResponse = {
        cafeID,
        name: {
          en: 'Terminal Cafe',
          zh: '航站楼咖啡厅'
        },
        description: {
          en: 'Fresh coffee and light meals',
          zh: '新鲜咖啡和轻食'
        },
        location: 'Terminal 1, Level 2',
        hours: {
          monday: { open: '06:00', close: '22:00', closed: false },
          tuesday: { open: '06:00', close: '22:00', closed: false },
          wednesday: { open: '06:00', close: '22:00', closed: false },
          thursday: { open: '06:00', close: '22:00', closed: false },
          friday: { open: '06:00', close: '22:00', closed: false },
          saturday: { open: '07:00', close: '23:00', closed: false },
          sunday: { open: '07:00', close: '21:00', closed: false }
        },
        items: await this.getMenuItems(cafeID, locale),
        categories: [
          {
            categoryID: 'beverages',
            name: { en: 'Beverages', zh: '饮品' },
            sortOrder: 1,
            isActive: true
          },
          {
            categoryID: 'food',
            name: { en: 'Food', zh: '食物' },
            sortOrder: 2,
            isActive: true
          }
        ]
      };

      this.performanceMonitor.recordMetric('menu_retrieved', menu.items.length, {
        cafeID,
        locale
      });

      timer.end(true);
      return menu;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get menu', {
        cafeID,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get category hierarchy
   * @param parentID - Parent category ID (optional)
   */
  async getCategories(parentID?: string): Promise<Category[]> {
    const timer = this.performanceMonitor.startTimer('get_categories');
    
    try {
      this.logger.debug('Getting categories', { parentID });

      const categories = Array.from(this.categoryCache.values())
        .filter(cat => cat.parentID === parentID)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      this.performanceMonitor.recordMetric('categories_retrieved', categories.length, {
        parentID
      });

      timer.end(true);
      return categories;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get categories', {
        parentID,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Bulk update products
   * @param request - Bulk update request
   */
  async bulkUpdateProducts(request: BulkUpdateRequest): Promise<BulkUpdateResponse> {
    const timer = this.performanceMonitor.startTimer('bulk_update_products');
    
    try {
      this.logger.info('Bulk updating products', {
        updateCount: request.updates.length,
        validateOnly: request.validateOnly
      });

      const response: BulkUpdateResponse = {
        updatedCount: 0,
        invalidRecords: [],
        processedAt: new Date(),
        validationErrors: []
      };

      // Validate updates
      for (const update of request.updates) {
        try {
          await this.validateProductUpdate(update);
          
          if (!request.validateOnly) {
            await this.applyProductUpdate(update);
            response.updatedCount++;
          }
        } catch (error) {
          response.invalidRecords.push({
            productID: update.productID,
            reason: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Clear caches for updated products
      if (!request.validateOnly) {
        this.clearProductCaches();
      }

      this.performanceMonitor.recordMetric('products_bulk_updated', response.updatedCount, {
        totalRequested: request.updates.length,
        invalidCount: response.invalidRecords.length
      });

      this.logger.info('Bulk update completed', {
        updatedCount: response.updatedCount,
        invalidCount: response.invalidRecords.length
      });

      timer.end(true);
      return response;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to bulk update products', {
        updateCount: request.updates.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update inventory for a product
   * @param event - Inventory update event
   */
  async processInventoryUpdate(event: InventoryUpdateEvent): Promise<void> {
    const timer = this.performanceMonitor.startTimer('process_inventory_update');
    
    try {
      this.logger.info('Processing inventory update', {
        productID: event.productID,
        newQty: event.newQty,
        source: event.source
      });

      // Update inventory cache
      const inventoryInfo: InventoryInfo = {
        availableQty: event.newQty,
        reservedQty: 0,
        reorderLevel: 10,
        location: event.location,
        updatedAt: event.timestamp
      };

      this.inventoryCache.set(event.productID, inventoryInfo);

      // Clear product cache to force refresh
      this.productCache.delete(event.productID);

      this.performanceMonitor.recordMetric('inventory_updated', 1, {
        productID: event.productID,
        source: event.source,
        newQty: event.newQty
      });

      this.logger.info('Inventory update processed', {
        productID: event.productID,
        newQty: event.newQty
      });

      timer.end(true);

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to process inventory update', {
        productID: event.productID,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get catalog analytics
   */
  async getCatalogAnalytics(): Promise<CatalogAnalytics> {
    const timer = this.performanceMonitor.startTimer('get_catalog_analytics');
    
    try {
      this.logger.debug('Getting catalog analytics');

      // Mock analytics data
      const analytics: CatalogAnalytics = {
        totalProducts: 1250,
        totalCategories: 45,
        outOfStockProducts: 23,
        lowStockProducts: 67,
        topSellingProducts: [
          {
            productID: 'DUTY_FREE_001',
            name: 'Premium Whiskey',
            salesCount: 156,
            revenue: 7164.00
          },
          {
            productID: 'FOOD_001',
            name: 'Artisan Coffee',
            salesCount: 234,
            revenue: 2925.00
          }
        ],
        categoryPerformance: [
          {
            categoryID: 'duty_free',
            name: 'Duty Free',
            productCount: 345,
            salesCount: 1250,
            revenue: 45600.00
          },
          {
            categoryID: 'food_beverage',
            name: 'Food & Beverage',
            productCount: 234,
            salesCount: 2340,
            revenue: 23400.00
          }
        ]
      };

      this.performanceMonitor.recordMetric('catalog_analytics_generated', 1, {
        totalProducts: analytics.totalProducts,
        outOfStockProducts: analytics.outOfStockProducts
      });

      timer.end(true);
      return analytics;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get catalog analytics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Private helper methods

  private async validateSearchRequest(request: ProductSearchRequest): Promise<void> {
    if (request.limit && request.limit > this.MAX_PAGE_SIZE) {
      throw new Error(`Limit cannot exceed ${this.MAX_PAGE_SIZE}`);
    }

    if (request.minPrice && request.maxPrice && request.minPrice > request.maxPrice) {
      throw new Error('Min price cannot be greater than max price');
    }
  }

  private generateSearchCacheKey(request: ProductSearchRequest): string {
    return JSON.stringify({
      q: request.q,
      categoryID: request.categoryID,
      minPrice: request.minPrice,
      maxPrice: request.maxPrice,
      inStock: request.inStock,
      sortBy: request.sortBy,
      order: request.order,
      page: request.page,
      limit: request.limit,
      filters: request.filters
    });
  }

  private async performProductSearch(request: ProductSearchRequest): Promise<ProductSearchResponse> {
    // Mock search implementation
    const allProducts = Array.from(this.productCache.values());
    let filteredProducts = allProducts;

    // Apply search query
    if (request.q) {
      const query = request.q.toLowerCase();
      filteredProducts = filteredProducts.filter(product =>
        Object.values(product.name).some(name => name.toLowerCase().includes(query)) ||
        Object.values(product.description).some(desc => desc.toLowerCase().includes(query))
      );
    }

    // Apply category filter
    if (request.categoryID) {
      filteredProducts = filteredProducts.filter(product =>
        product.categoryIDs.includes(request.categoryID!)
      );
    }

    // Apply price filters
    if (request.minPrice) {
      filteredProducts = filteredProducts.filter(product => product.basePrice >= request.minPrice!);
    }
    if (request.maxPrice) {
      filteredProducts = filteredProducts.filter(product => product.basePrice <= request.maxPrice!);
    }

    // Apply stock filter
    if (request.inStock) {
      filteredProducts = filteredProducts.filter(product => product.inventory.availableQty > 0);
    }

    // Sort products
    if (request.sortBy) {
      filteredProducts.sort((a, b) => {
        let comparison = 0;
        switch (request.sortBy) {
          case 'price':
            comparison = a.basePrice - b.basePrice;
            break;
          case 'relevance':
            // Mock relevance scoring
            comparison = 0;
            break;
          case 'popularity':
            // Mock popularity scoring
            comparison = 0;
            break;
        }
        return request.order === 'desc' ? -comparison : comparison;
      });
    }

    // Pagination
    const page = request.page || 1;
    const limit = request.limit || this.DEFAULT_PAGE_SIZE;
    const startIndex = (page - 1) * limit;
    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + limit);

    // Convert to summary format
    const productSummaries: ProductSummary[] = paginatedProducts.map(product => ({
      productID: product.productID,
      name: product.name,
      price: product.basePrice,
      currency: product.currency,
      stock: product.inventory.availableQty,
      thumbnailURL: product.thumbnailURL,
      model3DURLs: product.mediaAssets
        .filter(asset => asset.assetType === 'model3D')
        .reduce((urls, asset) => ({ ...urls, [asset.lod]: asset.assetURL }), {}),
      categoryIDs: product.categoryIDs,
      rating: 4.2, // Mock rating
      reviewCount: 15, // Mock review count
      isOnSale: !!product.salePrice,
      salePrice: product.salePrice,
      brand: product.metadata.brand
    }));

    return {
      totalCount: filteredProducts.length,
      page,
      limit,
      products: productSummaries,
      facets: this.generateSearchFacets(filteredProducts),
      suggestions: this.generateSearchSuggestions(request.q)
    };
  }

  private generateSearchFacets(products: ProductDetails[]): SearchFacet[] {
    // Mock facet generation
    return [
      {
        field: 'brand',
        name: 'Brand',
        values: [
          { value: 'Apple', count: 12, selected: false },
          { value: 'Samsung', count: 8, selected: false },
          { value: 'Sony', count: 6, selected: false }
        ]
      },
      {
        field: 'price_range',
        name: 'Price Range',
        values: [
          { value: '0-50', count: 45, selected: false },
          { value: '50-100', count: 32, selected: false },
          { value: '100+', count: 18, selected: false }
        ]
      }
    ];
  }

  private generateSearchSuggestions(query?: string): string[] {
    if (!query) return [];
    
    // Mock suggestions
    return [
      'coffee',
      'chocolate',
      'perfume',
      'electronics'
    ].filter(suggestion => suggestion.includes(query.toLowerCase()));
  }

  private async fetchProductFromDatabase(productID: string): Promise<ProductDetails | null> {
    // Mock product data
    const mockProducts: Record<string, ProductDetails> = {
      'DUTY_FREE_001': {
        productID: 'DUTY_FREE_001',
        name: { en: 'Premium Whiskey', zh: '优质威士忌' },
        description: { en: 'Aged 12 years, smooth finish', zh: '陈年12年，口感顺滑' },
        basePrice: 89.90,
        currency: 'SGD',
        categoryIDs: ['duty_free', 'alcohol'],
        thumbnailURL: 'https://assets.aerofusionxr.com/products/whiskey_thumb.jpg',
        mediaAssets: [
          {
            assetID: 'asset_001',
            assetType: 'model3D',
            lod: 'high',
            assetURL: 'https://assets.aerofusionxr.com/models/whiskey_high.glb',
            checksum: 'abc123',
            updatedAt: new Date()
          }
        ],
        inventory: {
          availableQty: 25,
          reservedQty: 3,
          reorderLevel: 10,
          location: 'Duty Free Shop A',
          updatedAt: new Date()
        },
        metadata: {
          brand: 'Premium Spirits',
          weight: 0.75,
          dimensions: { width: 8, height: 25, depth: 8, unit: 'cm' },
          materials: ['glass', 'cork'],
          sku: 'DF-WHIS-001',
          barcode: '1234567890123'
        },
        specifications: [
          { name: 'Alcohol Content', value: '40', unit: '%' },
          { name: 'Volume', value: '750', unit: 'ml' },
          { name: 'Origin', value: 'Scotland' }
        ],
        reviews: [],
        relatedProducts: ['DUTY_FREE_002', 'DUTY_FREE_003'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };

    return mockProducts[productID] || null;
  }

  private async getMenuItems(cafeID: string, locale: string): Promise<MenuItem[]> {
    // Mock menu items
    return [
      {
        itemID: 'MENU_001',
        name: { en: 'Espresso', zh: '浓缩咖啡' },
        description: { en: 'Rich and bold coffee', zh: '浓郁醇厚的咖啡' },
        price: 4.50,
        currency: 'SGD',
        calories: 5,
        thumbnailURL: 'https://assets.aerofusionxr.com/menu/espresso.jpg',
        model3DURLs: {},
        stock: 100,
        dietary: { vegan: true, glutenFree: true },
        categoryID: 'beverages',
        isAvailable: true,
        preparationTime: 3
      },
      {
        itemID: 'MENU_002',
        name: { en: 'Croissant', zh: '羊角面包' },
        description: { en: 'Buttery and flaky pastry', zh: '酥脆黄油面包' },
        price: 6.90,
        currency: 'SGD',
        calories: 280,
        thumbnailURL: 'https://assets.aerofusionxr.com/menu/croissant.jpg',
        model3DURLs: {},
        stock: 15,
        dietary: { vegetarian: true },
        categoryID: 'food',
        isAvailable: true,
        preparationTime: 2
      }
    ];
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
    const product = this.productCache.get(update.productID);
    if (!product) {
      throw new Error(`Product not found: ${update.productID}`);
    }

    if (update.operation === 'delete') {
      this.productCache.delete(update.productID);
      return;
    }

    // Apply updates
    if (update.newPrice !== undefined) {
      product.basePrice = update.newPrice;
    }
    if (update.newSalePrice !== undefined) {
      product.salePrice = update.newSalePrice;
    }
    if (update.newStock !== undefined) {
      product.inventory.availableQty = update.newStock;
      product.inventory.updatedAt = new Date();
    }

    product.updatedAt = new Date();
  }

  private clearProductCaches(): void {
    this.productCache.clear();
    this.searchCache.clear();
  }

  private initializeMockData(): void {
    // Initialize mock categories
    const categories: Category[] = [
      {
        categoryID: 'duty_free',
        name: { en: 'Duty Free', zh: '免税商品' },
        description: { en: 'Tax-free shopping', zh: '免税购物' },
        subcategories: ['alcohol', 'perfume', 'tobacco'],
        productCount: 345,
        isActive: true,
        sortOrder: 1
      },
      {
        categoryID: 'food_beverage',
        name: { en: 'Food & Beverage', zh: '食品饮料' },
        description: { en: 'Fresh food and drinks', zh: '新鲜食品和饮料' },
        subcategories: ['coffee', 'snacks', 'meals'],
        productCount: 234,
        isActive: true,
        sortOrder: 2
      }
    ];

    categories.forEach(category => {
      this.categoryCache.set(category.categoryID, category);
    });

    this.logger.debug('Mock catalog data initialized', {
      categoryCount: categories.length
    });
  }
} 