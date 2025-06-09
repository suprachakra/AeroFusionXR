/**
 * WayfindingSDK.ts
 * SDK for embedding wayfinding functionality in kiosks and web applications
 */

import { Vector3 } from 'three';
import { NavigationPoint } from '../models/NavigationPoint';
import { UserPreferences } from '../models/UserPreferences';

interface SDKConfig {
  apiUrl: string;
  apiKey: string;
  container: HTMLElement;
  onError?: (error: Error) => void;
  onPositionUpdate?: (position: Vector3) => void;
  onRouteUpdate?: (path: NavigationPoint[]) => void;
}

interface NavigationOptions {
  start?: NavigationPoint;
  end: NavigationPoint;
  preferences?: {
    avoidCrowded?: boolean;
    accessibilityMode?: boolean;
  };
}

export class WayfindingSDK {
  private config: SDKConfig;
  private renderer?: THREE.WebGLRenderer;
  private currentPath?: NavigationPoint[];
  private userPosition?: Vector3;
  private userPreferences?: UserPreferences;
  private updateInterval?: number;

  constructor(config: SDKConfig) {
    this.config = config;
    this.validateConfig();
  }

  /**
   * Initialize the SDK
   */
  public async initialize(): Promise<void> {
    try {
      // Initialize renderer
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
      });
      this.renderer.setSize(
        this.config.container.clientWidth,
        this.config.container.clientHeight
      );
      this.config.container.appendChild(this.renderer.domElement);

      // Start position updates
      this.startPositionUpdates();

      // Add resize handler
      window.addEventListener('resize', this.handleResize);

    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Start navigation to destination
   */
  public async startNavigation(options: NavigationOptions): Promise<void> {
    try {
      const start = options.start || await this.getCurrentPosition();
      
      const response = await fetch(`${this.config.apiUrl}/api/v1/navigation/path`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey
        },
        body: JSON.stringify({
          start,
          end: options.end,
          preferences: options.preferences
        })
      });

      if (!response.ok) {
        throw new Error(`Navigation request failed: ${response.statusText}`);
      }

      const { path } = await response.json();
      this.currentPath = path;
      
      if (this.config.onRouteUpdate) {
        this.config.onRouteUpdate(path);
      }

    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Stop active navigation
   */
  public stopNavigation(): void {
    this.currentPath = undefined;
    if (this.config.onRouteUpdate) {
      this.config.onRouteUpdate([]);
    }
  }

  /**
   * Update user preferences
   */
  public async updatePreferences(preferences: Partial<UserPreferences>): Promise<void> {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/v1/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey
        },
        body: JSON.stringify(preferences)
      });

      if (!response.ok) {
        throw new Error(`Preferences update failed: ${response.statusText}`);
      }

      this.userPreferences = await response.json();

    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Add a saved location
   */
  public async addSavedLocation(location: {
    name: string;
    position: Vector3;
    floorId: string;
    type: 'favorite' | 'waypoint';
  }): Promise<void> {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/v1/locations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey
        },
        body: JSON.stringify(location)
      });

      if (!response.ok) {
        throw new Error(`Failed to save location: ${response.statusText}`);
      }

    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Clean up SDK resources
   */
  public dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    
    if (this.updateInterval) {
      window.clearInterval(this.updateInterval);
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.config.container.removeChild(this.renderer.domElement);
    }
  }

  private async getCurrentPosition(): Promise<NavigationPoint> {
    const response = await fetch(`${this.config.apiUrl}/api/v1/position`, {
      headers: {
        'X-API-Key': this.config.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get position: ${response.statusText}`);
    }

    return response.json();
  }

  private startPositionUpdates(): void {
    this.updateInterval = window.setInterval(async () => {
      try {
        const position = await this.getCurrentPosition();
        this.userPosition = position.position;
        
        if (this.config.onPositionUpdate) {
          this.config.onPositionUpdate(position.position);
        }

        // Update route if needed
        if (this.currentPath) {
          await this.updateRoute();
        }

      } catch (error) {
        this.handleError(error as Error);
      }
    }, 200); // Update every 200ms
  }

  private async updateRoute(): Promise<void> {
    if (!this.userPosition || !this.currentPath) return;

    // Check if we need to recalculate route
    const nextPoint = this.currentPath[1]; // Next waypoint
    if (nextPoint) {
      const distance = this.userPosition.distanceTo(nextPoint.position);
      
      // Recalculate if we're too far off course (>5m)
      if (distance > 5) {
        await this.startNavigation({
          end: this.currentPath[this.currentPath.length - 1]
        });
      }
    }
  }

  private handleResize = (): void => {
    if (this.renderer) {
      this.renderer.setSize(
        this.config.container.clientWidth,
        this.config.container.clientHeight
      );
    }
  };

  private handleError(error: Error): void {
    if (this.config.onError) {
      this.config.onError(error);
    } else {
      console.error('WayfindingSDK Error:', error);
    }
  }

  private validateConfig(): void {
    if (!this.config.apiUrl) {
      throw new Error('apiUrl is required');
    }
    if (!this.config.apiKey) {
      throw new Error('apiKey is required');
    }
    if (!this.config.container || !(this.config.container instanceof HTMLElement)) {
      throw new Error('container must be a valid HTMLElement');
    }
  }
} 