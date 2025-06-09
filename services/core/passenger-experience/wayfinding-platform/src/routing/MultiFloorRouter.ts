/**
 * MultiFloorRouter.ts
 * Handles path planning across multiple floors with vertical transitions
 */

import { Vector3 } from 'three';
import { Graph } from 'ngraph.graph';
import { PathFinder } from 'ngraph.path';
import { MetricsClient } from '../monitoring/MetricsClient';
import { TracingClient } from '../monitoring/TracingClient';
import { createLogger } from '@aerofusionxr/shared';
import { FloorPlan } from '../models/FloorPlan';
import { VerticalTransition } from '../models/VerticalTransition';
import { NavigationPoint } from '../models/NavigationPoint';
import { Cache } from '../utils/Cache';
import { aStar } from 'ngraph.path';
import { Position, Route, RouteSegment, NavigationOptions } from '../types';
import { metrics } from '../utils/metrics';

interface RouterConfig {
  maxPathLength: number;
  maxTransitions: number;
  weightFactors: {
    distance: number;
    transition: number;
    crowding: number;
  };
  cacheConfig: {
    maxSize: number;
    ttl: number;
  };
}

export class MultiFloorRouter {
  private floorPlans: Map<string, FloorPlan>;
  private transitions: VerticalTransition[];
  private graph: Graph;
  private pathFinder: PathFinder;
  private config: RouterConfig;
  private cache: Cache<string, NavigationPoint[]>;
  private metrics: MetricsClient;
  private tracer: TracingClient;
  private logger: Logger;
  private verticalTransitions: Map<string, {
    type: 'elevator' | 'escalator' | 'stairs';
    floors: number[];
    position: Position;
  }>;

