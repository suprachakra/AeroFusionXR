import { FlightInfo } from '../models/FlightInfo';
import { BaggageTag } from '../models/BaggageTag';

export interface RouteNode {
  airport: string;
  terminal: string;
  gate?: string;
  estimatedTime: Date;
  actualTime?: Date;
  duration: number; // minutes
  type: 'departure' | 'arrival' | 'connection' | 'sorting';
  status: 'scheduled' | 'in_progress' | 'completed' | 'delayed' | 'cancelled';
}

export interface RouteSegment {
  from: RouteNode;
  to: RouteNode;
  transport: 'flight' | 'conveyor' | 'cart' | 'manual';
  distance: number; // meters for ground transport
  duration: number; // minutes
  capacity: number;
  currentLoad: number;
  priority: number; // 1-10, higher is more urgent
}

export interface OptimizedRoute {
  id: string;
  baggageId: string;
  nodes: RouteNode[];
  segments: RouteSegment[];
  totalDuration: number;
  totalDistance: number;
  confidence: number; // 0-1
  alternativeRoutes: OptimizedRoute[];
  riskFactors: string[];
  estimatedArrival: Date;
}

export interface ConnectionDeadline {
  flightNumber: string;
  departureTime: Date;
  minimumConnectionTime: number; // minutes
  gate: string;
  terminal: string;
  deadline: Date; // latest arrival time for connection
  buffer: number; // safety margin in minutes
}

export class RouteOptimizer {
  private static readonly MIN_CONNECTION_TIME = 45; // minutes
  private static readonly BUFFER_TIME = 15; // minutes safety margin
  private static readonly MAX_ROUTE_ALTERNATIVES = 3;
  private static readonly CONVEYOR_SPEED = 2.0; // m/s
  private static readonly CART_SPEED = 5.0; // m/s
  private static readonly SORTING_TIME = 10; // minutes average

  /**
   * Calculate planned route for baggage based on flight information
   */
  public static async calculatePlannedRoute(flightInfo: FlightInfo): Promise<RouteNode[]> {
    const route: RouteNode[] = [];

    try {
      // Departure airport processing
      route.push({
        airport: flightInfo.departureAirport,
        terminal: flightInfo.departureTerminal,
        gate: flightInfo.departureGate,
        estimatedTime: new Date(flightInfo.scheduledDeparture.getTime() - 120 * 60 * 1000), // 2 hours before
        duration: 30,
        type: 'departure',
        status: 'scheduled'
      });

      // Add intermediate stops for connecting flights
      if (flightInfo.connections && flightInfo.connections.length > 0) {
        for (const connection of flightInfo.connections) {
          // Arrival at connection airport
          route.push({
            airport: connection.airport,
            terminal: connection.arrivalTerminal,
            estimatedTime: connection.arrivalTime,
            duration: this.SORTING_TIME,
            type: 'connection',
            status: 'scheduled'
          });

          // Departure from connection airport  
          route.push({
            airport: connection.airport,
            terminal: connection.departureTerminal,
            gate: connection.departureGate,
            estimatedTime: new Date(connection.departureTime.getTime() - 60 * 60 * 1000), // 1 hour before
            duration: 20,
            type: 'departure',
            status: 'scheduled'
          });
        }
      }

      // Final destination
      route.push({
        airport: flightInfo.arrivalAirport,
        terminal: flightInfo.arrivalTerminal,
        estimatedTime: flightInfo.scheduledArrival,
        duration: 45, // baggage claim processing
        type: 'arrival',
        status: 'scheduled'
      });

      return route;

    } catch (error) {
      console.error('Error calculating planned route:', error);
      return [];
    }
  }

  /**
   * Optimize route based on current conditions and constraints
   */
  public static async optimizeRoute(
    baggageTag: BaggageTag,
    currentLocation: RouteNode,
    destination: RouteNode,
    constraints: {
      deadlines: ConnectionDeadline[];
      capacity: Map<string, number>;
      outages: string[];
      weather: any;
    }
  ): Promise<OptimizedRoute> {
    
    const routeId = `route_${baggageTag.id}_${Date.now()}`;
    
    // Calculate primary route
    const primaryRoute = await this.calculateOptimalPath(
      baggageTag,
      currentLocation,
      destination,
      constraints
    );

    // Calculate alternative routes
    const alternatives = await this.calculateAlternativeRoutes(
      baggageTag,
      currentLocation,
      destination,
      constraints,
      primaryRoute
    );

    // Risk assessment
    const riskFactors = this.assessRouteRisks(primaryRoute, constraints);

    // Calculate confidence based on historical data
    const confidence = this.calculateRouteConfidence(primaryRoute, riskFactors);

    return {
      id: routeId,
      baggageId: baggageTag.id,
      nodes: primaryRoute.nodes,
      segments: primaryRoute.segments,
      totalDuration: primaryRoute.totalDuration,
      totalDistance: primaryRoute.totalDistance,
      confidence,
      alternativeRoutes: alternatives,
      riskFactors,
      estimatedArrival: new Date(
        currentLocation.estimatedTime.getTime() + primaryRoute.totalDuration * 60 * 1000
      )
    };
  }

