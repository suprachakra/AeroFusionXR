/**
 * AutoCalibration.ts
 * Handles automatic calibration of beacon positions and SLAM drift correction
 */

import { Vector3 } from 'three';
import { MetricsClient } from '../../monitoring/MetricsClient';
import { TracingClient } from '../../monitoring/TracingClient';
import { Logger } from '../../utils/Logger';
import { BeaconSlamFusion } from '../positioning/BeaconSlamFusion';
import { Beacon, Position, FloorPlan } from '../../types';
import { logger } from '../../utils/Logger';
import { metrics } from '../../utils/metrics';

interface CalibrationConfig {
  minSamples: number;
  maxSamples: number;
  minConfidence: number;
  maxDriftPerHour: number;
  calibrationInterval: number;
  driftCheckInterval: number;
}

interface BeaconCalibrationData {
  id: string;
  type: 'BLE' | 'UWB';
  samples: Array<{
    position: Vector3;
    rssi?: number;
    timestamp: number;
  }>;
  lastCalibration: number;
  confidence: number;
}

interface DriftData {
  timestamp: number;
  offset: Vector3;
  confidence: number;
}

export class AutoCalibration {
  private beaconData: Map<string, BeaconCalibrationData>;
  private driftHistory: DriftData[];
  private config: CalibrationConfig;
  private metrics: MetricsClient;
  private tracer: TracingClient;
  private logger: Logger;
  private positioning: BeaconSlamFusion;
  private floorPlans: Map<number, FloorPlan>;
  private calibrationData: Map<string, {
    originalPosition: Position;
    measurements: Array<{
      position: Position;
      rssi: number;
      timestamp: number;
    }>;
    lastCalibration: number;
  }>;

  // Metrics
  private readonly calibrationErrorGauge = metrics.createGauge({
    name: 'beacon_calibration_error_meters',
    help: 'Estimated error in beacon position calibration',
    labelNames: ['beacon_id']
  });

  private readonly driftRateGauge = metrics.createGauge({
    name: 'beacon_drift_rate_meters_per_day',
    help: 'Rate of beacon position drift',
    labelNames: ['beacon_id']
  });

  private readonly calibrationHistogram = metrics.createHistogram({
    name: 'beacon_calibration_duration_seconds',
    help: 'Time taken to calibrate beacon positions',
    buckets: [1, 5, 10, 30, 60]
  });

  constructor(
    config: CalibrationConfig,
    positioning: BeaconSlamFusion,
    metrics: MetricsClient,
    tracer: TracingClient,
    logger: Logger
  ) {
    this.config = config;
    this.positioning = positioning;
    this.metrics = metrics;
    this.tracer = tracer;
    this.logger = logger;
    this.beaconData = new Map();
    this.driftHistory = [];
    this.floorPlans = new Map();
    this.calibrationData = new Map();

    this.setupMetrics();
    this.startCalibrationLoop();
    this.startDriftCheckLoop();
  }

  /**
   * Add a beacon observation for calibration
   */
  public addBeaconObservation(
    id: string,
    type: 'BLE' | 'UWB',
    position: Vector3,
    rssi?: number
  ): void {
    const span = this.tracer.startSpan('AutoCalibration.addBeaconObservation');

    try {
      let data = this.beaconData.get(id);
      if (!data) {
        data = {
          id,
          type,
          samples: [],
          lastCalibration: 0,
          confidence: 0
        };
        this.beaconData.set(id, data);
      }

      // Add sample
      data.samples.push({
        position: position.clone(),
        rssi,
        timestamp: Date.now()
      });

      // Prune old samples
      this.pruneSamples(data);

      this.metrics.increment('calibration.observations');
      this.metrics.gauge('calibration.sample_count', data.samples.length);

    } catch (error) {
      this.logger.error('Error adding beacon observation', error);
      this.metrics.increment('calibration.errors');
      throw error;

    } finally {
      span.end();
    }
  }

