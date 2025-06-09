import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { BeaconSlamFusion } from './core/positioning/BeaconSlamFusion';
import { NavigationOverlay } from './ar/NavigationOverlay';
import { MultiFloorRouter } from './routing/MultiFloorRouter';
import { metrics } from './utils/metrics';
import { createLogger } from '@aerofusionxr/shared';

// Initialize logger
const logger = createLogger('wayfinding-platform');

// Initialize OpenTelemetry
const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()]
});

sdk.start();

// Create Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));

// Initialize core services
const beaconFusion = new BeaconSlamFusion({
  updateInterval: 100,
  maxBeaconAge: 5000
});

const router = new MultiFloorRouter({
  maxPathLength: 1000,
  maxTransitions: 5,
  weightFactors: {
    distance: 1,
    transition: 2,
    crowding: 1.5
  },
  cacheConfig: {
    maxSize: 1000,
    ttl: 300000 // 5 minutes
  }
}, metrics, sdk.getTracer('wayfinding'), logger);

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
app.post('/api/position/update', (req, res) => {
  try {
    const { beacons, slam } = req.body;
    
    if (beacons) {
      beacons.forEach((beacon: any) => {
        beaconFusion.updateBeacon(beacon.id, beacon.rssi, beacon.distance);
      });
    }

    if (slam) {
      beaconFusion.updateSlam(slam);
    }

    res.json(beaconFusion.getCurrentPosition());
  } catch (error) {
    logger.error('Error updating position:', error);
    res.status(500).json({ error: 'Failed to update position' });
  }
});

app.post('/api/route/find', async (req, res) => {
  try {
    const { start, end, options } = req.body;
    const route = await router.findPath(start, end, options);
    res.json(route);
  } catch (error) {
    logger.error('Error finding route:', error);
    res.status(500).json({ error: 'Failed to find route' });
  }
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  logger.info(`Server started on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM. Starting graceful shutdown...');
  sdk.shutdown()
    .then(() => {
      logger.info('OpenTelemetry SDK shut down');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Error shutting down OpenTelemetry SDK:', error);
      process.exit(1);
    });
}); 