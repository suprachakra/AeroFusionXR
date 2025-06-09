import express from 'express';
import { ProductService } from '../services/ProductService';
import { CartService } from '../services/CartService';
import { PaymentService } from '../services/PaymentService';
import { PromotionService } from '../services/PromotionService';
import { ARService } from '../services/ARService';
import { Cache } from '../utils/Cache';
import { createLogger } from '@aerofusionxr/shared';
import { metrics } from '../utils/metrics';

const router = express.Router();
const logger = createLogger('commerce-api');

// Initialize services
const cache = new Cache(process.env.REDIS_URL!);
const productService = new ProductService(cache);
const cartService = new CartService();
const paymentService = new PaymentService(process.env.STRIPE_SECRET_KEY!);
const promotionService = new PromotionService();
const arService = new ARService(
  process.env.AWS_REGION!,
  process.env.S3_BUCKET!
);

// Product routes
router.get('/products', async (req, res) => {
  try {
    const filters = {
      query: req.query.q as string,
      categories: req.query.categories as string[],
      priceRange: req.query.priceRange ? JSON.parse(req.query.priceRange as string) : undefined,
      tags: req.query.tags as string[],
      inStock: req.query.inStock === 'true',
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as 'asc' | 'desc'
    };

    const result = await productService.searchProducts(filters);
    res.json(result);
  } catch (error) {
    logger.error('Product search failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/products/:id', async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    logger.error('Product retrieval failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/products/:id/related', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const products = await productService.getRelatedProducts(req.params.id, limit);
    res.json(products);
  } catch (error) {
    logger.error('Related products fetch failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cart routes
router.post('/cart/items', async (req, res) => {
  try {
    const { productId, quantity, variantId } = req.body;
    const sessionId = req.cookies.sessionId;
    const userId = req.user?.id;

    const cart = await cartService.addItem(sessionId, {
      productId,
      variantId,
      quantity
    }, userId);

    res.json(cart);
  } catch (error) {
    logger.error('Add to cart failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/cart/items/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { variantId } = req.query;
    const sessionId = req.cookies.sessionId;

    const cart = await cartService.removeItem(sessionId, productId, variantId as string);
    res.json(cart);
  } catch (error) {
    logger.error('Remove from cart failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/cart/items/:productId/quantity', async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity, variantId } = req.body;
    const sessionId = req.cookies.sessionId;

    const cart = await cartService.updateItemQuantity(
      sessionId,
      productId,
      quantity,
      variantId
    );

    res.json(cart);
  } catch (error) {
    logger.error('Update cart quantity failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Promotion routes
router.post('/promotions/validate', async (req, res) => {
  try {
    const { code, subtotal, productIds } = req.body;
    const promotion = await promotionService.validatePromotion(
      code,
      subtotal,
      productIds
    );

    if (!promotion) {
      return res.status(400).json({ error: 'Invalid promotion code' });
    }

    const discount = await promotionService.calculateDiscount(
      promotion,
      subtotal,
      req.body.items
    );

    res.json({ promotion, discount });
  } catch (error) {
    logger.error('Promotion validation failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Checkout routes
router.post('/checkout/payment-intent', async (req, res) => {
  try {
    const { amount, currency, metadata } = req.body;
    const intent = await paymentService.createPaymentIntent(
      amount,
      currency,
      metadata
    );
    res.json(intent);
  } catch (error) {
    logger.error('Payment intent creation failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/checkout/complete', async (req, res) => {
  try {
    const { paymentIntentId, cartId } = req.body;
    const userId = req.user?.id;

    // Verify payment
    const paymentConfirmed = await paymentService.confirmPayment(paymentIntentId);
    if (!paymentConfirmed) {
      return res.status(400).json({ error: 'Payment confirmation failed' });
    }

    // Create order
    const cart = await cartService.getCart(cartId);
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    // Update inventory
    for (const item of cart.items) {
      await productService.updateInventory(
        item.productId,
        item.quantity,
        'decrement'
      );
    }

    // Clear cart
    await cartService.clear(cartId);

    res.json({ success: true });
  } catch (error) {
    logger.error('Checkout completion failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AR routes
router.get('/ar/model/:productId', async (req, res) => {
  try {
    const userAgent = req.get('user-agent') || '';
    const compatibility = arService.checkDeviceCompatibility(userAgent);
    
    const product = await productService.getProductById(req.params.productId);
    if (!product || !product.arAssets) {
      return res.status(404).json({ error: 'AR model not found' });
    }

    const model = await arService.loadModel(product.arAssets, {
      maxTriangles: compatibility.maxTriangles,
      maxTextureSize: compatibility.maxTextureSize,
      supportedFormats: compatibility.supportedFormats
    });

    res.json(model);
  } catch (error) {
    logger.error('AR model loading failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 
