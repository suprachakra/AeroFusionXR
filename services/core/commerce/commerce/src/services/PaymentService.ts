import Stripe from 'stripe';
import { createLogger, Logger } from '@aerofusionxr/shared';
import { metrics } from '../utils/metrics';

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
  client_secret: string;
}

export class PaymentService {
  private stripe: Stripe;
  private logger: Logger;

  // Metrics
  private readonly paymentLatencyHistogram = metrics.createHistogram({
    name: 'payment_processing_latency_seconds',
    help: 'Time taken to process payments',
    labelNames: ['status']
  });

  private readonly paymentErrorCounter = metrics.createCounter({
    name: 'payment_errors_total',
    help: 'Total number of payment errors',
    labelNames: ['error_type']
  });

  constructor(apiKey: string) {
    this.stripe = new Stripe(apiKey, {
      apiVersion: '2023-10-16'
    });
    this.logger = createLogger('commerce-payment');
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, string>
  ): Promise<PaymentIntent> {
    const startTime = Date.now();
    try {
      const intent = await this.stripe.paymentIntents.create({
        amount,
        currency,
        metadata,
        automatic_payment_methods: {
          enabled: true
        }
      });

      const latency = (Date.now() - startTime) / 1000;
      this.paymentLatencyHistogram.observe({ status: 'success' }, latency);

      return {
        id: intent.id,
        amount: intent.amount,
        currency: intent.currency,
        status: intent.status,
        client_secret: intent.client_secret!
      };
    } catch (error) {
      const latency = (Date.now() - startTime) / 1000;
      this.paymentLatencyHistogram.observe({ status: 'error' }, latency);
      this.paymentErrorCounter.inc({ error_type: (error as Error).name });
      this.logger.error('Payment intent creation failed:', error);
      throw error;
    }
  }

  async confirmPayment(paymentIntentId: string): Promise<boolean> {
    try {
      const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return intent.status === 'succeeded';
    } catch (error) {
      this.logger.error('Payment confirmation failed:', error);
      this.paymentErrorCounter.inc({ error_type: (error as Error).name });
      return false;
    }
  }

  async refundPayment(
    paymentIntentId: string,
    amount?: number
  ): Promise<boolean> {
    try {
      await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount
      });
      return true;
    } catch (error) {
      this.logger.error('Payment refund failed:', error);
      this.paymentErrorCounter.inc({ error_type: (error as Error).name });
      return false;
    }
  }
} 
