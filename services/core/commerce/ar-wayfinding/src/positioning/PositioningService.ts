import { EventEmitter } from 'events';

export interface PositionUpdate {
  userID: string;
  x: number;
  y: number;
  z: number;
  floor: number;
  headingDegrees: number;
  accuracyMeters: number;
  timestamp: Date;
  terminal?: string;
}

export interface BeaconData {
  beaconID: string;
  rssi: number;
  txPower: number;
  distance: number;
  x: number;
  y: number;
  floor: number;
}

export interface WiFiFingerprint {
  bssid: string;
  ssid: string;
  rssi: number;
  frequency: number;
}

export interface IMUData {
  accelerometer: { x: number; y: number; z: number };
  gyroscope: { x: number; y: number; z: number };
  magnetometer: { x: number; y: number; z: number };
  timestamp: Date;
}

export interface PositioningConfig {
  beaconScanRate: number; // Hz
  wifiScanRate: number; // Hz
  updateInterval: number; // ms
  minAccuracy: number; // meters
  kalmanFilterEnabled: boolean;
  deadReckoningEnabled: boolean;
}

export class PositioningService extends EventEmitter {
  private currentPositions: Map<string, PositionUpdate> = new Map();
  private positionCallbacks: Map<string, (position: PositionUpdate) => void> = new Map();
  private beaconDatabase: Map<string, BeaconData> = new Map();
  private wifiDatabase: Map<string, { x: number; y: number; floor: number }> = new Map();
  private positioningIntervals: Map<string, any> = new Map();
  private config: PositioningConfig;

  constructor() {
    super();
    this.config = {
      beaconScanRate: 5, // 5 Hz
      wifiScanRate: 2, // 2 Hz
      updateInterval: 200, // 200ms
      minAccuracy: 5.0, // 5 meters
      kalmanFilterEnabled: true,
      deadReckoningEnabled: true
    };

    this.initializeBeaconDatabase();
    this.initializeWiFiDatabase();
  }

  /**
   * Get current position for user
   */
  async getCurrentPosition(userID: string): Promise<PositionUpdate | null> {
    return this.currentPositions.get(userID) || null;
  }

  /**
   * Start position tracking for user
   */
  async startPositionTracking(userID: string, terminal: string = 'T1'): Promise<void> {
    try {
      console.debug(`[POSITIONING] Starting position tracking for user: ${userID}, terminal: ${terminal}`);

      // Initialize position if not exists
      if (!this.currentPositions.has(userID)) {
        const initialPosition: PositionUpdate = {
          userID,
          x: 0,
          y: 0,
          z: 0,
          floor: 1,
          headingDegrees: 0,
          accuracyMeters: 10,
          timestamp: new Date(),
          terminal
        };
        this.currentPositions.set(userID, initialPosition);
      }

      // Start position update interval
      const interval = setInterval(async () => {
        await this.updateUserPosition(userID);
      }, this.config.updateInterval);

      this.positioningIntervals.set(userID, interval);

      console.debug(`[POSITIONING] Position tracking started for user: ${userID}`);

    } catch (error) {
      console.error(`[POSITIONING] Failed to start position tracking for user: ${userID}`, error);
      throw error;
    }
  }

  /**
   * Stop position tracking for user
   */
  async stopPositionTracking(userID: string): Promise<void> {
    const interval = this.positioningIntervals.get(userID);
    if (interval) {
      clearInterval(interval);
      this.positioningIntervals.delete(userID);
    }

    this.positionCallbacks.delete(userID);
    console.debug(`[POSITIONING] Position tracking stopped for user: ${userID}`);
  }

  /**
   * Subscribe to position updates
   */
  async subscribeToPositionUpdates(userID: string, callback: (position: PositionUpdate) => void): Promise<void> {
    this.positionCallbacks.set(userID, callback);
    console.debug(`[POSITIONING] Subscribed to position updates for user: ${userID}`);
  }

  /**
   * Unsubscribe from position updates
   */
  async unsubscribeFromPositionUpdates(userID: string): Promise<void> {
    this.positionCallbacks.delete(userID);
    console.debug(`[POSITIONING] Unsubscribed from position updates for user: ${userID}`);
  }

