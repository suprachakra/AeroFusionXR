import { Router } from 'express';
import circuit from '../services/circuitBreaker.js';
import { proxyBooking } from '../controllers/authController.js';
const router = Router();
router.post('/', circuit.fire.bind(circuit), proxyBooking);
export default router;
