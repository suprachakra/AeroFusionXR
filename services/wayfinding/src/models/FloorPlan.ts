/**
 * FloorPlan.ts
 * Types for floor plan data structures
 */

import { Vector3, Box3 } from 'three';
import { NavigationPoint } from './NavigationPoint';

export interface FloorPlanConnection {
  start: NavigationPoint;
  end: NavigationPoint;
  distance: number;
  type: 'walkway' | 'corridor' | 'doorway';
  accessibility?: {
    wheelchair: boolean;
    stairs: boolean;
    ramp: boolean;
  };
}

export interface FloorPlanZone {
  id: string;
  name: string;
  type: 'gate' | 'security' | 'retail' | 'restroom' | 'restaurant' | 'lounge';
  bounds: Box3;
  capacity?: number;
  occupancy?: number;
  restrictions?: string[];
}

export interface FloorPlanPOI {
  id: string;
  name: string;
  type: string;
  position: Vector3;
  description?: string;
  icon?: string;
  category?: string;
  tags?: string[];
}

export interface FloorPlan {
  id: string;
  name: string;
  level: number;
  bounds: Box3;
  walkablePoints: NavigationPoint[];
  connections: FloorPlanConnection[];
  zones: FloorPlanZone[];
  pois: FloorPlanPOI[];
  metadata: {
    lastUpdated: string;
    version: string;
    source: string;
  };
  accessibility?: {
    wheelchairAccessible: boolean;
    hasElevators: boolean;
    hasEscalators: boolean;
    hasRamps: boolean;
  };
  restrictions?: {
    accessLevel: string;
    timeRestrictions?: {
      start: string;
      end: string;
      days: string[];
    }[];
  };
} 