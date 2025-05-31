/**
 * MultiFloorRouter.ts
 * Handles multi-floor routing with vertical transition points
 */

import { Vector3 } from 'three';
import { MetricsClient } from '../../monitoring/MetricsClient';
import { TracingClient } from '../../monitoring/TracingClient';
import { Logger } from '../../utils/Logger';
import { NavigationPoint } from '../../models/NavigationPoint';
import { UserPreferences } from '../../models/UserPreferences';
import { Graph } from 'ngraph.graph';
import { pathFinder } from 'ngraph.path';

interface RouterConfig {
  maxPathLength: number;
  maxFloorTransitions: number;
  transitionPenalty: number;
  crowdingPenalty: number;
  accessibilityPenalty: number;
}

interface VerticalTransition {
  id: string;
  type: 'elevator' | 'escalator' | 'stairs';
  startFloor: string;
  endFloor: string;
  position: Vector3;
  status: 'operational' | 'maintenance' | 'closed';
  crowdLevel?: number;
  accessibilityFeatures?: {
    wheelchairAccessible: boolean;
    handrails: boolean;
    brailleSignage: boolean;
    audioGuides: boolean;
  };
}

export class MultiFloorRouter {
  private graph: Graph;
  private config: RouterConfig;
  private transitions: Map<string, VerticalTransition>;
  private metrics: MetricsClient;
  private tracer: TracingClient;
  private logger: Logger;

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
    this.graph = Graph();
    this.transitions = new Map();

