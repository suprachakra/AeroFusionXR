import { EventEmitter } from 'events';
import { createLogger } from '@aerofusionxr/shared';
import { ProductService } from './ProductService';
import { PromotionService } from './PromotionService';
import { PaymentService } from './PaymentService';
import { ARService } from './ARService';

// ================================
// TYPES AND INTERFACES
// ================================

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  subcategory: string;
  brand: string;
  images: string[];
  arModelUrl?: string;
  inventory: {
    available: number;
    reserved: number;
    total: number;
  };
  attributes: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  shippingAddress: Address;
  billingAddress: Address;
  createdAt: Date;
  updatedAt: Date;
  estimatedDelivery?: Date;
  trackingNumber?: string;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customizations?: Record<string, any>;
}

export interface Cart {
  id: string;
  customerId: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  currency: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItem {
  productId: string;
  quantity: number;
  addedAt: Date;
  customizations?: Record<string, any>;
}

export interface Address {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  loyaltyTier: 'bronze' | 'silver' | 'gold' | 'platinum';
  loyaltyPoints: number;
  addresses: Address[];
  paymentMethods: PaymentMethod[];
  preferences: CustomerPreferences;
  createdAt: Date;
  lastPurchase?: Date;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'digital_wallet' | 'bank_account';
  last4: string;
  brand: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

export interface CustomerPreferences {
  currency: string;
  language: string;
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  interests: string[];
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

export enum PaymentStatus {
  PENDING = 'pending',
  AUTHORIZED = 'authorized',
  CAPTURED = 'captured',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded'
}

export interface CommerceConfig {
  defaultCurrency: string;
  supportedCurrencies: string[];
  taxRates: Record<string, number>;
  shippingRates: Record<string, number>;
  loyaltyPointsRatio: number;
  cartExpiryMinutes: number;
  maxCartItems: number;
  maxQuantityPerItem: number;
  arModelFormats: string[];
  enablePersonalization: boolean;
  enableRecommendations: boolean;
}

// ================================
// COMMERCE SERVICE IMPLEMENTATION
// ================================

export class CommerceService extends EventEmitter {
  private logger: Logger;
  private productService: ProductService;
  private promotionService: PromotionService;
  private paymentService: PaymentService;
  private arService: ARService;
  private config: CommerceConfig;

  // In-memory storage for demo purposes
  private customers: Map<string, Customer> = new Map();
  private orders: Map<string, Order> = new Map();
  private carts: Map<string, Cart> = new Map();
  private sessions: Map<string, string> = new Map(); // sessionId -> customerId

  constructor(
    productService: ProductService,
    promotionService: PromotionService,
    paymentService: PaymentService,
    arService: ARService,
    config: CommerceConfig
  ) {
    super();
    
    this.logger = new Logger();
    this.productService = productService;
    this.promotionService = promotionService;
    this.paymentService = paymentService;
    this.arService = arService;
    this.config = config;

    this.initializeSampleData();
    this.setupEventListeners();
  }

  // ================================
  // PRODUCT MANAGEMENT
  // ================================

