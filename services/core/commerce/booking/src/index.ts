import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { BookingService } from './services/BookingService';
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

// Initialize booking service
const bookingService = new BookingService(
  process.env.REDIS_URL || 'redis://localhost:6379',
  process.env.MONGO_URL || 'mongodb://localhost:27017/booking',
  process.env.STRIPE_KEY || ''
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
app.get('/api/flights/search', async (req, res) => {
  try {
    const flights = await bookingService.searchFlights(req.query);
    res.json(flights);
  } catch (error) {
    logger.error('Error searching flights:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const { flightId, userId, passengers, cabinClass } = req.body;
    const booking = await bookingService.createBooking(
      flightId,
      userId,
      passengers,
      cabinClass
    );
    res.status(201).json(booking);
  } catch (error) {
    logger.error('Error creating booking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/bookings/:bookingId/payment', async (req, res) => {
  try {
    const { paymentToken } = req.body;
    const booking = await bookingService.processPayment(
      req.params.bookingId,
      paymentToken
    );
    res.json(booking);
  } catch (error) {
    logger.error('Error processing payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/bookings/:bookingId/cancel', async (req, res) => {
  try {
    const booking = await bookingService.cancelBooking(req.params.bookingId);
    res.json(booking);
  } catch (error) {
    logger.error('Error cancelling booking:', error);
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
    await bookingService.shutdown();
    await sdk.shutdown();
    logger.info('Service shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}); 