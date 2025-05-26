import { Router } from 'express';
import { listProducts } from '../services/productCatalogService.js';
import { createOrder } from '../services/checkoutService.js';

const router = Router();
router.get('/catalog', (req, res) => res.json(listProducts()));
router.post('/checkout', async (req, res, next) => {
  try { res.json(await createOrder(req.body)); }
  catch(err) { next(err); }
});

export default router;
