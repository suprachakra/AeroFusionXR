import { createLogger } from '@aerofusionxr/shared';
import { CheckoutSession, CartItem, BillingAddress } from './PaymentService';
import { v4 as uuidv4 } from 'uuid';

export interface CreateSessionData {
  userID: string;
  cartItems: CartItem[];
  subtotal: number;
  tax: number;
  loyaltyValue: number;
  amountDue: number;
  currency: string;
  billingAddress: BillingAddress;
  shippingOption: 'in-store pickup' | 'delivery';
}

export interface CreateOrderData {
  orderID: string;
  sessionID: string;
  userID: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  loyaltyValue: number;
  totalPaid: number;
  currency: string;
  paymentReference: string;
  billingAddress: BillingAddress;
  shippingOption: string;
}

export interface Order {
  orderID: string;
  sessionID: string;
  userID: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  loyaltyValue: number;
  totalPaid: number;
  currency: string;
  paymentMethod: string;
  paymentReference: string;
  billingAddress: BillingAddress;
  shippingOption: string;
  orderStatus: 'processing' | 'completed' | 'canceled';
  createdAt: Date;
  updatedAt: Date;
}

export class CheckoutService {
  private logger: Logger;
  private sessions: Map<string, CheckoutSession> = new Map();
  private orders: Map<string, Order> = new Map();

  constructor() {
    this.logger = new Logger('CheckoutService');
  }

  /**
   * Create a new checkout session
   */
  async createSession(data: CreateSessionData): Promise<CheckoutSession> {
    try {
      const sessionID = uuidv4();
      const now = new Date();

      const session: CheckoutSession = {
        sessionID,
        userID: data.userID,
        cartItems: data.cartItems,
        subtotal: data.subtotal,
        tax: data.tax,
        loyaltyValue: data.loyaltyValue,
        amountDue: data.amountDue,
        currency: data.currency,
        billingAddress: data.billingAddress,
        shippingOption: data.shippingOption,
        status: 'pending',
        createdAt: now,
        updatedAt: now
      };

      // Store in memory (in production, this would be a database)
      this.sessions.set(sessionID, session);

      this.logger.info('Checkout session created', {
        sessionID,
        userID: data.userID,
        amountDue: data.amountDue,
        currency: data.currency
      });

      return session;
    } catch (error) {
      this.logger.error('Failed to create checkout session', {
        userID: data.userID,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get checkout session by ID
   */
  async getSession(sessionID: string): Promise<CheckoutSession | null> {
    try {
      const session = this.sessions.get(sessionID);
      return session || null;
    } catch (error) {
      this.logger.error('Failed to get checkout session', {
        sessionID,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    sessionID: string,
    status: 'pending' | 'paid' | 'failed' | 'expired',
    paymentReference?: string
  ): Promise<void> {
    try {
      const session = this.sessions.get(sessionID);
      if (!session) {
        throw new Error(`Session not found: ${sessionID}`);
      }

      session.status = status;
      session.updatedAt = new Date();
      
      if (paymentReference) {
        session.paymentReference = paymentReference;
      }

      if (status === 'paid') {
        session.paidAt = new Date();
      }

      this.sessions.set(sessionID, session);

      this.logger.info('Session status updated', {
        sessionID,
        status,
        paymentReference
      });
    } catch (error) {
      this.logger.error('Failed to update session status', {
        sessionID,
        status,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create order from successful payment
   */
  async createOrder(data: CreateOrderData): Promise<Order> {
    try {
      const now = new Date();

      const order: Order = {
        orderID: data.orderID,
        sessionID: data.sessionID,
        userID: data.userID,
        items: data.items,
        subtotal: data.subtotal,
        tax: data.tax,
        loyaltyValue: data.loyaltyValue,
        totalPaid: data.totalPaid,
        currency: data.currency,
        paymentMethod: this.determinePaymentMethod(data.paymentReference),
        paymentReference: data.paymentReference,
        billingAddress: data.billingAddress,
        shippingOption: data.shippingOption,
        orderStatus: 'processing',
        createdAt: now,
        updatedAt: now
      };

      // Store in memory (in production, this would be a database)
      this.orders.set(data.orderID, order);

      this.logger.info('Order created', {
        orderID: data.orderID,
        sessionID: data.sessionID,
        userID: data.userID,
        totalPaid: data.totalPaid,
        currency: data.currency
      });

      return order;
    } catch (error) {
      this.logger.error('Failed to create order', {
        orderID: data.orderID,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  async getOrder(orderID: string): Promise<Order | null> {
    try {
      const order = this.orders.get(orderID);
      return order || null;
    } catch (error) {
      this.logger.error('Failed to get order', {
        orderID,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get orders by user ID
   */
  async getOrdersByUser(userID: string): Promise<Order[]> {
    try {
      const userOrders = Array.from(this.orders.values())
        .filter(order => order.userID === userID)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return userOrders;
    } catch (error) {
      this.logger.error('Failed to get orders by user', {
        userID,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderID: string,
    status: 'processing' | 'completed' | 'canceled'
  ): Promise<void> {
    try {
      const order = this.orders.get(orderID);
      if (!order) {
        throw new Error(`Order not found: ${orderID}`);
      }

      order.orderStatus = status;
      order.updatedAt = new Date();

      this.orders.set(orderID, order);

      this.logger.info('Order status updated', {
        orderID,
        status
      });
    } catch (error) {
      this.logger.error('Failed to update order status', {
        orderID,
        status,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    totalSessions: number;
    pendingSessions: number;
    paidSessions: number;
    failedSessions: number;
  }> {
    const sessions = Array.from(this.sessions.values());
    
    return {
      totalSessions: sessions.length,
      pendingSessions: sessions.filter(s => s.status === 'pending').length,
      paidSessions: sessions.filter(s => s.status === 'paid').length,
      failedSessions: sessions.filter(s => s.status === 'failed').length
    };
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(maxAgeHours: number = 24): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
      let cleanedCount = 0;

      for (const [sessionID, session] of this.sessions.entries()) {
        if (session.createdAt < cutoffTime && session.status === 'pending') {
          // Mark as expired
          session.status = 'expired';
          session.updatedAt = new Date();
          cleanedCount++;
        }
      }

      this.logger.info('Expired sessions cleaned up', {
        cleanedCount,
        cutoffTime
      });

      return cleanedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup expired sessions', {
        error: error.message
      });
      return 0;
    }
  }

  /**
   * Private helper methods
   */
  private determinePaymentMethod(paymentReference: string): string {
    if (paymentReference.startsWith('pi_')) {
      return 'card';
    } else if (paymentReference.startsWith('loyalty_')) {
      return 'loyalty_miles';
    } else if (paymentReference.includes('apple') || paymentReference.includes('google')) {
      return 'digital_wallet';
    } else {
      return 'unknown';
    }
  }

  /**
   * Get service health
   */
  async getHealth(): Promise<{ available: boolean; stats?: any }> {
    try {
      const stats = await this.getSessionStats();
      return {
        available: true,
        stats: {
          ...stats,
          totalOrders: this.orders.size
        }
      };
    } catch (error) {
      this.logger.error('Health check failed', {
        error: error.message
      });
      return {
        available: false
      };
    }
  }
} 