  /**
   * Calculate optimal path between two points
   */
  private static async calculateOptimalPath(
    baggageTag: BaggageTag,
    start: RouteNode,
    end: RouteNode,
    constraints: any
  ): Promise<{ nodes: RouteNode[]; segments: RouteSegment[]; totalDuration: number; totalDistance: number }> {
    
    const nodes: RouteNode[] = [start];
    const segments: RouteSegment[] = [];
    let totalDuration = 0;
    let totalDistance = 0;

    // Same airport - terminal transfer
    if (start.airport === end.airport) {
      if (start.terminal !== end.terminal) {
        // Inter-terminal transfer needed
        const transferNode: RouteNode = {
          airport: start.airport,
          terminal: end.terminal,
          estimatedTime: new Date(start.estimatedTime.getTime() + 20 * 60 * 1000),
          duration: 15,
          type: 'connection',
          status: 'scheduled'
        };

        const transferSegment: RouteSegment = {
          from: start,
          to: transferNode,
          transport: 'cart',
          distance: this.calculateTerminalDistance(start.terminal, end.terminal),
          duration: 20,
          capacity: 100,
          currentLoad: 50,
          priority: baggageTag.priority || 5
        };

        nodes.push(transferNode);
        segments.push(transferSegment);
        totalDuration += 20;
        totalDistance += transferSegment.distance;
      }
    } else {
      // Different airports - flight required
      const flightSegment: RouteSegment = {
        from: start,
        to: end,
        transport: 'flight',
        distance: this.calculateFlightDistance(start.airport, end.airport),
        duration: this.calculateFlightDuration(start.airport, end.airport),
        capacity: 1000,
        currentLoad: 200,
        priority: baggageTag.priority || 5
      };

      segments.push(flightSegment);
      totalDuration += flightSegment.duration;
      totalDistance += flightSegment.distance;
    }

    nodes.push(end);
    
    return { nodes, segments, totalDuration, totalDistance };
  }

  /**
   * Calculate alternative routes for redundancy
   */
  private static async calculateAlternativeRoutes(
    baggageTag: BaggageTag,
    start: RouteNode,
    end: RouteNode,
    constraints: any,
    primaryRoute: any
  ): Promise<OptimizedRoute[]> {
    
    const alternatives: OptimizedRoute[] = [];

    // Alternative 1: Different transport method
    if (start.airport === end.airport) {
      const altRoute = await this.calculateOptimalPath(baggageTag, start, end, {
        ...constraints,
        preferredTransport: 'conveyor' // vs cart
      });

      alternatives.push({
        id: `alt1_${baggageTag.id}`,
        baggageId: baggageTag.id,
        nodes: altRoute.nodes,
        segments: altRoute.segments,
        totalDuration: altRoute.totalDuration * 1.2, // Slightly slower
        totalDistance: altRoute.totalDistance,
        confidence: 0.8,
        alternativeRoutes: [],
        riskFactors: ['slower_transport'],
        estimatedArrival: new Date(start.estimatedTime.getTime() + altRoute.totalDuration * 1.2 * 60 * 1000)
      });
    }

    // Alternative 2: Different connection airport (if applicable)
    if (baggageTag.connections && baggageTag.connections.length > 1) {
      const altConnection = baggageTag.connections[1]; // Use second connection option
      const altRoute = await this.calculateOptimalPath(baggageTag, start, {
        airport: altConnection.airport,
        terminal: altConnection.terminal,
        estimatedTime: altConnection.arrivalTime,
        duration: this.SORTING_TIME,
        type: 'connection',
        status: 'scheduled'
      }, constraints);

      alternatives.push({
        id: `alt2_${baggageTag.id}`,
        baggageId: baggageTag.id,
        nodes: altRoute.nodes,
        segments: altRoute.segments,
        totalDuration: altRoute.totalDuration,
        totalDistance: altRoute.totalDistance,
        confidence: 0.7,
        alternativeRoutes: [],
        riskFactors: ['alternative_connection'],
        estimatedArrival: new Date(start.estimatedTime.getTime() + altRoute.totalDuration * 60 * 1000)
      });
    }

    return alternatives.slice(0, this.MAX_ROUTE_ALTERNATIVES);
  }

