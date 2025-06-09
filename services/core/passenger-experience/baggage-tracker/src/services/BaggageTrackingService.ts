/**
 * AeroFusionXR Baggage Tracking Service
 * ====================================
 * 
 * Enterprise-grade baggage tracking service with RFID integration, real-time monitoring,
 * predictive analytics, and comprehensive automation for baggage handling operations.
 * 
 * Features:
 * - 📱 RFID/NFC tag scanning and management
 * - 🗺️ Real-time baggage location tracking across airport zones
 * - 🤖 Automated baggage routing and sorting optimization
 * - 🚨 Intelligent alert system for mishandled baggage
 * - 📊 Predictive analytics for baggage handling efficiency
 * - 🔄 Integration with airline and airport systems
 * - 📈 Performance metrics and SLA monitoring
 * - 🛡️ Security and audit trail management
 * - 📲 Customer notification and self-service portal
 * - 🧠 Machine learning for delay prediction and optimization
 * 
 * Architecture:
 * - Event-driven architecture with MQTT/WebSocket communication
 * - Redis for real-time data caching and pub/sub
 * - MongoDB for baggage history and analytics
 * - Machine learning models for predictive routing
 * - Integration with airport infrastructure systems
 * - Comprehensive observability and monitoring
 * 
 * Author: AeroFusionXR Team
 * License: Proprietary
 */

import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import { connect as mqttConnect, Client as MqttClient } from 'mqtt';
import { MongoClient, Db, Collection } from 'mongodb';
import { createLogger } from '@aerofusionxr/shared';
import { MetricsClient } from '../utils/metrics';
import { TracingClient } from '../utils/tracing';
import {
  BaggageTag,
  BaggageEvent,
  BaggageStatus,
  BaggageEventType,
  Location,
  AlertType,
  AlertSeverity,
  BaggageAlert,
  FlightInfo,
  HandlingInstructions,
  SecurityCheck,
  BaggageJourney,
  PredictionResult,
  PerformanceMetrics
} from '../types';

// ================================
// ENHANCED INTERFACES & TYPES
// ================================

interface RFIDScanData {
  tagId: string;
  readerId: string;
  readerLocation: Location;
  signalStrength: number;
  timestamp: Date;
  scanType: 'entry' | 'exit' | 'checkpoint' | 'loading';
  additionalData?: Record<string, any>;
}

interface ConveyorSystem {
  id: string;
  name: string;
  zones: string[];
  capacity: number;
  currentLoad: number;
  speed: number;
  status: 'operational' | 'maintenance' | 'offline';
  lastMaintenance: Date;
}

interface RouteOptimization {
  tagId: string;
  currentLocation: Location;
  destination: Location;
  recommendedPath: Location[];
  estimatedTime: number;
  confidence: number;
  alternatives: Array<{
    path: Location[];
    estimatedTime: number;
    risk: number;
  }>;
}

interface SLATarget {
  type: 'connection_time' | 'delivery_time' | 'accuracy';
  target: number;
  current: number;
  threshold: number;
  unit: 'minutes' | 'percentage';
}

// ================================
// ENHANCED BAGGAGE TRACKING SERVICE
// ================================

export class BaggageTrackingService extends EventEmitter {
  private redis: Redis;
  private mqtt: MqttClient;
  private mongodb: Db;
  private logger: Logger;
  private metrics: MetricsClient;
  private tracer: TracingClient;

  // Configuration constants
  private readonly REDIS_TAG_PREFIX = 'baggage:tag:';
  private readonly REDIS_EVENT_PREFIX = 'baggage:event:';
  private readonly REDIS_ALERT_PREFIX = 'baggage:alert:';
  private readonly REDIS_JOURNEY_PREFIX = 'baggage:journey:';
  private readonly EVENT_RETENTION_DAYS = 30;
  private readonly STATIONARY_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
  private readonly MISHANDLED_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
  private readonly CONNECTION_TIME_SLA = 45; // 45 minutes

