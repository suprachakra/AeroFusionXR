import { createLogger, createPerformanceMonitor, PerformanceMonitor } from '@aerofusionxr/shared';

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
  shippingOption: 'in-store pickup' | 'delivery' | 'digital';
  status: 'pending' | 'paid' | 'failed' | 'expired';
  paymentReference?: string;
  createdAt: Date;
  paidAt?: Date;
  updatedAt: Date;
}

export interface CartItem {
  skuID: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  category: 'duty_free' | 'food_beverage' | 'retail' | 'service';
  taxable: boolean;
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
  type: 'card' | 'digital_wallet' | 'loyalty_miles' | 'bnpl';
  provider?: 'stripe' | 'apple_pay' | 'google_pay' | 'klarna' | 'afterpay';
  paymentToken?: string;
  paymentData?: string;
  billingDetails?: {
    name: string;
    email: string;
  };
  milesToUse?: number;
  cardDetails?: {
    last4: string;
    brand: string;
    expiryMonth: number;
    expiryYear: number;
  };
}

export interface PaymentResult {
  orderID: string;
  paymentStatus: 'success' | 'failed' | 'requires_action' | 'pending';
  amountPaid: number;
  currency: string;
  paymentReference?: string;
  failureReason?: string;
  requiresAction?: {
    type: '3ds_redirect' | '3ds_challenge' | 'verification';
    redirectURL?: string;
    clientSecret?: string;
  };
  receiptURL?: string;
}

export interface CreateSessionRequest {
  userID: string;
  cartItems: CartItem[];
  currency: string;
  billingAddress: BillingAddress;
  shippingOption: 'in-store pickup' | 'delivery' | 'digital';
  loyaltyMilesToRedeem?: number;
  promoCode?: string;
}

export interface PaymentRequest {
  sessionID: string;
  paymentMethod: PaymentMethod;
  savePaymentMethod?: boolean;
}

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

export interface RefundRequest {
  orderID: string;
  amountMinor: number;
  reason: 'customer_request' | 'fraud' | 'duplicate' | 'other';
  description?: string;
}

export interface RefundResult {
  refundID: string;
  status: 'pending' | 'succeeded' | 'failed';
  amountRefunded: number;
  currency: string;
  failureReason?: string;
  estimatedArrival?: Date;
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

export interface TaxCalculation {
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  dutyFreeAmount: number;
  totalAmount: number;
}

export interface PaymentAnalytics {
  totalTransactions: number;
  totalRevenue: number;
  averageOrderValue: number;
  successRate: number;
  topPaymentMethods: Array<{
    method: string;
    count: number;
    percentage: number;
  }>;
  fraudRate: number;
  refundRate: number;
}

/**
 * Payment Feature Module
 * Consolidated from payment-checkout service into commerce
 * 
 * Features:
 * - Secure payment processing with multiple gateways
 * - Checkout session management and cart handling
 * - Multi-currency support with real-time conversion
 * - Digital wallet integration (Apple Pay, Google Pay)
 * - Buy-now-pay-later (BNPL) options
 * - Loyalty points redemption and earning
 * - Fraud detection and risk assessment
 * - Tax calculation for duty-free and retail items
 * - Refund processing and dispute management
 * - Payment analytics and reporting
 */
export class PaymentFeature {
  private logger = createLogger('commerce.payments');
  private performanceMonitor = createPerformanceMonitor('payments');
  private checkoutSessions: Map<string, CheckoutSession> = new Map();
  private paymentIntents: Map<string, PaymentIntent> = new Map();
  private savedPaymentMethods: Map<string, PaymentMethod[]> = new Map();
  
  // Configuration
  private readonly DEFAULT_CURRENCY = 'SGD';
  private readonly SESSION_TTL_SECONDS = 3600; // 1 hour
  private readonly MAX_CART_ITEMS = 20;
  private readonly DEFAULT_TAX_RATE = 0.07; // 7% GST for Singapore
  private readonly FRAUD_THRESHOLD = 0.75;