  // Metrics
  private readonly routeComputeHistogram = metrics.createHistogram({
    name: 'route_computation_seconds',
    help: 'Time taken to compute routes in seconds',
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2]
  });

  private readonly routeLengthHistogram = metrics.createHistogram({
    name: 'route_length_meters',
    help: 'Length of computed routes in meters',
    buckets: [10, 50, 100, 500, 1000]
  });

  constructor(
    config: RouterConfig,
    metrics: MetricsClient,
    tracer: TracingClient,
    logger: Logger
  ) {
    this.config = config;
    this.metrics = metrics;
    this.tracer = tracer;
    this.logger = logger;

    this.floorPlans = new Map();
    this.transitions = [];
    this.graph = new Graph();
    this.cache = new Cache(config.cacheConfig);
    this.verticalTransitions = new Map();

    // Setup monitoring
    this.setupMetrics();
  }

  /**
   * Finds optimal path between two points across multiple floors
   */
  public async findPath(
    start: NavigationPoint,
    end: NavigationPoint,
    preferences?: { 
      avoidCrowded?: boolean;
      accessibilityMode?: boolean;
    }
  ): Promise<NavigationPoint[]> {
    const span = this.tracer.startSpan('MultiFloorRouter.findPath');
    const routeStart = performance.now();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(start, end, preferences);
      const cachedPath = this.cache.get(cacheKey);
      if (cachedPath) {
        this.metrics.increment('route.cache_hits');
        return cachedPath;
      }

      // Find start and end floors
      const startFloor = this.findFloor(start);
      const endFloor = this.findFloor(end);

      if (!startFloor || !endFloor) {
        throw new Error('Invalid start or end point');
      }

      // Update graph weights based on current conditions
      await this.updateGraphWeights(preferences);

      // Find path using A* algorithm
      const path = this.pathFinder.find(
        this.getNodeId(start),
        this.getNodeId(end)
      );

      if (!path || path.length === 0) {
        throw new Error('No valid path found');
      }

      // Convert path to navigation points
      const navigationPoints = await this.convertToNavigationPoints(path);

      // Validate path
      this.validatePath(navigationPoints);

      // Cache result
      this.cache.set(cacheKey, navigationPoints);

      // Record metrics
      const routeDuration = performance.now() - routeStart;
      this.recordRouteMetrics(navigationPoints, routeDuration);

      return navigationPoints;

    } catch (error) {
      this.logger.error('Error finding path', error);
      this.metrics.increment('route.errors');
      throw error;

    } finally {
      span.end();
    }
  }

  /**
   * Updates floor plan data and rebuilds navigation graph
   */
  public async updateFloorPlans(floorPlans: FloorPlan[]): Promise<void> {
    const span = this.tracer.startSpan('MultiFloorRouter.updateFloorPlans');

    try {
      // Clear existing data
      this.floorPlans.clear();
      this.graph.clear();

      // Store new floor plans
      floorPlans.forEach(plan => {
        this.floorPlans.set(plan.id, plan);
      });

      // Rebuild graph
      await this.buildNavigationGraph();

      // Clear cache
      this.cache.clear();

      this.metrics.gauge('floorplans.count', floorPlans.length);
      this.metrics.gauge('graph.nodes', this.graph.getNodesCount());
      this.metrics.gauge('graph.edges', this.graph.getLinksCount());

    } catch (error) {
      this.logger.error('Error updating floor plans', error);
      this.metrics.increment('floorplans.update_errors');
      throw error;

    } finally {
      span.end();
    }
  }

  private setupMetrics(): void {
    // Define metrics
    this.metrics.defineGauge('floorplans.count', 'Number of floor plans loaded');
    this.metrics.defineGauge('graph.nodes', 'Number of nodes in navigation graph');
    this.metrics.defineGauge('graph.edges', 'Number of edges in navigation graph');
    this.metrics.defineHistogram('route.duration_ms', 'Path finding duration');
    this.metrics.defineHistogram('route.length', 'Path length in meters');
    this.metrics.defineHistogram('route.transitions', 'Number of floor transitions');
    this.metrics.defineCounter('route.cache_hits', 'Number of route cache hits');
    this.metrics.defineCounter('route.errors', 'Number of routing errors');
  }

  private async buildNavigationGraph(): Promise<void> {
    // Add nodes for each walkable point
    this.floorPlans.forEach(plan => {
      plan.walkablePoints.forEach(point => {
        this.graph.addNode(this.getNodeId(point), point);
      });
    });

    // Add edges between connected points
    this.floorPlans.forEach(plan => {
      plan.connections.forEach(conn => {
        this.graph.addLink(
          this.getNodeId(conn.start),
          this.getNodeId(conn.end),
          { weight: conn.distance }
        );
      });
    });

    // Add vertical transitions
    this.transitions.forEach(trans => {
      this.graph.addLink(
        this.getNodeId(trans.start),
        this.getNodeId(trans.end),
        { 
          weight: trans.distance,
          type: 'transition',
          mode: trans.mode // elevator, stairs, escalator
        }
      );
    });
  }

  private async updateGraphWeights(preferences?: { 
    avoidCrowded?: boolean;
    accessibilityMode?: boolean;
  }): Promise<void> {
    this.graph.forEachLink(link => {
      let weight = link.data.weight * this.config.weightFactors.distance;

      // Add transition penalty
      if (link.data.type === 'transition') {
        weight *= this.config.weightFactors.transition;

        // Increase weight for non-accessible transitions in accessibility mode
        if (preferences?.accessibilityMode && link.data.mode === 'stairs') {
          weight *= 10;
        }
      }

      // Add crowding factor
      if (preferences?.avoidCrowded) {
        const crowding = this.getCrowdingFactor(link);
        weight *= (1 + crowding * this.config.weightFactors.crowding);
      }

      link.data.currentWeight = weight;
    });
  }

  private getCrowdingFactor(link: any): number {
    // Get real-time crowding data
    // Implementation depends on crowding data source
    return 0;
  }

  private findFloor(point: NavigationPoint): FloorPlan | undefined {
    return Array.from(this.floorPlans.values()).find(plan => 
      plan.bounds.contains(point.position)
    );
  }

  private getNodeId(point: NavigationPoint): string {
    return `${point.floorId}:${point.position.x},${point.position.y},${point.position.z}`;
  }

  private async convertToNavigationPoints(path: any[]): Promise<NavigationPoint[]> {
    return path.map(node => ({
      position: new Vector3(node.data.x, node.data.y, node.data.z),
      floorId: node.data.floorId,
      label: node.data.label,
      type: node.data.type
    }));
  }

  private validatePath(path: NavigationPoint[]): void {
    // Check path length
    const totalDistance = this.calculatePathDistance(path);
    if (totalDistance > this.config.maxPathLength) {
      throw new Error('Path exceeds maximum length');
    }

    // Check number of transitions
    const transitions = this.countTransitions(path);
    if (transitions > this.config.maxTransitions) {
      throw new Error('Path exceeds maximum transitions');
    }
  }

  private calculatePathDistance(path: NavigationPoint[]): number {
    let distance = 0;
    for (let i = 1; i < path.length; i++) {
      distance += path[i].position.distanceTo(path[i-1].position);
    }
    return distance;
  }

  private countTransitions(path: NavigationPoint[]): number {
    let transitions = 0;
    for (let i = 1; i < path.length; i++) {
      if (path[i].floorId !== path[i-1].floorId) {
        transitions++;
      }
    }
    return transitions;
  }

  private generateCacheKey(
    start: NavigationPoint,
    end: NavigationPoint,
    preferences?: object
  ): string {
    return JSON.stringify({
      start: this.getNodeId(start),
      end: this.getNodeId(end),
      preferences
    });
  }

  private recordRouteMetrics(path: NavigationPoint[], duration: number): void {
    this.metrics.histogram('route.duration_ms', duration);
    this.metrics.histogram('route.length', this.calculatePathDistance(path));
    this.metrics.histogram('route.transitions', this.countTransitions(path));
  }

  /**
   * Adds or updates a floor plan in the router
   */
  public addFloorPlan(floorPlan: FloorPlan): void {
    try {
      this.floorPlans.set(floorPlan.id, floorPlan);
      this.updateGraphForFloor(floorPlan);
      this.logger.info(`Added floor plan for level ${floorPlan.level}`, {
        landmarks: floorPlan.landmarks.length,
        beacons: floorPlan.beacons.length
      });
    } catch (error) {
      this.logger.error('Failed to add floor plan:', error);
      throw error;
    }
  }

  /**
   * Adds a vertical transition point (elevator, escalator, stairs)
   */
  public addVerticalTransition(id: string, type: 'elevator' | 'escalator' | 'stairs', 
    floors: number[], position: Position): void {
    this.verticalTransitions.set(id, { type, floors, position });
    this.updateVerticalConnections(id);
  }

  /**
   * Computes a route between two points considering accessibility options
   */
  public findRoute(start: Position, end: Position, options?: NavigationOptions): Route {
    const startTime = performance.now();

    try {
      // Find start and end floors
      const startFloor = this.findFloorForPosition(start);
      const endFloor = this.findFloorForPosition(end);

      if (startFloor === undefined || endFloor === undefined) {
        throw new Error('Start or end position not found in any floor plan');
      }

      // Generate node IDs
      const startId = this.getNodeId(start, startFloor);
      const endId = this.getNodeId(end, endFloor);

      // Find path using A*
      const path = this.pathFinder.find(startId, endId);
      
      if (!path || path.length === 0) {
        throw new Error('No route found between start and end points');
      }

      // Convert path to route segments
      const segments = this.convertPathToSegments(path, options);
      const totalDistance = segments.reduce((sum, seg) => sum + seg.distance, 0);

      // Calculate metrics
      const computeTime = (performance.now() - startTime) / 1000;
      this.routeComputeHistogram.observe(computeTime);
      this.routeLengthHistogram.observe(totalDistance);

      this.logger.info('Route computed', {
        startFloor,
        endFloor,
        segments: segments.length,
        distance: totalDistance,
        computeTime
      });

      return {
        segments,
        totalDistance,
        estimatedTime: this.estimateTravelTime(segments, options)
      };

    } catch (error) {
      this.logger.error('Failed to find route:', error);
      throw error;
    }
  }

  /**
   * Updates the navigation graph for a floor
   */
  private updateGraphForFloor(floorPlan: FloorPlan): void {
    // Add nodes for all landmarks
    floorPlan.landmarks.forEach(landmark => {
      const nodeId = this.getNodeId(landmark.position, floorPlan.level);
      this.graph.addNode(nodeId, {
        position: landmark.position,
        floor: floorPlan.level,
        type: landmark.type
      });
    });

    // Connect nearby landmarks
    floorPlan.landmarks.forEach((landmark1, i) => {
      floorPlan.landmarks.slice(i + 1).forEach(landmark2 => {
        const distance = this.calculateDistance(landmark1.position, landmark2.position);
        if (distance <= 10) { // Connect landmarks within 10 meters
          const node1 = this.getNodeId(landmark1.position, floorPlan.level);
          const node2 = this.getNodeId(landmark2.position, floorPlan.level);
          
          this.graph.addLink(node1, node2, { distance, type: 'hallway' });
          this.graph.addLink(node2, node1, { distance, type: 'hallway' });
        }
      });
    });
  }

  /**
   * Updates vertical connections in the graph
   */
  private updateVerticalConnections(transitionId: string): void {
    const transition = this.verticalTransitions.get(transitionId);
    if (!transition) return;

    // Connect adjacent floors
    transition.floors.forEach((floor, i) => {
      if (i === 0) return;
      
      const prevFloor = transition.floors[i - 1];
      const nodeId1 = this.getNodeId(transition.position, prevFloor);
      const nodeId2 = this.getNodeId(transition.position, floor);
      
      // Add vertical connection
      const distance = Math.abs(floor - prevFloor) * 3; // Assume 3m per floor
      this.graph.addLink(nodeId1, nodeId2, {
        distance,
        type: transition.type
      });
      
      // Add reverse connection if not escalator
      if (transition.type !== 'escalator') {
        this.graph.addLink(nodeId2, nodeId1, {
          distance,
          type: transition.type
        });
      }
    });
  }

  /**
   * Converts graph path to route segments
   */
  private convertPathToSegments(path: any[], options?: NavigationOptions): RouteSegment[] {
    const segments: RouteSegment[] = [];
    
    for (let i = 0; i < path.length - 1; i++) {
      const node1 = this.graph.getNode(path[i].id);
      const node2 = this.graph.getNode(path[i + 1].id);
      const link = this.graph.getLink(path[i].id, path[i + 1].id);

      segments.push({
        start: node1.data.position,
        end: node2.data.position,
        type: link.data.type,
        distance: link.data.distance,
        floor: node1.data.floor,
        instructions: this.generateInstructions(node1, node2, link.data.type)
      });
    }

    return segments;
  }

  /**
   * Generates human-readable instructions for a route segment
   */
  private generateInstructions(node1: any, node2: any, type: string): string {
    const distance = Math.round(this.calculateDistance(node1.data.position, node2.data.position));
    
    if (node1.data.floor !== node2.data.floor) {
      switch (type) {
        case 'elevator':
          return `Take elevator to floor ${node2.data.floor}`;
        case 'escalator':
          return `Take escalator to floor ${node2.data.floor}`;
        case 'stairs':
          return `Take stairs to floor ${node2.data.floor}`;
        default:
          return `Go to floor ${node2.data.floor}`;
      }
    }

    const direction = this.calculateDirection(node1.data.position, node2.data.position);
    return `Go ${direction} for ${distance} meters`;
  }

  /**
   * Calculates Euclidean distance between two positions
   */
  private calculateDistance(pos1: Position, pos2: Position): number {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Calculates cardinal direction between two positions
   */
  private calculateDirection(start: Position, end: Position): string {
    const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
    
    if (angle > -22.5 && angle <= 22.5) return 'east';
    if (angle > 22.5 && angle <= 67.5) return 'northeast';
    if (angle > 67.5 && angle <= 112.5) return 'north';
    if (angle > 112.5 && angle <= 157.5) return 'northwest';
    if (angle > 157.5 || angle <= -157.5) return 'west';
    if (angle > -157.5 && angle <= -112.5) return 'southwest';
    if (angle > -112.5 && angle <= -67.5) return 'south';
    return 'southeast';
  }

  /**
   * Finds which floor a position belongs to
   */
  private findFloorForPosition(position: Position): number | undefined {
    for (const [level, plan] of this.floorPlans) {
      if (position.z >= plan.origin.z - 1.5 && position.z < plan.origin.z + 1.5) {
        return level;
      }
    }
    return undefined;
  }

  /**
   * Estimates travel time for a route based on segments and accessibility options
   */
  private estimateTravelTime(segments: RouteSegment[], options?: NavigationOptions): number {
    const walkingSpeed = 1.4; // meters per second
    const verticalSpeed = 0.5; // meters per second

    return segments.reduce((time, segment) => {
      switch (segment.type) {
        case 'elevator':
          return time + segment.distance / verticalSpeed + 10; // Add 10s for waiting
        case 'escalator':
          return time + segment.distance / verticalSpeed;
        case 'stairs':
          // Slower on stairs, especially if accessibility needed
          const stairSpeed = options?.accessibility ? 0.3 : 0.7;
          return time + segment.distance / stairSpeed;
        default:
          return time + segment.distance / walkingSpeed;
      }
    }, 0);
  }
} 
