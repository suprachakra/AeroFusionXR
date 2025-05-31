import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { BaggageTrackingService } from './services/BaggageTrackingService';
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

// Initialize tracking service
const trackingService = new BaggageTrackingService(
  process.env.REDIS_URL || 'redis://localhost:6379',
  process.env.MQTT_URL || 'mqtt://localhost:1883'
);

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

// API routes
app.get('/api/baggage/:tagId', async (req, res) => {
  try {
    const tag = await trackingService.getTag(req.params.tagId);
    if (!tag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }
    res.json(tag);
  } catch (error) {
    logger.error('Error retrieving baggage tag:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/baggage/:tagId/history', async (req, res) => {
  try {
    const events = await trackingService.getTagHistory(req.params.tagId);
    res.json(events);
  } catch (error) {
    logger.error('Error retrieving baggage history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/baggage/:tagId/alerts', async (req, res) => {
  try {
    const alerts = await trackingService.getTagAlerts(req.params.tagId);
    res.json(alerts);
  } catch (error) {
    logger.error('Error retrieving baggage alerts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/baggage/search', async (req, res) => {
  try {
    const tags = await trackingService.searchTags(req.body);
    res.json(tags);
  } catch (error) {
    logger.error('Error searching baggage tags:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use(logger.createErrorLogger());

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  logger.info(`Server started on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM. Starting graceful shutdown...');
  
  try {
    await trackingService.shutdown();
    await sdk.shutdown();
    logger.info('Service shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}); 