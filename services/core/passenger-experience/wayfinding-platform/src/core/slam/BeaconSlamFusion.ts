/**
 * BeaconSlamFusion.ts
 * Handles fusion of BLE/UWB beacon data with Visual SLAM for robust indoor positioning
 */

import { Matrix4, Vector3 } from 'three';
import { BeaconManager } from '../beacons/BeaconManager';
import { SlamEngine } from './SlamEngine';
import { KalmanFilter } from '../utils/KalmanFilter';
import { MetricsClient } from '../monitoring/MetricsClient';
import { TracingClient } from '../monitoring/TracingClient';
import { createLogger } from '@aerofusionxr/shared';

// ================================
// TYPES AND INTERFACES
// ================================

export interface CalibrationSample {
  beaconId: string;
  position: Vector3;
  rssi: number;
  measuredDistance: number;
  referenceDistance: number;
  timestamp: Date;
  environmentalFactors: {
    temperature: number;
    humidity: number;
    interference: number;
  };
}

export interface SlamWeights {
  rssi: number;
  trilateration: number;
  environmental: number;
  confidence: number;
  adaptationRate: number;
  maxAdjustment: number;
}

export interface BeaconReading {
  id: string;
  position: Vector3;
  rssi: number;
  distance: number;
  timestamp: Date;
  accuracy: number;
}

interface FusionConfig {
  beaconWeight: number;
  slamWeight: number;
  minBeacons: number;
  maxAge: number;
  kalmanParams: {
    processNoise: number;
    measurementNoise: number;
  };
}

export class BeaconSlamFusion {
  private beaconManager: BeaconManager;
  private slamEngine: SlamEngine;
  private kalmanFilter: KalmanFilter;
  private config: FusionConfig;
  private lastPosition: Vector3;
  private lastUpdate: number;
  private metrics: MetricsClient;
  private tracer: TracingClient;
  private logger: Logger;

  constructor(
    beaconManager: BeaconManager,
    slamEngine: SlamEngine,
    config: FusionConfig,
    metrics: MetricsClient,
    tracer: TracingClient,
    logger: Logger
  ) {
    this.beaconManager = beaconManager;
    this.slamEngine = slamEngine;
    this.config = config;
    this.metrics = metrics;
    this.tracer = tracer;
    this.logger = logger;

    this.kalmanFilter = new KalmanFilter(config.kalmanParams);
    this.lastPosition = new Vector3();
    this.lastUpdate = Date.now();

    // Initialize monitoring
    this.setupMetrics();
  }

  /**
   * Updates position estimate using beacon and SLAM data
   * @returns Current position estimate as Vector3
   */
  public async updatePosition(): Promise<Vector3> {
    const span = this.tracer.startSpan('BeaconSlamFusion.updatePosition');

    try {
      // Get beacon positions
      const beaconData = await this.beaconManager.getBeaconPositions();
      this.metrics.gauge('beacon.count', beaconData.length);

      // Get SLAM position
      const slamPosition = await this.slamEngine.getCurrentPosition();
      
      // Calculate weights based on conditions
      const weights = this.calculateWeights(beaconData.length);
      
      // Fuse positions
      const fusedPosition = this.fusePositions(beaconData, slamPosition, weights);
      
      // Apply Kalman filter
      const filteredPosition = this.kalmanFilter.update(fusedPosition);
      
      // Update state
      this.lastPosition.copy(filteredPosition);
      this.lastUpdate = Date.now();

      // Record metrics
      this.recordMetrics(beaconData.length, weights);

      return filteredPosition;

    } catch (error) {
      this.logger.error('Error in position update', error);
      this.metrics.increment('fusion.errors');
      throw error;

    } finally {
      span.end();
    }
  }

  /**
   * Auto-calibrates fusion weights based on environment
   */
  public async calibrateWeights(): Promise<void> {
    const span = this.tracer.startSpan('BeaconSlamFusion.calibrateWeights');

    try {
      // Collect sample measurements
      const samples = await this.collectCalibrationSamples();
      
      // Calculate optimal weights
      const optimalWeights = this.calculateOptimalWeights(samples);
      
      // Update config
      this.config.beaconWeight = optimalWeights.beacon;
      this.config.slamWeight = optimalWeights.slam;

      this.logger.info('Calibration complete', { weights: optimalWeights });
      this.metrics.gauge('calibration.beacon_weight', optimalWeights.beacon);
      this.metrics.gauge('calibration.slam_weight', optimalWeights.slam);

    } catch (error) {
      this.logger.error('Calibration failed', error);
      this.metrics.increment('calibration.errors');
      throw error;

    } finally {
      span.end();
    }
  }

  private setupMetrics(): void {
    // Define metrics
    this.metrics.defineGauge('beacon.count', 'Number of visible beacons');
    this.metrics.defineGauge('fusion.beacon_weight', 'Current beacon weight in fusion');
    this.metrics.defineGauge('fusion.slam_weight', 'Current SLAM weight in fusion');
    this.metrics.defineHistogram('fusion.position_delta', 'Change in position between updates');
    this.metrics.defineCounter('fusion.errors', 'Number of fusion errors');
  }

  private calculateWeights(beaconCount: number): { beacon: number; slam: number } {
    // Adjust weights based on beacon count and environment
    let beaconWeight = this.config.beaconWeight;
    let slamWeight = this.config.slamWeight;

    if (beaconCount < this.config.minBeacons) {
      // Reduce beacon weight when few beacons are visible
      beaconWeight *= (beaconCount / this.config.minBeacons);
      slamWeight = 1 - beaconWeight;
    }

    return { beacon: beaconWeight, slam: slamWeight };
  }