    this.setupMetrics();
  }

  /**
   * Compute route between two points across floors
   */
  public async computeRoute(
    start: NavigationPoint,
    end: NavigationPoint,
    preferences: UserPreferences
  ): Promise<NavigationPoint[]> {
    const span = this.tracer.startSpan('MultiFloorRouter.computeRoute');

    try {
      // Find best vertical transitions
      const transitions = this.findBestTransitions(
        start.floorId,
        end.floorId,
        preferences
      );

      // Build path segments
      const segments = await this.buildPathSegments(
        start,
        end,
        transitions,
        preferences
      );

      // Combine segments into final path
      const path = this.combinePath(segments);

      // Validate path
      this.validatePath(path);

      // Record metrics
      this.recordRouteMetrics(path, transitions);

      return path;

    } catch (error) {
      this.logger.error('Error computing route', error);
      this.metrics.increment('routing.errors');
      throw error;

    } finally {
      span.end();
    }
  }

  /**
   * Add or update a vertical transition point
   */
  public addTransition(transition: VerticalTransition): void {
    const span = this.tracer.startSpan('MultiFloorRouter.addTransition');

    try {
      this.transitions.set(transition.id, transition);
      
      // Add to routing graph
      this.graph.addNode(transition.id, transition);
      
      // Add edges to nearby nodes on both floors
      this.connectTransitionToFloors(transition);

      this.metrics.increment('routing.transitions_added');

    } catch (error) {
      this.logger.error('Error adding transition', error);
      this.metrics.increment('routing.errors');
      throw error;

    } finally {
      span.end();
    }
  }

  /**
   * Update transition status
   */
  public updateTransitionStatus(
    id: string,
    status: 'operational' | 'maintenance' | 'closed',
    crowdLevel?: number
  ): void {
    const span = this.tracer.startSpan('MultiFloorRouter.updateTransitionStatus');

    try {
      const transition = this.transitions.get(id);
      if (!transition) {
        throw new Error(`Transition not found: ${id}`);
      }

      transition.status = status;
      if (crowdLevel !== undefined) {
        transition.crowdLevel = crowdLevel;
      }

      // Update graph weights
      this.updateTransitionWeights(transition);

      this.metrics.increment('routing.transitions_updated');

    } catch (error) {
      this.logger.error('Error updating transition', error);
      this.metrics.increment('routing.errors');
      throw error;

    } finally {
      span.end();
    }
  }

  private findBestTransitions(
    startFloor: string,
    endFloor: string,
    preferences: UserPreferences
  ): VerticalTransition[] {
    // If same floor, no transitions needed
    if (startFloor === endFloor) {
      return [];
    }

    // Get all possible transitions between floors
    const possibleTransitions = Array.from(this.transitions.values())
      .filter(t => 
        (t.startFloor === startFloor && t.endFloor === endFloor) ||
        (t.startFloor === endFloor && t.endFloor === startFloor)
      );

    // Filter by status and accessibility
    const validTransitions = possibleTransitions.filter(t => {
      if (t.status !== 'operational') return false;
      
      if (preferences.navigation.wheelchairAccessible &&
          !t.accessibilityFeatures?.wheelchairAccessible) {
        return false;
      }

      return true;
    });

    // Score transitions
    const scoredTransitions = validTransitions.map(t => ({
      transition: t,
      score: this.scoreTransition(t, preferences)
    }));

    // Sort by score and return best options
    return scoredTransitions
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxFloorTransitions)
      .map(st => st.transition);
  }

  private scoreTransition(
    transition: VerticalTransition,
    preferences: UserPreferences
  ): number {
    let score = 1.0;

    // Apply crowding penalty
    if (transition.crowdLevel) {
      score -= (transition.crowdLevel / 100) * this.config.crowdingPenalty;
    }

    // Apply type preferences
    if (preferences.navigation.preferElevators && transition.type === 'elevator') {
      score += 0.3;
    }
    if (preferences.navigation.preferEscalators && transition.type === 'escalator') {
      score += 0.2;
    }
    if (preferences.navigation.avoidStairs && transition.type === 'stairs') {
      score -= 0.4;
    }

    // Apply accessibility score
    if (transition.accessibilityFeatures) {
      const features = transition.accessibilityFeatures;
      if (features.wheelchairAccessible) score += 0.2;
      if (features.handrails) score += 0.1;
      if (features.brailleSignage) score += 0.1;
      if (features.audioGuides) score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  private async buildPathSegments(
    start: NavigationPoint,
    end: NavigationPoint,
    transitions: VerticalTransition[],
    preferences: UserPreferences
  ): Promise<NavigationPoint[][]> {
    const segments: NavigationPoint[][] = [];
    
    if (transitions.length === 0) {
      // Same floor routing
      const path = await this.findPathOnFloor(start, end, preferences);
      segments.push(path);
      return segments;
    }

    // Multi-floor routing
    let currentPoint = start;
    for (const transition of transitions) {
      // Route to transition entrance
      const toTransition = await this.findPathOnFloor(
        currentPoint,
        {
          position: transition.position,
          floorId: transition.startFloor,
          type: 'transition'
        },
        preferences
      );
      segments.push(toTransition);

      // Add transition point
      segments.push([{
        position: transition.position,
        floorId: transition.startFloor,
        type: 'transition',
        metadata: {
          transitionId: transition.id,
          transitionType: transition.type
        }
      }]);

      // Update current point to transition exit
      currentPoint = {
        position: transition.position,
        floorId: transition.endFloor,
        type: 'transition'
      };
    }

    // Route from last transition to destination
    const finalSegment = await this.findPathOnFloor(currentPoint, end, preferences);
    segments.push(finalSegment);

    return segments;
  }

  private combinePath(segments: NavigationPoint[][]): NavigationPoint[] {
    const path: NavigationPoint[] = [];
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      // Add all points except last from each segment
      // (to avoid duplicates at transition points)
      if (i < segments.length - 1) {
        path.push(...segment.slice(0, -1));
      } else {
        // Add all points from final segment
        path.push(...segment);
      }
    }

    return path;
  }

  private validatePath(path: NavigationPoint[]): void {
    if (path.length === 0) {
      throw new Error('Empty path');
    }

    if (path.length > this.config.maxPathLength) {
      throw new Error('Path exceeds maximum length');
    }

    // Count floor transitions
    let transitions = 0;
    for (let i = 1; i < path.length; i++) {
      if (path[i].floorId !== path[i-1].floorId) {
        transitions++;
      }
    }

    if (transitions > this.config.maxFloorTransitions) {
      throw new Error('Too many floor transitions');
    }
  }

  private connectTransitionToFloors(transition: VerticalTransition): void {
    const span = this.tracer.startSpan('MultiFloorRouter.connectTransitionToFloors');

    try {
      // Get nearby nodes on both floors
      const startFloorNodes = this.findNearbyNodes(
        transition.position,
        transition.startFloor,
        50 // Search radius in meters
      );

      const endFloorNodes = this.findNearbyNodes(
        transition.position,
        transition.endFloor,
        50
      );

      // Add edges to/from transition
      for (const node of startFloorNodes) {
        this.graph.addLink(
          node.id,
          transition.id,
          { weight: this.getDistance(node.data, transition) }
        );
      }

      for (const node of endFloorNodes) {
        this.graph.addLink(
          transition.id,
          node.id,
          { weight: this.getDistance(transition, node.data) }
        );
      }

    } catch (error) {
      this.logger.error('Error connecting transition to floors', error);
      this.metrics.increment('routing.connection_errors');
      throw error;

    } finally {
      span.end();
    }
  }

  private updateTransitionWeights(transition: VerticalTransition): void {
    const span = this.tracer.startSpan('MultiFloorRouter.updateTransitionWeights');

    try {
      // Get all edges connected to transition
      const links = this.graph.getLinks(transition.id);
      if (!links) return;

      for (const link of links) {
        // Base weight is distance
        let weight = this.getDistance(
          this.graph.getNode(link.fromId)?.data,
          this.graph.getNode(link.toId)?.data
        );

        // Apply status penalties
        if (transition.status === 'maintenance') {
          weight *= 2;
        } else if (transition.status === 'closed') {
          weight = Infinity;
        }

        // Apply crowding penalty
        if (transition.crowdLevel) {
          weight *= (1 + (transition.crowdLevel / 100) * this.config.crowdingPenalty);
        }

        // Update edge weight
        link.data = { weight };
      }

    } catch (error) {
      this.logger.error('Error updating transition weights', error);
      this.metrics.increment('routing.weight_update_errors');
      throw error;

    } finally {
      span.end();
    }
  }

  private getDistance(a: NavigationPoint, b: NavigationPoint): number {
    if (!a || !b) return Infinity;
    return a.position.distanceTo(b.position);
  }

  private applyPreferences(
    distance: number,
    from: NavigationPoint,
    to: NavigationPoint,
    preferences: UserPreferences
  ): number {
    let weight = distance;

    // Apply crowding penalty
    if (preferences.navigation.avoidCrowded && 
        (from.metadata?.crowdLevel || to.metadata?.crowdLevel)) {
      const crowdLevel = Math.max(
        from.metadata?.crowdLevel || 0,
        to.metadata?.crowdLevel || 0
      );
      weight *= (1 + (crowdLevel / 100) * this.config.crowdingPenalty);
    }

    // Apply accessibility penalty
    if (preferences.navigation.wheelchairAccessible &&
        (!from.metadata?.accessibility?.wheelchair || 
         !to.metadata?.accessibility?.wheelchair)) {
      weight *= (1 + this.config.accessibilityPenalty);
    }

    return weight;
  }

  private getNodeId(point: NavigationPoint): string {
    return `${point.floorId}:${point.position.x},${point.position.y},${point.position.z}`;
  }

  private findNearbyNodes(
    position: Vector3,
    floorId: string,
    radius: number
  ): Array<{ id: string; data: NavigationPoint }> {
    const nodes: Array<{ id: string; data: NavigationPoint }> = [];
    
    this.graph.forEachNode(node => {
      if (node.data.floorId === floorId &&
          node.data.position.distanceTo(position) <= radius) {
        nodes.push(node);
      }
    });

    return nodes;
  }

  private async findPathOnFloor(
    start: NavigationPoint,
    end: NavigationPoint,
    preferences: UserPreferences
  ): Promise<NavigationPoint[]> {
    const span = this.tracer.startSpan('MultiFloorRouter.findPathOnFloor');

    try {
      // Create path finder
      const finder = pathFinder(this.graph, {
        oriented: true,
        distance: (fromNode, toNode, link) => {
          const distance = this.getDistance(fromNode.data, toNode.data);
          return this.applyPreferences(distance, fromNode.data, toNode.data, preferences);
        }
      });

      // Find path
      const path = finder.find(
        this.getNodeId(start),
        this.getNodeId(end)
      );

      if (!path) {
        throw new Error('No path found');
      }

      // Convert to navigation points
      return path.map(node => ({
        position: node.data.position,
        floorId: node.data.floorId,
        type: node.data.type
      }));

    } catch (error) {
      this.logger.error('Error finding path on floor', error);
      this.metrics.increment('routing.path_errors');
      throw error;

    } finally {
      span.end();
    }
  }

  private recordRouteMetrics(
    path: NavigationPoint[],
    transitions: VerticalTransition[]
  ): void {
    this.metrics.histogram('routing.path_length', path.length);
    this.metrics.histogram('routing.transitions_used', transitions.length);
    
    // Record transition types used
    const typeCounts = new Map<string, number>();
    transitions.forEach(t => {
      typeCounts.set(t.type, (typeCounts.get(t.type) || 0) + 1);
    });
    
    typeCounts.forEach((count, type) => {
      this.metrics.histogram(`routing.transition_type_${type}`, count);
    });
  }

  private setupMetrics(): void {
    this.metrics.defineCounter('routing.transitions_added', 'Number of transitions added');
    this.metrics.defineCounter('routing.transitions_updated', 'Number of transitions updated');
    this.metrics.defineCounter('routing.errors', 'Number of routing errors');
    this.metrics.defineHistogram('routing.path_length', 'Path length in waypoints');
    this.metrics.defineHistogram('routing.transitions_used', 'Number of transitions used in route');
    this.metrics.defineHistogram('routing.transition_type_elevator', 'Number of elevators used');
    this.metrics.defineHistogram('routing.transition_type_escalator', 'Number of escalators used');
    this.metrics.defineHistogram('routing.transition_type_stairs', 'Number of stairs used');
  }
} 