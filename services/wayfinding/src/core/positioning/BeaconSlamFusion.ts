/**
 * BeaconSlamFusion.ts
 * Fuses BLE/UWB beacon data with visual SLAM for accurate indoor positioning
 */

import { Vector3 } from 'three';
import { MetricsClient } from '../../monitoring/MetricsClient';
import { TracingClient } from '../../monitoring/TracingClient';
import { Logger } from '../../utils/Logger';
import { KalmanFilter } from 'kalmanjs';
import { EventEmitter } from 'events';
import { Beacon, Position, SlamData, FusionResult } from '../../types';
import { metrics } from '../../utils/metrics';

interface BeaconData {
  id: string;
  position: Vector3;
  type: 'BLE' | 'UWB';
  rssi?: number;
  distance?: number;
  timestamp: number;
}

interface FusionConfig {
  beaconWeight: number;
  slamWeight: number;
  maxBeaconAge: number;
  minBeaconCount: number;
  minFeatureCount: number;
  kalmanNoiseParams: {
    processNoise: number;
    measurementNoise: number;
  };
}

export class BeaconSlamFusion extends EventEmitter {
  private beacons: Map<string, Beacon>;
  private lastSlamData?: SlamData;
  private kalmanFilter: KalmanFilter;
  private lastPosition: Position | null;
  private confidenceScore: number;
  private readonly updateInterval: number;
  private readonly maxBeaconAge: number;
  private config: FusionConfig;
  private metrics: MetricsClient;
  private tracer: TracingClient;
  private logger: Logger;

  // Metrics for monitoring positioning accuracy and performance
  private readonly positioningLatencyHistogram = metrics.createHistogram({
    name: 'positioning_latency_seconds',
    help: 'Latency of position calculations in seconds',
    labelNames: ['method']
  });

  private readonly positioningAccuracyGauge = metrics.createGauge({
    name: 'positioning_accuracy_meters',
    help: 'Estimated accuracy of position in meters',
    labelNames: ['method']
  });

  constructor(
    config: FusionConfig,
    metrics: MetricsClient,
    tracer: TracingClient,
    logger: Logger,
    options = {
      updateInterval: 100, // ms
      maxBeaconAge: 5000, // ms
      initialPosition: { x: 0, y: 0, z: 0 }
    }
  ) {
    super();
    this.config = config;
    this.metrics = metrics;
    this.tracer = tracer;
    this.logger = logger;
    this.beacons = new Map();
    this.kalmanFilter = new KalmanFilter({
      R: 0.01, // Process noise
      Q: 0.1,  // Measurement noise
      A: 1,    // State transition
      B: 0,    // Control input
      C: 1     // Measurement matrix
    });
    this.lastPosition = options.initialPosition;
    this.confidenceScore = 0;
    this.updateInterval = options.updateInterval;
    this.maxBeaconAge = options.maxBeaconAge;

    // Start periodic updates
    setInterval(() => this.update(), this.updateInterval);

    this.setupMetrics();
  }

  /**
   * Update beacon data
   */
  public updateBeacon(id: string, rssi: number, distance: number): void {
    const startTime = process.hrtime();
    
    this.beacons.set(id, {
      id,
      rssi,
      distance,
      lastUpdate: Date.now()
    });

    const [seconds, nanoseconds] = process.hrtime(startTime);
    this.positioningLatencyHistogram.observe({ method: 'beacon_update' }, 
      seconds + nanoseconds / 1e9);
  }

  /**
   * Update SLAM data
   */
  public updateSlam(slamData: SlamData): void {
    const startTime = process.hrtime();
    
    // Apply SLAM corrections to current position estimate
    if (this.lastPosition && slamData.confidence > 0.7) {
      this.lastPosition = {
        x: this.kalmanFilter.filter(slamData.position.x),
        y: this.kalmanFilter.filter(slamData.position.y),
        z: this.kalmanFilter.filter(slamData.position.z)
      };
      this.confidenceScore = Math.max(this.confidenceScore, slamData.confidence);
    }

    const [seconds, nanoseconds] = process.hrtime(startTime);
    this.positioningLatencyHistogram.observe({ method: 'slam_update' },
      seconds + nanoseconds / 1e9);
  }

