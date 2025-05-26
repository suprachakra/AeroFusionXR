import { Router } from 'express';
import { runBookingFlow } from '../workflows/bookingFlow.js';

const router = Router();
router.post('/', async (req, res, next) => {
  try {
    const result = await runBookingFlow(req.body);
    res.json(result);
  } catch (err) { next(err); }
});
export default router;
