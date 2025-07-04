/**
 * Core position and navigation types
 */
export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Rotation {
  x: number;
  y: number;
  z: number;
}

export interface Beacon {
  id: string;
  position: Position;
  rssi: number;
  distance: number;
  lastUpdate: number;
  type: 'BLE' | 'UWB';
}

export interface SlamData {
  position: Position;
  rotation: Rotation;
  features: Array<{
    position: Position;
    descriptor: Float32Array;
    confidence: number;
  }>;
  confidence: number;
  timestamp: number;
}

export interface FusionResult {
  position: Position;
  confidence: number;
  timestamp: number;
}

/**
 * Server and API types
 */
export type UUID = string;
export type Timestamp = string;

export interface WayfindingRequest {
  correlationId: UUID;
  timestamp: Timestamp;
  userId?: string;
  sessionId?: string;
  origin: Position;
  destination: Position;
  preferences?: NavigationOptions;
  context?: {
    deviceType?: 'mobile' | 'kiosk' | 'ar' | 'web';
    accessibility?: boolean;
    language?: string;
  };
}

export interface WayfindingResponse {
  correlationId: UUID;
  timestamp: Timestamp;
  route: Route;
  alternatives?: Route[];
  metadata: {
    computationTime: number;
    algorithmUsed: string;
    confidence: number;
  };
  warnings?: string[];
  errors?: string[];
}

export interface WayfindingSocket {
  id: string;
  userId?: string;
  sessionId: string;
  connectedAt: Timestamp;
  lastActivity: Timestamp;
  subscriptions: string[];
  context: {
    deviceType: 'mobile' | 'kiosk' | 'ar' | 'web';
    userAgent?: string;
    location?: Position;
    floor?: string;
  };
}

export interface WebSocketEvent {
  type: 'position_update' | 'route_update' | 'hazard_alert' | 'poi_update' | 'system_status';
  timestamp: Timestamp;
  data: any;
  targetUsers?: string[];
  targetSessions?: string[];
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface PerformanceMetrics {
  requestCount: number;
  errorCount: number;
  responseTimeSum: number;
  activeConnections: number;
  websocketConnections: number;
  averageResponseTime?: number;
  errorRate?: number;
  uptime?: number;
  memoryUsage?: {
    used: number;
    total: number;
  };
}

/**
 * Navigation and routing types
 */
export type TransitionType = 'elevator' | 'escalator' | 'stairs';

export enum PathType {
  HALLWAY = 'hallway',
  TRANSITION = 'transition'
}

export interface RouteSegment {
  start: Position;
  end: Position;
  type: PathType;
  distance: number;
  floor: number;
  instructions?: string;
}

export interface Route {
  segments: RouteSegment[];
  totalDistance: number;
  estimatedTime: number;
}

export interface NavigationOptions {
  accessibility?: boolean;
  avoidCrowded?: boolean;
  preferredTransitions?: TransitionType[];
}

/**
 * Floor plan and building types
 */
export interface FloorPlan {
  id: string;
  level: number;
  origin: Position;
  bounds: {
    min: Position;
    max: Position;
  };
  walkablePoints: Position[];
  connections: Array<{
    start: Position;
    end: Position;
    distance: number;
  }>;
  landmarks: Array<{
    id: string;
    position: Position;
    type: string;
    label: string;
  }>;
  beacons: Array<{
    id: string;
    position: Position;
    type: 'BLE' | 'UWB';
  }>;
}

/**
 * Monitoring and metrics types
 */
export interface MetricsClient {
  createHistogram: (options: {
    name: string;
    help: string;
    labelNames?: string[];
    buckets?: number[];
  }) => {
    observe: (labels: Record<string, string | number>, value: number) => void;
  };
  createGauge: (options: {
    name: string;
    help: string;
    labelNames?: string[];
  }) => {
    set: (labels: Record<string, string | number>, value: number) => void;
  };
  increment: (name: string, labels?: Record<string, string | number>) => void;
  gauge: (name: string, value: number, labels?: Record<string, string | number>) => void;
}

export interface UserPreferences {
  id: string;
  accessibility: {
    audioEnabled: boolean;
    highContrast: boolean;
    largeText: boolean;
  };
  favoriteLocations: Array<{
    id: string;
    name: string;
    position: Position;
  }>;
  preferredRouteType: 'fastest' | 'elevator' | 'escalator' | 'stairs';
}

export interface PointOfInterest {
  id: string;
  name: string;
  position: Position;
  floor: number;
  category: string;
  description?: string;
  imageUrl?: string;
} 