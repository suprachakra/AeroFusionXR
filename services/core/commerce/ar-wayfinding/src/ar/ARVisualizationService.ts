import { Node } from '../mapping/MappingService';

export interface ARArrow {
  id: string;
  position: Node;
  targetPosition: Node;
  color: string;
  scale: number;
  isVisible: boolean;
}

export interface ARBreadcrumb {
  id: string;
  position: Node;
  timestamp: Date;
  isVisible: boolean;
}

export interface ARNavigationOverlay {
  sessionID: string;
  showDistance: boolean;
  showInstructions: boolean;
  highContrast: boolean;
  locale: string;
}

export interface ARObject {
  id: string;
  type: 'arrow' | 'breadcrumb' | 'marker' | 'text';
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  color: string;
  isVisible: boolean;
  animationState?: 'idle' | 'pulsing' | 'rotating' | 'bouncing';
}

export interface ARScene {
  sessionID: string;
  objects: Map<string, ARObject>;
  activeFloor: number;
  cameraPosition: { x: number; y: number; z: number };
  cameraRotation: { x: number; y: number; z: number };
}

export class ARVisualizationService {
  private activeSessions: Map<string, ARScene> = new Map();
  private arObjects: Map<string, ARObject> = new Map();
  private breadcrumbTrails: Map<string, ARBreadcrumb[]> = new Map();
  private navigationOverlays: Map<string, ARNavigationOverlay> = new Map();

  /**
   * Create AR arrow for navigation guidance
   */
  async createArrow(sessionID: string, arrow: ARArrow): Promise<void> {
    try {
      const scene = this.getOrCreateScene(sessionID);
      
      const arObject: ARObject = {
        id: arrow.id,
        type: 'arrow',
        position: {
          x: arrow.position.x,
          y: arrow.position.y + 1.5, // Elevate arrow above ground
          z: arrow.position.z
        },
        rotation: this.calculateArrowRotation(arrow.position, arrow.targetPosition),
        scale: { x: arrow.scale, y: arrow.scale, z: arrow.scale },
        color: arrow.color,
        isVisible: arrow.isVisible,
        animationState: 'pulsing'
      };

      scene.objects.set(arrow.id, arObject);
      this.arObjects.set(arrow.id, arObject);

      console.debug(`[AR] Created arrow ${arrow.id} for session ${sessionID}`);

    } catch (error) {
      console.error(`[AR] Failed to create arrow for session ${sessionID}:`, error);
      throw error;
    }
  }

  /**
   * Update arrow target direction
   */
  async updateArrowTarget(sessionID: string, targetPosition: Node): Promise<void> {
    try {
      const scene = this.activeSessions.get(sessionID);
      if (!scene) return;

      // Find arrow objects in the scene
      for (const [objectId, object] of scene.objects) {
        if (object.type === 'arrow') {
          const currentPosition = {
            x: object.position.x,
            y: 0, // Use ground level for direction calculation
            z: object.position.z
          };

          object.rotation = this.calculateArrowRotation(currentPosition, targetPosition);
          object.animationState = 'pulsing';

          console.debug(`[AR] Updated arrow ${objectId} target for session ${sessionID}`);
        }
      }

    } catch (error) {
      console.error(`[AR] Failed to update arrow target for session ${sessionID}:`, error);
    }
  }

  /**
   * Initialize breadcrumb system
   */
  async initializeBreadcrumbs(sessionID: string): Promise<void> {
    try {
      this.breadcrumbTrails.set(sessionID, []);
      console.debug(`[AR] Initialized breadcrumb system for session ${sessionID}`);

    } catch (error) {
      console.error(`[AR] Failed to initialize breadcrumbs for session ${sessionID}:`, error);
      throw error;
    }
  }

