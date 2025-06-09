export interface Node {
  nodeID: string;
  x: number;
  y: number;
  z: number;
  floor: number;
  type: 'intersection' | 'elevator' | 'staircase' | 'POIEntrance' | 'entrance' | 'exit';
  isPOI: boolean;
  poiID?: string;
  name?: string;
  isAccessible: boolean;
}

export interface Edge {
  edgeID: string;
  fromNode: string;
  toNode: string;
  distanceMeters: number;
  edgeType: 'corridor' | 'staircase' | 'ramp' | 'elevator' | 'escalator';
  isAccessible: boolean;
  floorChange: boolean;
  maxSlopeDegrees?: number;
}

export interface RoutingGraph {
  terminal: string;
  lastUpdated: Date;
  nodes: Node[];
  edges: Edge[];
}

export interface IndoorMap {
  terminal: string;
  floor: number;
  vectorTiles: VectorTile[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  lastUpdated: Date;
}

export interface VectorTile {
  x: number;
  y: number;
  z: number;
  url: string;
  size: number;
}

export interface FloorPlan {
  terminal: string;
  floor: number;
  width: number;
  height: number;
  scale: number; // meters per pixel
  imageUrl: string;
  overlayElements: OverlayElement[];
}

export interface OverlayElement {
  id: string;
  type: 'poi' | 'entrance' | 'exit' | 'elevator' | 'staircase' | 'restroom';
  x: number;
  y: number;
  name: string;
  isAccessible: boolean;
}

export class MappingService {
  private routingGraphCache: Map<string, RoutingGraph> = new Map();
  private indoorMapCache: Map<string, IndoorMap> = new Map();
  private floorPlanCache: Map<string, FloorPlan> = new Map();

  constructor() {
    this.initializeMockData();
  }

  /**
   * Get routing graph for terminal
   */
  async getRoutingGraph(terminal: string): Promise<RoutingGraph | null> {
    let graph = this.routingGraphCache.get(terminal);
    
    if (!graph) {
      // In real implementation, fetch from database
      graph = await this.fetchRoutingGraphFromDB(terminal);
      if (graph) {
        this.routingGraphCache.set(terminal, graph);
      }
    }

    return graph;
  }

  /**
   * Get indoor map for terminal and floor
   */
  async getIndoorMap(terminal: string, floor?: number): Promise<IndoorMap | null> {
    const key = floor ? `${terminal}_${floor}` : terminal;
    let map = this.indoorMapCache.get(key);
    
    if (!map) {
      // In real implementation, fetch from database
      map = await this.fetchIndoorMapFromDB(terminal, floor);
      if (map) {
        this.indoorMapCache.set(key, map);
      }
    }

    return map;
  }

  /**
   * Get floor plan for terminal and floor
   */
  async getFloorPlan(terminal: string, floor: number): Promise<FloorPlan | null> {
    const key = `${terminal}_${floor}`;
    let floorPlan = this.floorPlanCache.get(key);
    
    if (!floorPlan) {
      // In real implementation, fetch from database
      floorPlan = await this.fetchFloorPlanFromDB(terminal, floor);
      if (floorPlan) {
        this.floorPlanCache.set(key, floorPlan);
      }
    }

    return floorPlan;
  }

  /**
   * Find node by ID
   */
  async findNode(terminal: string, nodeID: string): Promise<Node | null> {
    const graph = await this.getRoutingGraph(terminal);
    if (!graph) return null;

    return graph.nodes.find(node => node.nodeID === nodeID) || null;
  }

  /**
   * Find nodes by type
   */
  async findNodesByType(terminal: string, type: Node['type'], floor?: number): Promise<Node[]> {
    const graph = await this.getRoutingGraph(terminal);
    if (!graph) return [];

    return graph.nodes.filter(node => 
      node.type === type && 
      (floor === undefined || node.floor === floor)
    );
  }

  /**
   * Find POI nodes
   */
  async findPOINodes(terminal: string, floor?: number): Promise<Node[]> {
    const graph = await this.getRoutingGraph(terminal);
    if (!graph) return [];

    return graph.nodes.filter(node => 
      node.isPOI && 
      (floor === undefined || node.floor === floor)
    );
  }

