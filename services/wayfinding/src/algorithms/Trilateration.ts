import { Vector3 } from '../types/Vector3';

export interface Beacon {
  id: string;
  position: Vector3;
  rssi: number;
  distance: number;
  accuracy: number;
  timestamp: number;
}

export interface TrilaterationResult {
  position: Vector3;
  accuracy: number;
  confidence: number;
  usedBeacons: string[];
  method: 'trilateration' | 'multilateration' | 'weighted_centroid';
}

export class TrilaterationSolver {
  private static readonly MIN_BEACONS = 3;
  private static readonly MAX_BEACONS = 10;
  private static readonly RSSI_REFERENCE = -59; // dBm at 1 meter
  private static readonly PATH_LOSS_EXPONENT = 2.0;
  private static readonly MAX_POSITION_ERROR = 0.5; // meters
  private static readonly MAX_ITERATIONS = 100;
  private static readonly CONVERGENCE_THRESHOLD = 0.01;

  /**
   * Calculate position using trilateration from beacon distances
   */
  public static calculatePosition(beacons: Beacon[]): TrilaterationResult | null {
    if (beacons.length < this.MIN_BEACONS) {
      return null;
    }

    // Sort beacons by signal strength and accuracy
    const sortedBeacons = this.selectBestBeacons(beacons);
    
    if (sortedBeacons.length >= 4) {
      // Use multilateration for 4+ beacons
      return this.multilateration(sortedBeacons);
    } else if (sortedBeacons.length === 3) {
      // Use standard trilateration for exactly 3 beacons
      return this.trilateration(sortedBeacons);
    } else {
      // Fallback to weighted centroid for 2 beacons
      return this.weightedCentroid(sortedBeacons);
    }
  }

  /**
   * Standard trilateration for 3 beacons
   */
  private static trilateration(beacons: Beacon[]): TrilaterationResult {
    const [b1, b2, b3] = beacons;
    
    // Calculate distances with enhanced accuracy
    const r1 = this.refineDistance(b1);
    const r2 = this.refineDistance(b2);
    const r3 = this.refineDistance(b3);

    // Use geometric trilateration algorithm
    const p1 = b1.position;
    const p2 = b2.position;
    const p3 = b3.position;

    // Vector from p1 to p2
    const ex = this.normalize(this.subtract(p2, p1));
    
    // Distance between p1 and p2
    const i = this.distance(p1, p2);
    
    // Vector from p1 to p3, projected onto ex
    const ival = this.dot(this.subtract(p3, p1), ex);
    
    // Vector from p1 to p3, perpendicular to ex
    const p3_minus_p1_minus_ival_ex = this.subtract(
      this.subtract(p3, p1),
      this.scale(ex, ival)
    );
    const ey = this.normalize(p3_minus_p1_minus_ival_ex);
    
    // Distance from p1 to p3 projected onto ex
    const j = this.dot(this.subtract(p3, p1), ey);
    
    // Calculate x coordinate
    const x = (r1 * r1 - r2 * r2 + i * i) / (2 * i);
    
    // Calculate y coordinate
    const y = (r1 * r1 - r3 * r3 + ival * ival + j * j) / (2 * j) - (ival * x) / j;
    
    // Calculate z coordinate (assume 2D for now, extend to 3D if needed)
    const z = p1.z; // Use reference level
    
    const position: Vector3 = {
      x: p1.x + x * ex.x + y * ey.x,
      y: p1.y + x * ex.y + y * ey.y,
      z: z
    };

    // Calculate accuracy based on beacon quality
    const accuracy = this.calculateAccuracy([b1, b2, b3]);
    const confidence = this.calculateConfidence([b1, b2, b3], position);

    return {
      position,
      accuracy,
      confidence,
      usedBeacons: [b1.id, b2.id, b3.id],
      method: 'trilateration'
    };
  }