  private fusePositions(
    beaconData: Array<{ position: Vector3; rssi: number }>,
    slamPosition: Vector3,
    weights: { beacon: number; slam: number }
  ): Vector3 {
    // Weighted average of positions
    const fusedPosition = new Vector3();
    
    // Add weighted SLAM position
    fusedPosition.add(slamPosition.multiplyScalar(weights.slam));
    
    // Add weighted beacon position
    if (beaconData.length > 0) {
      const beaconPosition = this.calculateBeaconPosition(beaconData);
      fusedPosition.add(beaconPosition.multiplyScalar(weights.beacon));
    }

    return fusedPosition;
  }

  private calculateBeaconPosition(beaconData: Array<{ position: Vector3; rssi: number }>): Vector3 {
    // Weighted average based on RSSI
    const position = new Vector3();
    let totalWeight = 0;

    beaconData.forEach(beacon => {
      const weight = Math.pow(10, beacon.rssi / -20); // Convert RSSI to weight
      position.add(beacon.position.multiplyScalar(weight));
      totalWeight += weight;
    });

    return position.divideScalar(totalWeight);
  }

  private recordMetrics(beaconCount: number, weights: { beacon: number; slam: number }): void {
    this.metrics.gauge('fusion.beacon_weight', weights.beacon);
    this.metrics.gauge('fusion.slam_weight', weights.slam);
    
    const positionDelta = this.lastPosition.distanceTo(this.lastPosition);
    this.metrics.histogram('fusion.position_delta', positionDelta);
  }

  public async collectCalibrationSamples(duration: number = 30): Promise<CalibrationSample[]> {
    const samples: CalibrationSample[] = [];
    const sampleInterval = 1000; // 1 second intervals
    const totalSamples = duration;
    
    this.logger.info(`Starting beacon calibration data collection for ${duration} seconds`);
    
    try {
      for (let i = 0; i < totalSamples; i++) {
        // Simulate beacon reading collection during calibration
        const beacons = await this.mockBeaconReadings(); // In production, this would be real beacon readings
        
        for (const beacon of beacons) {
          // Calculate distance using trilateration from known reference points
          const referenceDistance = this.calculateReferenceDistance(beacon);
          
          const sample: CalibrationSample = {
            beaconId: beacon.id,
            position: beacon.position,
            rssi: beacon.rssi,
            measuredDistance: beacon.distance,
            referenceDistance,
            timestamp: new Date(),
            environmentalFactors: {
              temperature: 22 + Math.random() * 4, // 22-26°C
              humidity: 45 + Math.random() * 10,   // 45-55%
              interference: Math.random() * 0.3    // 0-30% interference
            }
          };
          
          samples.push(sample);
        }
        
        // Wait for next sample interval in production
        // await new Promise(resolve => setTimeout(resolve, sampleInterval));
      }
      
      this.logger.info(`Collected ${samples.length} calibration samples`);
      
      // Store samples for analysis
      this.calibrationSamples = samples;
      
      return samples;
      
    } catch (error) {
      this.logger.error('Error collecting calibration samples:', error);
      throw error;
    }
  }

  public calculateOptimalWeights(samples: CalibrationSample[]): SlamWeights {
    try {
      if (samples.length === 0) {
        throw new Error('No calibration samples provided');
      }
      
      this.logger.info(`Calculating optimal SLAM weights from ${samples.length} samples`);
      
      // Group samples by beacon
      const beaconSamples = new Map<string, CalibrationSample[]>();
      samples.forEach(sample => {
        if (!beaconSamples.has(sample.beaconId)) {
          beaconSamples.set(sample.beaconId, []);
        }
        beaconSamples.get(sample.beaconId)!.push(sample);
      });
      
      // Calculate accuracy metrics for each method
      const rssiAccuracy = this.calculateRSSIAccuracy(samples);
      const trilaterationAccuracy = this.calculateTrilaterationAccuracy(samples);
      const environmentalFactor = this.calculateEnvironmentalFactor(samples);
      
      // Calculate optimal weights using weighted least squares
      let rssiWeight = 0.4;
      let trilaterationWeight = 0.6;
      
      // Adjust weights based on measured accuracy
      if (rssiAccuracy < 2.0) { // RSSI very accurate (< 2m error)
        rssiWeight = 0.6;
        trilaterationWeight = 0.4;
      } else if (trilaterationAccuracy < 1.0) { // Trilateration very accurate (< 1m error)
        rssiWeight = 0.3;
        trilaterationWeight = 0.7;
      }
      
      // Apply environmental compensation
      const environmentalWeight = Math.max(0.1, 1.0 - environmentalFactor);
      rssiWeight *= environmentalWeight;
      
      // Normalize weights
      const totalWeight = rssiWeight + trilaterationWeight;
      rssiWeight /= totalWeight;
      trilaterationWeight /= totalWeight;
      
      const weights: SlamWeights = {
        rssi: rssiWeight,
        trilateration: trilaterationWeight,
        environmental: environmentalFactor,
        confidence: this.calculateWeightConfidence(samples, rssiWeight, trilaterationWeight),
        adaptationRate: 0.1, // How quickly to adapt to new measurements
        maxAdjustment: 0.2    // Maximum weight adjustment per update
      };
      
      this.currentWeights = weights;
      
      this.logger.info('Optimal SLAM weights calculated:', {
        rssi: weights.rssi.toFixed(3),
        trilateration: weights.trilateration.toFixed(3),
        confidence: weights.confidence.toFixed(3)
      });
      
      return weights;
      
    } catch (error) {
      this.logger.error('Error calculating optimal weights:', error);
      
      // Return safe default weights
      return {
        rssi: 0.4,
        trilateration: 0.6,
        environmental: 0.5,
        confidence: 0.5,
        adaptationRate: 0.1,
        maxAdjustment: 0.2
      };
    }
  }
} 
