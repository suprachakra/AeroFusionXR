/**
 * Core baggage tracking types
 */
export interface BaggageTag {
  id: string;
  flightNumber: string;
  passengerName: string;
  origin: string;
  destination: string;
  weight: number;
  taggedAt: Date;
  status: BaggageStatus;
  lastLocation?: Location;
  lastUpdated?: Date;
}

export enum BaggageStatus {
  CHECKED_IN = 'CHECKED_IN',
  IN_TRANSIT = 'IN_TRANSIT',
  LOADED = 'LOADED',
  UNLOADED = 'UNLOADED',
  DELIVERED = 'DELIVERED',
  LOST = 'LOST'
}

export interface Location {
  x: number;
  y: number;
  z: number;
  zone: string;
  terminal: string;
  timestamp: Date;
  confidence: number;
}

export interface BaggageEvent {
  tagId: string;
  eventType: BaggageEventType;
  location: Location;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export enum BaggageEventType {
  SCAN = 'SCAN',
  ZONE_ENTRY = 'ZONE_ENTRY',
  ZONE_EXIT = 'ZONE_EXIT',
  LOAD = 'LOAD',
  UNLOAD = 'UNLOAD',
  DELIVERY = 'DELIVERY',
  EXCEPTION = 'EXCEPTION'
}

export interface BaggageAlert {
  tagId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  timestamp: Date;
  location?: Location;
}

export enum AlertType {
  WRONG_ZONE = 'WRONG_ZONE',
  STATIONARY = 'STATIONARY',
  LOST_SIGNAL = 'LOST_SIGNAL',
  WRONG_FLIGHT = 'WRONG_FLIGHT',
  DELAYED = 'DELAYED'
}

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface SearchCriteria {
  tagId?: string;
  flightNumber?: string;
  passengerName?: string;
  status?: BaggageStatus;
  terminal?: string;
  zone?: string;
  startTime?: Date;
  endTime?: Date;
} 