  /**
   * Get current drift estimate
   */
  public getDrift(): Vector3 {
    if (this.driftHistory.length === 0) {
      return new Vector3();
    }

    // Weight recent drift measurements more heavily
    const now = Date.now();
    const weightedSum = new Vector3();
    let totalWeight = 0;

    this.driftHistory.forEach(drift => {
      const age = (now - drift.timestamp) / (60 * 60 * 1000); // Hours
      const weight = Math.exp(-age) * drift.confidence;
      weightedSum.add(drift.offset.clone().multiplyScalar(weight));
      totalWeight += weight;
    });

    return totalWeight > 0 ? weightedSum.divideScalar(totalWeight) : new Vector3();
  }

  private async calibrateBeacons(): Promise<void> {
    const span = this.tracer.startSpan('AutoCalibration.calibrateBeacons');

    try {
      for (const data of this.beaconData.values()) {
        if (!this.shouldCalibrate(data)) continue;

        const calibratedPosition = await this.computeBeaconPosition(data);
        if (!calibratedPosition) continue;

        // Update beacon position
        await this.updateBeaconPosition(data.id, calibratedPosition);
        
        data.lastCalibration = Date.now();
        this.metrics.increment('calibration.updates');
      }

    } catch (error) {
      this.logger.error('Error calibrating beacons', error);
      this.metrics.increment('calibration.errors');
      throw error;

    } finally {
      span.end();
    }
  }

  private async checkDrift(): Promise<void> {
    const span = this.tracer.startSpan('AutoCalibration.checkDrift');

    try {
      // Get current position estimate
      const currentPosition = this.positioning.getPosition();
      const uncertainty = this.positioning.getUncertainty();

      // Compare with known reference points
      // TODO: Implement reference point comparison
      const drift = new Vector3(); // Placeholder
      const confidence = 1 / (1 + uncertainty);

      // Add to history
      this.driftHistory.push({
        timestamp: Date.now(),
        offset: drift,
        confidence
      });

      // Prune old drift measurements
      this.pruneDriftHistory();

      // Check for excessive drift
      const driftMagnitude = drift.length();
      this.metrics.gauge('calibration.drift', driftMagnitude);

      if (driftMagnitude > this.config.maxDriftPerHour) {
        this.logger.warn('Excessive drift detected', {
          drift: driftMagnitude,
          threshold: this.config.maxDriftPerHour
        });
        this.metrics.increment('calibration.drift_alerts');
      }

    } catch (error) {
      this.logger.error('Error checking drift', error);
      this.metrics.increment('calibration.errors');
      throw error;

    } finally {
      span.end();
    }
  }

  private async computeBeaconPosition(
    data: BeaconCalibrationData
  ): Promise<Vector3 | null> {
    if (data.samples.length < this.config.minSamples) {
      return null;
    }

    // Weight samples by recency and RSSI
    const now = Date.now();
    const positions: Vector3[] = [];
    const weights: number[] = [];

    data.samples.forEach(sample => {
      const age = (now - sample.timestamp) / (60 * 60 * 1000); // Hours
      let weight = Math.exp(-age);

      if (sample.rssi !== undefined) {
        // Stronger RSSI = higher weight
        const rssiWeight = Math.exp((sample.rssi + 100) / 20);
        weight *= rssiWeight;
      }

      positions.push(sample.position);
      weights.push(weight);
    });

    // Weighted average
    const position = new Vector3();
    let totalWeight = 0;

    for (let i = 0; i < positions.length; i++) {
      position.add(positions[i].clone().multiplyScalar(weights[i]));
      totalWeight += weights[i];
    }

    if (totalWeight > 0) {
      position.divideScalar(totalWeight);
      return position;
    }

    return null;
  }

  private shouldCalibrate(data: BeaconCalibrationData): boolean {
    const age = Date.now() - data.lastCalibration;
    return age >= this.config.calibrationInterval &&
           data.samples.length >= this.config.minSamples;
  }