  // Collections
  private tagsCollection: Collection<BaggageTag>;
  private eventsCollection: Collection<BaggageEvent>;
  private alertsCollection: Collection<BaggageAlert>;
  private journeysCollection: Collection<BaggageJourney>;
  private performanceCollection: Collection<PerformanceMetrics>;

  // State management
  private conveyorSystems: Map<string, ConveyorSystem> = new Map();
  private activeAlerts: Map<string, BaggageAlert[]> = new Map();
  private routingRules: Map<string, RouteOptimization> = new Map();
  private slaTargets: Map<string, SLATarget> = new Map();

  // Machine Learning Models (simplified interface)
  private predictionModel: any;
  private routingOptimizer: any;

  constructor(
    redisUrl: string,
    mqttUrl: string,
    mongoUrl: string,
    private readonly config = {
      zoneCheckInterval: 60000,
      alertCleanupInterval: 3600000,
      maxEventsPerTag: 1000,
      predictionHorizonMinutes: 120,
      routeOptimizationEnabled: true,
      mlModelPath: './models/baggage_prediction.json',
      performanceReportInterval: 300000, // 5 minutes
      slaMonitoringEnabled: true,
      autoRoutingEnabled: true,
      notificationEnabled: true
    }
  ) {
    super();
    this.logger = createLogger('BaggageTrackingService');
    this.metrics = new MetricsClient();
    this.tracer = new TracingClient();
    
    this.setupConnections(redisUrl, mqttUrl, mongoUrl);
    this.initializeSLATargets();
    this.startMaintenanceTasks();
    this.loadMLModels();
  }

  // ================================
  // INITIALIZATION & SETUP
  // ================================

  private async setupConnections(redisUrl: string, mqttUrl: string, mongoUrl: string): Promise<void> {
    try {
      // Redis connection
      this.redis = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 3
      });

      this.redis.on('error', (error) => {
        this.logger.error('Redis connection error:', error);
        this.metrics.increment('baggage_redis_errors');
      });

      // MQTT connection for real-time RFID data
      this.mqtt = mqttConnect(mqttUrl, {
        clientId: `baggage-tracker-${Date.now()}`,
        clean: true,
        reconnectPeriod: 1000,
        keepalive: 60
      });

      this.mqtt.on('connect', () => {
        this.logger.info('MQTT connected successfully');
        this.subscribeMQTTTopics();
      });

      this.mqtt.on('message', this.handleMqttMessage.bind(this));

      // MongoDB connection
      const mongoClient = new MongoClient(mongoUrl);
      await mongoClient.connect();
      this.mongodb = mongoClient.db('baggage_tracking');

      // Initialize collections
      this.tagsCollection = this.mongodb.collection('tags');
      this.eventsCollection = this.mongodb.collection('events');
      this.alertsCollection = this.mongodb.collection('alerts');
      this.journeysCollection = this.mongodb.collection('journeys');
      this.performanceCollection = this.mongodb.collection('performance');

      // Create indexes for performance
      await this.createIndexes();