  /**
   * Multilateration using least squares for 4+ beacons
   */
  private static multilateration(beacons: Beacon[]): TrilaterationResult {
    // Use up to MAX_BEACONS for computation efficiency
    const selectedBeacons = beacons.slice(0, this.MAX_BEACONS);
    
    // Initial guess - centroid of beacon positions
    let position = this.calculateCentroid(selectedBeacons.map(b => b.position));
    
    // Iterative least squares optimization
    for (let iteration = 0; iteration < this.MAX_ITERATIONS; iteration++) {
      const { position: newPosition, converged } = this.leastSquaresIteration(
        selectedBeacons, 
        position
      );
      
      if (converged) {
        position = newPosition;
        break;
      }
      
      position = newPosition;
    }

    const accuracy = this.calculateAccuracy(selectedBeacons);
    const confidence = this.calculateConfidence(selectedBeacons, position);

    return {
      position,
      accuracy,
      confidence,
      usedBeacons: selectedBeacons.map(b => b.id),
      method: 'multilateration'
    };
  }

  /**
   * Weighted centroid fallback for insufficient beacons
   */
  private static weightedCentroid(beacons: Beacon[]): TrilaterationResult {
    let totalWeight = 0;
    let weightedSum: Vector3 = { x: 0, y: 0, z: 0 };

    beacons.forEach(beacon => {
      // Weight inversely proportional to distance and proportional to signal strength
      const weight = 1.0 / (beacon.distance + 0.1) * (1.0 / (Math.abs(beacon.rssi) + 1));
      
      weightedSum.x += beacon.position.x * weight;
      weightedSum.y += beacon.position.y * weight;
      weightedSum.z += beacon.position.z * weight;
      totalWeight += weight;
    });

    const position: Vector3 = {
      x: weightedSum.x / totalWeight,
      y: weightedSum.y / totalWeight,
      z: weightedSum.z / totalWeight
    };

    const accuracy = this.calculateAccuracy(beacons) * 2; // Lower accuracy for centroid method
    const confidence = Math.max(0.3, this.calculateConfidence(beacons, position) * 0.7);

    return {
      position,
      accuracy,
      confidence,
      usedBeacons: beacons.map(b => b.id),
      method: 'weighted_centroid'
    };
  }

  /**
   * Single iteration of least squares optimization
   */
  private static leastSquaresIteration(
    beacons: Beacon[], 
    currentPosition: Vector3
  ): { position: Vector3; converged: boolean } {
    const n = beacons.length;
    const A: number[][] = [];
    const b: number[] = [];

    beacons.forEach((beacon, i) => {
      const distance = this.refineDistance(beacon);
      const calculatedDistance = this.distance(currentPosition, beacon.position);
      
      if (calculatedDistance > 0.001) { // Avoid division by zero
        const factor = 2 / calculatedDistance;
        
        A[i] = [
          factor * (currentPosition.x - beacon.position.x),
          factor * (currentPosition.y - beacon.position.y),
          factor * (currentPosition.z - beacon.position.z)
        ];
        
        b[i] = calculatedDistance - distance;
      }
    });

    // Solve Ax = b using pseudo-inverse
    const delta = this.solveLeastSquares(A, b);
    
    const newPosition: Vector3 = {
      x: currentPosition.x - delta[0],
      y: currentPosition.y - delta[1],
      z: currentPosition.z - delta[2]
    };

    // Check convergence
    const positionChange = this.distance(currentPosition, newPosition);
    const converged = positionChange < this.CONVERGENCE_THRESHOLD;

    return { position: newPosition, converged };
  }

