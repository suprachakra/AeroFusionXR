import { createLogger } from '@aerofusionxr/shared';
import { PerformanceMonitor } from '@aerofusionxr/shared';
import { SecurityService, PaymentSecurityContext } from '../security/SecurityService';
import { CheckoutService } from './CheckoutService';
import { StripeService } from '../payment/StripeService';
import { DigitalWalletService } from '../payment/DigitalWalletService';
import { LoyaltyRedemptionService } from '../loyalty/LoyaltyRedemptionService';
import { ReceiptService } from '../receipt/ReceiptService';
import { InventoryService } from '../inventory/InventoryService';
import { NotificationService } from '../notification/NotificationService';
import { CacheService } from '../utils/CacheService';
import Stripe from 'stripe';
import { Pool } from 'pg';
import * as Redis from 'redis';
import axios from 'axios';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Core payment interfaces
export interface CheckoutSession {
  sessionID: string;
  userID: string;
  cartItems: CartItem[];
  subtotal: number;
  tax: number;
  loyaltyValue: number;
  amountDue: number;
  currency: string;
  billingAddress: BillingAddress;
  shippingOption: 'in-store pickup' | 'delivery';
  status: 'pending' | 'paid' | 'failed' | 'expired';
  paymentReference?: string;
  createdAt: Date;
  paidAt?: Date;
  updatedAt: Date;
}

export interface CartItem {
  skuID: string;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
}

export interface BillingAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface PaymentMethod {
  type: 'card' | 'digital_wallet' | 'loyalty_miles';
  provider?: 'stripe' | 'apple_pay' | 'google_pay';
  paymentToken?: string;
  paymentData?: string;
  billingDetails?: {
    name: string;
    email: string;
  };
  milesToUse?: number;
}

export interface PaymentResult {
  orderID: string;
  paymentStatus: 'success' | 'failed' | 'requires_action';
  amountPaid: number;
  currency: string;
  paymentReference?: string;
  failureReason?: string;
  requiresAction?: {
    type: '3ds_redirect' | '3ds_challenge';
    redirectURL?: string;
    clientSecret?: string;
  };
}

export interface CreateSessionRequest {
  userID: string;
  cartItems: CartItem[];
  currency: string;
  billingAddress: BillingAddress;
  shippingOption: 'in-store pickup' | 'delivery';
  loyaltyMilesToRedeem?: number;
}

export interface PaymentRequest {
  sessionID: string;
  paymentMethod: PaymentMethod;
}

// Core interfaces and types
export interface PaymentIntent {
  intentID: string;
  userID: string;
  orderID: string;
  amountMinor: number;
  currency: string;
  status: 'initiated' | 'authorized' | 'captured' | 'failed' | 'refunded' | 'pending_review';
  paymentMethod?: string;
  gatewayChargeID?: string;
  riskScore?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Refund {
  refundID: string;
  chargeID: string;
  amountMinor: number;
  status: 'pending' | 'succeeded' | 'failed';
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CurrencyRate {
  currencyCode: string;
  rateToBase: number;
  fetchedAt: Date;
}

export interface CheckoutItem {
  sku: string;
  quantity: number;
  priceMinor?: number;
  isDutyFreeEligible?: boolean;
  taxExemptMinor?: number;
}

export interface CreatePaymentIntentRequest {
  userID: string;
  currency: string;
  items: CheckoutItem[];
  applyRedeemPoints?: boolean;
  idempotencyKey?: string;
}

export interface ConfirmPaymentRequest {
  intentID: string;
  paymentToken?: string;
  paymentMethodType: 'card' | 'apple_pay' | 'google_pay' | 'klarna';
  klarnaSessionID?: string;
  idempotencyKey?: string;
}

export interface CreateRefundRequest {
  chargeID: string;
  amountMinor: number;
  reason?: string;
  idempotencyKey?: string;
}

export interface CreatePaymentMethodRequest {
  userID: string;
  paymentMethodID: string;
  isDefault?: boolean;
}

export interface FraudCheckRequest {
  userID: string;
  amount: { value: number; currency: string };
  paymentMethod: string;
  billingCountry?: string;
  ipAddress?: string;
  deviceFingerprint?: string;
}

export interface FraudCheckResponse {
  riskScore: number;
  decision: 'approve' | 'decline' | 'review';
  reasons?: string[];
}

export interface TaxCalculationRequest {
  sku: string;
  origin: string;
  destination: string;
  userResidency: string;
  priceMinor: number;
}

export interface TaxCalculationResponse {
  taxExemptMinor: number;
  vatRate: number;
  isDutyFree: boolean;
}

export interface WebhookEvent {
  eventID: string;
  gateway: 'stripe' | 'klarna' | 'adyen';
  eventType: string;
  payload: any;
  receivedAt: Date;
}

// Custom error classes
export class PaymentError extends Error {
  constructor(message: string, public code: string, public statusCode: number = 500) {
    super(message);
    this.name = 'PaymentError';
  }
}

export class InsufficientFundsError extends PaymentError {
  constructor() {
    super('Payment declined due to insufficient funds', 'INSUFFICIENT_FUNDS', 402);
  }
}

export class PaymentDeclinedError extends PaymentError {
  constructor(reason: string) {
    super(`Payment declined: ${reason}`, 'PAYMENT_DECLINED', 402);
  }
}

export class HighRiskError extends PaymentError {
  constructor() {
    super('Payment declined due to high risk score', 'HIGH_RISK', 402);
  }
}

export class InvalidPaymentMethodError extends PaymentError {
  constructor(methodID: string) {
    super(`Invalid payment method: ${methodID}`, 'INVALID_PAYMENT_METHOD', 400);
  }
}

export class RefundWindowExpiredError extends PaymentError {
  constructor() {
    super('Refund window has expired', 'REFUND_WINDOW_EXPIRED', 403);
  }
}

export class PaymentIntentNotFoundError extends PaymentError {
  constructor(intentID: string) {
    super(`Payment intent not found: ${intentID}`, 'PAYMENT_INTENT_NOT_FOUND', 404);
  }
}

export class GatewayUnavailableError extends PaymentError {
  constructor() {
    super('Payment gateway is currently unavailable', 'GATEWAY_UNAVAILABLE', 502);
  }
}

export interface PaymentConfig {
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
    cacheTTL: number;
  };
  gateways: {
    stripe: {
      apiKey: string;
      webhookSecret: string;
      publicKey: string;
    };
    klarna: {
      apiKey: string;
      apiSecret: string;
      environment: 'sandbox' | 'production';
    };
    adyen: {
      apiKey: string;
      merchantAccount: string;
      environment: 'test' | 'live';
    };
  };
  fraud: {
    endpoint: string;
    apiKey: string;
    riskThresholdBlock: number;
    riskThresholdReview: number;
    timeoutMs: number;
  };
  taxEngine: {
    endpoint: string;
    apiKey: string;
    timeoutMs: number;
  };
  currencyService: {
    apiUrl: string;
    apiKey: string;
    updateIntervalMs: number;
  };
  business: {
    baseCurrency: string;
    supportedCurrencies: string[];
    serviceFeePercent: number;
    refundWindowDays: number;
    conversionRates: Record<string, number>;
  };
  security: {
    jwtSecret: string;
    encryptionKey: string;
  };
  features: {
    enableFraudCheck: boolean;
    enableBNPL: boolean;
    enableDigitalWallets: boolean;
    enableTaxCalculation: boolean;
    enableOfflineQueue: boolean;
  };
}

export class PaymentService {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private securityService: SecurityService;
  private checkoutService: CheckoutService;
  private stripeService: StripeService;
  private digitalWalletService: DigitalWalletService;
  private loyaltyRedemptionService: LoyaltyRedemptionService;
  private receiptService: ReceiptService;
  private inventoryService: InventoryService;
  private notificationService: NotificationService;
  private cacheService: CacheService;
  private dbPool: Pool;
  private redisClient: Redis.RedisClientType;
  private config: PaymentConfig;