      this.logger.info('All database connections established successfully');

    } catch (error) {
      this.logger.error('Failed to setup connections:', error);
      throw error;
    }
  }

  private async createIndexes(): Promise<void> {
    try {
      // Create indexes for better query performance
      await this.tagsCollection.createIndex({ tagId: 1 }, { unique: true });
      await this.tagsCollection.createIndex({ flightNumber: 1 });
      await this.tagsCollection.createIndex({ status: 1 });
      await this.tagsCollection.createIndex({ lastUpdated: 1 });

      await this.eventsCollection.createIndex({ tagId: 1, timestamp: -1 });
      await this.eventsCollection.createIndex({ eventType: 1 });
      await this.eventsCollection.createIndex({ "location.zone": 1 });

      await this.alertsCollection.createIndex({ tagId: 1, timestamp: -1 });
      await this.alertsCollection.createIndex({ alertType: 1, severity: 1 });
      await this.alertsCollection.createIndex({ resolved: 1 });

      await this.journeysCollection.createIndex({ tagId: 1 });
      await this.journeysCollection.createIndex({ flightNumber: 1 });
      await this.journeysCollection.createIndex({ startTime: -1 });

      this.logger.info('Database indexes created successfully');
    } catch (error) {
      this.logger.error('Error creating database indexes:', error);
      throw error;
    }
  }

  private subscribeMQTTTopics(): void {
    const topics = [
      'baggage/rfid/+/scan',
      'baggage/conveyor/+/status',
      'baggage/zone/+/entry',
      'baggage/zone/+/exit',
      'airport/flight/+/status',
      'baggage/alert/+',
      'baggage/manual/+/update'
    ];

    topics.forEach(topic => {
      this.mqtt.subscribe(topic, (error) => {
        if (error) {
          this.logger.error(`Failed to subscribe to topic ${topic}:`, error);
        } else {
          this.logger.debug(`Subscribed to topic: ${topic}`);
        }
      });
    });
  }

  private initializeSLATargets(): void {
    this.slaTargets.set('connection_time', {
      type: 'connection_time',
      target: this.CONNECTION_TIME_SLA,
      current: 0,
      threshold: this.CONNECTION_TIME_SLA * 1.2,
      unit: 'minutes'
    });

    this.slaTargets.set('delivery_accuracy', {
      type: 'accuracy',
      target: 99.5,
      current: 0,
      threshold: 97.0,
      unit: 'percentage'
    });

    this.slaTargets.set('mishandling_rate', {
      type: 'accuracy',
      target: 0.5,
      current: 0,
      threshold: 2.0,
      unit: 'percentage'
    });
  }

  private async loadMLModels(): Promise<void> {
    try {
      // In a real implementation, these would load actual ML models
      this.predictionModel = {
        predict: (features: any[]) => {
          // Simplified prediction logic
          return {
            delayProbability: Math.random() * 0.3,
            estimatedDelay: Math.random() * 60,
            confidence: 0.8 + Math.random() * 0.2
          };
        }
      };

      this.routingOptimizer = {
        optimize: (current: Location, destination: Location, constraints: any) => {
          // Simplified routing optimization
          return {
            path: [current, destination],
            estimatedTime: 15 + Math.random() * 30,
            confidence: 0.9
          };
        }
      };

      this.logger.info('ML models loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load ML models:', error);
    }
  }

  // ================================
  // CORE TRACKING FUNCTIONALITY
  // ================================

  public async registerBaggage(
    tagId: string,
    flightInfo: FlightInfo,
    passengerInfo: any,
    handlingInstructions: HandlingInstructions
  ): Promise<BaggageTag> {
    const span = this.tracer.startSpan('registerBaggage');
    
    try {
      const tag: BaggageTag = {
        id: tagId,
        flightNumber: flightInfo.flightNumber,
        passengerName: passengerInfo.name,
        origin: flightInfo.origin,
        destination: flightInfo.destination,
        weight: passengerInfo.weight || 0,
        taggedAt: new Date(),
        status: BaggageStatus.CHECKED_IN,
        priority: handlingInstructions.priority || 'normal',
        specialHandling: handlingInstructions.specialInstructions || [],
        securityStatus: 'pending',
        lastLocation: {
          zone: 'check-in',
          terminal: flightInfo.terminal,
          coordinates: { x: 0, y: 0, z: 0 },
          timestamp: new Date()
        },
        lastUpdated: new Date(),
        journey: {
          checkInTime: new Date(),
          plannedRoute: await this.calculatePlannedRoute(flightInfo),
          actualRoute: [],
          milestones: []
        }
      };

      // Store in database and cache
      await this.tagsCollection.insertOne(tag);
      await this.updateTagCache(tag);

      // Create initial journey record
      await this.createJourneyRecord(tag);

      // Start tracking
      await this.redis.sadd('tracked_bags', tagId);

      // Record event
      await this.recordEvent({
        tagId,
        eventType: BaggageEventType.CHECKED_IN,
        location: tag.lastLocation!,
        timestamp: new Date(),
        metadata: {
          flightNumber: flightInfo.flightNumber,
          passenger: passengerInfo.name,
          weight: tag.weight
        }
      });

      this.metrics.increment('baggage_registered');
      this.logger.info(`Baggage registered: ${tagId} for flight ${flightInfo.flightNumber}`);

      return tag;

    } catch (error) {
      this.logger.error(`Error registering baggage ${tagId}:`, error);
      this.metrics.increment('baggage_registration_errors');
      throw error;
    } finally {
      span.end();
    }
  }

  public async processScan(scanData: RFIDScanData): Promise<void> {
    const span = this.tracer.startSpan('processScan');
    
    try {
      const tag = await this.getTag(scanData.tagId);
    if (!tag) {
        this.logger.warn(`Scan received for unknown tag: ${scanData.tagId}`);
      return;
    }

      // Record the scan event
      const event: BaggageEvent = {
        tagId: scanData.tagId,
        eventType: this.mapScanTypeToEventType(scanData.scanType),
        location: scanData.readerLocation,
        timestamp: scanData.timestamp,
        metadata: {
          readerId: scanData.readerId,
          signalStrength: scanData.signalStrength,
          scanType: scanData.scanType,
          ...scanData.additionalData
        }
      };

      await this.recordEvent(event);

      // Update tag status and location
      const updatedTag = await this.updateTagLocation(tag, scanData);

      // Check for routing optimization
      if (this.config.routeOptimizationEnabled) {
        await this.optimizeRoute(updatedTag);
      }

      // Check for alerts
      await this.checkAlerts(updatedTag, event);

      // Update performance metrics
      await this.updatePerformanceMetrics(updatedTag, event);

      // Broadcast update
      this.emit('baggage_updated', updatedTag);

      this.metrics.increment('scans_processed', { 
        scan_type: scanData.scanType,
        zone: scanData.readerLocation.zone 
      });

    } catch (error) {
      this.logger.error(`Error processing scan for ${scanData.tagId}:`, error);
      this.metrics.increment('scan_processing_errors');
    } finally {
      span.end();
    }
  }

  private async updateTagLocation(tag: BaggageTag, scanData: RFIDScanData): Promise<BaggageTag> {
    // Determine new status based on scan location and type
    const newStatus = this.determineStatusFromScan(tag, scanData);
    
    const updatedTag: BaggageTag = {
      ...tag,
      status: newStatus,
      lastLocation: scanData.readerLocation,
      lastUpdated: new Date()
    };

    // Update journey route
    if (updatedTag.journey) {
      updatedTag.journey.actualRoute.push({
        location: scanData.readerLocation,
        timestamp: scanData.timestamp,
        eventType: this.mapScanTypeToEventType(scanData.scanType)
      });

      // Check for milestone completion
      await this.checkMilestones(updatedTag, scanData);
    }

    // Update in database and cache
    await this.tagsCollection.updateOne(
      { id: tag.id },
      { $set: updatedTag }
    );
    await this.updateTagCache(updatedTag);

    return updatedTag;
  }

  private determineStatusFromScan(tag: BaggageTag, scanData: RFIDScanData): BaggageStatus {
    const zone = scanData.readerLocation.zone.toLowerCase();
    const scanType = scanData.scanType;

    // Status determination logic
    if (zone.includes('security') && scanType === 'checkpoint') {
      return BaggageStatus.SECURITY_CHECK;
    } else if (zone.includes('sorting') || zone.includes('conveyor')) {
        return BaggageStatus.IN_TRANSIT;
    } else if (zone.includes('loading') && scanType === 'loading') {
      return BaggageStatus.LOADING;
    } else if (zone.includes('aircraft') || zone.includes('cargo')) {
        return BaggageStatus.LOADED;
    } else if (zone.includes('claim') || zone.includes('arrival')) {
      return BaggageStatus.AVAILABLE_FOR_PICKUP;
    } else if (zone.includes('pickup') && scanType === 'exit') {
        return BaggageStatus.DELIVERED;
    }

    return tag.status; // Keep current status if no specific rule matches
  }

  private async optimizeRoute(tag: BaggageTag): Promise<void> {
    try {
      if (!tag.lastLocation || !tag.destination) return;

      const currentLocation = tag.lastLocation;
      const destinationLocation = await this.getDestinationLocation(tag);

      const optimization = this.routingOptimizer.optimize(
        currentLocation,
        destinationLocation,
        {
          priority: tag.priority,
          specialHandling: tag.specialHandling,
          currentLoad: await this.getCurrentSystemLoad()
        }
      );

      // Store routing recommendation
      this.routingRules.set(tag.id, {
        tagId: tag.id,
        currentLocation,
        destination: destinationLocation,
        recommendedPath: optimization.path,
        estimatedTime: optimization.estimatedTime,
        confidence: optimization.confidence,
        alternatives: []
      });

      // Send routing instructions to conveyor system
      if (this.config.autoRoutingEnabled && optimization.confidence > 0.8) {
        await this.sendRoutingInstructions(tag.id, optimization);
      }

    } catch (error) {
      this.logger.error(`Error optimizing route for ${tag.id}:`, error);
    }
  }

  // ================================
  // ALERT SYSTEM
  // ================================

  private async checkAlerts(tag: BaggageTag, event: BaggageEvent): Promise<void> {
    const alerts: BaggageAlert[] = [];

    // Check for stationary baggage
    if (await this.isStationary(tag)) {
      alerts.push({
        tagId: tag.id,
        alertType: AlertType.STATIONARY,
        severity: AlertSeverity.MEDIUM,
        message: `Baggage stationary for over ${this.STATIONARY_THRESHOLD_MS / 60000} minutes`,
        timestamp: new Date(),
        location: tag.lastLocation,
        metadata: {
          stationaryDuration: await this.getStationaryDuration(tag),
          lastMovement: await this.getLastMovementTime(tag)
        }
      });
    }

    // Check for wrong zone
    if (await this.isInWrongZone(tag, event.location)) {
      alerts.push({
        tagId: tag.id,
        alertType: AlertType.WRONG_ZONE,
        severity: AlertSeverity.HIGH,
        message: `Baggage detected in incorrect zone: ${event.location.zone}`,
        timestamp: new Date(),
        location: event.location,
        metadata: {
          expectedZone: await this.getExpectedZone(tag),
          currentZone: event.location.zone
        }
      });
    }

    // Check for missed connection
    if (await this.isMissedConnection(tag)) {
      alerts.push({
        tagId: tag.id,
        alertType: AlertType.MISSED_CONNECTION,
        severity: AlertSeverity.CRITICAL,
        message: `Baggage missed connection deadline for flight ${tag.flightNumber}`,
        timestamp: new Date(),
        location: tag.lastLocation,
        metadata: {
          flightNumber: tag.flightNumber,
          connectionDeadline: await this.getConnectionDeadline(tag),
          currentTime: new Date()
        }
      });
    }

    // Check for security hold
    if (await this.isSecurityHold(tag)) {
      alerts.push({
        tagId: tag.id,
        alertType: AlertType.SECURITY_HOLD,
        severity: AlertSeverity.HIGH,
        message: `Baggage held for security screening`,
        timestamp: new Date(),
        location: tag.lastLocation,
        metadata: {
          securityStatus: tag.securityStatus,
          holdReason: await this.getSecurityHoldReason(tag)
        }
      });
    }

    // Process and store alerts
    for (const alert of alerts) {
      await this.storeAlert(alert);
      this.emit('alert_created', alert);
      
      // Send notifications if enabled
      if (this.config.notificationEnabled) {
        await this.sendNotification(alert);
      }
    }
  }

  private async storeAlert(alert: BaggageAlert): Promise<void> {
    try {
      // Store in MongoDB
      await this.alertsCollection.insertOne(alert);

      // Store in Redis for quick access
      const key = `${this.REDIS_ALERT_PREFIX}${alert.tagId}`;
      await this.redis.zadd(key, alert.timestamp.getTime(), JSON.stringify(alert));
      await this.redis.expire(key, 86400 * this.EVENT_RETENTION_DAYS);

      // Update active alerts cache
      const activeAlerts = this.activeAlerts.get(alert.tagId) || [];
      activeAlerts.push(alert);
      this.activeAlerts.set(alert.tagId, activeAlerts);

      this.metrics.increment('alerts_created', { 
        alert_type: alert.alertType,
        severity: alert.severity
      });

      this.logger.info(`Alert created: ${alert.alertType} for bag ${alert.tagId}`);

    } catch (error) {
      this.logger.error(`Error storing alert for ${alert.tagId}:`, error);
      this.metrics.increment('alert_storage_errors');
    }
  }

  // ================================
  // PERFORMANCE MONITORING
  // ================================

  private async updatePerformanceMetrics(tag: BaggageTag, event: BaggageEvent): Promise<void> {
    try {
      const currentTime = new Date();
      
      // Calculate connection time if baggage reaches final destination
      if (event.eventType === BaggageEventType.DELIVERED && tag.journey?.checkInTime) {
        const connectionTime = (currentTime.getTime() - tag.journey.checkInTime.getTime()) / (1000 * 60);
        
        const performanceMetric: PerformanceMetrics = {
          timestamp: currentTime,
          tagId: tag.id,
          flightNumber: tag.flightNumber,
          metrics: {
            connectionTime,
            onTimeDelivery: connectionTime <= this.CONNECTION_TIME_SLA,
            processingSteps: tag.journey?.actualRoute.length || 0,
            alertsGenerated: this.activeAlerts.get(tag.id)?.length || 0
          }
        };

        await this.performanceCollection.insertOne(performanceMetric);
        
        // Update SLA metrics
        await this.updateSLAMetrics(performanceMetric);
      }

      // Update conveyor system metrics
      if (event.location.zone.includes('conveyor')) {
        await this.updateConveyorMetrics(event.location.zone);
      }

    } catch (error) {
      this.logger.error(`Error updating performance metrics:`, error);
    }
  }

  private async updateSLAMetrics(metric: PerformanceMetrics): Promise<void> {
    // Update connection time SLA
    const connectionSLA = this.slaTargets.get('connection_time');
    if (connectionSLA && metric.metrics.connectionTime !== undefined) {
      // Update running average (simplified)
      connectionSLA.current = (connectionSLA.current + metric.metrics.connectionTime) / 2;
      
      if (connectionSLA.current > connectionSLA.threshold) {
        this.emit('sla_violation', {
          type: 'connection_time',
          current: connectionSLA.current,
          threshold: connectionSLA.threshold
        });
      }
    }

    // Update delivery accuracy
    const accuracySLA = this.slaTargets.get('delivery_accuracy');
    if (accuracySLA && metric.metrics.onTimeDelivery !== undefined) {
      // Calculate running percentage (simplified)
      const recentDeliveries = await this.getRecentDeliveryCount();
      const onTimeDeliveries = await this.getOnTimeDeliveryCount();
      
      accuracySLA.current = (onTimeDeliveries / recentDeliveries) * 100;
      
      if (accuracySLA.current < accuracySLA.threshold) {
        this.emit('sla_violation', {
          type: 'delivery_accuracy',
          current: accuracySLA.current,
          threshold: accuracySLA.threshold
        });
      }
    }
  }

  // ================================
  // PUBLIC API METHODS
  // ================================

  public async getTag(tagId: string): Promise<BaggageTag | null> {
    try {
      // Check cache first
      const cached = await this.redis.get(`${this.REDIS_TAG_PREFIX}${tagId}`);
      if (cached) {
        this.metrics.increment('cache_hits');
        return JSON.parse(cached);
      }

      // Query database
      const tag = await this.tagsCollection.findOne({ id: tagId });
      if (tag) {
        await this.updateTagCache(tag);
        this.metrics.increment('cache_misses');
        return tag;
      }

      return null;
    } catch (error) {
      this.logger.error(`Error retrieving tag ${tagId}:`, error);
      throw error;
    }
  }

  public async getTagHistory(tagId: string): Promise<BaggageEvent[]> {
    try {
      const events = await this.eventsCollection
        .find({ tagId })
        .sort({ timestamp: -1 })
        .limit(this.config.maxEventsPerTag)
        .toArray();

      return events;
    } catch (error) {
      this.logger.error(`Error retrieving history for ${tagId}:`, error);
      throw error;
    }
  }

  public async getTagAlerts(tagId: string): Promise<BaggageAlert[]> {
    try {
      const alerts = await this.alertsCollection
        .find({ tagId })
        .sort({ timestamp: -1 })
        .toArray();

      return alerts;
    } catch (error) {
      this.logger.error(`Error retrieving alerts for ${tagId}:`, error);
      throw error;
    }
  }

  public async searchTags(criteria: {
    flightNumber?: string;
    status?: BaggageStatus;
    zone?: string;
    passengerName?: string;
    dateRange?: { start: Date; end: Date };
  }): Promise<BaggageTag[]> {
    try {
      const query: any = {};

      if (criteria.flightNumber) {
        query.flightNumber = criteria.flightNumber;
      }

      if (criteria.status) {
        query.status = criteria.status;
      }

      if (criteria.zone) {
        query['lastLocation.zone'] = criteria.zone;
      }

      if (criteria.passengerName) {
        query.passengerName = new RegExp(criteria.passengerName, 'i');
      }

      if (criteria.dateRange) {
        query.taggedAt = {
          $gte: criteria.dateRange.start,
          $lte: criteria.dateRange.end
        };
      }

      const tags = await this.tagsCollection
        .find(query)
        .sort({ lastUpdated: -1 })
        .toArray();

      return tags;
    } catch (error) {
      this.logger.error('Error searching tags:', error);
      throw error;
    }
  }

  public async predictDelay(tagId: string): Promise<PredictionResult> {
    try {
      const tag = await this.getTag(tagId);
      if (!tag) {
        throw new Error(`Tag not found: ${tagId}`);
      }

      // Extract features for prediction
      const features = await this.extractPredictionFeatures(tag);
      
      // Use ML model for prediction
      const prediction = this.predictionModel.predict(features);

      const result: PredictionResult = {
        tagId,
        delayProbability: prediction.delayProbability,
        estimatedDelay: prediction.estimatedDelay,
        confidence: prediction.confidence,
        factors: await this.identifyDelayFactors(tag, features),
        predictedAt: new Date()
      };

      this.metrics.increment('predictions_made');
      return result;

    } catch (error) {
      this.logger.error(`Error predicting delay for ${tagId}:`, error);
      throw error;
    }
  }

  // ================================
  // UTILITY METHODS
  // ================================

  private async updateTagCache(tag: BaggageTag): Promise<void> {
    const key = `${this.REDIS_TAG_PREFIX}${tag.id}`;
    await this.redis.setex(key, 3600, JSON.stringify(tag)); // 1 hour cache
  }

  private async recordEvent(event: BaggageEvent): Promise<void> {
    // Store in MongoDB
    await this.eventsCollection.insertOne(event);

    // Store in Redis for quick access
    const key = `${this.REDIS_EVENT_PREFIX}${event.tagId}`;
    await this.redis.zadd(key, event.timestamp.getTime(), JSON.stringify(event));
    await this.redis.expire(key, 86400 * this.EVENT_RETENTION_DAYS);

    this.metrics.increment('events_recorded', { event_type: event.eventType });
  }

  private mapScanTypeToEventType(scanType: string): BaggageEventType {
    const mapping = {
      'entry': BaggageEventType.ZONE_ENTRY,
      'exit': BaggageEventType.ZONE_EXIT,
      'checkpoint': BaggageEventType.SCAN,
      'loading': BaggageEventType.LOAD
    };
    return mapping[scanType] || BaggageEventType.SCAN;
  }

  private async handleMqttMessage(topic: string, message: Buffer): Promise<void> {
    const startTime = Date.now();
    
    try {
      const data = JSON.parse(message.toString());
      const topicParts = topic.split('/');

      switch (topicParts[1]) {
        case 'rfid':
          if (topicParts[3] === 'scan') {
            await this.processScan(data as RFIDScanData);
          }
          break;

        case 'conveyor':
          if (topicParts[3] === 'status') {
            await this.updateConveyorStatus(topicParts[2], data);
          }
          break;

        case 'zone':
          await this.processZoneEvent(topicParts[2], topicParts[3], data);
          break;

        case 'alert':
          await this.processExternalAlert(data);
          break;

        default:
          this.logger.warn(`Unknown MQTT topic: ${topic}`);
      }

      const latency = Date.now() - startTime;
      this.metrics.histogram('mqtt_message_processing_time', latency);

    } catch (error) {
      this.logger.error('Error processing MQTT message:', error);
      this.metrics.increment('mqtt_processing_errors');
    }
  }

  private startMaintenanceTasks(): void {
    // Zone checking task
    setInterval(async () => {
      await this.checkAllTagZones();
    }, this.config.zoneCheckInterval);

    // Alert cleanup task
    setInterval(async () => {
      await this.cleanupOldAlerts();
    }, this.config.alertCleanupInterval);

    // Performance reporting task
    setInterval(async () => {
      await this.generatePerformanceReport();
    }, this.config.performanceReportInterval);

    this.logger.info('Maintenance tasks started');
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down BaggageTrackingService...');
    
    try {
      if (this.mqtt) {
        this.mqtt.end();
      }
      
      if (this.redis) {
        this.redis.disconnect();
      }

      this.logger.info('BaggageTrackingService shutdown completed');
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
    }
  }

  // Helper methods (simplified implementations)
  private async isStationary(tag: BaggageTag): Promise<boolean> {
    if (!tag.lastUpdated) return false;
    return Date.now() - tag.lastUpdated.getTime() > this.STATIONARY_THRESHOLD_MS;
  }

  private async isInWrongZone(tag: BaggageTag, location: Location): Promise<boolean> {
    const expectedZone = await this.getExpectedZone(tag);
    return expectedZone !== location.zone;
  }

  private async isMissedConnection(tag: BaggageTag): Promise<boolean> {
    const deadline = await this.getConnectionDeadline(tag);
    return deadline && new Date() > deadline;
  }

  private async isSecurityHold(tag: BaggageTag): Promise<boolean> {
    return tag.securityStatus === 'hold' || tag.securityStatus === 'screening';
  }

  // Placeholder implementations for complex methods
  private async calculatePlannedRoute(flightInfo: FlightInfo): Promise<any[]> { return []; }
  private async createJourneyRecord(tag: BaggageTag): Promise<void> { }
  private async getDestinationLocation(tag: BaggageTag): Promise<Location> { return tag.lastLocation!; }
  private async getCurrentSystemLoad(): Promise<number> { return 0.5; }
  private async sendRoutingInstructions(tagId: string, optimization: any): Promise<void> { }
  private async getStationaryDuration(tag: BaggageTag): Promise<number> { return 0; }
  private async getLastMovementTime(tag: BaggageTag): Promise<Date> { return new Date(); }
  private async getExpectedZone(tag: BaggageTag): Promise<string> { return ''; }
  private async getConnectionDeadline(tag: BaggageTag): Promise<Date | null> { return null; }
  private async getSecurityHoldReason(tag: BaggageTag): Promise<string> { return ''; }
  private async sendNotification(alert: BaggageAlert): Promise<void> { }
  private async updateConveyorMetrics(zone: string): Promise<void> { }
  private async getRecentDeliveryCount(): Promise<number> { return 100; }
  private async getOnTimeDeliveryCount(): Promise<number> { return 95; }
  private async extractPredictionFeatures(tag: BaggageTag): Promise<any[]> { return []; }
  private async identifyDelayFactors(tag: BaggageTag, features: any[]): Promise<string[]> { return []; }
  private async updateConveyorStatus(conveyorId: string, data: any): Promise<void> { }
  private async processZoneEvent(zone: string, eventType: string, data: any): Promise<void> { }
  private async processExternalAlert(data: any): Promise<void> { }
  private async checkAllTagZones(): Promise<void> { }
  private async cleanupOldAlerts(): Promise<void> { }
  private async generatePerformanceReport(): Promise<void> { }
  private async checkMilestones(tag: BaggageTag, scanData: RFIDScanData): Promise<void> { }
} 