  private pruneSamples(data: BeaconCalibrationData): void {
    // Remove old samples
    const now = Date.now();
    data.samples = data.samples.filter(sample => {
      const age = now - sample.timestamp;
      return age <= this.config.calibrationInterval;
    });

    // Limit total samples
    if (data.samples.length > this.config.maxSamples) {
      data.samples = data.samples
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.config.maxSamples);
    }
  }

  private pruneDriftHistory(): void {
    const now = Date.now();
    this.driftHistory = this.driftHistory.filter(drift => {
      const age = (now - drift.timestamp) / (60 * 60 * 1000); // Hours
      return age <= 24; // Keep 24 hours of history
    });
  }

  private async updateBeaconPosition(
    id: string,
    position: Vector3
  ): Promise<void> {
    // TODO: Implement beacon position update in database/config
    this.logger.info('Updated beacon position', {
      id,
      position: {
        x: position.x,
        y: position.y,
        z: position.z
      }
    });
  }

  private startCalibrationLoop(): void {
    setInterval(
      () => this.calibrateBeacons(),
      this.config.calibrationInterval
    );
  }

  private startDriftCheckLoop(): void {
    setInterval(
      () => this.checkDrift(),
      this.config.driftCheckInterval
    );
  }

  private setupMetrics(): void {
    this.metrics.defineCounter('calibration.observations', 'Number of beacon observations');
    this.metrics.defineCounter('calibration.updates', 'Number of beacon position updates');
    this.metrics.defineCounter('calibration.errors', 'Number of calibration errors');
    this.metrics.defineCounter('calibration.drift_alerts', 'Number of excessive drift alerts');
    this.metrics.defineGauge('calibration.sample_count', 'Number of samples per beacon');
    this.metrics.defineGauge('calibration.drift', 'Current drift magnitude (meters)');
  }

  /**
   * Adds a floor plan to the calibration system
   */
  public addFloorPlan(floorPlan: FloorPlan): void {
    this.floorPlans.set(floorPlan.level, floorPlan);
    
    // Initialize calibration data for new beacons
    floorPlan.beacons.forEach(beacon => {
      if (!this.calibrationData.has(beacon.id)) {
        this.calibrationData.set(beacon.id, {
          originalPosition: { ...beacon.position },
          measurements: [],
          lastCalibration: Date.now()
        });
      }
    });
  }

  /**
   * Records a new RSSI measurement for a beacon
   */
  public addMeasurement(beaconId: string, rssi: number, position: Position): void {
    const data = this.calibrationData.get(beaconId);
    if (!data) {
      logger.warn(`No calibration data for beacon ${beaconId}`);
      return;
    }

    data.measurements.push({
      position,
      rssi,
      timestamp: Date.now()
    });

    // Keep only last 100 measurements
    if (data.measurements.length > 100) {
      data.measurements.shift();
    }
  }

  /**
   * Performs calibration for all beacons
   */
  public async calibrateAll(): Promise<void> {
    const startTime = performance.now();

    try {
      for (const [beaconId, data] of this.calibrationData) {
        await this.calibrateBeacon(beaconId, data);
      }

      const duration = (performance.now() - startTime) / 1000;
      this.calibrationHistogram.observe(duration);

      logger.info('Completed beacon calibration', {
        beacons: this.calibrationData.size,
        duration
      });
    } catch (error) {
      logger.error('Error during calibration:', error);
      throw error;
    }
  }

  /**
   * Calibrates a single beacon's position
   */
  private async calibrateBeacon(beaconId: string, data: {
    originalPosition: Position;
    measurements: Array<{
      position: Position;
      rssi: number;
      timestamp: number;
    }>;
    lastCalibration: number;
  }): Promise<void> {
    if (data.measurements.length < 10) {
      logger.debug(`Insufficient measurements for beacon ${beaconId}`);
      return;
    }

    try {
      // Calculate new position using trilateration
      const newPosition = this.calculatePosition(data.measurements);
      if (!newPosition) return;

      // Calculate drift
      const timeDiff = (Date.now() - data.lastCalibration) / (24 * 60 * 60 * 1000); // days
      const drift = this.calculateDistance(data.originalPosition, newPosition);
      const driftRate = drift / timeDiff;

      // Update metrics
      this.calibrationErrorGauge.set({ beacon_id: beaconId }, drift);
      this.driftRateGauge.set({ beacon_id: beaconId }, driftRate);

      // Update beacon position in floor plan
      this.updateBeaconPosition(beaconId, newPosition);
      data.lastCalibration = Date.now();

      logger.info(`Calibrated beacon ${beaconId}`, {
        drift,
        driftRate,
        measurements: data.measurements.length
      });
    } catch (error) {
      logger.error(`Error calibrating beacon ${beaconId}:`, error);
      throw error;
    }
  }

  /**
   * Calculates beacon position using trilateration from RSSI measurements
   */
  private calculatePosition(measurements: Array<{
    position: Position;
    rssi: number;
    timestamp: number;
  }>): Position | null {
    // Filter recent measurements
    const recentMeasurements = measurements.filter(m => 
      Date.now() - m.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
    );

    if (recentMeasurements.length < 10) return null;

    // Convert RSSI to estimated distances
    const points = recentMeasurements.map(m => ({
      position: m.position,
      distance: this.rssiToDistance(m.rssi)
    }));

    // Use least squares optimization to find best position
    let sumX = 0, sumY = 0, sumZ = 0, count = 0;
    points.forEach(point => {
      const weight = 1 / (point.distance * point.distance); // Weight by inverse square distance
      sumX += point.position.x * weight;
      sumY += point.position.y * weight;
      sumZ += point.position.z * weight;
      count += weight;
    });

    return {
      x: sumX / count,
      y: sumY / count,
      z: sumZ / count
    };
  }

  /**
   * Converts RSSI to estimated distance using path loss model
   */
  private rssiToDistance(rssi: number): number {
    const txPower = -59; // Calibrated transmit power at 1 meter
    const pathLossExponent = 2.0; // Path loss exponent (2.0 for free space)
    
    return Math.pow(10, (txPower - rssi) / (10 * pathLossExponent));
  }

  /**
   * Updates beacon position in floor plan
   */
  private updateBeaconPosition(beaconId: string, position: Position): void {
    for (const floorPlan of this.floorPlans.values()) {
      const beacon = floorPlan.beacons.find(b => b.id === beaconId);
      if (beacon) {
        beacon.position = position;
        break;
      }
    }
  }

  /**
   * Calculates Euclidean distance between two positions
   */
  private calculateDistance(pos1: Position, pos2: Position): number {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Gets calibration statistics for all beacons
   */
  public getCalibrationStats(): Array<{
    beaconId: string;
    drift: number;
    driftRate: number;
    lastCalibration: number;
    measurementCount: number;
  }> {
    return Array.from(this.calibrationData.entries()).map(([beaconId, data]) => {
      const drift = this.calculateDistance(
        data.originalPosition,
        this.findBeaconPosition(beaconId) || data.originalPosition
      );
      const timeDiff = (Date.now() - data.lastCalibration) / (24 * 60 * 60 * 1000);
      
      return {
        beaconId,
        drift,
        driftRate: drift / timeDiff,
        lastCalibration: data.lastCalibration,
        measurementCount: data.measurements.length
      };
    });
  }

  /**
   * Finds current position of a beacon
   */
  private findBeaconPosition(beaconId: string): Position | null {
    for (const floorPlan of this.floorPlans.values()) {
      const beacon = floorPlan.beacons.find(b => b.id === beaconId);
      if (beacon) {
        return beacon.position;
      }
    }
    return null;
  }
} 