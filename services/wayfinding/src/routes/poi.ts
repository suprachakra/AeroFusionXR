/**
 * poi.ts
 * API routes for points of interest
 */

import express from 'express';
import { z } from 'zod';
import { Vector3 } from 'three';
import { POIService } from '../services/POIService';
import { POICategory, PointOfInterest } from '../models/PointOfInterest';
import { MetricsClient } from '../monitoring/MetricsClient';
import { TracingClient } from '../monitoring/TracingClient';
import { Logger } from '../utils/Logger';

const router = express.Router();

// Validation schemas
const vectorSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number()
});

const poiSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum([
    'restroom',
    'elevator',
    'escalator',
    'stairs',
    'restaurant',
    'shop',
    'gate',
    'baggage',
    'security',
    'information',
    'medical',
    'lounge',
    'charging',
    'wifi',
    'custom'
  ] as const),
  position: vectorSchema,
  floorId: z.string(),
  buildingId: z.string(),
  icon: z.string(),
  accessibility: z.object({
    wheelchairAccessible: z.boolean(),
    brailleSignage: z.boolean(),
    hearingLoop: z.boolean(),
    assistanceAvailable: z.boolean(),
    guideDogFriendly: z.boolean(),
    quietSpace: z.boolean(),
    lowSensoryArea: z.boolean()
  }),
  hours: z.object({
    monday: z.array(z.object({
      open: z.string(),
      close: z.string()
    })).optional(),
    tuesday: z.array(z.object({
      open: z.string(),
      close: z.string()
    })).optional(),
    wednesday: z.array(z.object({
      open: z.string(),
      close: z.string()
    })).optional(),
    thursday: z.array(z.object({
      open: z.string(),
      close: z.string()
    })).optional(),
    friday: z.array(z.object({
      open: z.string(),
      close: z.string()
    })).optional(),
    saturday: z.array(z.object({
      open: z.string(),
      close: z.string()
    })).optional(),
    sunday: z.array(z.object({
      open: z.string(),
      close: z.string()
    })).optional(),
    holidays: z.array(z.object({
      date: z.string(),
      open: z.string(),
      close: z.string()
    })).optional(),
    exceptions: z.array(z.object({
      date: z.string(),
      open: z.string(),
      close: z.string()
    })).optional()
  }).optional(),
  contact: z.object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
    website: z.string().url().optional(),
    localExtension: z.string().optional()
  }).optional(),
  tags: z.array(z.string()),
  amenities: z.array(z.string()),
  images: z.array(z.string()),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().min(0).optional(),
  popularity: z.number().min(0).max(100).optional(),
  queueTime: z.number().min(0).optional(),
  occupancy: z.number().min(0).optional(),
  maxOccupancy: z.number().min(0).optional(),
  status: z.enum(['open', 'closed', 'temporarily_closed', 'maintenance']),
  metadata: z.record(z.any())
});

const searchQuerySchema = z.object({
  position: vectorSchema.optional(),
  floorId: z.string().optional(),
  buildingId: z.string().optional(),
  category: z.enum([
    'restroom',
    'elevator',
    'escalator',
    'stairs',
    'restaurant',
    'shop',
    'gate',
    'baggage',
    'security',
    'information',
    'medical',
    'lounge',
    'charging',
    'wifi',
    'custom'
  ] as const).optional(),
  tags: z.array(z.string()).optional(),
  amenities: z.array(z.string()).optional(),
  accessibility: z.object({
    wheelchairAccessible: z.boolean().optional(),
    brailleSignage: z.boolean().optional(),
    hearingLoop: z.boolean().optional()
  }).optional(),
  status: z.enum(['open', 'closed', 'temporarily_closed', 'maintenance']).optional(),
  maxDistance: z.number().min(0).optional(),
  limit: z.number().min(1).max(100).optional()
});

const statusUpdateSchema = z.object({
  status: z.enum(['open', 'closed', 'temporarily_closed', 'maintenance']).optional(),
  occupancy: z.number().min(0).optional(),
  queueTime: z.number().min(0).optional()
});