  constructor() {
    this.logger.info('Payment Feature initialized');
  }

  /**
   * Create a new checkout session
   * @param request - Checkout session creation request
   */
  async createCheckoutSession(request: CreateSessionRequest): Promise<CheckoutSession> {
    const timer = this.performanceMonitor.startTimer('create_checkout_session');
    
    try {
      this.logger.info('Creating checkout session', {
        userID: request.userID,
        itemCount: request.cartItems.length,
        currency: request.currency
      });

      // Validate request
      await this.validateCreateSessionRequest(request);

      // Calculate pricing
      const pricing = await this.calculatePricing(request);

      // Create session
      const sessionID = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const session: CheckoutSession = {
        sessionID,
        userID: request.userID,
        cartItems: request.cartItems,
        subtotal: pricing.subtotal,
        tax: pricing.tax,
        loyaltyValue: pricing.loyaltyValue,
        amountDue: pricing.amountDue,
        currency: request.currency,
        billingAddress: request.billingAddress,
        shippingOption: request.shippingOption,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store session
      this.checkoutSessions.set(sessionID, session);

      // Set expiration
      setTimeout(() => {
        const existingSession = this.checkoutSessions.get(sessionID);
        if (existingSession && existingSession.status === 'pending') {
          existingSession.status = 'expired';
          existingSession.updatedAt = new Date();
        }
      }, this.SESSION_TTL_SECONDS * 1000);

      this.performanceMonitor.recordMetric('checkout_session_created', 1, {
        userID: request.userID,
        itemCount: request.cartItems.length,
        amountDue: pricing.amountDue
      });

      this.logger.info('Checkout session created successfully', {
        sessionID,
        amountDue: pricing.amountDue,
        currency: request.currency
      });

      timer.end(true);
      return session;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to create checkout session', {
        userID: request.userID,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Process payment for a checkout session
   * @param request - Payment processing request
   */
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    const timer = this.performanceMonitor.startTimer('process_payment');
    
    try {
      this.logger.info('Processing payment', {
        sessionID: request.sessionID,
        paymentType: request.paymentMethod.type,
        provider: request.paymentMethod.provider
      });

      // Get checkout session
      const session = this.checkoutSessions.get(request.sessionID);
      if (!session) {
        throw new Error(`Checkout session not found: ${request.sessionID}`);
      }

      if (session.status !== 'pending') {
        throw new Error(`Invalid session status: ${session.status}`);
      }

      // Perform fraud check
      const fraudCheck = await this.performFraudCheck(session, request.paymentMethod);
      if (fraudCheck.decision === 'decline') {
        throw new Error(`Payment declined due to fraud risk: ${fraudCheck.reasons?.join(', ')}`);
      }

      // Process payment based on method type
      let paymentResult: PaymentResult;
      
      switch (request.paymentMethod.type) {
        case 'card':
          paymentResult = await this.processCardPayment(session, request.paymentMethod);
          break;
        case 'digital_wallet':
          paymentResult = await this.processDigitalWalletPayment(session, request.paymentMethod);
          break;
        case 'loyalty_miles':
          paymentResult = await this.processLoyaltyPayment(session, request.paymentMethod);
          break;
        case 'bnpl':
          paymentResult = await this.processBNPLPayment(session, request.paymentMethod);
          break;
        default:
          throw new Error(`Unsupported payment method: ${request.paymentMethod.type}`);
      }

      // Update session status
      if (paymentResult.paymentStatus === 'success') {
        session.status = 'paid';
        session.paidAt = new Date();
        session.paymentReference = paymentResult.paymentReference;
        
        // Complete order processing
        await this.completeOrder(session, paymentResult);
      } else if (paymentResult.paymentStatus === 'failed') {
        session.status = 'failed';
      }

      session.updatedAt = new Date();

      // Save payment method if requested
      if (request.savePaymentMethod && paymentResult.paymentStatus === 'success') {
        await this.savePaymentMethod(session.userID, request.paymentMethod);
      }

      this.performanceMonitor.recordMetric('payment_processed', 1, {
        paymentType: request.paymentMethod.type,
        status: paymentResult.paymentStatus,
        amount: paymentResult.amountPaid
      });

      this.logger.info('Payment processed', {
        sessionID: request.sessionID,
        orderID: paymentResult.orderID,
        status: paymentResult.paymentStatus,
        amount: paymentResult.amountPaid
      });

      timer.end(true);
      return paymentResult;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to process payment', {
        sessionID: request.sessionID,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get checkout session details
   * @param sessionID - Session identifier
   */
  async getCheckoutSession(sessionID: string): Promise<CheckoutSession | null> {
    const timer = this.performanceMonitor.startTimer('get_checkout_session');
    
    try {
      const session = this.checkoutSessions.get(sessionID);
      
      if (session) {
        this.performanceMonitor.recordMetric('checkout_session_retrieved', 1, {
          status: session.status
        });
      }

      timer.end(true);
      return session || null;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get checkout session', {
        sessionID,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Process refund for an order
   * @param request - Refund request
   */
  async processRefund(request: RefundRequest): Promise<RefundResult> {
    const timer = this.performanceMonitor.startTimer('process_refund');
    
    try {
      this.logger.info('Processing refund', {
        orderID: request.orderID,
        amount: request.amountMinor,
        reason: request.reason
      });

      // Find payment intent by order ID
      const paymentIntent = Array.from(this.paymentIntents.values())
        .find(intent => intent.orderID === request.orderID);

      if (!paymentIntent) {
        throw new Error(`Payment intent not found for order: ${request.orderID}`);
      }

      if (paymentIntent.status !== 'captured') {
        throw new Error(`Cannot refund payment with status: ${paymentIntent.status}`);
      }

      // Generate refund ID
      const refundID = `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Mock refund processing
      const refundResult: RefundResult = {
        refundID,
        status: 'succeeded',
        amountRefunded: request.amountMinor,
        currency: 'SGD',
        estimatedArrival: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days
      };

      // Update payment intent status
      paymentIntent.status = 'refunded';
      paymentIntent.updatedAt = new Date();

      this.performanceMonitor.recordMetric('refund_processed', 1, {
        orderID: request.orderID,
        amount: request.amountMinor,
        reason: request.reason
      });

      this.logger.info('Refund processed successfully', {
        refundID,
        orderID: request.orderID,
        amount: request.amountMinor
      });

      timer.end(true);
      return refundResult;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to process refund', {
        orderID: request.orderID,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get saved payment methods for user
   * @param userID - User identifier
   */
  async getPaymentMethods(userID: string): Promise<PaymentMethod[]> {
    const timer = this.performanceMonitor.startTimer('get_payment_methods');
    
    try {
      const methods = this.savedPaymentMethods.get(userID) || [];
      
      this.performanceMonitor.recordMetric('payment_methods_retrieved', methods.length, {
        userID
      });

      timer.end(true);
      return methods;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get payment methods', {
        userID,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get payment analytics
   * @param startDate - Start date for analytics
   * @param endDate - End date for analytics
   */
  async getPaymentAnalytics(startDate: Date, endDate: Date): Promise<PaymentAnalytics> {
    const timer = this.performanceMonitor.startTimer('get_payment_analytics');
    
    try {
      this.logger.info('Getting payment analytics', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      // Mock analytics data
      const analytics: PaymentAnalytics = {
        totalTransactions: 1250,
        totalRevenue: 156780.50,
        averageOrderValue: 125.42,
        successRate: 94.2,
        topPaymentMethods: [
          { method: 'card', count: 750, percentage: 60.0 },
          { method: 'digital_wallet', count: 375, percentage: 30.0 },
          { method: 'loyalty_miles', count: 100, percentage: 8.0 },
          { method: 'bnpl', count: 25, percentage: 2.0 }
        ],
        fraudRate: 0.8,
        refundRate: 2.1
      };

      this.performanceMonitor.recordMetric('payment_analytics_generated', 1, {
        totalTransactions: analytics.totalTransactions,
        successRate: analytics.successRate
      });

      timer.end(true);
      return analytics;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get payment analytics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Private helper methods

  private async validateCreateSessionRequest(request: CreateSessionRequest): Promise<void> {
    if (!request.userID) {
      throw new Error('User ID is required');
    }

    if (!request.cartItems || request.cartItems.length === 0) {
      throw new Error('Cart items are required');
    }

    if (request.cartItems.length > this.MAX_CART_ITEMS) {
      throw new Error(`Too many cart items. Maximum: ${this.MAX_CART_ITEMS}`);
    }

    if (!request.currency) {
      throw new Error('Currency is required');
    }

    if (!request.billingAddress) {
      throw new Error('Billing address is required');
    }

    // Validate cart items
    for (const item of request.cartItems) {
      if (!item.skuID || item.quantity <= 0) {
        throw new Error('Invalid cart item');
      }
    }
  }

  private async calculatePricing(request: CreateSessionRequest): Promise<{
    subtotal: number;
    tax: number;
    loyaltyValue: number;
    amountDue: number;
  }> {
    let subtotal = 0;

    // Calculate subtotal
    for (const item of request.cartItems) {
      const unitPrice = await this.getItemPrice(item.skuID);
      item.unitPrice = unitPrice;
      item.lineTotal = unitPrice * item.quantity;
      subtotal += item.lineTotal;
    }

    // Calculate tax
    const taxCalculation = await this.calculateTax(request.cartItems, request.billingAddress);
    const tax = taxCalculation.taxAmount;

    // Calculate loyalty redemption value
    const loyaltyValue = request.loyaltyMilesToRedeem ? 
      await this.calculateLoyaltyValue(request.loyaltyMilesToRedeem) : 0;

    // Calculate final amount due
    const amountDue = Math.max(0, subtotal + tax - loyaltyValue);

    return { subtotal, tax, loyaltyValue, amountDue };
  }

  private async getItemPrice(skuID: string): Promise<number> {
    // Mock pricing - in real implementation, this would query product catalog
    const mockPrices: Record<string, number> = {
      'DUTY_FREE_001': 45.90,
      'DUTY_FREE_002': 89.50,
      'FOOD_001': 12.50,
      'FOOD_002': 8.90,
      'RETAIL_001': 25.00,
      'RETAIL_002': 67.80,
      'SERVICE_001': 15.00
    };

    return mockPrices[skuID] || 29.90;
  }

  private async calculateTax(cartItems: CartItem[], billingAddress: BillingAddress): Promise<TaxCalculation> {
    let subtotal = 0;
    let taxableAmount = 0;
    let dutyFreeAmount = 0;

    for (const item of cartItems) {
      subtotal += item.lineTotal || 0;
      
      if (item.category === 'duty_free') {
        dutyFreeAmount += item.lineTotal || 0;
      } else if (item.taxable) {
        taxableAmount += item.lineTotal || 0;
      }
    }

    const taxAmount = taxableAmount * this.DEFAULT_TAX_RATE;
    const totalAmount = subtotal + taxAmount;

    return {
      subtotal,
      taxAmount,
      taxRate: this.DEFAULT_TAX_RATE,
      dutyFreeAmount,
      totalAmount
    };
  }

  private async calculateLoyaltyValue(miles: number): Promise<number> {
    // Mock conversion rate: 1000 miles = $10 SGD
    return (miles / 1000) * 10;
  }

  private async performFraudCheck(session: CheckoutSession, paymentMethod: PaymentMethod): Promise<FraudCheckResponse> {
    // Mock fraud check
    const riskScore = Math.random() * 0.5; // Low risk for demo
    
    return {
      riskScore,
      decision: riskScore > this.FRAUD_THRESHOLD ? 'decline' : 'approve',
      reasons: riskScore > this.FRAUD_THRESHOLD ? ['High risk score'] : []
    };
  }

  private async processCardPayment(session: CheckoutSession, paymentMethod: PaymentMethod): Promise<PaymentResult> {
    // Mock card payment processing
    const orderID = await this.generateOrderID();
    
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock success (95% success rate)
    const success = Math.random() > 0.05;

    if (success) {
      return {
        orderID,
        paymentStatus: 'success',
        amountPaid: session.amountDue,
        currency: session.currency,
        paymentReference: `card_${Date.now()}`,
        receiptURL: `https://receipts.aerofusionxr.com/${orderID}`
      };
    } else {
      return {
        orderID,
        paymentStatus: 'failed',
        amountPaid: 0,
        currency: session.currency,
        failureReason: 'Card declined by issuer'
      };
    }
  }

  private async processDigitalWalletPayment(session: CheckoutSession, paymentMethod: PaymentMethod): Promise<PaymentResult> {
    // Mock digital wallet payment processing
    const orderID = await this.generateOrderID();
    
    return {
      orderID,
      paymentStatus: 'success',
      amountPaid: session.amountDue,
      currency: session.currency,
      paymentReference: `${paymentMethod.provider}_${Date.now()}`,
      receiptURL: `https://receipts.aerofusionxr.com/${orderID}`
    };
  }

  private async processLoyaltyPayment(session: CheckoutSession, paymentMethod: PaymentMethod): Promise<PaymentResult> {
    // Mock loyalty miles payment
    const orderID = await this.generateOrderID();
    const milesUsed = paymentMethod.milesToUse || 0;
    const milesValue = await this.calculateLoyaltyValue(milesUsed);

    if (milesValue >= session.amountDue) {
      return {
        orderID,
        paymentStatus: 'success',
        amountPaid: session.amountDue,
        currency: session.currency,
        paymentReference: `miles_${milesUsed}`,
        receiptURL: `https://receipts.aerofusionxr.com/${orderID}`
      };
    } else {
      return {
        orderID,
        paymentStatus: 'failed',
        amountPaid: 0,
        currency: session.currency,
        failureReason: 'Insufficient loyalty miles'
      };
    }
  }

  private async processBNPLPayment(session: CheckoutSession, paymentMethod: PaymentMethod): Promise<PaymentResult> {
    // Mock BNPL payment processing
    const orderID = await this.generateOrderID();
    
    return {
      orderID,
      paymentStatus: 'success',
      amountPaid: session.amountDue,
      currency: session.currency,
      paymentReference: `${paymentMethod.provider}_${Date.now()}`,
      receiptURL: `https://receipts.aerofusionxr.com/${orderID}`
    };
  }

  private async completeOrder(session: CheckoutSession, paymentResult: PaymentResult): Promise<void> {
    // Mock order completion
    this.logger.info('Order completed successfully', {
      orderID: paymentResult.orderID,
      userID: session.userID,
      amount: paymentResult.amountPaid
    });

    // In real implementation, this would:
    // - Update inventory
    // - Send confirmation email
    // - Create shipping label
    // - Update loyalty points
    // - Trigger fulfillment process
  }

  private async savePaymentMethod(userID: string, paymentMethod: PaymentMethod): Promise<void> {
    const existingMethods = this.savedPaymentMethods.get(userID) || [];
    
    // Don't save loyalty miles or one-time methods
    if (paymentMethod.type === 'loyalty_miles') {
      return;
    }

    // Create sanitized payment method (remove sensitive data)
    const savedMethod: PaymentMethod = {
      type: paymentMethod.type,
      provider: paymentMethod.provider,
      billingDetails: paymentMethod.billingDetails,
      cardDetails: paymentMethod.cardDetails
    };

    existingMethods.push(savedMethod);
    this.savedPaymentMethods.set(userID, existingMethods);
  }

  private async generateOrderID(): Promise<string> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }
} 