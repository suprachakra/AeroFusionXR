/**
 * VerticalTransition.ts
 * Types for vertical transitions between floors
 */

import { NavigationPoint } from './NavigationPoint';

export interface VerticalTransition {
  id: string;
  start: NavigationPoint;
  end: NavigationPoint;
  mode: 'elevator' | 'escalator' | 'stairs' | 'ramp';
  distance: number;
  direction: 'up' | 'down' | 'bidirectional';
  accessibility: {
    wheelchair: boolean;
    visualGuide: boolean;
    audioGuide: boolean;
    handrail: boolean;
  };
  status: {
    operational: boolean;
    lastUpdated: string;
    maintenanceScheduled?: string;
    capacity?: number;
    currentLoad?: number;
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