  // Configuration
  private readonly DEFAULT_CURRENCY = 'SGD';
  private readonly SESSION_TTL_SECONDS = 3600; // 1 hour
  private readonly MAX_CART_ITEMS = 10;
  private readonly DEFAULT_TAX_RATE = 0.07; // 7% GST for Singapore

  constructor(config: PaymentConfig) {
    this.config = config;
    this.logger = new Logger('PaymentService');
    this.performanceMonitor = new PerformanceMonitor('PaymentService');
    this.securityService = new SecurityService();
    this.checkoutService = new CheckoutService();
    this.stripeService = new StripeService();
    this.digitalWalletService = new DigitalWalletService();
    this.loyaltyRedemptionService = new LoyaltyRedemptionService();
    this.receiptService = new ReceiptService();
    this.inventoryService = new InventoryService();
    this.notificationService = new NotificationService();
    this.cacheService = new CacheService();
    
    // Initialize database pool
    this.dbPool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.username,
      password: config.database.password,
      ssl: config.database.ssl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Initialize Redis client
    this.redisClient = Redis.createClient({
      url: config.redis.url,
    });
  }

  async initialize(): Promise<void> {
    const timer = this.performanceMonitor.startTimer('service_initialization');
    
    try {
      // Connect to Redis
      await this.redisClient.connect();
      this.logger.info('Connected to Redis');

      // Test database connection
      const client = await this.dbPool.connect();
      await client.query('SELECT 1');
      client.release();
      this.logger.info('Connected to PostgreSQL');

      // Initialize database schema if needed
      await this.initializeSchema();

      // Load initial currency rates
      await this.loadCurrencyRates();

      this.logger.info('PaymentService initialized successfully');
      timer.end(true);
    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to initialize PaymentService', { error: error.message });
      throw new PaymentError('Service initialization failed', 'INIT_FAILED', 500);
    }
  }

