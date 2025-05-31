import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import mongoose from 'mongoose';
import { ARService } from './services/ARService';
import { ProductService } from './services/ProductService';
import { PromotionService } from './services/PromotionService';
import { PaymentService } from './services/PaymentService';
import { CommerceService } from './services/CommerceService';
import { metrics } from './utils/metrics';
import { Logger } from './utils/Logger';

// Initialize OpenTelemetry
const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()]
});

sdk.start();

// Create Express app
const app = express();
const logger = new Logger();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));

// Initialize services
const arService = new ARService(
  process.env.AWS_REGION || 'us-east-1',
  process.env.S3_BUCKET || 'aerofusion-ar-models'
);

const productService = new ProductService();
const promotionService = new PromotionService();
const paymentService = new PaymentService(process.env.STRIPE_SECRET_KEY || '');

const commerceConfig = {
  defaultCurrency: 'USD',
  supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
  taxRates: {
    'CA': 0.05, 'NY': 0.08, 'TX': 0.0625, 'FL': 0.06, 'WA': 0.0965
  },
  shippingRates: {
    'US': 10, 'CA': 15, 'GB': 20, 'EU': 18, 'AU': 25, 'JP': 22
  },
  loyaltyPointsRatio: 0.01,
  cartExpiryMinutes: 60,
  maxCartItems: 50,
  maxQuantityPerItem: 10,
  arModelFormats: ['gltf', 'usdc', 'obj'],
  enablePersonalization: true,
  enableRecommendations: true
};

const commerceService = new CommerceService(
  productService,
  promotionService,
  paymentService,
  arService,
  commerceConfig
);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/commerce')
  .then(() => logger.info('Connected to MongoDB'))
  .catch(error => logger.error('MongoDB connection error:', error));

// Add request logging
app.use(logger.createRequestLogger());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: process.env.SERVICE_VERSION || 'unknown',
    timestamp: new Date().toISOString()
  });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(await metrics.getMetrics());
});

// ================================
// COMMERCE API ENDPOINTS
// ================================

