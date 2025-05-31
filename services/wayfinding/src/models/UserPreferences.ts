/**
 * UserPreferences.ts
 * Types and interfaces for user preferences
 */

import { Vector3 } from 'three';

export interface SavedLocation {
  id: string;
  name: string;
  position: Vector3;
  floorId: string;
  type: 'favorite' | 'waypoint' | 'recent';
  icon?: string;
  tags?: string[];
  lastVisited?: string;
}

export interface AccessibilityPreferences {
  fontSize: 'normal' | 'large' | 'xlarge';
  highContrast: boolean;
  audioOnly: boolean;
  audioGuides: boolean;
  hapticFeedback: boolean;
  visualGuides: boolean;
  reducedMotion: boolean;
  wheelchairAccessible: boolean;
}

export interface NavigationPreferences {
  avoidCrowded: boolean;
  avoidStairs: boolean;
  preferElevators: boolean;
  preferEscalators: boolean;
  wheelchairAccessible: boolean;
  routeOptimization: 'fastest' | 'fewest_turns' | 'fewest_level_changes';
}

export interface NotificationPreferences {
  enabled: boolean;
  pushNotifications: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  notifyOnArrival: boolean;
  notifyOnDelay: boolean;
  notifyOnReroute: boolean;
}

export interface UserPreferences {
  id: string;
  userId: string;
  savedLocations: SavedLocation[];
  accessibility: AccessibilityPreferences;
  navigation: NavigationPreferences;
  notifications: NotificationPreferences;
  lastUpdated: string;
  version: number;
} 