  public async getProducts(filters?: {
    category?: string;
    subcategory?: string;
    brand?: string;
    priceMin?: number;
    priceMax?: number;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ products: Product[]; total: number }> {
    try {
      const result = await this.productService.searchProducts(filters || {});
      
      this.emit('products.searched', {
        filters,
        resultCount: result.products.length,
        timestamp: new Date()
      });

      return result;
    } catch (error) {
      this.logger.error('Error getting products:', error);
      throw error;
    }
  }

  public async getProduct(productId: string): Promise<Product | null> {
    try {
      const product = await this.productService.getProduct(productId);
      
      if (product) {
        this.emit('product.viewed', {
          productId,
          timestamp: new Date()
        });
      }

      return product;
    } catch (error) {
      this.logger.error('Error getting product:', error);
      throw error;
    }
  }

  public async getProductRecommendations(
    customerId: string,
    context?: {
      currentProductId?: string;
      category?: string;
      limit?: number;
    }
  ): Promise<Product[]> {
    try {
      if (!this.config.enableRecommendations) {
        return [];
      }

      const customer = this.customers.get(customerId);
      if (!customer) {
        return [];
      }

      // Simple recommendation logic based on customer preferences and purchase history
      const recommendations = await this.productService.getRecommendations({
        customerId,
        interests: customer.preferences.interests,
        loyaltyTier: customer.loyaltyTier,
        ...context
      });

      this.emit('recommendations.generated', {
        customerId,
        count: recommendations.length,
        context,
        timestamp: new Date()
      });

      return recommendations;
    } catch (error) {
      this.logger.error('Error getting recommendations:', error);
      return [];
    }
  }

  // ================================
  // CART MANAGEMENT
  // ================================

  public async getCart(sessionId: string): Promise<Cart | null> {
    try {
      const customerId = this.sessions.get(sessionId);
      if (!customerId) {
        return null;
      }

      const cart = Array.from(this.carts.values())
        .find(c => c.customerId === customerId && c.expiresAt > new Date());

      if (cart) {
        // Refresh cart totals
        await this.recalculateCartTotals(cart);
      }

      return cart;
    } catch (error) {
      this.logger.error('Error getting cart:', error);
      throw error;
    }
  }

  public async addToCart(
    sessionId: string,
    productId: string,
    quantity: number,
    customizations?: Record<string, any>
  ): Promise<Cart> {
    try {
      const customerId = this.sessions.get(sessionId);
      if (!customerId) {
        throw new Error('Invalid session');
      }

      const product = await this.productService.getProduct(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      if (!product.isActive) {
        throw new Error('Product is not available');
      }

      if (product.inventory.available < quantity) {
        throw new Error('Insufficient inventory');
      }

      let cart = await this.getCart(sessionId);
      if (!cart) {
        cart = {
          id: this.generateId(),
          customerId,
          items: [],
          subtotal: 0,
          total: 0,
          currency: this.config.defaultCurrency,
          expiresAt: new Date(Date.now() + this.config.cartExpiryMinutes * 60 * 1000),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        this.carts.set(cart.id, cart);
      }

      // Check if item already exists in cart
      const existingItemIndex = cart.items.findIndex(item => 
        item.productId === productId && 
        JSON.stringify(item.customizations) === JSON.stringify(customizations)
      );

      if (existingItemIndex >= 0) {
        cart.items[existingItemIndex].quantity += quantity;
      } else {
        if (cart.items.length >= this.config.maxCartItems) {
          throw new Error('Cart is full');
        }

        cart.items.push({
          productId,
          quantity,
          addedAt: new Date(),
          customizations
        });
      }

      cart.updatedAt = new Date();
      await this.recalculateCartTotals(cart);

      this.emit('cart.item_added', {
        cartId: cart.id,
        customerId,
        productId,
        quantity,
        timestamp: new Date()
      });

      return cart;
    } catch (error) {
      this.logger.error('Error adding to cart:', error);
      throw error;
    }
  }

  public async updateCartItem(
    sessionId: string,
    productId: string,
    quantity: number,
    customizations?: Record<string, any>
  ): Promise<Cart> {
    try {
      const cart = await this.getCart(sessionId);
      if (!cart) {
        throw new Error('Cart not found');
      }

      const itemIndex = cart.items.findIndex(item => 
        item.productId === productId && 
        JSON.stringify(item.customizations) === JSON.stringify(customizations)
      );

      if (itemIndex === -1) {
        throw new Error('Item not found in cart');
      }

      if (quantity <= 0) {
        cart.items.splice(itemIndex, 1);
      } else {
        const product = await this.productService.getProduct(productId);
        if (!product || product.inventory.available < quantity) {
          throw new Error('Insufficient inventory');
        }

        cart.items[itemIndex].quantity = quantity;
      }

      cart.updatedAt = new Date();
      await this.recalculateCartTotals(cart);

      this.emit('cart.item_updated', {
        cartId: cart.id,
        productId,
        quantity,
        timestamp: new Date()
      });

      return cart;
    } catch (error) {
      this.logger.error('Error updating cart item:', error);
      throw error;
    }
  }

  public async removeFromCart(
    sessionId: string,
    productId: string,
    customizations?: Record<string, any>
  ): Promise<Cart> {
    try {
      const cart = await this.getCart(sessionId);
      if (!cart) {
        throw new Error('Cart not found');
      }

      const itemIndex = cart.items.findIndex(item => 
        item.productId === productId && 
        JSON.stringify(item.customizations) === JSON.stringify(customizations)
      );

      if (itemIndex === -1) {
        throw new Error('Item not found in cart');
      }

      cart.items.splice(itemIndex, 1);
      cart.updatedAt = new Date();
      await this.recalculateCartTotals(cart);

      this.emit('cart.item_removed', {
        cartId: cart.id,
        productId,
        timestamp: new Date()
      });

      return cart;
    } catch (error) {
      this.logger.error('Error removing from cart:', error);
      throw error;
    }
  }

  public async clearCart(sessionId: string): Promise<void> {
    try {
      const cart = await this.getCart(sessionId);
      if (!cart) {
        return;
      }

      cart.items = [];
      cart.subtotal = 0;
      cart.total = 0;
      cart.updatedAt = new Date();

      this.emit('cart.cleared', {
        cartId: cart.id,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Error clearing cart:', error);
      throw error;
    }
  }

  // ================================
  // ORDER MANAGEMENT
  // ================================

  public async createOrder(
    sessionId: string,
    shippingAddress: Address,
    billingAddress: Address,
    paymentMethodId: string
  ): Promise<Order> {
    try {
      const customerId = this.sessions.get(sessionId);
      if (!customerId) {
        throw new Error('Invalid session');
      }

      const cart = await this.getCart(sessionId);
      if (!cart || cart.items.length === 0) {
        throw new Error('Cart is empty');
      }

      const customer = this.customers.get(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Validate inventory
      for (const item of cart.items) {
        const product = await this.productService.getProduct(item.productId);
        if (!product || product.inventory.available < item.quantity) {
          throw new Error(`Insufficient inventory for product ${item.productId}`);
        }
      }

      // Calculate order totals with promotions
      const orderItems: OrderItem[] = [];
      let subtotal = 0;

      for (const cartItem of cart.items) {
        const product = await this.productService.getProduct(cartItem.productId);
        if (!product) {
          throw new Error(`Product ${cartItem.productId} not found`);
        }

        const unitPrice = product.price;
        const totalPrice = unitPrice * cartItem.quantity;

        orderItems.push({
          productId: cartItem.productId,
          quantity: cartItem.quantity,
          unitPrice,
          totalPrice,
          customizations: cartItem.customizations
        });

        subtotal += totalPrice;
      }

      // Apply promotions
      const promotions = await this.promotionService.getApplicablePromotions(customerId, orderItems);
      const discount = promotions.reduce((total, promo) => total + promo.discountAmount, 0);

      // Calculate tax and shipping
      const tax = this.calculateTax(subtotal - discount, shippingAddress.state);
      const shipping = this.calculateShipping(orderItems, shippingAddress);
      const total = subtotal - discount + tax + shipping;

      // Create order
      const order: Order = {
        id: this.generateId(),
        customerId,
        items: orderItems,
        subtotal,
        tax,
        shipping,
        discount,
        total,
        currency: cart.currency,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        shippingAddress,
        billingAddress,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Process payment
      const paymentResult = await this.paymentService.processPayment({
        amount: total,
        currency: order.currency,
        paymentMethodId,
        customerId,
        orderId: order.id,
        description: `Order ${order.id} - ${orderItems.length} items`
      });

      if (paymentResult.status === 'succeeded') {
        order.paymentStatus = PaymentStatus.CAPTURED;
        order.status = OrderStatus.CONFIRMED;

        // Reserve inventory
        for (const item of orderItems) {
          await this.productService.reserveInventory(item.productId, item.quantity);
        }

        // Clear cart
        await this.clearCart(sessionId);

        // Update customer loyalty points
        const pointsEarned = Math.floor(total * this.config.loyaltyPointsRatio);
        customer.loyaltyPoints += pointsEarned;
        customer.lastPurchase = new Date();

        this.emit('order.created', {
          orderId: order.id,
          customerId,
          total,
          pointsEarned,
          timestamp: new Date()
        });

      } else {
        order.paymentStatus = PaymentStatus.FAILED;
        this.emit('order.payment_failed', {
          orderId: order.id,
          customerId,
          reason: paymentResult.failureReason,
          timestamp: new Date()
        });
      }

      this.orders.set(order.id, order);
      return order;

    } catch (error) {
      this.logger.error('Error creating order:', error);
      throw error;
    }
  }

  public async getOrder(orderId: string): Promise<Order | null> {
    try {
      return this.orders.get(orderId) || null;
    } catch (error) {
      this.logger.error('Error getting order:', error);
      throw error;
    }
  }

  public async getCustomerOrders(
    customerId: string,
    filters?: {
      status?: OrderStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ orders: Order[]; total: number }> {
    try {
      let orders = Array.from(this.orders.values())
        .filter(order => order.customerId === customerId);

      if (filters?.status) {
        orders = orders.filter(order => order.status === filters.status);
      }

      orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const total = orders.length;
      const offset = filters?.offset || 0;
      const limit = filters?.limit || 50;

      orders = orders.slice(offset, offset + limit);

      return { orders, total };
    } catch (error) {
      this.logger.error('Error getting customer orders:', error);
      throw error;
    }
  }

  public async updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
    try {
      const order = this.orders.get(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      order.status = status;
      order.updatedAt = new Date();

      if (status === OrderStatus.SHIPPED) {
        order.trackingNumber = this.generateTrackingNumber();
        order.estimatedDelivery = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      }

      this.emit('order.status_updated', {
        orderId,
        status,
        timestamp: new Date()
      });

      return order;
    } catch (error) {
      this.logger.error('Error updating order status:', error);
      throw error;
    }
  }

  // ================================
  // CUSTOMER MANAGEMENT
  // ================================

  public async createCustomer(customerData: Omit<Customer, 'id' | 'createdAt'>): Promise<Customer> {
    try {
      const customer: Customer = {
        id: this.generateId(),
        createdAt: new Date(),
        ...customerData
      };

      this.customers.set(customer.id, customer);

      this.emit('customer.created', {
        customerId: customer.id,
        email: customer.email,
        timestamp: new Date()
      });

      return customer;
    } catch (error) {
      this.logger.error('Error creating customer:', error);
      throw error;
    }
  }

  public async getCustomer(customerId: string): Promise<Customer | null> {
    try {
      return this.customers.get(customerId) || null;
    } catch (error) {
      this.logger.error('Error getting customer:', error);
      throw error;
    }
  }

  public async updateCustomer(customerId: string, updates: Partial<Customer>): Promise<Customer> {
    try {
      const customer = this.customers.get(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      Object.assign(customer, updates);

      this.emit('customer.updated', {
        customerId,
        timestamp: new Date()
      });

      return customer;
    } catch (error) {
      this.logger.error('Error updating customer:', error);
      throw error;
    }
  }

  // ================================
  // AR INTEGRATION
  // ================================

  public async getProductARModel(productId: string, userAgent: string): Promise<any> {
    try {
      const product = await this.productService.getProduct(productId);
      if (!product || !product.arModelUrl) {
        throw new Error('AR model not available for this product');
      }

      const compatibility = this.arService.checkDeviceCompatibility(userAgent);
      
      const asset = {
        gltfUrl: product.arModelUrl,
        usdcUrl: product.arModelUrl.replace('.gltf', '.usdc'),
        thumbnailUrl: product.images[0] || '',
        size: { width: 1, height: 1, depth: 1 },
        lods: [
          { level: 0, url: product.arModelUrl, triangleCount: 100000 },
          { level: 1, url: product.arModelUrl.replace('.gltf', '_med.gltf'), triangleCount: 50000 },
          { level:2, url: product.arModelUrl.replace('.gltf', '_low.gltf'), triangleCount: 25000 }
        ]
      };

      const model = await this.arService.loadModel(asset, {
        maxTriangles: compatibility.maxTriangles,
        maxTextureSize: compatibility.maxTextureSize,
        supportedFormats: compatibility.supportedFormats
      });

      this.emit('ar_model.loaded', {
        productId,
        userAgent,
        timestamp: new Date()
      });

      return model;
    } catch (error) {
      this.logger.error('Error getting AR model:', error);
      throw error;
    }
  }

  // ================================
  // ANALYTICS AND METRICS
  // ================================

  public async getAnalytics(period: 'day' | 'week' | 'month'): Promise<any> {
    try {
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      const orders = Array.from(this.orders.values())
        .filter(order => order.createdAt >= startDate);

      const revenue = orders.reduce((total, order) => total + order.total, 0);
      const orderCount = orders.length;
      const averageOrderValue = orderCount > 0 ? revenue / orderCount : 0;

      const topProducts = this.getTopProductsByRevenue(orders, 10);
      const customerMetrics = this.getCustomerMetrics();

      return {
        period,
        startDate,
        endDate: now,
        revenue,
        orderCount,
        averageOrderValue,
        topProducts,
        customerMetrics
      };
    } catch (error) {
      this.logger.error('Error getting analytics:', error);
      throw error;
    }
  }

  // ================================
  // PRIVATE HELPER METHODS
  // ================================

  private async recalculateCartTotals(cart: Cart): Promise<void> {
    let subtotal = 0;

    for (const item of cart.items) {
      const product = await this.productService.getProduct(item.productId);
      if (product) {
        subtotal += product.price * item.quantity;
      }
    }

    cart.subtotal = subtotal;
    cart.total = subtotal; // Additional calculations for tax/shipping can be added
  }

  private calculateTax(amount: number, state: string): number {
    const taxRate = this.config.taxRates[state] || 0.08; // Default 8%
    return amount * taxRate;
  }

  private calculateShipping(items: OrderItem[], address: Address): number {
    const baseShipping = this.config.shippingRates[address.country] || 10;
    const itemCount = items.reduce((total, item) => total + item.quantity, 0);
    return baseShipping + (itemCount - 1) * 2; // Additional $2 per extra item
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private generateTrackingNumber(): string {
    return 'AXR' + Math.random().toString(36).substr(2, 12).toUpperCase();
  }

  private getTopProductsByRevenue(orders: Order[], limit: number): any[] {
    const productRevenue = new Map<string, number>();

    orders.forEach(order => {
      order.items.forEach(item => {
        const current = productRevenue.get(item.productId) || 0;
        productRevenue.set(item.productId, current + item.totalPrice);
      });
    });

    return Array.from(productRevenue.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([productId, revenue]) => ({ productId, revenue }));
  }

  private getCustomerMetrics(): any {
    const totalCustomers = this.customers.size;
    const customersWithPurchases = Array.from(this.customers.values())
      .filter(customer => customer.lastPurchase).length;

    return {
      totalCustomers,
      customersWithPurchases,
      conversionRate: totalCustomers > 0 ? customersWithPurchases / totalCustomers : 0
    };
  }

  private setupEventListeners(): void {
    // Listen for inventory updates from ProductService
    this.productService.on('inventory.updated', (data) => {
      this.emit('commerce.inventory_updated', data);
    });

    // Listen for promotion events
    this.promotionService.on('promotion.applied', (data) => {
      this.emit('commerce.promotion_applied', data);
    });

    // Listen for payment events
    this.paymentService.on('payment.completed', (data) => {
      this.emit('commerce.payment_completed', data);
    });
  }

  private initializeSampleData(): void {
    // Create sample customer
    const sampleCustomer: Customer = {
      id: 'customer_001',
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1-555-0123',
      loyaltyTier: 'gold',
      loyaltyPoints: 2500,
      addresses: [{
        name: 'John Doe',
        line1: '123 Main St',
        city: 'Seattle',
        state: 'WA',
        postalCode: '98101',
        country: 'US',
        phone: '+1-555-0123'
      }],
      paymentMethods: [{
        id: 'pm_001',
        type: 'card',
        last4: '4242',
        brand: 'visa',
        expiryMonth: 12,
        expiryYear: 2025,
        isDefault: true
      }],
      preferences: {
        currency: 'USD',
        language: 'en',
        notifications: {
          email: true,
          sms: false,
          push: true
        },
        interests: ['electronics', 'travel', 'fashion']
      },
      createdAt: new Date()
    };

    this.customers.set(sampleCustomer.id, sampleCustomer);

    // Create session mapping
    this.sessions.set('session_001', 'customer_001');

    this.logger.info('Commerce service initialized with sample data');
  }
} 