  /**
   * Find edges connected to node
   */
  async findConnectedEdges(terminal: string, nodeID: string): Promise<Edge[]> {
    const graph = await this.getRoutingGraph(terminal);
    if (!graph) return [];

    return graph.edges.filter(edge => 
      edge.fromNode === nodeID || edge.toNode === nodeID
    );
  }

  /**
   * Find closest node to position
   */
  async findClosestNode(terminal: string, x: number, y: number, floor: number): Promise<Node | null> {
    const graph = await this.getRoutingGraph(terminal);
    if (!graph) return null;

    const floorNodes = graph.nodes.filter(node => node.floor === floor);
    if (floorNodes.length === 0) return null;

    let closestNode = floorNodes[0];
    let minDistance = this.calculateDistance(x, y, closestNode.x, closestNode.y);

    for (const node of floorNodes) {
      const distance = this.calculateDistance(x, y, node.x, node.y);
      if (distance < minDistance) {
        minDistance = distance;
        closestNode = node;
      }
    }

    return closestNode;
  }

  /**
   * Get available floors for terminal
   */
  async getAvailableFloors(terminal: string): Promise<number[]> {
    const graph = await this.getRoutingGraph(terminal);
    if (!graph) return [];

    const floors = new Set<number>();
    graph.nodes.forEach(node => floors.add(node.floor));
    
    return Array.from(floors).sort((a, b) => a - b);
  }

  /**
   * Check if edge is accessible for constraints
   */
  isEdgeAccessible(edge: Edge, accessType: 'default' | 'wheelchair' | 'stroller'): boolean {
    if (accessType === 'default') return true;

    if (accessType === 'wheelchair') {
      // Wheelchairs need accessible edges, no stairs, limited slope
      return edge.isAccessible && 
             edge.edgeType !== 'staircase' && 
             (edge.maxSlopeDegrees === undefined || edge.maxSlopeDegrees <= 5);
    }

    if (accessType === 'stroller') {
      // Strollers can handle some stairs but prefer elevators
      return edge.edgeType !== 'escalator' && 
             (edge.maxSlopeDegrees === undefined || edge.maxSlopeDegrees <= 8);
    }

    return true;
  }

  /**
   * Get vector tiles for map area
   */
  async getVectorTiles(terminal: string, floor: number, bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }): Promise<VectorTile[]> {
    const map = await this.getIndoorMap(terminal, floor);
    if (!map) return [];

    // Filter tiles within bounds
    return map.vectorTiles.filter(tile => 
      tile.x >= bounds.minX && tile.x <= bounds.maxX &&
      tile.y >= bounds.minY && tile.y <= bounds.maxY
    );
  }

  /**
   * Private helper methods
   */
  private calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  private async fetchRoutingGraphFromDB(terminal: string): Promise<RoutingGraph | null> {
    // Mock implementation - in real system would fetch from database
    console.debug(`[MAPPING] Fetching routing graph from DB for terminal: ${terminal}`);
    
    if (terminal === 'T1') {
      return this.createMockRoutingGraph(terminal);
    }
    
    return null;
  }

  private async fetchIndoorMapFromDB(terminal: string, floor?: number): Promise<IndoorMap | null> {
    // Mock implementation - in real system would fetch from database
    console.debug(`[MAPPING] Fetching indoor map from DB for terminal: ${terminal}, floor: ${floor}`);
    
    if (terminal === 'T1') {
      return this.createMockIndoorMap(terminal, floor || 1);
    }
    
    return null;
  }

  private async fetchFloorPlanFromDB(terminal: string, floor: number): Promise<FloorPlan | null> {
    // Mock implementation - in real system would fetch from database
    console.debug(`[MAPPING] Fetching floor plan from DB for terminal: ${terminal}, floor: ${floor}`);
    
    if (terminal === 'T1') {
      return this.createMockFloorPlan(terminal, floor);
    }
    
    return null;
  }