  /**
   * Select best beacons based on signal quality and geometric distribution
   */
  private static selectBestBeacons(beacons: Beacon[]): Beacon[] {
    // Filter out beacons with poor signal or very high distance
    const validBeacons = beacons.filter(beacon => 
      beacon.rssi > -90 && // Minimum signal strength
      beacon.distance < 50 && // Maximum distance in meters
      beacon.accuracy > 0.1 // Minimum accuracy
    );

    // Sort by combined score of signal strength, distance, and accuracy
    validBeacons.sort((a, b) => {
      const scoreA = this.calculateBeaconScore(a);
      const scoreB = this.calculateBeaconScore(b);
      return scoreB - scoreA; // Higher score is better
    });

    // Select up to MAX_BEACONS with good geometric distribution
    const selected: Beacon[] = [];
    
    for (const beacon of validBeacons) {
      if (selected.length >= this.MAX_BEACONS) {
        break;
      }
      
      // Check geometric distribution
      if (selected.length === 0 || this.hasGoodGeometry(selected, beacon)) {
        selected.push(beacon);
      }
    }

    return selected;
  }

  /**
   * Calculate beacon quality score
   */
  private static calculateBeaconScore(beacon: Beacon): number {
    const signalScore = Math.max(0, (beacon.rssi + 100) / 40); // Normalize RSSI
    const distanceScore = Math.max(0, 1 - beacon.distance / 20); // Prefer closer beacons
    const accuracyScore = Math.min(1, beacon.accuracy);
    
    return signalScore * 0.4 + distanceScore * 0.3 + accuracyScore * 0.3;
  }

  /**
   * Check if adding a beacon improves geometric distribution
   */
  private static hasGoodGeometry(selected: Beacon[], candidate: Beacon): boolean {
    if (selected.length < 2) {
      return true;
    }

    // Calculate minimum angle between candidate and existing beacons
    let minAngle = Math.PI;
    
    for (let i = 0; i < selected.length; i++) {
      for (let j = i + 1; j < selected.length; j++) {
        const angle = this.calculateAngle(selected[i].position, candidate.position, selected[j].position);
        minAngle = Math.min(minAngle, angle);
      }
    }

    // Require minimum separation angle of 30 degrees
    return minAngle > Math.PI / 6;
  }

  /**
   * Refine distance estimate using RSSI and other factors
   */
  private static refineDistance(beacon: Beacon): number {
    // Combine measured distance with RSSI-based distance
    const rssiDistance = this.rssiToDistance(beacon.rssi);
    
    // Weighted average based on confidence in each method
    const rssiWeight = 0.3;
    const measuredWeight = 0.7;
    
    return (rssiDistance * rssiWeight + beacon.distance * measuredWeight) / 
           (rssiWeight + measuredWeight);
  }

  /**
   * Convert RSSI to distance estimate
   */
  private static rssiToDistance(rssi: number): number {
    if (rssi === 0) {
      return 1000; // Invalid reading
    }

    return Math.pow(10, (this.RSSI_REFERENCE - rssi) / (10 * this.PATH_LOSS_EXPONENT));
  }

  /**
   * Calculate positioning accuracy estimate
   */
  private static calculateAccuracy(beacons: Beacon[]): number {
    if (beacons.length === 0) {
      return 100; // Very poor accuracy
    }

    const avgAccuracy = beacons.reduce((sum, b) => sum + (1.0 / b.accuracy), 0) / beacons.length;
    const signalQuality = beacons.reduce((sum, b) => sum + Math.max(0, (b.rssi + 100) / 40), 0) / beacons.length;
    
    return Math.max(0.5, 5.0 / (avgAccuracy * signalQuality));
  }

  /**
   * Calculate confidence in position estimate
   */
  private static calculateConfidence(beacons: Beacon[], position: Vector3): number {
    const residuals = beacons.map(beacon => {
      const calculatedDistance = this.distance(position, beacon.position);
      const measuredDistance = this.refineDistance(beacon);
      return Math.abs(calculatedDistance - measuredDistance);
    });

    const meanResidual = residuals.reduce((sum, r) => sum + r, 0) / residuals.length;
    const maxAllowableError = 2.0; // meters
    
    return Math.max(0.1, 1.0 - (meanResidual / maxAllowableError));
  }

  // ================================
  // UTILITY METHODS
  // ================================