export function createPOIRouter(
  poiService: POIService,
  metrics: MetricsClient,
  tracer: TracingClient,
  logger: Logger
): express.Router {
  // Get POI by ID
  router.get('/:id', async (req, res) => {
    const span = tracer.startSpan('GET /poi/:id');

    try {
      const poi = await poiService.getPOI(req.params.id);
      if (!poi) {
        res.status(404).json({ error: 'POI not found' });
        return;
      }

      res.json(poi);
      metrics.increment('api.poi.get_success');

    } catch (error) {
      logger.error('Error getting POI', error);
      metrics.increment('api.poi.get_error');
      res.status(500).json({ error: 'Internal server error' });

    } finally {
      span.end();
    }
  });

  // Create or update POI
  router.put('/:id', async (req, res) => {
    const span = tracer.startSpan('PUT /poi/:id');

    try {
      const poi = poiSchema.parse({
        ...req.body,
        id: req.params.id,
        position: new Vector3(
          req.body.position.x,
          req.body.position.y,
          req.body.position.z
        )
      });

      await poiService.upsertPOI(poi);
      res.status(200).json({ message: 'POI updated successfully' });
      metrics.increment('api.poi.update_success');

    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid POI data', details: error.errors });
        metrics.increment('api.poi.validation_error');
      } else {
        logger.error('Error updating POI', error);
        metrics.increment('api.poi.update_error');
        res.status(500).json({ error: 'Internal server error' });
      }

    } finally {
      span.end();
    }
  });

  // Delete POI
  router.delete('/:id', async (req, res) => {
    const span = tracer.startSpan('DELETE /poi/:id');

    try {
      await poiService.deletePOI(req.params.id);
      res.status(200).json({ message: 'POI deleted successfully' });
      metrics.increment('api.poi.delete_success');

    } catch (error) {
      logger.error('Error deleting POI', error);
      metrics.increment('api.poi.delete_error');
      res.status(500).json({ error: 'Internal server error' });

    } finally {
      span.end();
    }
  });

  // Search POIs
  router.post('/search', async (req, res) => {
    const span = tracer.startSpan('POST /poi/search');

    try {
      const query = searchQuerySchema.parse({
        ...req.body,
        position: req.body.position && new Vector3(
          req.body.position.x,
          req.body.position.y,
          req.body.position.z
        )
      });

      const results = await poiService.searchPOIs(query);
      res.json(results);
      metrics.increment('api.poi.search_success');
      metrics.histogram('api.poi.search_results', results.length);

    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid search query', details: error.errors });
        metrics.increment('api.poi.validation_error');
      } else {
        logger.error('Error searching POIs', error);
        metrics.increment('api.poi.search_error');
        res.status(500).json({ error: 'Internal server error' });
      }

    } finally {
      span.end();
    }
  });

  // Get nearby POIs
  router.get('/nearby', async (req, res) => {
    const span = tracer.startSpan('GET /poi/nearby');

    try {
      const position = vectorSchema.parse({
        x: Number(req.query.x),
        y: Number(req.query.y),
        z: Number(req.query.z)
      });

      const radius = req.query.radius
        ? Number(req.query.radius)
        : undefined;

      const pois = await poiService.getNearbyPOIs(
        new Vector3(position.x, position.y, position.z),
        radius
      );

      res.json(pois);
      metrics.increment('api.poi.nearby_success');
      metrics.histogram('api.poi.nearby_results', pois.length);

    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid position', details: error.errors });
        metrics.increment('api.poi.validation_error');
      } else {
        logger.error('Error getting nearby POIs', error);
        metrics.increment('api.poi.nearby_error');
        res.status(500).json({ error: 'Internal server error' });
      }

    } finally {
      span.end();
    }
  });

  // Update POI status
  router.patch('/:id/status', async (req, res) => {
    const span = tracer.startSpan('PATCH /poi/:id/status');

    try {
      const updates = statusUpdateSchema.parse(req.body);
      await poiService.updatePOIStatus(req.params.id, updates);
      res.status(200).json({ message: 'POI status updated successfully' });
      metrics.increment('api.poi.status_update_success');

    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid status update', details: error.errors });
        metrics.increment('api.poi.validation_error');
      } else {
        logger.error('Error updating POI status', error);
        metrics.increment('api.poi.status_update_error');
        res.status(500).json({ error: 'Internal server error' });
      }

    } finally {
      span.end();
    }
  });

  return router;
} 