  private createMockRoutingGraph(terminal: string): RoutingGraph {
    const nodes: Node[] = [
      // Floor 1 nodes
      { nodeID: 'node_entrance_main', x: 0, y: 0, z: 0, floor: 1, type: 'entrance', isPOI: true, name: 'Main Entrance', isAccessible: true },
      { nodeID: 'node_security_checkpoint', x: 20, y: 0, z: 0, floor: 1, type: 'intersection', isPOI: true, name: 'Security Checkpoint', isAccessible: true },
      { nodeID: 'node_information_desk', x: 40, y: 10, z: 0, floor: 1, type: 'POIEntrance', isPOI: true, poiID: 'info_desk_001', name: 'Information Desk', isAccessible: true },
      { nodeID: 'node_elevator_bank_1', x: 30, y: 20, z: 0, floor: 1, type: 'elevator', isPOI: false, name: 'Elevator Bank 1', isAccessible: true },
      { nodeID: 'node_stairs_east', x: 50, y: 20, z: 0, floor: 1, type: 'staircase', isPOI: false, name: 'East Staircase', isAccessible: false },
      { nodeID: 'node_gate_a1', x: 60, y: 30, z: 0, floor: 1, type: 'POIEntrance', isPOI: true, poiID: 'gate_a1', name: 'Gate A1', isAccessible: true },
      { nodeID: 'node_gate_a3', x: 80, y: 30, z: 0, floor: 1, type: 'POIEntrance', isPOI: true, poiID: 'gate_a3', name: 'Gate A3', isAccessible: true },
      { nodeID: 'node_restroom_1', x: 25, y: 40, z: 0, floor: 1, type: 'POIEntrance', isPOI: true, poiID: 'restroom_001', name: 'Restrooms', isAccessible: true },
      
      // Floor 2 nodes
      { nodeID: 'node_elevator_bank_1_f2', x: 30, y: 20, z: 3, floor: 2, type: 'elevator', isPOI: false, name: 'Elevator Bank 1', isAccessible: true },
      { nodeID: 'node_stairs_east_f2', x: 50, y: 20, z: 3, floor: 2, type: 'staircase', isPOI: false, name: 'East Staircase', isAccessible: false },
      { nodeID: 'node_gate_b1', x: 60, y: 30, z: 3, floor: 2, type: 'POIEntrance', isPOI: true, poiID: 'gate_b1', name: 'Gate B1', isAccessible: true },
      { nodeID: 'node_gate_b3', x: 80, y: 30, z: 3, floor: 2, type: 'POIEntrance', isPOI: true, poiID: 'gate_b3', name: 'Gate B3', isAccessible: true },
      { nodeID: 'node_food_court', x: 40, y: 40, z: 3, floor: 2, type: 'POIEntrance', isPOI: true, poiID: 'food_court_001', name: 'Food Court', isAccessible: true },
      { nodeID: 'node_restroom_2', x: 25, y: 40, z: 3, floor: 2, type: 'POIEntrance', isPOI: true, poiID: 'restroom_002', name: 'Restrooms', isAccessible: true }
    ];

    const edges: Edge[] = [
      // Floor 1 edges
      { edgeID: 'edge_001', fromNode: 'node_entrance_main', toNode: 'node_security_checkpoint', distanceMeters: 20, edgeType: 'corridor', isAccessible: true, floorChange: false },
      { edgeID: 'edge_002', fromNode: 'node_security_checkpoint', toNode: 'node_information_desk', distanceMeters: 22, edgeType: 'corridor', isAccessible: true, floorChange: false },
      { edgeID: 'edge_003', fromNode: 'node_security_checkpoint', toNode: 'node_elevator_bank_1', distanceMeters: 22, edgeType: 'corridor', isAccessible: true, floorChange: false },
      { edgeID: 'edge_004', fromNode: 'node_information_desk', toNode: 'node_stairs_east', distanceMeters: 14, edgeType: 'corridor', isAccessible: true, floorChange: false },
      { edgeID: 'edge_005', fromNode: 'node_elevator_bank_1', toNode: 'node_stairs_east', distanceMeters: 20, edgeType: 'corridor', isAccessible: true, floorChange: false },
      { edgeID: 'edge_006', fromNode: 'node_stairs_east', toNode: 'node_gate_a1', distanceMeters: 14, edgeType: 'corridor', isAccessible: true, floorChange: false },
      { edgeID: 'edge_007', fromNode: 'node_gate_a1', toNode: 'node_gate_a3', distanceMeters: 20, edgeType: 'corridor', isAccessible: true, floorChange: false },
      { edgeID: 'edge_008', fromNode: 'node_elevator_bank_1', toNode: 'node_restroom_1', distanceMeters: 20, edgeType: 'corridor', isAccessible: true, floorChange: false },
      
      // Floor change edges
      { edgeID: 'edge_elevator_1_f1_f2', fromNode: 'node_elevator_bank_1', toNode: 'node_elevator_bank_1_f2', distanceMeters: 5, edgeType: 'elevator', isAccessible: true, floorChange: true },
      { edgeID: 'edge_stairs_east_f1_f2', fromNode: 'node_stairs_east', toNode: 'node_stairs_east_f2', distanceMeters: 10, edgeType: 'staircase', isAccessible: false, floorChange: true },
      
      // Floor 2 edges
      { edgeID: 'edge_101', fromNode: 'node_elevator_bank_1_f2', toNode: 'node_stairs_east_f2', distanceMeters: 20, edgeType: 'corridor', isAccessible: true, floorChange: false },
      { edgeID: 'edge_102', fromNode: 'node_stairs_east_f2', toNode: 'node_gate_b1', distanceMeters: 14, edgeType: 'corridor', isAccessible: true, floorChange: false },
      { edgeID: 'edge_103', fromNode: 'node_gate_b1', toNode: 'node_gate_b3', distanceMeters: 20, edgeType: 'corridor', isAccessible: true, floorChange: false },
      { edgeID: 'edge_104', fromNode: 'node_elevator_bank_1_f2', toNode: 'node_food_court', distanceMeters: 22, edgeType: 'corridor', isAccessible: true, floorChange: false },
      { edgeID: 'edge_105', fromNode: 'node_elevator_bank_1_f2', toNode: 'node_restroom_2', distanceMeters: 20, edgeType: 'corridor', isAccessible: true, floorChange: false }
    ];

    return {
      terminal,
      lastUpdated: new Date(),
      nodes,
      edges
    };
  }