  /**
   * Main update loop that fuses beacon and SLAM data
   */
  private update(): void {
    const startTime = process.hrtime();
    
    try {
      // Clean up old beacons
      const now = Date.now();
      for (const [id, beacon] of this.beacons) {
        if (now - beacon.lastUpdate > this.maxBeaconAge) {
          this.beacons.delete(id);
        }
      }

      // Calculate position from active beacons using trilateration
      if (this.beacons.size >= 3) {
        const newPosition = this.calculatePosition();
        if (newPosition) {
          this.lastPosition = newPosition;
          this.confidenceScore = Math.min(1.0, this.beacons.size / 5);
          
          // Update accuracy metric
          this.positioningAccuracyGauge.set(
            { method: 'fusion' },
            this.estimateAccuracy()
          );

          // Emit new position
          this.emit('position', {
            position: this.lastPosition,
            confidence: this.confidenceScore,
            timestamp: Date.now()
          } as FusionResult);
        }
      }
    } catch (error) {
      this.logger.error('Error in BeaconSlamFusion update:', error);
    }

    const [seconds, nanoseconds] = process.hrtime(startTime);
    this.positioningLatencyHistogram.observe({ method: 'fusion' },
      seconds + nanoseconds / 1e9);
  }

  /**
   * Calculates position using trilateration from beacon distances
   */
  private calculatePosition(): Position | null {
    if (this.beacons.size < 3) return null;

    // Convert beacon data to arrays for trilateration
    const positions: Position[] = [];
    const distances: number[] = [];
    
    this.beacons.forEach(beacon => {
      // Only use beacons with valid distances
      if (beacon.distance > 0) {
        positions.push(beacon.position);
        distances.push(beacon.distance);
      }
    });

    if (positions.length < 3) return null;

    // Implement trilateration using least squares optimization
    // This is a simplified version - in practice, you'd want to use
    // a more sophisticated algorithm that handles measurement noise
    let sumX = 0, sumY = 0, sumZ = 0;
    let totalWeight = 0;

    for (let i = 0; i < positions.length; i++) {
      // Weight measurements by inverse square of distance
      const weight = 1 / (distances[i] * distances[i]);
      sumX += positions[i].x * weight;
      sumY += positions[i].y * weight;
      sumZ += positions[i].z * weight;
      totalWeight += weight;
    }

    return {
      x: sumX / totalWeight,
      y: sumY / totalWeight,
      z: sumZ / totalWeight
    };
  }

  /**
   * Estimates current positioning accuracy in meters
   */
  private estimateAccuracy(): number {
    const beaconCount = this.beacons.size;
    const baseAccuracy = 2.0; // Base accuracy in meters
    
    // Accuracy improves with more beacons
    return baseAccuracy * (1 / Math.sqrt(beaconCount));
  }

  /**
   * Returns the current position and confidence
   */
  public getCurrentPosition(): FusionResult {
    return {
      position: this.lastPosition || { x: 0, y: 0, z: 0 },
      confidence: this.confidenceScore,
      timestamp: Date.now()
    };
  }

  private setupMetrics(): void {
    this.metrics.defineCounter('positioning.beacon_updates', 'Number of beacon updates');
    this.metrics.defineCounter('positioning.slam_updates', 'Number of SLAM updates');
    this.metrics.defineCounter('positioning.errors', 'Number of positioning errors');
    this.metrics.defineGauge('positioning.beacon_count', 'Total number of beacons');
    this.metrics.defineGauge('positioning.valid_beacon_count', 'Number of valid beacons');
    this.metrics.defineGauge('positioning.feature_count', 'Number of SLAM features');
    this.metrics.defineGauge('positioning.uncertainty', 'Position uncertainty (meters)');
    this.metrics.defineGauge('positioning.x', 'X coordinate (meters)');
    this.metrics.defineGauge('positioning.y', 'Y coordinate (meters)');
    this.metrics.defineGauge('positioning.z', 'Z coordinate (meters)');
    this.metrics.defineGauge('positioning.beacon_type_BLE', 'Number of BLE beacons');
    this.metrics.defineGauge('positioning.beacon_type_UWB', 'Number of UWB beacons');
  }
} 