import { Router } from 'express';
import { login, refreshToken } from './controllers/authController.js';
import authValidator from './middlewares/authValidator.js';

const router = Router();
router.post('/login', authValidator.login, login);
router.post('/refresh', authValidator.refresh, refreshToken);
export default router;