  /**
   * Update user position using multilateration
   */
  private async updateUserPosition(userID: string): Promise<void> {
    try {
      const currentPosition = this.currentPositions.get(userID);
      if (!currentPosition) return;

      // Simulate BLE beacon scanning
      const beaconData = await this.scanBLEBeacons(currentPosition);
      
      // Simulate WiFi scanning
      const wifiData = await this.scanWiFi(currentPosition);

      // Simulate IMU data for dead reckoning
      const imuData = await this.getIMUData();

      // Calculate new position using trilateration/multilateration
      const newPosition = await this.calculatePosition(currentPosition, beaconData, wifiData, imuData);

      // Apply Kalman filter if enabled
      const filteredPosition = this.config.kalmanFilterEnabled 
        ? await this.applyKalmanFilter(currentPosition, newPosition)
        : newPosition;

      // Update stored position
      this.currentPositions.set(userID, filteredPosition);

      // Notify callbacks
      const callback = this.positionCallbacks.get(userID);
      if (callback) {
        callback(filteredPosition);
      }

      // Emit events based on accuracy
      if (filteredPosition.accuracyMeters > this.config.minAccuracy) {
        this.emit('lowAccuracy', {
          userID,
          accuracy: filteredPosition.accuracyMeters,
          threshold: this.config.minAccuracy
        });
      }

      // Check for positioning lost
      if (filteredPosition.accuracyMeters > 10) {
        this.emit('positioningLost', {
          userID,
          accuracy: filteredPosition.accuracyMeters,
          lastGoodPosition: currentPosition
        });
      }

    } catch (error) {
      console.error(`[POSITIONING] Failed to update position for user: ${userID}`, error);
    }
  }

  /**
   * Simulate BLE beacon scanning
   */
  private async scanBLEBeacons(currentPosition: PositionUpdate): Promise<BeaconData[]> {
    const beacons: BeaconData[] = [];
    
    // Get beacons for current floor
    for (const [beaconID, beacon] of this.beaconDatabase) {
      if (beacon.floor === currentPosition.floor) {
        // Calculate distance to beacon
        const distance = Math.sqrt(
          Math.pow(beacon.x - currentPosition.x, 2) + 
          Math.pow(beacon.y - currentPosition.y, 2)
        );

        // Only include beacons within range (typically 30-50m for BLE)
        if (distance <= 50) {
          // Simulate RSSI based on distance with noise
          const rssi = beacon.txPower - (20 * Math.log10(Math.max(distance, 1))) + 
                      (Math.random() - 0.5) * 10; // Add noise

          beacons.push({
            ...beacon,
            rssi,
            distance
          });
        }
      }
    }

    return beacons;
  }

  /**
   * Simulate WiFi scanning
   */
  private async scanWiFi(currentPosition: PositionUpdate): Promise<WiFiFingerprint[]> {
    const wifiSignals: WiFiFingerprint[] = [];
    
    // Simulate WiFi access points
    const accessPoints = [
      { bssid: '00:11:22:33:44:55', ssid: 'Terminal_WiFi_1', frequency: 2437 },
      { bssid: '00:11:22:33:44:56', ssid: 'Terminal_WiFi_2', frequency: 5180 },
      { bssid: '00:11:22:33:44:57', ssid: 'Terminal_WiFi_3', frequency: 2412 }
    ];

    for (const ap of accessPoints) {
      // Simulate RSSI based on position with realistic WiFi propagation
      const baseRSSI = -30;
      const distance = Math.random() * 100; // Random distance simulation
      const rssi = baseRSSI - (20 * Math.log10(Math.max(distance, 1))) + 
                   (Math.random() - 0.5) * 15; // WiFi has more noise than BLE

      wifiSignals.push({
        bssid: ap.bssid,
        ssid: ap.ssid,
        rssi,
        frequency: ap.frequency
      });
    }

    return wifiSignals;
  }

