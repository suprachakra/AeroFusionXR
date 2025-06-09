import { ARRenderingService, ARSession, ARAsset, ARAnchor, ARInterface, ARUIComponent } from '../../ar-engine/src/core/ARRenderingService';
import { ARVRBridgeService, LocationContext, POIData, NavigationPath } from '../../ar-vr-bridge/src/core/ARVRBridgeService';
import { createLogger } from '@aerofusionxr/shared';
import { PerformanceMonitor } from './utils/PerformanceMonitor';

// AR Wayfinding specific interfaces
export interface ARNavigation {
  navigationId: string;
  destination: POIData;
  path: NavigationPath;
  waypoints: ARWaypoint[];
  visualStyle: 'arrow-overlay' | 'path-line' | 'breadcrumb';
  updateFrequency: number; // milliseconds
  isActive: boolean;
  currentStep: number;
}

export interface ARWaypoint {
  waypointId: string;
  position: { x: number; y: number; z: number };
  type: 'direction' | 'landmark' | 'destination';
  description: string;
  arAsset?: ARAsset;
  reached: boolean;
}

export interface ARNavigationUpdate {
  navigationId: string;
  currentPosition: LocationContext;
  nextWaypoint: ARWaypoint;
  remainingDistance: number;
  estimatedTime: number;
  instruction: string;
}

export interface ARWayfindingConfig {
  enableVoiceGuidance: boolean;
  preferredLanguage: string;
  visualStyle: 'minimal' | 'detailed' | 'gamified';
  updateInterval: number;
  maxViewDistance: number; // meters
}

/**
 * AR Wayfinding & Navigation Service (Feature AR_NAV_001)
 * Real-time AR navigation through terminals with turn-by-turn directions
 */
export class ARWayfindingService extends ARRenderingService {
  private wayfindingLogger: Logger;
  private wayfindingPerformanceMonitor: PerformanceMonitor;
  private bridgeService: ARVRBridgeService;
  private activeNavigations: Map<string, ARNavigation>;
  private navigationUpdateIntervals: Map<string, any>; // Changed from NodeJS.Timeout to any

  constructor() {
    super();
    this.wayfindingLogger = new Logger('ARWayfindingService');
    this.wayfindingPerformanceMonitor = new PerformanceMonitor();
    this.bridgeService = new ARVRBridgeService();
    this.activeNavigations = new Map();
    this.navigationUpdateIntervals = new Map();
  }