  private static distance(a: Vector3, b: Vector3): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private static subtract(a: Vector3, b: Vector3): Vector3 {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  private static scale(v: Vector3, scalar: number): Vector3 {
    return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar };
  }

  private static dot(a: Vector3, b: Vector3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  private static normalize(v: Vector3): Vector3 {
    const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (length === 0) {
      return { x: 0, y: 0, z: 0 };
    }
    return { x: v.x / length, y: v.y / length, z: v.z / length };
  }

  private static calculateCentroid(positions: Vector3[]): Vector3 {
    const sum = positions.reduce(
      (acc, pos) => ({ x: acc.x + pos.x, y: acc.y + pos.y, z: acc.z + pos.z }),
      { x: 0, y: 0, z: 0 }
    );
    
    return {
      x: sum.x / positions.length,
      y: sum.y / positions.length,
      z: sum.z / positions.length
    };
  }

  private static calculateAngle(a: Vector3, center: Vector3, b: Vector3): number {
    const va = this.subtract(a, center);
    const vb = this.subtract(b, center);
    
    const dot = this.dot(va, vb);
    const lengthA = Math.sqrt(va.x * va.x + va.y * va.y + va.z * va.z);
    const lengthB = Math.sqrt(vb.x * vb.x + vb.y * vb.y + vb.z * vb.z);
    
    if (lengthA === 0 || lengthB === 0) {
      return 0;
    }
    
    return Math.acos(Math.max(-1, Math.min(1, dot / (lengthA * lengthB))));
  }

  private static solveLeastSquares(A: number[][], b: number[]): number[] {
    // Simple 3x3 case for position estimation
    if (A.length >= 3 && A[0].length === 3) {
      // Use pseudo-inverse for overdetermined system
      const AT = this.transpose(A);
      const ATA = this.multiply(AT, A);
      const ATb = this.multiplyVector(AT, b);
      
      return this.solve3x3(ATA, ATb);
    }
    
    return [0, 0, 0]; // Fallback
  }

  private static transpose(matrix: number[][]): number[][] {
    if (matrix.length === 0) return [];
    
    const result: number[][] = [];
    for (let j = 0; j < matrix[0].length; j++) {
      result[j] = [];
      for (let i = 0; i < matrix.length; i++) {
        result[j][i] = matrix[i][j];
      }
    }
    return result;
  }

  private static multiply(a: number[][], b: number[][]): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < a.length; i++) {
      result[i] = [];
      for (let j = 0; j < b[0].length; j++) {
        result[i][j] = 0;
        for (let k = 0; k < b.length; k++) {
          result[i][j] += a[i][k] * b[k][j];
        }
      }
    }
    return result;
  }

  private static multiplyVector(matrix: number[][], vector: number[]): number[] {
    const result: number[] = [];
    for (let i = 0; i < matrix.length; i++) {
      result[i] = 0;
      for (let j = 0; j < vector.length; j++) {
        result[i] += matrix[i][j] * vector[j];
      }
    }
    return result;
  }

  private static solve3x3(A: number[][], b: number[]): number[] {
    // Gaussian elimination for 3x3 system
    const augmented = A.map((row, i) => [...row, b[i]]);
    
    // Forward elimination
    for (let i = 0; i < 3; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < 3; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }
      
      // Swap rows
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
      
      // Make diagonal element 1
      const pivot = augmented[i][i];
      if (Math.abs(pivot) < 1e-10) {
        return [0, 0, 0]; // Singular matrix
      }
      
      for (let j = 0; j < 4; j++) {
        augmented[i][j] /= pivot;
      }
      
      // Eliminate column
      for (let k = 0; k < 3; k++) {
        if (k !== i) {
          const factor = augmented[k][i];
          for (let j = 0; j < 4; j++) {
            augmented[k][j] -= factor * augmented[i][j];
          }
        }
      }
    }
    
    return [augmented[0][3], augmented[1][3], augmented[2][3]];
  }
} 