  /**
   * Get simulated IMU data for dead reckoning
   */
  private async getIMUData(): Promise<IMUData> {
    return {
      accelerometer: {
        x: (Math.random() - 0.5) * 0.2, // Small movements
        y: (Math.random() - 0.5) * 0.2,
        z: 9.8 + (Math.random() - 0.5) * 0.1 // Gravity + noise
      },
      gyroscope: {
        x: (Math.random() - 0.5) * 0.1,
        y: (Math.random() - 0.5) * 0.1,
        z: (Math.random() - 0.5) * 0.1
      },
      magnetometer: {
        x: (Math.random() - 0.5) * 50,
        y: (Math.random() - 0.5) * 50,
        z: (Math.random() - 0.5) * 50
      },
      timestamp: new Date()
    };
  }

  /**
   * Calculate position using trilateration
   */
  private async calculatePosition(
    currentPosition: PositionUpdate,
    beacons: BeaconData[],
    wifi: WiFiFingerprint[],
    imu: IMUData
  ): Promise<PositionUpdate> {
    
    if (beacons.length >= 3) {
      // Use trilateration with BLE beacons
      const position = this.trilaterate(beacons);
      
      return {
        ...currentPosition,
        x: position.x,
        y: position.y,
        accuracyMeters: Math.max(2.0, Math.min(5.0, beacons.length)), // Better accuracy with more beacons
        timestamp: new Date()
      };
    } else if (wifi.length >= 2) {
      // Fallback to WiFi fingerprinting
      const position = this.wifiFingerprinting(wifi, currentPosition);
      
      return {
        ...position,
        accuracyMeters: 5.0, // WiFi typically less accurate
        timestamp: new Date()
      };
    } else {
      // Dead reckoning using IMU
      const position = this.deadReckoning(currentPosition, imu);
      
      return {
        ...position,
        accuracyMeters: Math.min(currentPosition.accuracyMeters + 0.5, 10.0), // Accuracy degrades over time
        timestamp: new Date()
      };
    }
  }

  /**
   * Trilateration algorithm using beacon distances
   */
  private trilaterate(beacons: BeaconData[]): { x: number; y: number } {
    if (beacons.length < 3) {
      throw new Error('Need at least 3 beacons for trilateration');
    }

    // Use first three beacons for trilateration
    const [b1, b2, b3] = beacons.slice(0, 3);

    // Trilateration mathematics
    const A = 2 * (b2.x - b1.x);
    const B = 2 * (b2.y - b1.y);
    const C = Math.pow(b1.distance, 2) - Math.pow(b2.distance, 2) - Math.pow(b1.x, 2) + Math.pow(b2.x, 2) - Math.pow(b1.y, 2) + Math.pow(b2.y, 2);
    const D = 2 * (b3.x - b2.x);
    const E = 2 * (b3.y - b2.y);
    const F = Math.pow(b2.distance, 2) - Math.pow(b3.distance, 2) - Math.pow(b2.x, 2) + Math.pow(b3.x, 2) - Math.pow(b2.y, 2) + Math.pow(b3.y, 2);

    const x = (C * E - F * B) / (E * A - B * D);
    const y = (A * F - D * C) / (A * E - D * B);

    return { x, y };
  }