  /**
   * Get connection deadline for a flight
   */
  public static async getConnectionDeadline(baggageTag: BaggageTag): Promise<ConnectionDeadline | null> {
    if (!baggageTag.flightNumber || !baggageTag.connections || baggageTag.connections.length === 0) {
      return null;
    }

    const nextConnection = baggageTag.connections[0];
    const minimumConnectionTime = this.calculateMinimumConnectionTime(
      baggageTag.currentLocation?.terminal || '',
      nextConnection.departureTerminal
    );

    return {
      flightNumber: nextConnection.flightNumber,
      departureTime: nextConnection.departureTime,
      minimumConnectionTime,
      gate: nextConnection.departureGate,
      terminal: nextConnection.departureTerminal,
      deadline: new Date(nextConnection.departureTime.getTime() - minimumConnectionTime * 60 * 1000),
      buffer: this.BUFFER_TIME
    };
  }

  /**
   * Check if baggage will miss connection
   */
  public static async isMissedConnection(baggageTag: BaggageTag): Promise<boolean> {
    const deadline = await this.getConnectionDeadline(baggageTag);
    if (!deadline) {
      return false;
    }

    // Check if current time plus minimum transfer time exceeds deadline
    const now = new Date();
    const requiredArrivalTime = new Date(now.getTime() + deadline.minimumConnectionTime * 60 * 1000);
    
    return requiredArrivalTime > deadline.deadline;
  }

  /**
   * Assess risks for a given route
   */
  private static assessRouteRisks(route: any, constraints: any): string[] {
    const risks: string[] = [];

    // Check capacity constraints
    route.segments.forEach((segment: RouteSegment) => {
      if (segment.currentLoad / segment.capacity > 0.9) {
        risks.push(`high_capacity_${segment.transport}`);
      }
    });

    // Check time constraints
    if (route.totalDuration > 180) { // More than 3 hours
      risks.push('long_duration');
    }

    // Check for outages
    if (constraints.outages && constraints.outages.length > 0) {
      risks.push('system_outages');
    }

    // Weather risks
    if (constraints.weather && constraints.weather.severity > 3) {
      risks.push('weather_delay');
    }

    return risks;
  }

  /**
   * Calculate route confidence based on historical performance
   */
  private static calculateRouteConfidence(route: any, riskFactors: string[]): number {
    let baseConfidence = 0.9;

    // Reduce confidence for each risk factor
    baseConfidence -= riskFactors.length * 0.1;

    // Adjust for route complexity
    const complexity = route.segments.length;
    baseConfidence -= Math.max(0, (complexity - 2) * 0.05);

    // Adjust for total duration
    if (route.totalDuration > 120) {
      baseConfidence -= 0.1;
    }

    return Math.max(0.1, Math.min(1.0, baseConfidence));
  }

  // ================================
  // HELPER METHODS
  // ================================

  private static calculateTerminalDistance(terminal1: string, terminal2: string): number {
    // Simplified distance calculation between terminals
    const terminalDistances: { [key: string]: number } = {
      'A-B': 800,
      'A-C': 1200,
      'B-C': 600,
      'B-D': 1000,
      'C-D': 500
    };

    const key1 = `${terminal1}-${terminal2}`;
    const key2 = `${terminal2}-${terminal1}`;
    
    return terminalDistances[key1] || terminalDistances[key2] || 1000;
  }

  private static calculateFlightDistance(airport1: string, airport2: string): number {
    // Simplified flight distance calculation (in km)
    const airportCoordinates: { [key: string]: { lat: number; lon: number } } = {
      'LAX': { lat: 33.9425, lon: -118.4081 },
      'JFK': { lat: 40.6413, lon: -73.7781 },
      'ORD': { lat: 41.9742, lon: -87.9073 },
      'DFW': { lat: 32.8998, lon: -97.0403 },
      'DEN': { lat: 39.8617, lon: -104.6732 }
    };

    const coord1 = airportCoordinates[airport1];
    const coord2 = airportCoordinates[airport2];

    if (!coord1 || !coord2) {
      return 2000; // Default distance
    }

    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(coord2.lat - coord1.lat);
    const dLon = this.toRadians(coord2.lon - coord1.lon);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(coord1.lat)) * Math.cos(this.toRadians(coord2.lat)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
  }

  private static calculateFlightDuration(airport1: string, airport2: string): number {
    const distance = this.calculateFlightDistance(airport1, airport2);
    const averageSpeed = 800; // km/h
    return Math.round((distance / averageSpeed) * 60); // Convert to minutes
  }

  private static calculateMinimumConnectionTime(fromTerminal: string, toTerminal: string): number {
    if (fromTerminal === toTerminal) {
      return this.MIN_CONNECTION_TIME;
    }
    
    // Add extra time for inter-terminal transfers
    return this.MIN_CONNECTION_TIME + 30;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
} 