  /**
   * Start AR navigation to a destination
   */
  async startNavigation(
    sessionId: string,
    destination: POIData,
    config: ARWayfindingConfig = this.getDefaultConfig()
  ): Promise<ARNavigation> {
    try {
      this.wayfindingLogger.info('Starting AR navigation', {
        sessionId,
        destinationId: destination.poiId,
        destinationName: destination.name
      });

      // Get current location
      const currentLocation = await this.bridgeService.getCurrentLocation();

      // Calculate navigation path
      const path = await this.bridgeService.getNavigationPath(currentLocation, destination.location);

      // Create AR waypoints from navigation path
      const waypoints = await this.createARWaypoints(path, config);

      // Create navigation object
      const navigation: ARNavigation = {
        navigationId: `nav_${sessionId}_${Date.now()}`,
        destination,
        path,
        waypoints,
        visualStyle: this.mapVisualStyle(config.visualStyle),
        updateFrequency: config.updateInterval,
        isActive: true,
        currentStep: 0
      };

      // Store navigation
      this.activeNavigations.set(navigation.navigationId, navigation);

      // Create AR visualization
      await this.createNavigationVisualization(sessionId, navigation, config);

      // Start navigation updates
      await this.startNavigationUpdates(navigation, config);

      // Track analytics
      await this.bridgeService.trackARVREvent({
        eventType: 'ar_navigation_started',
        userId: sessionId.split('_')[0], // Extract user ID from session
        sessionId,
        timestamp: new Date(),
        data: {
          destinationId: destination.poiId,
          distance: path.distance,
          estimatedTime: path.estimatedTime
        },
        context: {
          platform: 'ar',
          feature: 'wayfinding',
          deviceInfo: {
            model: 'unknown',
            os: 'unknown',
            version: 'unknown',
            capabilities: ['gps', 'camera', 'accelerometer']
          },
          location: currentLocation
        }
      });

      this.wayfindingLogger.info('AR navigation started successfully', {
        navigationId: navigation.navigationId,
        waypointCount: waypoints.length,
        estimatedTime: path.estimatedTime
      });

      return navigation;

    } catch (error) {
      this.wayfindingLogger.error('Failed to start AR navigation', {
        sessionId,
        destinationId: destination.poiId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update navigation progress based on current location
   */
  async updateNavigationProgress(navigationId: string, currentLocation: LocationContext): Promise<ARNavigationUpdate> {
    try {
      const navigation = this.activeNavigations.get(navigationId);
      if (!navigation || !navigation.isActive) {
        throw new Error(`Navigation not found or inactive: ${navigationId}`);
      }

      // Calculate distance to next waypoint
      const nextWaypoint = navigation.waypoints[navigation.currentStep];
      const distance = this.calculateDistance(currentLocation, nextWaypoint.position);

      // Check if waypoint is reached
      if (distance < 5.0) { // 5 meter threshold
        await this.reachWaypoint(navigation, navigation.currentStep);
      }

      // Calculate remaining distance and time
      const remainingDistance = this.calculateRemainingDistance(navigation, currentLocation);
      const estimatedTime = this.calculateEstimatedTime(remainingDistance);

      // Generate instruction
      const instruction = this.generateNavigationInstruction(navigation, currentLocation);

      const update: ARNavigationUpdate = {
        navigationId,
        currentPosition: currentLocation,
        nextWaypoint,
        remainingDistance,
        estimatedTime,
        instruction
      };

      // Update AR visualization
      await this.updateNavigationVisualization(navigationId, update);

      // Record performance metrics
      await this.wayfindingPerformanceMonitor.recordMetric('ar_navigation_update', 1, {
        navigationId,
        currentStep: navigation.currentStep,
        remainingDistance
      });

      return update;

    } catch (error) {
      this.wayfindingLogger.error('Failed to update navigation progress', {
        navigationId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Stop navigation and cleanup
   */
  async stopNavigation(navigationId: string): Promise<void> {
    try {
      this.wayfindingLogger.info('Stopping AR navigation', { navigationId });

      const navigation = this.activeNavigations.get(navigationId);
      if (!navigation) {
        this.wayfindingLogger.warn('Navigation not found', { navigationId });
        return;
      }

      // Stop updates
      navigation.isActive = false;
      const updateInterval = this.navigationUpdateIntervals.get(navigationId);
      if (updateInterval) {
        clearInterval(updateInterval);
        this.navigationUpdateIntervals.delete(navigationId);
      }

      // Remove AR visualization
      await this.removeNavigationVisualization(navigationId);

      // Remove from active navigations
      this.activeNavigations.delete(navigationId);

      // Track completion analytics
      await this.bridgeService.trackARVREvent({
        eventType: 'ar_navigation_completed',
        userId: 'unknown', // Would extract from session
        sessionId: navigationId.split('_')[1], // Extract session from navigation ID
        timestamp: new Date(),
        data: {
          destinationReached: navigation.currentStep >= navigation.waypoints.length - 1,
          completionPercentage: (navigation.currentStep / navigation.waypoints.length) * 100
        },
        context: {
          platform: 'ar',
          feature: 'wayfinding',
          deviceInfo: {
            model: 'unknown',
            os: 'unknown',
            version: 'unknown',
            capabilities: []
          }
        }
      });

      this.wayfindingLogger.info('AR navigation stopped successfully', { navigationId });

    } catch (error) {
      this.wayfindingLogger.error('Failed to stop AR navigation', {
        navigationId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all POIs within range for discovery
   */
  async getPOIsInRange(currentLocation: LocationContext, range: number = 100): Promise<POIData[]> {
    try {
      this.wayfindingLogger.debug('Getting POIs in range', { location: currentLocation, range });

      // In a real implementation, this would query the wayfinding service
      // For now, we'll simulate with mock data
      const mockPOIs: POIData[] = [
        {
          poiId: 'poi_gate_b15',
          name: 'Gate B15',
          description: 'Departure gate for international flights',
          category: 'gate',
          location: {
            latitude: currentLocation.latitude + 0.001,
            longitude: currentLocation.longitude + 0.001,
            accuracy: 2.0,
            floor: currentLocation.floor,
            building: currentLocation.building,
            zone: 'Gate Area B'
          },
          amenities: ['seating', 'charging-stations', 'wifi'],
          operatingHours: {
            monday: { open: '05:00', close: '23:00' },
            tuesday: { open: '05:00', close: '23:00' },
            wednesday: { open: '05:00', close: '23:00' },
            thursday: { open: '05:00', close: '23:00' },
            friday: { open: '05:00', close: '23:00' },
            saturday: { open: '05:00', close: '23:00' },
            sunday: { open: '05:00', close: '23:00' }
          }
        },
        {
          poiId: 'poi_restaurant_001',
          name: 'Sky Lounge Restaurant',
          description: 'Premium dining with runway views',
          category: 'restaurant',
          location: {
            latitude: currentLocation.latitude - 0.0005,
            longitude: currentLocation.longitude + 0.0008,
            accuracy: 2.0,
            floor: currentLocation.floor,
            building: currentLocation.building,
            zone: 'Central Plaza'
          },
          amenities: ['dining', 'bar', 'wifi', 'view'],
          operatingHours: {
            monday: { open: '06:00', close: '22:00' },
            tuesday: { open: '06:00', close: '22:00' },
            wednesday: { open: '06:00', close: '22:00' },
            thursday: { open: '06:00', close: '22:00' },
            friday: { open: '06:00', close: '22:00' },
            saturday: { open: '06:00', close: '22:00' },
            sunday: { open: '06:00', close: '22:00' }
          },
          contactInfo: {
            phone: '+1-555-0123',
            website: 'https://skylounge.example.com'
          }
        }
      ];

      // Filter by range
      const poisInRange = mockPOIs.filter(poi => {
        const distance = this.calculateDistance(currentLocation, {
          x: poi.location.latitude,
          y: poi.location.longitude,
          z: poi.location.altitude || 0
        });
        return distance <= range;
      });

      this.wayfindingLogger.info('POIs retrieved', {
        totalFound: poisInRange.length,
        range
      });

      return poisInRange;

    } catch (error) {
      this.wayfindingLogger.error('Failed to get POIs in range', {
        location: currentLocation,
        range,
        error: error.message
      });
      throw error;
    }
  }

  // Private helper methods
  private getDefaultConfig(): ARWayfindingConfig {
    return {
      enableVoiceGuidance: true,
      preferredLanguage: 'en',
      visualStyle: 'detailed',
      updateInterval: 1000, // 1 second
      maxViewDistance: 50 // 50 meters
    };
  }

  private async createARWaypoints(path: NavigationPath, config: ARWayfindingConfig): Promise<ARWaypoint[]> {
    const waypoints: ARWaypoint[] = [];

    for (let i = 0; i < path.waypoints.length; i++) {
      const pathWaypoint = path.waypoints[i];
      const instruction = path.instructions[i];

      const arWaypoint: ARWaypoint = {
        waypointId: `waypoint_${i}`,
        position: {
          x: pathWaypoint.location.latitude,
          y: pathWaypoint.location.longitude,
          z: pathWaypoint.location.altitude || 0
        },
        type: pathWaypoint.type === 'landmark' ? 'landmark' : 'direction',
        description: instruction?.instruction || pathWaypoint.description || 'Continue',
        reached: false
      };

      // Load AR asset for waypoint if needed
      if (config.visualStyle !== 'minimal') {
        // In a real implementation, we would load the appropriate 3D asset
        // arWaypoint.arAsset = await this.loadWaypointAsset(arWaypoint.type);
      }

      waypoints.push(arWaypoint);
    }

    // Mark destination
    if (waypoints.length > 0) {
      waypoints[waypoints.length - 1].type = 'destination';
    }

    return waypoints;
  }

  private mapVisualStyle(style: string): 'arrow-overlay' | 'path-line' | 'breadcrumb' {
    switch (style) {
      case 'minimal': return 'arrow-overlay';
      case 'gamified': return 'breadcrumb';
      default: return 'path-line';
    }
  }

  private async createNavigationVisualization(
    sessionId: string,
    navigation: ARNavigation,
    config: ARWayfindingConfig
  ): Promise<void> {
    try {
      const components: ARUIComponent[] = [];

      // Create direction arrows
      if (navigation.visualStyle === 'arrow-overlay' || navigation.visualStyle === 'path-line') {
        components.push({
          type: 'direction-arrow',
          properties: {
            id: `arrow_${navigation.navigationId}`,
            direction: navigation.waypoints[0].position,
            color: '#00FF00',
            size: 'medium',
            animated: true
          }
        });
      }

      // Create path visualization
      if (navigation.visualStyle === 'path-line') {
        components.push({
          type: 'path-line',
          properties: {
            id: `path_${navigation.navigationId}`,
            waypoints: navigation.waypoints.map(wp => wp.position),
            color: '#0066FF',
            width: 0.1,
            opacity: 0.8
          }
        });
      }

      // Create breadcrumb trail
      if (navigation.visualStyle === 'breadcrumb') {
        navigation.waypoints.forEach((waypoint, index) => {
          components.push({
            type: 'breadcrumb',
            properties: {
              id: `breadcrumb_${navigation.navigationId}_${index}`,
              position: waypoint.position,
              label: waypoint.description,
              active: index === navigation.currentStep
            }
          });
        });
      }

      // Create destination marker
      const destination = navigation.waypoints[navigation.waypoints.length - 1];
      components.push({
        type: 'destination-marker',
        properties: {
          id: `destination_${navigation.navigationId}`,
          position: destination.position,
          label: navigation.destination.name,
          category: navigation.destination.category,
          pulsating: true
        }
      });

      // Create instruction UI
      components.push({
        type: 'instruction-panel',
        properties: {
          id: `instructions_${navigation.navigationId}`,
          text: navigation.waypoints[0].description,
          distance: this.calculateRemainingDistance(navigation, await this.bridgeService.getCurrentLocation()),
          estimatedTime: navigation.path.estimatedTime
        }
      });

      // Create AR interface
      await this.createARInterface(components);

      this.wayfindingLogger.debug('Navigation visualization created', {
        navigationId: navigation.navigationId,
        componentCount: components.length
      });

    } catch (error) {
      this.wayfindingLogger.error('Failed to create navigation visualization', {
        navigationId: navigation.navigationId,
        error: error.message
      });
      throw error;
    }
  }

  private async startNavigationUpdates(navigation: ARNavigation, config: ARWayfindingConfig): Promise<void> {
    const updateInterval = setInterval(async () => {
      try {
        if (!navigation.isActive) {
          clearInterval(updateInterval);
          return;
        }

        const currentLocation = await this.bridgeService.getCurrentLocation();
        await this.updateNavigationProgress(navigation.navigationId, currentLocation);

      } catch (error) {
        this.wayfindingLogger.error('Navigation update failed', {
          navigationId: navigation.navigationId,
          error: error.message
        });
      }
    }, config.updateInterval);

    this.navigationUpdateIntervals.set(navigation.navigationId, updateInterval);
  }

  private async reachWaypoint(navigation: ARNavigation, waypointIndex: number): Promise<void> {
    if (waypointIndex < navigation.waypoints.length) {
      navigation.waypoints[waypointIndex].reached = true;
      navigation.currentStep = Math.min(waypointIndex + 1, navigation.waypoints.length - 1);

      this.wayfindingLogger.debug('Waypoint reached', {
        navigationId: navigation.navigationId,
        waypointIndex,
        currentStep: navigation.currentStep
      });

      // Check if destination reached
      if (navigation.currentStep >= navigation.waypoints.length - 1) {
        await this.stopNavigation(navigation.navigationId);
      }
    }
  }

  private async updateNavigationVisualization(navigationId: string, update: ARNavigationUpdate): Promise<void> {
    // Update AR visualization with new position and instruction
    // In a real implementation, this would update the AR interface elements
    this.wayfindingLogger.debug('Updating navigation visualization', {
      navigationId,
      instruction: update.instruction,
      remainingDistance: update.remainingDistance
    });
  }

  private async removeNavigationVisualization(navigationId: string): Promise<void> {
    // Remove AR elements from the scene
    // In a real implementation, this would cleanup AR interface elements
    this.wayfindingLogger.debug('Removing navigation visualization', { navigationId });
  }

  private calculateDistance(from: LocationContext, to: { x: number; y: number; z: number }): number {
    // Simple Euclidean distance calculation
    // In a real implementation, this would use proper geospatial calculations
    const dx = from.latitude - to.x;
    const dy = from.longitude - to.y;
    const dz = (from.altitude || 0) - to.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) * 111000; // Rough conversion to meters
  }

  private calculateRemainingDistance(navigation: ARNavigation, currentLocation: LocationContext): number {
    let totalDistance = 0;
    
    // Distance to next waypoint
    if (navigation.currentStep < navigation.waypoints.length) {
      const nextWaypoint = navigation.waypoints[navigation.currentStep];
      totalDistance += this.calculateDistance(currentLocation, nextWaypoint.position);

      // Distance for remaining waypoints
      for (let i = navigation.currentStep; i < navigation.waypoints.length - 1; i++) {
        const current = navigation.waypoints[i];
        const next = navigation.waypoints[i + 1];
        totalDistance += this.calculateDistance(
          { latitude: current.position.x, longitude: current.position.y, accuracy: 0 },
          next.position
        );
      }
    }

    return totalDistance;
  }

  private calculateEstimatedTime(distance: number): number {
    // Estimate walking time at 4 km/h (1.1 m/s)
    return Math.round(distance / 1.1);
  }

  private generateNavigationInstruction(navigation: ARNavigation, currentLocation: LocationContext): string {
    if (navigation.currentStep >= navigation.waypoints.length) {
      return 'You have reached your destination';
    }

    const nextWaypoint = navigation.waypoints[navigation.currentStep];
    const distance = this.calculateDistance(currentLocation, nextWaypoint.position);

    if (distance < 10) {
      return `${nextWaypoint.description} (${Math.round(distance)}m)`;
    } else {
      return `Continue towards ${nextWaypoint.description} (${Math.round(distance)}m)`;
    }
  }
} 