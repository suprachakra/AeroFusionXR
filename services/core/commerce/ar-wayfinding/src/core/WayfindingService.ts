import { createLogger } from '@aerofusionxr/shared';
import { PerformanceMonitor } from '@aerofusionxr/shared';
import { SecurityService, WayfindingSecurityContext, WayfindingAuditEvent } from '../security/SecurityService';
import { PositioningService, PositionUpdate, BeaconData } from '../positioning/PositioningService';
import { MappingService, IndoorMap, RoutingGraph, Node, Edge } from '../mapping/MappingService';
import { PathfindingEngine, PathfindingRequest, PathfindingResult } from '../pathfinding/PathfindingEngine';
import { ARVisualizationService, ARArrow, ARBreadcrumb, ARNavigationOverlay } from '../ar/ARVisualizationService';

// Core wayfinding interfaces
export interface WayfindingRequest {
  sessionID: string;
  userID: string;
  startNode: string;
  endNode: string;
  terminal: string;
  constraints: AccessibilityConstraints;
  mode: 'AR' | '2D' | 'audio';
  preferences: NavigationPreferences;
}

export interface AccessibilityConstraints {
  accessType: 'default' | 'wheelchair' | 'stroller';
  avoidStaircases: boolean;
  requireElevators: boolean;
  maxSlopeDegrees?: number;
  preferRamps: boolean;
}

export interface NavigationPreferences {
  voiceGuidance: boolean;
  highContrast: boolean;
  visualStyle: 'minimal' | 'detailed' | 'gamified';
  speechRate: number;
  locale: string;
  updateFrequency: number; // Hz
}

export interface NavigationSession {
  sessionID: string;
  userID: string;
  terminal: string;
  route: PathfindingResult;
  currentWaypointIndex: number;
  isActive: boolean;
  mode: 'AR' | '2D' | 'audio';
  startTime: Date;
  endTime?: Date;
  constraints: AccessibilityConstraints;
  preferences: NavigationPreferences;
}

export interface NavigationUpdate {
  sessionID: string;
  currentPosition: PositionUpdate;
  nextWaypoint: Node;
  distanceToWaypoint: number;
  distanceRemaining: number;
  estimatedTimeRemaining: number;
  instruction: string;
  shouldPlayAudio: boolean;
}

export interface FloorChangeEvent {
  sessionID: string;
  fromFloor: number;
  toFloor: number;
  elevatorNode?: string;
  staircaseNode?: string;
  instruction: string;
}

// Error classes
export class WayfindingError extends Error {
  constructor(message: string, public code: string, public sessionID?: string) {
    super(message);
    this.name = 'WayfindingError';
  }
}

export class RouteNotFoundError extends WayfindingError {
  constructor(startNode: string, endNode: string) {
    super(`No route found from ${startNode} to ${endNode}`, 'ROUTE_NOT_FOUND');
  }
}

export class PositioningLostError extends WayfindingError {
  constructor(sessionID: string) {
    super(`Positioning lost for session ${sessionID}`, 'POSITIONING_LOST', sessionID);
  }
}

export class MapDataMissingError extends WayfindingError {
  constructor(terminal: string, floor: number) {
    super(`Map data missing for terminal ${terminal} floor ${floor}`, 'MAP_DATA_MISSING');
  }
}

export class WayfindingService {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private securityService: SecurityService;
  private positioningService: PositioningService;
  private mappingService: MappingService;
  private pathfindingEngine: PathfindingEngine;
  private arVisualizationService: ARVisualizationService;

  // Active navigation sessions
  private activeSessions: Map<string, NavigationSession> = new Map();
  private sessionUpdateIntervals: Map<string, any> = new Map();
  private positioningCallbacks: Map<string, (position: PositionUpdate) => void> = new Map();

  constructor() {
    this.logger = new Logger('WayfindingService');
    this.performanceMonitor = new PerformanceMonitor('WayfindingService');
    this.securityService = new SecurityService();
    this.positioningService = new PositioningService();
    this.mappingService = new MappingService();
    this.pathfindingEngine = new PathfindingEngine();
    this.arVisualizationService = new ARVisualizationService();

    this.initializeEventListeners();
  }