// Product endpoints
app.get('/api/products', async (req, res) => {
  try {
    const filters = {
      category: req.query.category as string,
      subcategory: req.query.subcategory as string,
      brand: req.query.brand as string,
      priceMin: req.query.priceMin ? Number(req.query.priceMin) : undefined,
      priceMax: req.query.priceMax ? Number(req.query.priceMax) : undefined,
      search: req.query.search as string,
      limit: req.query.limit ? Number(req.query.limit) : 20,
      offset: req.query.offset ? Number(req.query.offset) : 0
    };

    const result = await commerceService.getProducts(filters);
    res.json(result);
  } catch (error) {
    logger.error('Error getting products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/products/:productId', async (req, res) => {
  try {
    const product = await commerceService.getProduct(req.params.productId);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    logger.error('Error getting product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/products/:productId/recommendations', async (req, res) => {
  try {
    const customerId = req.get('X-Customer-ID');
    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID required' });
    }

    const context = {
      currentProductId: req.params.productId,
      category: req.query.category as string,
      limit: req.query.limit ? Number(req.query.limit) : 10
    };

    const recommendations = await commerceService.getProductRecommendations(customerId, context);
    res.json({ recommendations });
  } catch (error) {
    logger.error('Error getting recommendations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cart endpoints
app.get('/api/cart', async (req, res) => {
  try {
    const sessionId = req.get('X-Session-ID');
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const cart = await commerceService.getCart(sessionId);
    res.json(cart);
  } catch (error) {
    logger.error('Error getting cart:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/cart/items', async (req, res) => {
  try {
    const sessionId = req.get('X-Session-ID');
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const { productId, quantity, customizations } = req.body;
    
    if (!productId || !quantity) {
      return res.status(400).json({ error: 'Product ID and quantity are required' });
    }

    const cart = await commerceService.addToCart(sessionId, productId, quantity, customizations);
    res.json(cart);
  } catch (error) {
    logger.error('Error adding to cart:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Bad request' });
  }
});

app.put('/api/cart/items/:productId', async (req, res) => {
  try {
    const sessionId = req.get('X-Session-ID');
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const { quantity, customizations } = req.body;
    
    if (quantity === undefined) {
      return res.status(400).json({ error: 'Quantity is required' });
    }

    const cart = await commerceService.updateCartItem(
      sessionId, 
      req.params.productId, 
      quantity, 
      customizations
    );
    res.json(cart);
  } catch (error) {
    logger.error('Error updating cart item:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Bad request' });
  }
});

app.delete('/api/cart/items/:productId', async (req, res) => {
  try {
    const sessionId = req.get('X-Session-ID');
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const customizations = req.body.customizations;
    const cart = await commerceService.removeFromCart(sessionId, req.params.productId, customizations);
    res.json(cart);
  } catch (error) {
    logger.error('Error removing from cart:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Bad request' });
  }
});

app.delete('/api/cart', async (req, res) => {
  try {
    const sessionId = req.get('X-Session-ID');
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    await commerceService.clearCart(sessionId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error clearing cart:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Order endpoints
app.post('/api/orders', async (req, res) => {
  try {
    const sessionId = req.get('X-Session-ID');
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const { shippingAddress, billingAddress, paymentMethodId } = req.body;
    
    if (!shippingAddress || !billingAddress || !paymentMethodId) {
      return res.status(400).json({ 
        error: 'Shipping address, billing address, and payment method are required' 
      });
    }

    const order = await commerceService.createOrder(
      sessionId, 
      shippingAddress, 
      billingAddress, 
      paymentMethodId
    );
    res.status(201).json(order);
  } catch (error) {
    logger.error('Error creating order:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Bad request' });
  }
});

app.get('/api/orders/:orderId', async (req, res) => {
  try {
    const order = await commerceService.getOrder(req.params.orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    logger.error('Error getting order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/customers/:customerId/orders', async (req, res) => {
  try {
    const filters = {
      status: req.query.status as any,
      limit: req.query.limit ? Number(req.query.limit) : 50,
      offset: req.query.offset ? Number(req.query.offset) : 0
    };

    const result = await commerceService.getCustomerOrders(req.params.customerId, filters);
    res.json(result);
  } catch (error) {
    logger.error('Error getting customer orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/orders/:orderId/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const order = await commerceService.updateOrderStatus(req.params.orderId, status);
    res.json(order);
  } catch (error) {
    logger.error('Error updating order status:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Bad request' });
  }
});

// Customer endpoints
app.post('/api/customers', async (req, res) => {
  try {
    const customerData = req.body;
    const customer = await commerceService.createCustomer(customerData);
    res.status(201).json(customer);
  } catch (error) {
    logger.error('Error creating customer:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Bad request' });
  }
});

app.get('/api/customers/:customerId', async (req, res) => {
  try {
    const customer = await commerceService.getCustomer(req.params.customerId);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(customer);
  } catch (error) {
    logger.error('Error getting customer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/customers/:customerId', async (req, res) => {
  try {
    const updates = req.body;
    const customer = await commerceService.updateCustomer(req.params.customerId, updates);
    res.json(customer);
  } catch (error) {
    logger.error('Error updating customer:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Bad request' });
  }
});

// AR endpoints
app.get('/api/ar/compatibility', (req, res) => {
  const userAgent = req.get('user-agent') || '';
  const compatibility = arService.checkDeviceCompatibility(userAgent);
  res.json(compatibility);
});

app.get('/api/ar/model/:productId', async (req, res) => {
  try {
    const userAgent = req.get('user-agent') || '';
    const model = await commerceService.getProductARModel(req.params.productId, userAgent);
    res.json(model);
  } catch (error) {
    logger.error('Error loading AR model:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Analytics endpoints
app.get('/api/analytics', async (req, res) => {
  try {
    const period = (req.query.period as 'day' | 'week' | 'month') || 'week';
    const analytics = await commerceService.getAnalytics(period);
    res.json(analytics);
  } catch (error) {
    logger.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use(logger.createErrorLogger());

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  logger.info(`Commerce service started on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM. Starting graceful shutdown...');
  
  try {
    await mongoose.disconnect();
    await sdk.shutdown();
    logger.info('Service shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}); 