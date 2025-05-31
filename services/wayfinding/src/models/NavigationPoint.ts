/**
 * NavigationPoint.ts
 * Types and interfaces for navigation points
 */

import { Vector3 } from 'three';

export interface NavigationPoint {
  position: Vector3;
  floorId: string;
  type: 'waypoint' | 'transition' | 'poi';
  metadata?: {
    transitionId?: string;
    transitionType?: 'elevator' | 'escalator' | 'stairs';
    crowdLevel?: number;
    accessibility?: {
      wheelchair: boolean;
      visualGuide: boolean;
      audioGuide: boolean;
    };
    restrictions?: string[];
    category?: string;
    priority?: number;
  };
} 