  /**
   * Create a new checkout session
   */
  async createCheckoutSession(
    request: CreateSessionRequest,
    context: PaymentSecurityContext
  ): Promise<CheckoutSession> {
    const startTime = Date.now();

    try {
      this.logger.info('Creating checkout session', {
        userID: request.userID,
        itemCount: request.cartItems.length,
        currency: request.currency,
        shippingOption: request.shippingOption
      });

      // Validate request
      await this.validateCreateSessionRequest(request, context);

      // Validate inventory availability
      await this.validateInventoryAvailability(request.cartItems);

      // Calculate pricing
      const pricing = await this.calculatePricing(request);

      // Create session
      const session = await this.checkoutService.createSession({
        userID: request.userID,
        cartItems: request.cartItems,
        subtotal: pricing.subtotal,
        tax: pricing.tax,
        loyaltyValue: pricing.loyaltyValue,
        amountDue: pricing.amountDue,
        currency: request.currency || this.DEFAULT_CURRENCY,
        billingAddress: request.billingAddress,
        shippingOption: request.shippingOption
      });

      // Cache session for quick access
      await this.cacheService.set(
        `checkout_session:${session.sessionID}`,
        session,
        this.SESSION_TTL_SECONDS
      );

      // Record metrics
      await this.performanceMonitor.recordMetric('session_created', 1, {
        userID: request.userID,
        currency: request.currency,
        itemCount: request.cartItems.length
      });

      await this.performanceMonitor.recordTiming('session_creation_duration', startTime, {
        userID: request.userID
      });

      this.logger.info('Checkout session created successfully', {
        sessionID: session.sessionID,
        userID: request.userID,
        amountDue: session.amountDue,
        currency: session.currency,
        duration: Date.now() - startTime
      });

      return session;

    } catch (error) {
      this.logger.error('Failed to create checkout session', {
        userID: request.userID,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('session_creation_errors', 1, {
        userID: request.userID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Process payment for a checkout session
   */
  async processPayment(
    request: PaymentRequest,
    context: PaymentSecurityContext
  ): Promise<PaymentResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Processing payment', {
        sessionID: request.sessionID,
        paymentType: request.paymentMethod.type,
        provider: request.paymentMethod.provider
      });

      // Get and validate session
      const session = await this.getCheckoutSession(request.sessionID);
      if (!session) {
        throw new InvalidSessionError(request.sessionID);
      }

      if (session.status !== 'pending') {
        throw new PaymentError(`Session status is ${session.status}, expected pending`, 'SESSION_STATUS_INVALID', request.sessionID);
      }

      // Validate session not expired
      const sessionAge = Date.now() - session.createdAt.getTime();
      if (sessionAge > this.SESSION_TTL_SECONDS * 1000) {
        throw new InvalidSessionError(request.sessionID);
      }

      // Revalidate inventory
      await this.validateInventoryAvailability(session.cartItems);

      // Process payment based on method
      let paymentResult: PaymentResult;
      
      switch (request.paymentMethod.type) {
        case 'card':
          paymentResult = await this.processCardPayment(session, request.paymentMethod, context);
          break;
        case 'digital_wallet':
          paymentResult = await this.processDigitalWalletPayment(session, request.paymentMethod, context);
          break;
        case 'loyalty_miles':
          paymentResult = await this.processLoyaltyPayment(session, request.paymentMethod, context);
          break;
        default:
          throw new PaymentError('Unsupported payment method', 'PAYMENT_METHOD_UNSUPPORTED', request.sessionID);
      }

      // If payment successful, complete the order
      if (paymentResult.paymentStatus === 'success') {
        await this.completeOrder(session, paymentResult);
      }

      // Update session status
      await this.checkoutService.updateSessionStatus(
        request.sessionID,
        paymentResult.paymentStatus === 'success' ? 'paid' : 'failed',
        paymentResult.paymentReference
      );

      // Record metrics
      await this.performanceMonitor.recordMetric('payment_processed', 1, {
        sessionID: request.sessionID,
        paymentType: request.paymentMethod.type,
        status: paymentResult.paymentStatus
      });

      await this.performanceMonitor.recordTiming('payment_processing_duration', startTime, {
        sessionID: request.sessionID,
        paymentType: request.paymentMethod.type
      });

      this.logger.info('Payment processed successfully', {
        sessionID: request.sessionID,
        orderID: paymentResult.orderID,
        paymentStatus: paymentResult.paymentStatus,
        amountPaid: paymentResult.amountPaid,
        duration: Date.now() - startTime
      });

      return paymentResult;

    } catch (error) {
      this.logger.error('Failed to process payment', {
        sessionID: request.sessionID,
        paymentType: request.paymentMethod.type,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('payment_errors', 1, {
        sessionID: request.sessionID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get checkout session details
   */
  async getCheckoutSession(sessionID: string): Promise<CheckoutSession | null> {
    try {
      // Try cache first
      const cachedSession = await this.cacheService.get<CheckoutSession>(`checkout_session:${sessionID}`);
      if (cachedSession) {
        return cachedSession;
      }

      // Fallback to database
      const session = await this.checkoutService.getSession(sessionID);
      if (session) {
        // Cache for future requests
        await this.cacheService.set(
          `checkout_session:${sessionID}`,
          session,
          this.SESSION_TTL_SECONDS
        );
      }

      return session;
    } catch (error) {
      this.logger.error('Failed to get checkout session', {
        sessionID,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Generate receipt for completed order
   */
  async generateReceipt(sessionID: string): Promise<{ receiptURL: string }> {
    try {
      this.logger.info('Generating receipt', { sessionID });

      const session = await this.getCheckoutSession(sessionID);
      if (!session || session.status !== 'paid') {
        throw new PaymentError('Session not found or not paid', 'SESSION_NOT_PAID', sessionID);
      }

      const receiptURL = await this.receiptService.generateReceipt(session);

      this.logger.info('Receipt generated successfully', {
        sessionID,
        receiptURL
      });

      return { receiptURL };
    } catch (error) {
      this.logger.error('Failed to generate receipt', {
        sessionID,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async validateCreateSessionRequest(
    request: CreateSessionRequest,
    context: PaymentSecurityContext
  ): Promise<void> {
    // Security validation
    await this.securityService.validatePaymentRequest(request.userID, 'checkout.write', context);

    // Validate cart items
    if (!request.cartItems || request.cartItems.length === 0) {
      throw new PaymentError('Cart is empty', 'CART_EMPTY');
    }

    if (request.cartItems.length > this.MAX_CART_ITEMS) {
      throw new PaymentError(`Cart has too many items (max ${this.MAX_CART_ITEMS})`, 'CART_TOO_LARGE');
    }

    // Validate currency
    const supportedCurrencies = ['SGD', 'USD', 'AED', 'EUR'];
    if (request.currency && !supportedCurrencies.includes(request.currency)) {
      throw new PaymentError(`Unsupported currency: ${request.currency}`, 'CURRENCY_UNSUPPORTED');
    }

    // Validate billing address
    if (!request.billingAddress || !request.billingAddress.line1 || !request.billingAddress.postalCode) {
      throw new PaymentError('Valid billing address required', 'BILLING_ADDRESS_INVALID');
    }
  }

  private async validateInventoryAvailability(cartItems: CartItem[]): Promise<void> {
    for (const item of cartItems) {
      const available = await this.inventoryService.checkAvailability(item.skuID, item.quantity);
      if (!available) {
        throw new InsufficientInventoryError('', item.skuID);
      }
    }
  }

  private async calculatePricing(request: CreateSessionRequest): Promise<{
    subtotal: number;
    tax: number;
    loyaltyValue: number;
    amountDue: number;
  }> {
    // Calculate subtotal from cart items
    let subtotal = 0;
    for (const item of request.cartItems) {
      const unitPrice = await this.inventoryService.getItemPrice(item.skuID);
      subtotal += unitPrice * item.quantity;
    }

    // Calculate tax
    const tax = Math.round(subtotal * this.DEFAULT_TAX_RATE * 100) / 100;

    // Calculate loyalty value if redemption requested
    let loyaltyValue = 0;
    if (request.loyaltyMilesToRedeem && request.loyaltyMilesToRedeem > 0) {
      loyaltyValue = await this.loyaltyRedemptionService.calculateRedemptionValue(
        request.userID,
        request.loyaltyMilesToRedeem
      );
    }

    // Calculate final amount due
    const amountDue = Math.max(0, subtotal + tax - loyaltyValue);

    return {
      subtotal,
      tax,
      loyaltyValue,
      amountDue
    };
  }

  private async processCardPayment(
    session: CheckoutSession,
    paymentMethod: PaymentMethod,
    context: PaymentSecurityContext
  ): Promise<PaymentResult> {
    try {
      const stripeResult = await this.stripeService.createPaymentIntent({
        amount: Math.round(session.amountDue * 100), // Convert to cents
        currency: session.currency.toLowerCase(),
        paymentMethodToken: paymentMethod.paymentToken!,
        metadata: {
          sessionID: session.sessionID,
          userID: session.userID
        },
        billingDetails: paymentMethod.billingDetails
      });

      if (stripeResult.status === 'succeeded') {
        return {
          orderID: await this.generateOrderID(),
          paymentStatus: 'success',
          amountPaid: session.amountDue,
          currency: session.currency,
          paymentReference: stripeResult.id
        };
      } else if (stripeResult.status === 'requires_action') {
        return {
          orderID: '',
          paymentStatus: 'requires_action',
          amountPaid: 0,
          currency: session.currency,
          paymentReference: stripeResult.id,
          requiresAction: {
            type: '3ds_redirect',
            clientSecret: stripeResult.client_secret
          }
        };
      } else {
        throw new PaymentDeclinedError(session.sessionID, stripeResult.last_payment_error?.message || 'Payment failed');
      }
    } catch (error) {
      this.logger.error('Card payment failed', {
        sessionID: session.sessionID,
        error: error.message
      });
      throw new PaymentDeclinedError(session.sessionID, error.message);
    }
  }

  private async processDigitalWalletPayment(
    session: CheckoutSession,
    paymentMethod: PaymentMethod,
    context: PaymentSecurityContext
  ): Promise<PaymentResult> {
    try {
      const walletResult = await this.digitalWalletService.processPayment({
        provider: paymentMethod.provider!,
        paymentData: paymentMethod.paymentData!,
        amount: session.amountDue,
        currency: session.currency,
        sessionID: session.sessionID
      });

      return {
        orderID: await this.generateOrderID(),
        paymentStatus: 'success',
        amountPaid: session.amountDue,
        currency: session.currency,
        paymentReference: walletResult.transactionID
      };
    } catch (error) {
      this.logger.error('Digital wallet payment failed', {
        sessionID: session.sessionID,
        provider: paymentMethod.provider,
        error: error.message
      });
      throw new PaymentDeclinedError(session.sessionID, error.message);
    }
  }

  private async processLoyaltyPayment(
    session: CheckoutSession,
    paymentMethod: PaymentMethod,
    context: PaymentSecurityContext
  ): Promise<PaymentResult> {
    try {
      const redemptionResult = await this.loyaltyRedemptionService.redeemMiles(
        session.userID,
        paymentMethod.milesToUse!,
        session.sessionID
      );

      return {
        orderID: await this.generateOrderID(),
        paymentStatus: 'success',
        amountPaid: 0, // Paid with miles
        currency: session.currency,
        paymentReference: redemptionResult.transactionID
      };
    } catch (error) {
      this.logger.error('Loyalty payment failed', {
        sessionID: session.sessionID,
        milesToUse: paymentMethod.milesToUse,
        error: error.message
      });
      throw new InsufficientLoyaltyMilesError(session.sessionID, paymentMethod.milesToUse!, 0);
    }
  }

  private async completeOrder(session: CheckoutSession, paymentResult: PaymentResult): Promise<void> {
    try {
      // Create order record
      await this.checkoutService.createOrder({
        orderID: paymentResult.orderID,
        sessionID: session.sessionID,
        userID: session.userID,
        items: session.cartItems,
        subtotal: session.subtotal,
        tax: session.tax,
        loyaltyValue: session.loyaltyValue,
        totalPaid: paymentResult.amountPaid,
        currency: session.currency,
        paymentReference: paymentResult.paymentReference!,
        billingAddress: session.billingAddress,
        shippingOption: session.shippingOption
      });

      // Update inventory
      await this.inventoryService.reserveItems(session.cartItems);

      // Send notifications
      await this.notificationService.sendPaymentConfirmation(session.userID, paymentResult.orderID);

      // Generate receipt asynchronously
      this.receiptService.generateReceipt(session).catch(error => {
        this.logger.error('Failed to generate receipt asynchronously', {
          sessionID: session.sessionID,
          orderID: paymentResult.orderID,
          error: error.message
        });
      });

    } catch (error) {
      this.logger.error('Failed to complete order', {
        sessionID: session.sessionID,
        orderID: paymentResult.orderID,
        error: error.message
      });
      throw error;
    }
  }

  private async generateOrderID(): Promise<string> {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD${timestamp.slice(-8)}${random}`;
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    dependencies: { [key: string]: boolean };
    metrics: any;
  }> {
    const stripeHealth = await this.stripeService.getHealth();
    const loyaltyHealth = await this.loyaltyRedemptionService.getHealth();
    const inventoryHealth = await this.inventoryService.getHealth();
    const cacheHealth = await this.cacheService.getHealth();

    const healthyServices = [
      stripeHealth.available,
      loyaltyHealth.available,
      inventoryHealth.available,
      cacheHealth.available
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
        stripe: stripeHealth.available,
        loyalty: loyaltyHealth.available,
        inventory: inventoryHealth.available,
        cache: cacheHealth.available
      },
      metrics: {
        avgPaymentTime: this.performanceMonitor.getMetricStats('payment_processing_duration')?.avg || 0,
        successRate: this.calculateSuccessRate(),
        totalSessions: this.performanceMonitor.getMetricStats('session_created')?.count || 0,
        totalPayments: this.performanceMonitor.getMetricStats('payment_processed')?.count || 0
      }
    };
  }

  private calculateSuccessRate(): number {
    const successCount = this.performanceMonitor.getMetricStats('payment_processed')?.count || 0;
    const errorCount = this.performanceMonitor.getMetricStats('payment_errors')?.count || 0;
    const total = successCount + errorCount;
    return total > 0 ? (successCount / total) * 100 : 0;
  }

  // Payment Intent Management
  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<{
    intentID: string;
    amountMinor: number;
    currency: string;
    merchantPublicKey: string;
    clientSecret: string;
  }> {
    const timer = this.performanceMonitor.startTimer('create_payment_intent');
    const correlationId = crypto.randomUUID();
    this.logger.setCorrelationId(correlationId);

    try {
      // Check idempotency
      if (request.idempotencyKey) {
        const cached = await this.checkIdempotency(request.idempotencyKey);
        if (cached) {
          timer.end(true);
          return cached;
        }
      }

      // Validate user exists
      await this.validateUser(request.userID);

      // Validate and calculate item totals
      const { subtotalMinor, taxExemptMinor } = await this.calculateOrderTotal(request.items, request.userID);

      // Apply service fee
      const serviceFeeMinor = Math.floor(subtotalMinor * this.config.business.serviceFeePercent / 100);
      const totalMinor = subtotalMinor - taxExemptMinor + serviceFeeMinor;

      // Convert to target currency
      const convertedMinor = await this.convertCurrency(totalMinor, this.config.business.baseCurrency, request.currency);

      // Generate unique intent ID
      const intentID = `pi_${crypto.randomBytes(16).toString('hex')}`;
      const orderID = `ord_${crypto.randomBytes(12).toString('hex')}`;

      // Create payment intent in database
      const query = `
        INSERT INTO payment_intents (intentID, userID, orderID, amountMinor, currency, status, createdAt, updatedAt)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      `;
      await this.dbPool.query(query, [intentID, request.userID, orderID, convertedMinor, request.currency, 'initiated']);

      // Create payment intent with gateway (Stripe as primary)
      const gatewayResponse = await this.createGatewayPaymentIntent(intentID, convertedMinor, request.currency, {
        userID: request.userID,
        orderID: orderID
      });

      const response = {
        intentID,
        amountMinor: convertedMinor,
        currency: request.currency,
        merchantPublicKey: this.config.gateways.stripe.publicKey,
        clientSecret: gatewayResponse.clientSecret
      };

      // Cache response for idempotency
      if (request.idempotencyKey) {
        await this.cacheIdempotency(request.idempotencyKey, response);
      }

      this.logger.info('Payment intent created', { intentID, userID: request.userID, amountMinor: convertedMinor, currency: request.currency });
      timer.end(true);
      return response;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to create payment intent', { error: error.message, userID: request.userID });
      throw error;
    }
  }

  async confirmPayment(request: ConfirmPaymentRequest): Promise<{
    chargeID: string;
    status: string;
    receiptURL?: string;
  }> {
    const timer = this.performanceMonitor.startTimer('confirm_payment');
    const correlationId = crypto.randomUUID();
    this.logger.setCorrelationId(correlationId);

    try {
      // Check idempotency
      if (request.idempotencyKey) {
        const cached = await this.checkIdempotency(request.idempotencyKey);
        if (cached) {
          timer.end(true);
          return cached;
        }
      }

      // Validate payment intent exists and is in correct state
      const intent = await this.getPaymentIntent(request.intentID);
      if (!intent) {
        throw new PaymentIntentNotFoundError(request.intentID);
      }

      if (intent.status !== 'initiated') {
        throw new PaymentError('Payment intent already processed', 'INTENT_ALREADY_PROCESSED', 409);
      }

      // Perform fraud check if enabled
      if (this.config.features.enableFraudCheck) {
        const fraudResult = await this.performFraudCheck(intent, request);
        
        if (fraudResult.decision === 'decline') {
          await this.updatePaymentIntentStatus(request.intentID, 'failed');
          throw new HighRiskError();
        }
        
        if (fraudResult.decision === 'review') {
          await this.updatePaymentIntentStatus(request.intentID, 'pending_review');
          await this.updatePaymentIntentRiskScore(request.intentID, fraudResult.riskScore);
          // TODO: Trigger manual review workflow
          this.logger.warn('Payment flagged for manual review', { intentID: request.intentID, riskScore: fraudResult.riskScore });
        }
      }

      // Process payment based on method type
      let gatewayResponse: any;
      
      switch (request.paymentMethodType) {
        case 'card':
        case 'apple_pay':
        case 'google_pay':
          gatewayResponse = await this.processCardPayment(request.intentID, request.paymentToken);
          break;
        case 'klarna':
          if (!this.config.features.enableBNPL) {
            throw new PaymentError('BNPL payments are not enabled', 'BNPL_DISABLED', 400);
          }
          gatewayResponse = await this.processKlarnaPayment(request.intentID, request.klarnaSessionID);
          break;
        default:
          throw new PaymentError('Unsupported payment method type', 'UNSUPPORTED_PAYMENT_METHOD', 400);
      }

      // Update payment intent with gateway response
      await this.updatePaymentIntentWithGatewayResponse(request.intentID, gatewayResponse);

      const response = {
        chargeID: gatewayResponse.chargeID,
        status: gatewayResponse.status,
        receiptURL: gatewayResponse.receiptURL
      };

      // Cache response for idempotency
      if (request.idempotencyKey) {
        await this.cacheIdempotency(request.idempotencyKey, response);
      }

      // Publish payment event
      await this.publishPaymentEvent('payment_succeeded', {
        intentID: request.intentID,
        userID: intent.userID,
        amountMinor: intent.amountMinor,
        currency: intent.currency,
        paymentMethod: request.paymentMethodType
      });

      this.logger.info('Payment confirmed successfully', { intentID: request.intentID, chargeID: gatewayResponse.chargeID });
      timer.end(true);
      return response;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to confirm payment', { error: error.message, intentID: request.intentID });
      throw error;
    }
  }

  // Payment Method Management
  async addPaymentMethod(request: CreatePaymentMethodRequest): Promise<PaymentMethod> {
    const timer = this.performanceMonitor.startTimer('add_payment_method');

    try {
      // Validate user exists
      await this.validateUser(request.userID);

      // Validate payment method with gateway
      const gatewayMethod = await this.validateGatewayPaymentMethod(request.paymentMethodID);

      // Check method limit (max 5 per user)
      const existingCount = await this.getPaymentMethodCount(request.userID);
      if (existingCount >= 5) {
        throw new PaymentError('Payment method limit reached', 'METHOD_LIMIT_REACHED', 409);
      }

      const methodID = `pm_${crypto.randomBytes(12).toString('hex')}`;

      // If setting as default, update existing defaults
      if (request.isDefault) {
        await this.updateDefaultPaymentMethods(request.userID, false);
      }

      // Insert new payment method
      const query = `
        INSERT INTO payment_methods (methodID, userID, type, gatewayID, cardBrand, last4, expMonth, expYear, isDefault, createdAt)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *
      `;
      
      const result = await this.dbPool.query(query, [
        methodID,
        request.userID,
        gatewayMethod.type,
        request.paymentMethodID,
        gatewayMethod.cardBrand,
        gatewayMethod.last4,
        gatewayMethod.expMonth,
        gatewayMethod.expYear,
        request.isDefault || false
      ]);

      this.logger.info('Payment method added', { methodID, userID: request.userID });
      timer.end(true);
      return result.rows[0];

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to add payment method', { error: error.message, userID: request.userID });
      throw error;
    }
  }

  async getPaymentMethods(userID: string): Promise<PaymentMethod[]> {
    const timer = this.performanceMonitor.startTimer('get_payment_methods');

    try {
      const query = `
        SELECT methodID, userID, type, cardBrand, last4, expMonth, expYear, isDefault, createdAt
        FROM payment_methods 
        WHERE userID = $1 AND deletedAt IS NULL 
        ORDER BY isDefault DESC, createdAt DESC
      `;
      
      const result = await this.dbPool.query(query, [userID]);
      
      timer.end(true);
      return result.rows;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get payment methods', { error: error.message, userID });
      throw error;
    }
  }

  // Refund Management
  async initiateRefund(request: CreateRefundRequest): Promise<{
    refundID: string;
    status: string;
  }> {
    const timer = this.performanceMonitor.startTimer('initiate_refund');

    try {
      // Check idempotency
      if (request.idempotencyKey) {
        const cached = await this.checkIdempotency(request.idempotencyKey);
        if (cached) {
          timer.end(true);
          return cached;
        }
      }

      // Validate charge exists and is refundable
      const intent = await this.getPaymentIntentByChargeID(request.chargeID);
      if (!intent) {
        throw new PaymentError('Charge not found', 'CHARGE_NOT_FOUND', 404);
      }

      if (intent.status !== 'captured' && intent.status !== 'succeeded') {
        throw new PaymentError('Charge is not in refundable state', 'CHARGE_NOT_REFUNDABLE', 400);
      }

      // Check refund window
      const daysSinceCharge = Math.floor((Date.now() - intent.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceCharge > this.config.business.refundWindowDays) {
        throw new RefundWindowExpiredError();
      }

      // Validate refund amount
      const totalRefunded = await this.getTotalRefundedAmount(request.chargeID);
      if (totalRefunded + request.amountMinor > intent.amountMinor) {
        throw new PaymentError('Refund amount exceeds original charge', 'REFUND_AMOUNT_EXCEEDS_CHARGE', 400);
      }

      const refundID = `re_${crypto.randomBytes(12).toString('hex')}`;

      // Create refund record
      const insertQuery = `
        INSERT INTO refunds (refundID, chargeID, amountMinor, status, createdAt, updatedAt)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
      `;
      await this.dbPool.query(insertQuery, [refundID, request.chargeID, request.amountMinor, 'pending']);

      // Process refund with gateway
      const gatewayRefund = await this.processGatewayRefund(request.chargeID, request.amountMinor, refundID);

      const response = {
        refundID,
        status: 'pending'
      };

      // Cache response for idempotency
      if (request.idempotencyKey) {
        await this.cacheIdempotency(request.idempotencyKey, response);
      }

      this.logger.info('Refund initiated', { refundID, chargeID: request.chargeID, amountMinor: request.amountMinor });
      timer.end(true);
      return response;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to initiate refund', { error: error.message, chargeID: request.chargeID });
      throw error;
    }
  }

  // Currency Management
  async getCurrencyRates(): Promise<{
    baseCurrency: string;
    rates: Record<string, number>;
    fetchedAt: string;
  }> {
    const timer = this.performanceMonitor.startTimer('get_currency_rates');

    try {
      // Try cache first
      const cachedRates = await this.redisClient.hGetAll('currency_rates');
      if (Object.keys(cachedRates).length > 0) {
        const fetchedAt = await this.redisClient.get('currency_rates_fetched_at');
        timer.end(true);
        return {
          baseCurrency: this.config.business.baseCurrency,
          rates: Object.fromEntries(Object.entries(cachedRates).map(([k, v]) => [k, parseFloat(v)])),
          fetchedAt: fetchedAt || new Date().toISOString()
        };
      }

      // Fallback to database
      const query = 'SELECT currencyCode, rateToBase, fetchedAt FROM currency_rates';
      const result = await this.dbPool.query(query);
      
      const rates: Record<string, number> = {};
      let fetchedAt = new Date().toISOString();

      for (const row of result.rows) {
        rates[row.currencycode] = row.ratetobase;
        fetchedAt = row.fetchedat.toISOString();
      }

      timer.end(true);
      return {
        baseCurrency: this.config.business.baseCurrency,
        rates,
        fetchedAt
      };

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get currency rates', { error: error.message });
      throw error;
    }
  }

  // Webhook Processing
  async processWebhook(gateway: string, signature: string, payload: any): Promise<void> {
    const timer = this.performanceMonitor.startTimer('process_webhook');

    try {
      // Validate webhook signature
      await this.validateWebhookSignature(gateway, signature, payload);

      // Store webhook event
      const eventID = `evt_${crypto.randomBytes(12).toString('hex')}`;
      const insertQuery = `
        INSERT INTO webhook_events (eventID, gateway, eventType, payload, receivedAt)
        VALUES ($1, $2, $3, $4, NOW())
      `;
      await this.dbPool.query(insertQuery, [eventID, gateway, payload.type, JSON.stringify(payload)]);

      // Process webhook based on type
      switch (payload.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(payload);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(payload);
          break;
        case 'charge.refunded':
          await this.handleRefundSucceeded(payload);
          break;
        default:
          this.logger.warn('Unhandled webhook event type', { type: payload.type, eventID });
      }

      this.logger.info('Webhook processed successfully', { gateway, eventType: payload.type, eventID });
      timer.end(true);

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to process webhook', { error: error.message, gateway });
      throw error;
    }
  }

  // Private helper methods
  private async initializeSchema(): Promise<void> {
    const schemas = [
      `CREATE TABLE IF NOT EXISTS payment_intents (
        intentID VARCHAR(64) PRIMARY KEY,
        userID VARCHAR(64) NOT NULL,
        orderID VARCHAR(64) NOT NULL,
        amountMinor INT NOT NULL,
        currency VARCHAR(8) NOT NULL,
        status VARCHAR(16) NOT NULL,
        paymentMethod VARCHAR(32),
        gatewayChargeID VARCHAR(128),
        riskScore FLOAT,
        createdAt TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS payment_methods (
        methodID VARCHAR(64) PRIMARY KEY,
        userID VARCHAR(64) NOT NULL,
        type VARCHAR(32) NOT NULL,
        gatewayID VARCHAR(128) NOT NULL,
        cardBrand VARCHAR(32),
        last4 CHAR(4),
        expMonth INT,
        expYear INT,
        isDefault BOOLEAN NOT NULL DEFAULT FALSE,
        createdAt TIMESTAMP NOT NULL,
        deletedAt TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS refunds (
        refundID VARCHAR(64) PRIMARY KEY,
        chargeID VARCHAR(64) NOT NULL,
        amountMinor INT NOT NULL,
        status VARCHAR(16) NOT NULL,
        failureReason TEXT,
        createdAt TIMESTAMP NOT NULL,
        updatedAt TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS currency_rates (
        currencyCode VARCHAR(8) PRIMARY KEY,
        rateToBase FLOAT NOT NULL,
        fetchedAt TIMESTAMP NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS webhook_events (
        eventID VARCHAR(128) PRIMARY KEY,
        gateway VARCHAR(32) NOT NULL,
        eventType VARCHAR(64) NOT NULL,
        payload JSONB NOT NULL,
        receivedAt TIMESTAMP NOT NULL
      )`
    ];

    for (const schema of schemas) {
      await this.dbPool.query(schema);
    }

    this.logger.info('Database schema initialized');
  }

  private async validateUser(userID: string): Promise<void> {
    // Placeholder - integrate with user service
    if (!userID || userID.length === 0) {
      throw new PaymentError('Invalid user ID', 'INVALID_USER_ID', 400);
    }
  }

  private async calculateOrderTotal(items: CheckoutItem[], userID: string): Promise<{
    subtotalMinor: number;
    taxExemptMinor: number;
  }> {
    let subtotalMinor = 0;
    let taxExemptMinor = 0;

    for (const item of items) {
      // Fetch item price from catalog service
      const itemPrice = await this.getItemPrice(item.sku);
      subtotalMinor += itemPrice * item.quantity;

      // Calculate tax exemption if duty-free eligible
      if (item.isDutyFreeEligible && this.config.features.enableTaxCalculation) {
        const taxCalc = await this.calculateTaxExemption(item.sku, userID);
        taxExemptMinor += taxCalc.taxExemptMinor * item.quantity;
      }
    }

    return { subtotalMinor, taxExemptMinor };
  }

  private async getItemPrice(sku: string): Promise<number> {
    // Placeholder - integrate with catalog service
    return 1000; // Default price in minor units
  }

  private async calculateTaxExemption(sku: string, userID: string): Promise<TaxCalculationResponse> {
    if (!this.config.features.enableTaxCalculation) {
      return { taxExemptMinor: 0, vatRate: 0, isDutyFree: false };
    }

    try {
      const response = await axios.post(this.config.taxEngine.endpoint, {
        sku,
        userID
      }, {
        headers: { 'Authorization': `Bearer ${this.config.taxEngine.apiKey}` },
        timeout: this.config.taxEngine.timeoutMs
      });

      return response.data;
    } catch (error) {
      this.logger.error('Tax calculation failed', { error: error.message, sku });
      return { taxExemptMinor: 0, vatRate: 0, isDutyFree: false };
    }
  }

  private async convertCurrency(amountMinor: number, fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amountMinor;
    }

    const rates = await this.getCurrencyRates();
    const rate = rates.rates[toCurrency];
    
    if (!rate) {
      throw new PaymentError(`Unsupported currency: ${toCurrency}`, 'UNSUPPORTED_CURRENCY', 400);
    }

    return Math.round(amountMinor * rate);
  }

  private async createGatewayPaymentIntent(intentID: string, amountMinor: number, currency: string, metadata: any): Promise<{ clientSecret: string }> {
    // Stripe integration
    try {
      const stripeResponse = await axios.post('https://api.stripe.com/v1/payment_intents', {
        amount: amountMinor,
        currency: currency.toLowerCase(),
        metadata,
        automatic_payment_methods: { enabled: true }
      }, {
        headers: {
          'Authorization': `Bearer ${this.config.gateways.stripe.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return { clientSecret: stripeResponse.data.client_secret };
    } catch (error) {
      this.logger.error('Stripe payment intent creation failed', { error: error.message });
      throw new GatewayUnavailableError();
    }
  }

  private async performFraudCheck(intent: PaymentIntent, request: ConfirmPaymentRequest): Promise<FraudCheckResponse> {
    try {
      const fraudRequest: FraudCheckRequest = {
        userID: intent.userID,
        amount: { value: intent.amountMinor / 100, currency: intent.currency },
        paymentMethod: request.paymentMethodType
      };

      const response = await axios.post(this.config.fraud.endpoint, fraudRequest, {
        headers: { 'Authorization': `Bearer ${this.config.fraud.apiKey}` },
        timeout: this.config.fraud.timeoutMs
      });

      const riskScore = response.data.riskScore;
      let decision: 'approve' | 'decline' | 'review' = 'approve';

      if (riskScore >= this.config.fraud.riskThresholdBlock) {
        decision = 'decline';
      } else if (riskScore >= this.config.fraud.riskThresholdReview) {
        decision = 'review';
      }

      return {
        riskScore,
        decision,
        reasons: response.data.reasons
      };
    } catch (error) {
      this.logger.error('Fraud check failed', { error: error.message });
      // Default to low risk on service failure
      return { riskScore: 0.1, decision: 'approve' };
    }
  }

  private async processCardPayment(intentID: string, paymentToken: string): Promise<any> {
    try {
      const response = await axios.post(`https://api.stripe.com/v1/payment_intents/${intentID}/confirm`, {
        payment_method: paymentToken
      }, {
        headers: {
          'Authorization': `Bearer ${this.config.gateways.stripe.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return {
        chargeID: response.data.latest_charge,
        status: response.data.status,
        receiptURL: response.data.receipt_url
      };
    } catch (error) {
      this.logger.error('Card payment processing failed', { error: error.message });
      throw new PaymentDeclinedError(error.response?.data?.error?.message || 'Payment processing failed');
    }
  }

  private async processKlarnaPayment(intentID: string, klarnaSessionID: string): Promise<any> {
    // Klarna integration placeholder
    try {
      // Klarna-specific payment processing
      return {
        chargeID: `klarna_${crypto.randomBytes(8).toString('hex')}`,
        status: 'authorized',
        receiptURL: null
      };
    } catch (error) {
      this.logger.error('Klarna payment processing failed', { error: error.message });
      throw new PaymentDeclinedError('BNPL payment failed');
    }
  }

  private async loadCurrencyRates(): Promise<void> {
    try {
      const response = await axios.get(this.config.currencyService.apiUrl, {
        params: { app_id: this.config.currencyService.apiKey }
      });

      const rates = response.data.rates;
      const fetchedAt = new Date().toISOString();

      // Update database
      for (const [currency, rate] of Object.entries(rates)) {
        await this.dbPool.query(
          'INSERT INTO currency_rates (currencyCode, rateToBase, fetchedAt) VALUES ($1, $2, $3) ON CONFLICT (currencyCode) DO UPDATE SET rateToBase = $2, fetchedAt = $3',
          [currency, rate, fetchedAt]
        );
      }

      // Update cache
      await this.redisClient.hSet('currency_rates', rates);
      await this.redisClient.set('currency_rates_fetched_at', fetchedAt);
      await this.redisClient.expire('currency_rates', this.config.redis.cacheTTL);

      this.logger.info('Currency rates updated', { rateCount: Object.keys(rates).length });
    } catch (error) {
      this.logger.error('Failed to load currency rates', { error: error.message });
    }
  }

  private async checkIdempotency(key: string): Promise<any> {
    try {
      const cached = await this.redisClient.get(`idem:${key}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.error('Idempotency check failed', { error: error.message });
      return null;
    }
  }

  private async cacheIdempotency(key: string, response: any): Promise<void> {
    try {
      await this.redisClient.setEx(`idem:${key}`, 86400, JSON.stringify(response));
    } catch (error) {
      this.logger.error('Idempotency caching failed', { error: error.message });
    }
  }

  private async getPaymentIntent(intentID: string): Promise<PaymentIntent | null> {
    const query = 'SELECT * FROM payment_intents WHERE intentID = $1';
    const result = await this.dbPool.query(query, [intentID]);
    return result.rows[0] || null;
  }

  private async updatePaymentIntentStatus(intentID: string, status: string): Promise<void> {
    const query = 'UPDATE payment_intents SET status = $1, updatedAt = NOW() WHERE intentID = $2';
    await this.dbPool.query(query, [status, intentID]);
  }

  private async updatePaymentIntentRiskScore(intentID: string, riskScore: number): Promise<void> {
    const query = 'UPDATE payment_intents SET riskScore = $1, updatedAt = NOW() WHERE intentID = $2';
    await this.dbPool.query(query, [riskScore, intentID]);
  }

  private async updatePaymentIntentWithGatewayResponse(intentID: string, gatewayResponse: any): Promise<void> {
    const query = `
      UPDATE payment_intents 
      SET status = $1, gatewayChargeID = $2, updatedAt = NOW() 
      WHERE intentID = $3
    `;
    await this.dbPool.query(query, [gatewayResponse.status, gatewayResponse.chargeID, intentID]);
  }

  private async publishPaymentEvent(eventType: string, data: any): Promise<void> {
    // Kafka integration placeholder
    this.logger.info('Publishing payment event', { eventType, data });
  }

  private async validateGatewayPaymentMethod(paymentMethodID: string): Promise<any> {
    // Gateway validation placeholder
    return {
      type: 'card',
      cardBrand: 'Visa',
      last4: '4242',
      expMonth: 12,
      expYear: 2027
    };
  }

  private async getPaymentMethodCount(userID: string): Promise<number> {
    const query = 'SELECT COUNT(*) FROM payment_methods WHERE userID = $1 AND deletedAt IS NULL';
    const result = await this.dbPool.query(query, [userID]);
    return parseInt(result.rows[0].count);
  }

  private async updateDefaultPaymentMethods(userID: string, isDefault: boolean): Promise<void> {
    const query = 'UPDATE payment_methods SET isDefault = $1 WHERE userID = $2';
    await this.dbPool.query(query, [isDefault, userID]);
  }

  private async getPaymentIntentByChargeID(chargeID: string): Promise<PaymentIntent | null> {
    const query = 'SELECT * FROM payment_intents WHERE gatewayChargeID = $1';
    const result = await this.dbPool.query(query, [chargeID]);
    return result.rows[0] || null;
  }

  private async getTotalRefundedAmount(chargeID: string): Promise<number> {
    const query = 'SELECT COALESCE(SUM(amountMinor), 0) as total FROM refunds WHERE chargeID = $1 AND status = $2';
    const result = await this.dbPool.query(query, [chargeID, 'succeeded']);
    return parseInt(result.rows[0].total);
  }

  private async processGatewayRefund(chargeID: string, amountMinor: number, refundID: string): Promise<any> {
    // Gateway refund processing placeholder
    return { refundID, status: 'pending' };
  }

  private async validateWebhookSignature(gateway: string, signature: string, payload: any): Promise<void> {
    // Webhook signature validation placeholder
    if (!signature) {
      throw new PaymentError('Invalid webhook signature', 'INVALID_WEBHOOK_SIGNATURE', 400);
    }
  }

  private async handlePaymentSucceeded(payload: any): Promise<void> {
    // Handle payment succeeded webhook
    this.logger.info('Payment succeeded webhook received', { paymentIntentID: payload.data.object.id });
  }

  private async handlePaymentFailed(payload: any): Promise<void> {
    // Handle payment failed webhook
    this.logger.info('Payment failed webhook received', { paymentIntentID: payload.data.object.id });
  }

  private async handleRefundSucceeded(payload: any): Promise<void> {
    // Handle refund succeeded webhook
    this.logger.info('Refund succeeded webhook received', { refundID: payload.data.object.id });
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down PaymentService');
    
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    
    if (this.dbPool) {
      await this.dbPool.end();
    }
    
    this.performanceMonitor.destroy();
    this.logger.info('PaymentService shutdown complete');
  }
} 
