/**
 * PointOfInterest.ts
 * Model for indoor points of interest
 */

import { Vector3 } from 'three';

export type POICategory =
  | 'restroom'
  | 'elevator'
  | 'escalator'
  | 'stairs'
  | 'restaurant'
  | 'shop'
  | 'gate'
  | 'baggage'
  | 'security'
  | 'information'
  | 'medical'
  | 'lounge'
  | 'charging'
  | 'wifi'
  | 'custom';

export interface POIAccessibility {
  wheelchairAccessible: boolean;
  brailleSignage: boolean;
  hearingLoop: boolean;
  assistanceAvailable: boolean;
  guideDogFriendly: boolean;
  quietSpace: boolean;
  lowSensoryArea: boolean;
}

export interface POIHours {
  monday?: { open: string; close: string }[];
  tuesday?: { open: string; close: string }[];
  wednesday?: { open: string; close: string }[];
  thursday?: { open: string; close: string }[];
  friday?: { open: string; close: string }[];
  saturday?: { open: string; close: string }[];
  sunday?: { open: string; close: string }[];
  holidays?: { date: string; open: string; close: string }[];
  exceptions?: { date: string; open: string; close: string }[];
}

export interface POIContact {
  phone?: string;
  email?: string;
  website?: string;
  localExtension?: string;
}

export interface PointOfInterest {
  id: string;
  name: string;
  description: string;
  category: POICategory;
  position: Vector3;
  floorId: string;
  buildingId: string;
  icon: string;
  accessibility: POIAccessibility;
  hours?: POIHours;
  contact?: POIContact;
  tags: string[];
  amenities: string[];
  images: string[];
  rating?: number;
  reviewCount?: number;
  popularity?: number;
  queueTime?: number;
  occupancy?: number;
  maxOccupancy?: number;
  status: 'open' | 'closed' | 'temporarily_closed' | 'maintenance';
  lastUpdated: string;
  metadata: Record<string, any>;
} 