  /**
   * Start navigation session
   */
  async startNavigation(request: WayfindingRequest, context: WayfindingSecurityContext): Promise<NavigationSession> {
    const startTime = Date.now();

    try {
      this.logger.info('Starting navigation session', {
        sessionID: request.sessionID,
        userID: request.userID,
        startNode: request.startNode,
        endNode: request.endNode,
        terminal: request.terminal,
        mode: request.mode,
        accessType: request.constraints.accessType
      });

      // Validate request
      await this.validateNavigationRequest(request, context);

      // Get current position
      const currentPosition = await this.positioningService.getCurrentPosition(request.userID);
      if (!currentPosition) {
        throw new PositioningLostError(request.sessionID);
      }

      // Load map data for terminal
      const indoorMap = await this.mappingService.getIndoorMap(request.terminal);
      if (!indoorMap) {
        throw new MapDataMissingError(request.terminal, currentPosition.floor);
      }

      // Load routing graph
      const routingGraph = await this.mappingService.getRoutingGraph(request.terminal);
      if (!routingGraph) {
        throw new MapDataMissingError(request.terminal, currentPosition.floor);
      }

      // Find optimal route
      const pathfindingRequest: PathfindingRequest = {
        graph: routingGraph,
        startNode: request.startNode,
        endNode: request.endNode,
        constraints: request.constraints,
        currentPosition: currentPosition
      };

      const route = await this.pathfindingEngine.findPath(pathfindingRequest);
      if (!route.success) {
        throw new RouteNotFoundError(request.startNode, request.endNode);
      }

      // Create navigation session
      const session: NavigationSession = {
        sessionID: request.sessionID,
        userID: request.userID,
        terminal: request.terminal,
        route,
        currentWaypointIndex: 0,
        isActive: true,
        mode: request.mode,
        startTime: new Date(),
        constraints: request.constraints,
        preferences: request.preferences
      };

      // Store session
      this.activeSessions.set(request.sessionID, session);

      // Initialize AR visualization if in AR mode
      if (request.mode === 'AR') {
        await this.initializeARVisualization(session, currentPosition);
      }

      // Start position tracking
      await this.startPositionTracking(session);

      // Record metrics
      await this.performanceMonitor.recordMetric('navigation_start_duration', Date.now() - startTime, {
        terminal: request.terminal,
        mode: request.mode,
        routeLength: route.waypoints.length,
        accessType: request.constraints.accessType
      });

      // Audit log
      await this.securityService.auditWayfindingAction({
        userID: request.userID,
        action: 'navigation_started',
        sessionID: request.sessionID,
        startNode: request.startNode,
        endNode: request.endNode,
        terminal: request.terminal,
        timestamp: new Date(),
        success: true
      });

      this.logger.info('Navigation session started successfully', {
        sessionID: request.sessionID,
        routeDistance: route.totalDistance,
        estimatedTime: route.estimatedTime,
        waypointCount: route.waypoints.length,
        duration: Date.now() - startTime
      });

      return session;

    } catch (error) {
      this.logger.error('Failed to start navigation session', {
        sessionID: request.sessionID,
        userID: request.userID,
        error: error.message,
        duration: Date.now() - startTime
      });

      // Audit log failure
      await this.securityService.auditWayfindingAction({
        userID: request.userID,
        action: 'navigation_started',
        sessionID: request.sessionID,
        startNode: request.startNode,
        endNode: request.endNode,
        terminal: request.terminal,
        timestamp: new Date(),
        success: false,
        errorDetails: error.message
      });

      throw error;
    }
  }