  private createMockIndoorMap(terminal: string, floor: number): IndoorMap {
    const vectorTiles: VectorTile[] = [];
    
    // Generate mock vector tiles for the floor
    for (let x = 0; x < 100; x += 10) {
      for (let y = 0; y < 60; y += 10) {
        vectorTiles.push({
          x,
          y,
          z: floor,
          url: `https://cdn.company.com/maps/${terminal}/${floor}/${x}_${y}.pbf`,
          size: 1024
        });
      }
    }

    return {
      terminal,
      floor,
      vectorTiles,
      bounds: {
        minX: 0,
        maxX: 100,
        minY: 0,
        maxY: 60
      },
      lastUpdated: new Date()
    };
  }

  private createMockFloorPlan(terminal: string, floor: number): FloorPlan {
    const overlayElements: OverlayElement[] = [
      { id: 'poi_001', type: 'poi', x: 40, y: 10, name: 'Information Desk', isAccessible: true },
      { id: 'entrance_001', type: 'entrance', x: 0, y: 0, name: 'Main Entrance', isAccessible: true },
      { id: 'elevator_001', type: 'elevator', x: 30, y: 20, name: 'Elevator Bank 1', isAccessible: true },
      { id: 'restroom_001', type: 'restroom', x: 25, y: 40, name: 'Restrooms', isAccessible: true }
    ];

    return {
      terminal,
      floor,
      width: 1000,
      height: 600,
      scale: 0.1, // 10cm per pixel
      imageUrl: `https://cdn.company.com/floorplans/${terminal}/floor_${floor}.png`,
      overlayElements
    };
  }

  private initializeMockData(): void {
    // Pre-populate cache with mock data for faster access
    const t1Graph = this.createMockRoutingGraph('T1');
    this.routingGraphCache.set('T1', t1Graph);

    const t1Map1 = this.createMockIndoorMap('T1', 1);
    const t1Map2 = this.createMockIndoorMap('T1', 2);
    this.indoorMapCache.set('T1_1', t1Map1);
    this.indoorMapCache.set('T1_2', t1Map2);

    const t1Floor1 = this.createMockFloorPlan('T1', 1);
    const t1Floor2 = this.createMockFloorPlan('T1', 2);
    this.floorPlanCache.set('T1_1', t1Floor1);
    this.floorPlanCache.set('T1_2', t1Floor2);

    console.debug('[MAPPING] Mock data initialized');
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<{
    available: boolean;
    cachedGraphs: number;
    cachedMaps: number;
    cachedFloorPlans: number;
  }> {
    return {
      available: true,
      cachedGraphs: this.routingGraphCache.size,
      cachedMaps: this.indoorMapCache.size,
      cachedFloorPlans: this.floorPlanCache.size
    };
  }
} 