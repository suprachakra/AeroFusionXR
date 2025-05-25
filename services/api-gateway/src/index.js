import express from 'express';
import rateLimit from './middlewares/rateLimiter.js';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/booking.js';
import healthRoutes from './routes/health.js';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { initTracing } from './services/tracingService.js';

// Initialize tracing before anything else
initTracing('api-gateway');

const app = express();
app.use(express.json());
app.use(rateLimit());

// Load OpenAPI spec
const apiSpec = YAML.load('openapi.yaml');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(apiSpec));

// Routes
app.use('/auth', authRoutes);
app.use('/booking', bookingRoutes);
app.use('/health', healthRoutes);

app.use((err, req, res, next) => {
  // Central error handler
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API Gateway listening on port ${port}`));