  /**
   * Update navigation based on current position
   */
  async updateNavigation(sessionID: string, currentPosition: PositionUpdate): Promise<NavigationUpdate | null> {
    try {
      const session = this.activeSessions.get(sessionID);
      if (!session || !session.isActive) {
        return null;
      }

      // Check if we've reached current waypoint
      const currentWaypoint = session.route.waypoints[session.currentWaypointIndex];
      const distanceToWaypoint = this.calculateDistance(currentPosition, currentWaypoint);

      // Waypoint reached threshold
      if (distanceToWaypoint < 3.0) { // 3 meters
        await this.waypointReached(session, session.currentWaypointIndex);
      }

      // Check if navigation completed
      if (session.currentWaypointIndex >= session.route.waypoints.length) {
        await this.completeNavigation(sessionID);
        return null;
      }

      // Get next waypoint
      const nextWaypoint = session.route.waypoints[session.currentWaypointIndex];
      
      // Calculate remaining distance and time
      const distanceRemaining = this.calculateRemainingDistance(session, currentPosition);
      const estimatedTimeRemaining = this.calculateEstimatedTime(distanceRemaining);

      // Generate instruction
      const instruction = await this.generateInstruction(session, currentPosition, nextWaypoint);

      // Check if should play audio
      const shouldPlayAudio = this.shouldPlayAudioInstruction(session, currentPosition, nextWaypoint);

      const update: NavigationUpdate = {
        sessionID,
        currentPosition,
        nextWaypoint,
        distanceToWaypoint,
        distanceRemaining,
        estimatedTimeRemaining,
        instruction,
        shouldPlayAudio
      };

      // Update AR visualization if in AR mode
      if (session.mode === 'AR') {
        await this.updateARVisualization(sessionID, update);
      }

      // Record metrics
      await this.performanceMonitor.recordMetric('navigation_update_duration', performance.now(), {
        sessionID,
        currentWaypoint: session.currentWaypointIndex,
        distanceRemaining,
        mode: session.mode
      });

      return update;

    } catch (error) {
      this.logger.error('Failed to update navigation', {
        sessionID,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Stop navigation session
   */
  async stopNavigation(sessionID: string, reason: 'completed' | 'cancelled' | 'error' = 'cancelled'): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionID);
      if (!session) {
        this.logger.warn('Attempted to stop non-existent session', { sessionID });
        return;
      }

      this.logger.info('Stopping navigation session', {
        sessionID,
        reason,
        duration: Date.now() - session.startTime.getTime()
      });

      // Mark session as inactive
      session.isActive = false;
      session.endTime = new Date();

      // Stop position tracking
      await this.stopPositionTracking(sessionID);

      // Remove AR visualization if in AR mode
      if (session.mode === 'AR') {
        await this.cleanupARVisualization(sessionID);
      }

      // Clear intervals
      const interval = this.sessionUpdateIntervals.get(sessionID);
      if (interval) {
        clearInterval(interval);
        this.sessionUpdateIntervals.delete(sessionID);
      }

      // Remove positioning callback
      this.positioningCallbacks.delete(sessionID);

      // Remove from active sessions
      this.activeSessions.delete(sessionID);

      // Audit log
      await this.securityService.auditWayfindingAction({
        userID: session.userID,
        action: 'navigation_stopped',
        sessionID,
        reason,
        duration: Date.now() - session.startTime.getTime(),
        timestamp: new Date(),
        success: true
      });

      this.logger.info('Navigation session stopped successfully', {
        sessionID,
        reason,
        totalDuration: Date.now() - session.startTime.getTime()
      });

    } catch (error) {
      this.logger.error('Failed to stop navigation session', {
        sessionID,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get navigation session status
   */
  async getNavigationStatus(sessionID: string): Promise<NavigationSession | null> {
    return this.activeSessions.get(sessionID) || null;
  }

  /**
   * Handle floor change during navigation
   */
  async handleFloorChange(sessionID: string, newFloor: number): Promise<FloorChangeEvent | null> {
    try {
      const session = this.activeSessions.get(sessionID);
      if (!session || !session.isActive) {
        return null;
      }

      const currentPosition = await this.positioningService.getCurrentPosition(session.userID);
      if (!currentPosition) {
        throw new PositioningLostError(sessionID);
      }

      const oldFloor = currentPosition.floor;
      
      // Find elevator or staircase node for floor change
      const floorChangeNode = this.findFloorChangeNode(session.route, oldFloor, newFloor);
      
      let instruction = `You are now on floor ${newFloor}`;
      if (floorChangeNode) {
        if (floorChangeNode.type === 'elevator') {
          instruction = `Take elevator to floor ${newFloor}`;
        } else if (floorChangeNode.type === 'staircase') {
          instruction = `Take stairs to floor ${newFloor}`;
        }
      }

      const floorChangeEvent: FloorChangeEvent = {
        sessionID,
        fromFloor: oldFloor,
        toFloor: newFloor,
        elevatorNode: floorChangeNode?.type === 'elevator' ? floorChangeNode.nodeID : undefined,
        staircaseNode: floorChangeNode?.type === 'staircase' ? floorChangeNode.nodeID : undefined,
        instruction
      };

      // Update AR visualization for new floor
      if (session.mode === 'AR') {
        await this.updateARForFloorChange(sessionID, newFloor);
      }

      this.logger.info('Floor change handled', {
        sessionID,
        fromFloor: oldFloor,
        toFloor: newFloor,
        floorChangeNode: floorChangeNode?.nodeID
      });

      return floorChangeEvent;

    } catch (error) {
      this.logger.error('Failed to handle floor change', {
        sessionID,
        newFloor,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get nearby POIs for discovery
   */
  async getNearbyPOIs(userID: string, radius: number = 50): Promise<Node[]> {
    try {
      const currentPosition = await this.positioningService.getCurrentPosition(userID);
      if (!currentPosition) {
        throw new PositioningLostError('temp_session');
      }

      const routingGraph = await this.mappingService.getRoutingGraph(currentPosition.terminal || 'T1');
      if (!routingGraph) {
        throw new MapDataMissingError(currentPosition.terminal || 'T1', currentPosition.floor);
      }

      // Find POI nodes within radius
      const nearbyPOIs = routingGraph.nodes.filter(node => {
        if (!node.isPOI) return false;
        
        const distance = this.calculateDistance(currentPosition, node);
        return distance <= radius && node.floor === currentPosition.floor;
      });

      // Sort by distance
      nearbyPOIs.sort((a, b) => {
        const distA = this.calculateDistance(currentPosition, a);
        const distB = this.calculateDistance(currentPosition, b);
        return distA - distB;
      });

      return nearbyPOIs.slice(0, 20); // Limit to 20 POIs

    } catch (error) {
      this.logger.error('Failed to get nearby POIs', {
        userID,
        radius,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async validateNavigationRequest(request: WayfindingRequest, context: WayfindingSecurityContext): Promise<void> {
    if (!request.sessionID || !request.userID || !request.startNode || !request.endNode) {
      throw new WayfindingError('Invalid navigation request', 'INVALID_REQUEST');
    }

    // Security validation
    await this.securityService.validateWayfindingRequest(request.userID, 'navigation.start', context);
  }

  private async initializeARVisualization(session: NavigationSession, currentPosition: PositionUpdate): Promise<void> {
    try {
      // Create AR arrow pointing to first waypoint
      const firstWaypoint = session.route.waypoints[0];
      
      const arArrow: ARArrow = {
        id: `arrow_${session.sessionID}`,
        position: firstWaypoint,
        targetPosition: firstWaypoint,
        color: session.preferences.highContrast ? '#FFE400' : '#00C853',
        scale: 0.25,
        isVisible: true
      };

      await this.arVisualizationService.createArrow(session.sessionID, arArrow);

      // Create breadcrumb system if enabled
      if (session.preferences.visualStyle === 'detailed') {
        await this.arVisualizationService.initializeBreadcrumbs(session.sessionID);
      }

      // Create navigation overlay
      const overlay: ARNavigationOverlay = {
        sessionID: session.sessionID,
        showDistance: true,
        showInstructions: true,
        highContrast: session.preferences.highContrast,
        locale: session.preferences.locale
      };

      await this.arVisualizationService.createNavigationOverlay(overlay);

    } catch (error) {
      this.logger.error('Failed to initialize AR visualization', {
        sessionID: session.sessionID,
        error: error.message
      });
      throw error;
    }
  }

  private async startPositionTracking(session: NavigationSession): Promise<void> {
    // Create position update callback
    const callback = (position: PositionUpdate) => {
      this.updateNavigation(session.sessionID, position).catch(error => {
        this.logger.error('Position update failed', {
          sessionID: session.sessionID,
          error: error.message
        });
      });
    };

    this.positioningCallbacks.set(session.sessionID, callback);

    // Subscribe to position updates
    await this.positioningService.subscribeToPositionUpdates(session.userID, callback);

    // Start periodic updates
    const interval = setInterval(async () => {
      try {
        const currentPosition = await this.positioningService.getCurrentPosition(session.userID);
        if (currentPosition) {
          await callback(currentPosition);
        }
      } catch (error) {
        this.logger.error('Periodic position update failed', {
          sessionID: session.sessionID,
          error: error.message
        });
      }
    }, 1000 / session.preferences.updateFrequency); // Convert Hz to ms

    this.sessionUpdateIntervals.set(session.sessionID, interval);
  }

  private async stopPositionTracking(sessionID: string): Promise<void> {
    const session = this.activeSessions.get(sessionID);
    if (!session) return;

    // Unsubscribe from position updates
    await this.positioningService.unsubscribeFromPositionUpdates(session.userID);
    
    // Clear interval
    const interval = this.sessionUpdateIntervals.get(sessionID);
    if (interval) {
      clearInterval(interval);
      this.sessionUpdateIntervals.delete(sessionID);
    }
  }

  private async waypointReached(session: NavigationSession, waypointIndex: number): Promise<void> {
    session.currentWaypointIndex = waypointIndex + 1;

    // Add breadcrumb at reached waypoint
    if (session.mode === 'AR' && session.preferences.visualStyle === 'detailed') {
      const waypoint = session.route.waypoints[waypointIndex];
      const breadcrumb: ARBreadcrumb = {
        id: `breadcrumb_${session.sessionID}_${waypointIndex}`,
        position: waypoint,
        timestamp: new Date(),
        isVisible: true
      };

      await this.arVisualizationService.addBreadcrumb(session.sessionID, breadcrumb);
    }

    // Audit log waypoint reached
    await this.securityService.auditWayfindingAction({
      userID: session.userID,
      action: 'waypoint_reached',
      sessionID: session.sessionID,
      waypointIndex,
      timestamp: new Date(),
      success: true
    });

    this.logger.debug('Waypoint reached', {
      sessionID: session.sessionID,
      waypointIndex,
      remainingWaypoints: session.route.waypoints.length - (waypointIndex + 1)
    });
  }

  private async completeNavigation(sessionID: string): Promise<void> {
    const session = this.activeSessions.get(sessionID);
    if (!session) return;

    await this.stopNavigation(sessionID, 'completed');

    // Record completion metrics
    const totalDuration = Date.now() - session.startTime.getTime();
    await this.performanceMonitor.recordMetric('navigation_completion_time', totalDuration, {
      terminal: session.terminal,
      mode: session.mode,
      accessType: session.constraints.accessType,
      routeLength: session.route.waypoints.length
    });

    this.logger.info('Navigation completed successfully', {
      sessionID,
      totalDuration,
      totalDistance: session.route.totalDistance
    });
  }

  private calculateDistance(from: PositionUpdate | Node, to: PositionUpdate | Node): number {
    const dx = from.x - to.x;
    const dy = from.y - to.y;
    const dz = from.z - to.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private calculateRemainingDistance(session: NavigationSession, currentPosition: PositionUpdate): number {
    let distance = 0;
    
    // Distance to current waypoint
    const currentWaypoint = session.route.waypoints[session.currentWaypointIndex];
    distance += this.calculateDistance(currentPosition, currentWaypoint);

    // Distance for remaining waypoints
    for (let i = session.currentWaypointIndex; i < session.route.waypoints.length - 1; i++) {
      const waypoint1 = session.route.waypoints[i];
      const waypoint2 = session.route.waypoints[i + 1];
      distance += this.calculateDistance(waypoint1, waypoint2);
    }

    return distance;
  }

  private calculateEstimatedTime(distance: number, walkingSpeed: number = 1.4): number {
    // Walking speed in m/s (average adult walking speed)
    return Math.round(distance / walkingSpeed);
  }

  private async generateInstruction(session: NavigationSession, currentPosition: PositionUpdate, nextWaypoint: Node): Promise<string> {
    const distance = this.calculateDistance(currentPosition, nextWaypoint);
    
    if (distance > 20) {
      return `Continue straight for ${Math.round(distance)} meters`;
    } else if (distance > 5) {
      // Generate turn instruction based on waypoint direction
      const direction = this.calculateDirection(currentPosition, nextWaypoint);
      return `In ${Math.round(distance)} meters, ${direction}`;
    } else {
      return `Approaching ${nextWaypoint.type || 'waypoint'}`;
    }
  }

  private calculateDirection(from: PositionUpdate, to: Node): string {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    
    if (angle >= -45 && angle < 45) return 'turn right';
    if (angle >= 45 && angle < 135) return 'continue straight';
    if (angle >= 135 || angle < -135) return 'turn left';
    return 'turn around';
  }

  private shouldPlayAudioInstruction(session: NavigationSession, currentPosition: PositionUpdate, nextWaypoint: Node): boolean {
    if (!session.preferences.voiceGuidance) return false;
    
    const distance = this.calculateDistance(currentPosition, nextWaypoint);
    return distance <= 10; // Play audio when within 10 meters
  }

  private findFloorChangeNode(route: PathfindingResult, fromFloor: number, toFloor: number): Node | null {
    for (const waypoint of route.waypoints) {
      if ((waypoint.type === 'elevator' || waypoint.type === 'staircase') && 
          waypoint.floor === fromFloor) {
        return waypoint;
      }
    }
    return null;
  }

  private async updateARVisualization(sessionID: string, update: NavigationUpdate): Promise<void> {
    // Update AR arrow direction
    await this.arVisualizationService.updateArrowTarget(sessionID, update.nextWaypoint);
    
    // Update navigation overlay
    await this.arVisualizationService.updateNavigationOverlay(sessionID, {
      distance: update.distanceRemaining,
      instruction: update.instruction,
      estimatedTime: update.estimatedTimeRemaining
    });
  }

  private async updateARForFloorChange(sessionID: string, newFloor: number): Promise<void> {
    // Update AR visualization for new floor
    await this.arVisualizationService.updateFloor(sessionID, newFloor);
  }

  private async cleanupARVisualization(sessionID: string): Promise<void> {
    await this.arVisualizationService.cleanup(sessionID);
  }

  private initializeEventListeners(): void {
    // Listen for position accuracy warnings
    this.positioningService.on('lowAccuracy', (event) => {
      this.logger.warn('Low positioning accuracy detected', event);
    });

    // Listen for positioning lost events
    this.positioningService.on('positioningLost', (event) => {
      this.logger.error('Positioning lost', event);
      // Handle gracefully by switching to 2D mode or showing warning
    });
  }

  /**
   * Get service status and health metrics
   */
  async getServiceStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    activeSessions: number;
    positioningService: any;
    mappingService: any;
    metrics: any;
  }> {
    const positioningStatus = await this.positioningService.getStatus();
    const mappingStatus = await this.mappingService.getStatus();
    
    const healthyServices = [
      positioningStatus.available,
      mappingStatus.available
    ].filter(s => s).length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyServices === 2) {
      status = 'healthy';
    } else if (healthyServices > 0) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      activeSessions: this.activeSessions.size,
      positioningService: positioningStatus,
      mappingService: mappingStatus,
      metrics: {
        avgNavigationStartTime: this.performanceMonitor.getMetricStats('navigation_start_duration')?.avg || 0,
        avgUpdateTime: this.performanceMonitor.getMetricStats('navigation_update_duration')?.avg || 0,
        totalNavigations: this.performanceMonitor.getMetricStats('navigation_start_duration')?.count || 0
      }
    };
  }
} 