  /**
   * Add breadcrumb at position
   */
  async addBreadcrumb(sessionID: string, breadcrumb: ARBreadcrumb): Promise<void> {
    try {
      const scene = this.getOrCreateScene(sessionID);
      let breadcrumbs = this.breadcrumbTrails.get(sessionID) || [];

      // Add breadcrumb to trail
      breadcrumbs.push(breadcrumb);

      // Limit breadcrumb count (keep last 20)
      if (breadcrumbs.length > 20) {
        const removedBreadcrumb = breadcrumbs.shift();
        if (removedBreadcrumb) {
          scene.objects.delete(removedBreadcrumb.id);
          this.arObjects.delete(removedBreadcrumb.id);
        }
      }

      this.breadcrumbTrails.set(sessionID, breadcrumbs);

      // Create AR object for breadcrumb
      const arObject: ARObject = {
        id: breadcrumb.id,
        type: 'breadcrumb',
        position: {
          x: breadcrumb.position.x,
          y: breadcrumb.position.y + 0.1, // Slightly above ground
          z: breadcrumb.position.z
        },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.1, y: 0.1, z: 0.1 },
        color: '#4CAF50',
        isVisible: breadcrumb.isVisible,
        animationState: 'idle'
      };

      scene.objects.set(breadcrumb.id, arObject);
      this.arObjects.set(breadcrumb.id, arObject);

      console.debug(`[AR] Added breadcrumb ${breadcrumb.id} for session ${sessionID}`);

    } catch (error) {
      console.error(`[AR] Failed to add breadcrumb for session ${sessionID}:`, error);
      throw error;
    }
  }

  /**
   * Create navigation overlay
   */
  async createNavigationOverlay(overlay: ARNavigationOverlay): Promise<void> {
    try {
      this.navigationOverlays.set(overlay.sessionID, overlay);
      console.debug(`[AR] Created navigation overlay for session ${overlay.sessionID}`);

    } catch (error) {
      console.error(`[AR] Failed to create navigation overlay for session ${overlay.sessionID}:`, error);
      throw error;
    }
  }

  /**
   * Update navigation overlay with current information
   */
  async updateNavigationOverlay(sessionID: string, updateData: {
    distance?: number;
    instruction?: string;
    estimatedTime?: number;
  }): Promise<void> {
    try {
      const overlay = this.navigationOverlays.get(sessionID);
      if (!overlay) return;

      // In a real implementation, this would update the AR overlay UI
      console.debug(`[AR] Updated navigation overlay for session ${sessionID}`, updateData);

    } catch (error) {
      console.error(`[AR] Failed to update navigation overlay for session ${sessionID}:`, error);
    }
  }

  /**
   * Update AR visualization for floor change
   */
  async updateFloor(sessionID: string, newFloor: number): Promise<void> {
    try {
      const scene = this.activeSessions.get(sessionID);
      if (!scene) return;

      scene.activeFloor = newFloor;

      // Hide objects not on current floor
      for (const [objectId, object] of scene.objects) {
        // In a real implementation, would check object floor association
        // For now, keep all objects visible
        object.isVisible = true;
      }

      console.debug(`[AR] Updated floor to ${newFloor} for session ${sessionID}`);

    } catch (error) {
      console.error(`[AR] Failed to update floor for session ${sessionID}:`, error);
    }
  }

  /**
   * Clean up AR objects for session
   */
  async cleanup(sessionID: string): Promise<void> {
    try {
      const scene = this.activeSessions.get(sessionID);
      if (scene) {
        // Remove all AR objects for this session
        for (const objectId of scene.objects.keys()) {
          this.arObjects.delete(objectId);
        }
        
        this.activeSessions.delete(sessionID);
      }

      // Clean up breadcrumbs
      this.breadcrumbTrails.delete(sessionID);
      
      // Clean up navigation overlay
      this.navigationOverlays.delete(sessionID);

      console.debug(`[AR] Cleaned up AR objects for session ${sessionID}`);

    } catch (error) {
      console.error(`[AR] Failed to cleanup AR objects for session ${sessionID}:`, error);
    }
  }

  /**
   * Add POI marker in AR
   */
  async addPOIMarker(sessionID: string, poi: Node, markerType: 'info' | 'warning' | 'destination'): Promise<void> {
    try {
      const scene = this.getOrCreateScene(sessionID);
      
      const markerId = `poi_marker_${poi.nodeID}`;
      const color = this.getMarkerColor(markerType);
      
      const arObject: ARObject = {
        id: markerId,
        type: 'marker',
        position: {
          x: poi.x,
          y: poi.y + 2.0, // Elevate marker above POI
          z: poi.z
        },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.3, y: 0.3, z: 0.3 },
        color,
        isVisible: true,
        animationState: markerType === 'destination' ? 'bouncing' : 'pulsing'
      };

      scene.objects.set(markerId, arObject);
      this.arObjects.set(markerId, arObject);

      console.debug(`[AR] Added POI marker ${markerId} for session ${sessionID}`);

    } catch (error) {
      console.error(`[AR] Failed to add POI marker for session ${sessionID}:`, error);
      throw error;
    }
  }

  /**
   * Add text label in AR
   */
  async addTextLabel(sessionID: string, position: Node, text: string, style: {
    fontSize?: number;
    color?: string;
    background?: boolean;
  } = {}): Promise<void> {
    try {
      const scene = this.getOrCreateScene(sessionID);
      
      const labelId = `text_label_${Date.now()}`;
      
      const arObject: ARObject = {
        id: labelId,
        type: 'text',
        position: {
          x: position.x,
          y: position.y + 2.5, // Elevate text above objects
          z: position.z
        },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: style.fontSize || 1.0, y: style.fontSize || 1.0, z: 1.0 },
        color: style.color || '#FFFFFF',
        isVisible: true,
        animationState: 'idle'
      };

      scene.objects.set(labelId, arObject);
      this.arObjects.set(labelId, arObject);

      console.debug(`[AR] Added text label ${labelId} for session ${sessionID}: "${text}"`);

    } catch (error) {
      console.error(`[AR] Failed to add text label for session ${sessionID}:`, error);
      throw error;
    }
  }

  /**
   * Update camera position and orientation
   */
  async updateCamera(sessionID: string, position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number }): Promise<void> {
    try {
      const scene = this.getOrCreateScene(sessionID);
      
      scene.cameraPosition = position;
      scene.cameraRotation = rotation;

      // Update object visibility based on camera position/orientation
      await this.updateObjectVisibility(sessionID);

      console.debug(`[AR] Updated camera for session ${sessionID}`);

    } catch (error) {
      console.error(`[AR] Failed to update camera for session ${sessionID}:`, error);
    }
  }

  /**
   * Get AR scene state for rendering
   */
  getScene(sessionID: string): ARScene | null {
    return this.activeSessions.get(sessionID) || null;
  }

  /**
   * Get all visible AR objects for session
   */
  getVisibleObjects(sessionID: string): ARObject[] {
    const scene = this.activeSessions.get(sessionID);
    if (!scene) return [];

    return Array.from(scene.objects.values()).filter(obj => obj.isVisible);
  }

  /**
   * Private helper methods
   */
  private getOrCreateScene(sessionID: string): ARScene {
    let scene = this.activeSessions.get(sessionID);
    
    if (!scene) {
      scene = {
        sessionID,
        objects: new Map(),
        activeFloor: 1,
        cameraPosition: { x: 0, y: 0, z: 0 },
        cameraRotation: { x: 0, y: 0, z: 0 }
      };
      
      this.activeSessions.set(sessionID, scene);
    }
    
    return scene;
  }

  private calculateArrowRotation(from: { x: number; y: number; z: number }, to: Node): { x: number; y: number; z: number } {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    
    // Calculate Y rotation (heading) in degrees
    const yRotation = Math.atan2(dx, dz) * (180 / Math.PI);
    
    return {
      x: 0,
      y: yRotation,
      z: 0
    };
  }

  private getMarkerColor(markerType: 'info' | 'warning' | 'destination'): string {
    switch (markerType) {
      case 'info': return '#2196F3';
      case 'warning': return '#FF9800';
      case 'destination': return '#4CAF50';
      default: return '#FFFFFF';
    }
  }

  private async updateObjectVisibility(sessionID: string): Promise<void> {
    const scene = this.activeSessions.get(sessionID);
    if (!scene) return;

    // In a real implementation, this would use camera frustum culling
    // and distance-based visibility. For now, keep objects visible
    for (const object of scene.objects.values()) {
      // Simple distance-based visibility
      const distance = this.calculateDistance(scene.cameraPosition, object.position);
      object.isVisible = distance <= 100; // 100 meter visibility range
    }
  }

  private calculateDistance(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): number {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Enable/disable high contrast mode
   */
  async setHighContrastMode(sessionID: string, enabled: boolean): Promise<void> {
    try {
      const scene = this.activeSessions.get(sessionID);
      if (!scene) return;

      for (const object of scene.objects.values()) {
        if (enabled) {
          // High contrast colors
          if (object.type === 'arrow') {
            object.color = '#FFE400'; // Bright yellow
          } else if (object.type === 'breadcrumb') {
            object.color = '#FF3D00'; // Bright red-orange
          }
        } else {
          // Normal colors
          if (object.type === 'arrow') {
            object.color = '#00C853'; // Green
          } else if (object.type === 'breadcrumb') {
            object.color = '#4CAF50'; // Light green
          }
        }
      }

      console.debug(`[AR] Set high contrast mode ${enabled ? 'enabled' : 'disabled'} for session ${sessionID}`);

    } catch (error) {
      console.error(`[AR] Failed to set high contrast mode for session ${sessionID}:`, error);
    }
  }

  /**
   * Animate AR objects
   */
  async animateObjects(sessionID: string): Promise<void> {
    const scene = this.activeSessions.get(sessionID);
    if (!scene) return;

    for (const object of scene.objects.values()) {
      if (!object.isVisible) continue;

      switch (object.animationState) {
        case 'pulsing':
          // Simulate pulsing animation by varying scale
          const pulseScale = 1.0 + 0.2 * Math.sin(Date.now() * 0.005);
          object.scale = { x: pulseScale, y: pulseScale, z: pulseScale };
          break;
          
        case 'rotating':
          // Simulate rotation animation
          object.rotation.y = (object.rotation.y + 2) % 360;
          break;
          
        case 'bouncing':
          // Simulate bouncing animation
          const bounceHeight = 0.3 * Math.abs(Math.sin(Date.now() * 0.01));
          object.position.y += bounceHeight;
          break;
      }
    }
  }

  /**
   * Get AR visualization statistics
   */
  getStatistics(): {
    activeSessions: number;
    totalObjects: number;
    totalBreadcrumbs: number;
    averageObjectsPerSession: number;
  } {
    const totalBreadcrumbs = Array.from(this.breadcrumbTrails.values())
      .reduce((sum, trail) => sum + trail.length, 0);

    return {
      activeSessions: this.activeSessions.size,
      totalObjects: this.arObjects.size,
      totalBreadcrumbs,
      averageObjectsPerSession: this.activeSessions.size > 0 
        ? Math.round(this.arObjects.size / this.activeSessions.size)
        : 0
    };
  }
} 