  /**
   * WiFi fingerprinting for position estimation
   */
  private wifiFingerprinting(wifi: WiFiFingerprint[], currentPosition: PositionUpdate): PositionUpdate {
    // Simplified WiFi fingerprinting - find closest match in database
    let bestMatch = currentPosition;
    let minDistance = Infinity;

    for (const [bssid, location] of this.wifiDatabase) {
      const signal = wifi.find(w => w.bssid === bssid);
      if (signal && location.floor === currentPosition.floor) {
        // Simple RSSI-based distance estimation
        const estimatedDistance = Math.pow(10, (-30 - signal.rssi) / 20);
        
        if (estimatedDistance < minDistance) {
          minDistance = estimatedDistance;
          bestMatch = {
            ...currentPosition,
            x: location.x + (Math.random() - 0.5) * 5, // Add some variation
            y: location.y + (Math.random() - 0.5) * 5,
            floor: location.floor
          };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Dead reckoning using IMU data
   */
  private deadReckoning(currentPosition: PositionUpdate, imu: IMUData): PositionUpdate {
    // Simplified dead reckoning - small incremental movement
    const deltaTime = 0.2; // 200ms interval
    const walkingSpeed = 1.4; // m/s average walking speed
    
    // Simulate small movements based on accelerometer
    const deltaX = imu.accelerometer.x * deltaTime * walkingSpeed * 0.1;
    const deltaY = imu.accelerometer.y * deltaTime * walkingSpeed * 0.1;
    
    // Update heading based on gyroscope
    const deltaHeading = imu.gyroscope.z * deltaTime * 57.2958; // rad to degrees
    
    return {
      ...currentPosition,
      x: currentPosition.x + deltaX,
      y: currentPosition.y + deltaY,
      headingDegrees: (currentPosition.headingDegrees + deltaHeading) % 360
    };
  }

  /**
   * Apply Kalman filter for position smoothing
   */
  private async applyKalmanFilter(previous: PositionUpdate, current: PositionUpdate): Promise<PositionUpdate> {
    // Simplified Kalman filter - weighted average between previous and current
    const alpha = 0.7; // Trust factor for new measurement
    
    return {
      ...current,
      x: alpha * current.x + (1 - alpha) * previous.x,
      y: alpha * current.y + (1 - alpha) * previous.y,
      headingDegrees: alpha * current.headingDegrees + (1 - alpha) * previous.headingDegrees,
      accuracyMeters: Math.min(current.accuracyMeters, previous.accuracyMeters * 1.1)
    };
  }

  /**
   * Initialize mock beacon database
   */
  private initializeBeaconDatabase(): void {
    // Mock BLE beacons for Terminal 1
    const beacons = [
      { beaconID: 'beacon_001', x: 10, y: 10, floor: 1, txPower: -59 },
      { beaconID: 'beacon_002', x: 50, y: 10, floor: 1, txPower: -59 },
      { beaconID: 'beacon_003', x: 10, y: 50, floor: 1, txPower: -59 },
      { beaconID: 'beacon_004', x: 50, y: 50, floor: 1, txPower: -59 },
      { beaconID: 'beacon_005', x: 30, y: 30, floor: 1, txPower: -59 },
      
      // Floor 2 beacons
      { beaconID: 'beacon_101', x: 15, y: 15, floor: 2, txPower: -59 },
      { beaconID: 'beacon_102', x: 45, y: 15, floor: 2, txPower: -59 },
      { beaconID: 'beacon_103', x: 15, y: 45, floor: 2, txPower: -59 },
      { beaconID: 'beacon_104', x: 45, y: 45, floor: 2, txPower: -59 }
    ];

    beacons.forEach(beacon => {
      this.beaconDatabase.set(beacon.beaconID, {
        ...beacon,
        rssi: 0,
        distance: 0
      });
    });

    console.debug(`[POSITIONING] Initialized ${beacons.length} BLE beacons`);
  }

  /**
   * Initialize mock WiFi database
   */
  private initializeWiFiDatabase(): void {
    const wifiAPs = [
      { bssid: '00:11:22:33:44:55', x: 20, y: 20, floor: 1 },
      { bssid: '00:11:22:33:44:56', x: 40, y: 20, floor: 1 },
      { bssid: '00:11:22:33:44:57', x: 20, y: 40, floor: 1 },
      { bssid: '00:11:22:33:44:58', x: 25, y: 25, floor: 2 },
      { bssid: '00:11:22:33:44:59', x: 35, y: 35, floor: 2 }
    ];

    wifiAPs.forEach(ap => {
      this.wifiDatabase.set(ap.bssid, ap);
    });

    console.debug(`[POSITIONING] Initialized ${wifiAPs.length} WiFi access points`);
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<{
    available: boolean;
    activeUsers: number;
    beaconCount: number;
    wifiAPCount: number;
    avgAccuracy: number;
  }> {
    const activeUsers = this.currentPositions.size;
    const positions = Array.from(this.currentPositions.values());
    const avgAccuracy = positions.length > 0
      ? positions.reduce((sum, pos) => sum + pos.accuracyMeters, 0) / positions.length
      : 0;

    return {
      available: true,
      activeUsers,
      beaconCount: this.beaconDatabase.size,
      wifiAPCount: this.wifiDatabase.size,
      avgAccuracy
    };
  }
} 