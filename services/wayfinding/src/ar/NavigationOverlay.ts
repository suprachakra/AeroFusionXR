/**
 * NavigationOverlay.ts
 * Handles AR visualization of navigation path and waypoints
 */

import { Scene, WebGLRenderer, PerspectiveCamera, Vector3, Line, 
  BufferGeometry, LineBasicMaterial, Group, Mesh, SphereGeometry, 
  MeshBasicMaterial, TextGeometry, Font } from 'three';
import { metrics } from '../utils/metrics';
import { Logger } from '../utils/Logger';
import { Route, RouteSegment, Position, PathType } from '../types';

/**
 * NavigationOverlay handles the AR visualization of navigation paths and waypoints
 * using Three.js. It provides real-time updates of paths, distance markers, and
 * directional indicators aligned with the user's device orientation.
 */
export class NavigationOverlay {
  private scene: Scene;
  private camera: PerspectiveCamera;
  private renderer: WebGLRenderer;
  private pathGroup: Group;
  private waypointGroup: Group;
  private labelGroup: Group;
  private currentRoute: Route | null;
  private font: Font | null;
  private logger: Logger;

  // Performance metrics
  private readonly renderTimeHistogram = metrics.createHistogram({
    name: 'ar_render_time_ms',
    help: 'Time taken to render AR overlay in milliseconds',
    buckets: [5, 10, 20, 50, 100]
  });

  private readonly frameRateGauge = metrics.createGauge({
    name: 'ar_frame_rate',
    help: 'Current frame rate of AR overlay'
  });

  constructor(
    container: HTMLElement,
    private readonly config = {
      pathColor: 0x00ff00,
      waypointColor: 0xff0000,
      pathWidth: 0.2,
      waypointSize: 0.5,
      labelSize: 0.3,
      minFrameRate: 30
    }
  ) {
    // Initialize Three.js scene
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    // Create object groups
    this.pathGroup = new Group();
    this.waypointGroup = new Group();
    this.labelGroup = new Group();
    this.scene.add(this.pathGroup);
    this.scene.add(this.waypointGroup);
    this.scene.add(this.labelGroup);

    // Initialize state
    this.currentRoute = null;
    this.font = null;
    this.logger = new Logger();

    // Start render loop
    this.animate();

    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  /**
   * Updates the navigation path displayed in AR
   */
  public updateRoute(route: Route): void {
    const startTime = performance.now();

    try {
      // Clear existing path
      this.clearPath();
      this.currentRoute = route;

      // Create path geometry
      const points: Vector3[] = [];
      route.segments.forEach(segment => {
        points.push(new Vector3(segment.start.x, segment.start.y, segment.start.z));
        points.push(new Vector3(segment.end.x, segment.end.y, segment.end.z));
      });

      const geometry = new BufferGeometry().setFromPoints(points);
      const material = new LineBasicMaterial({ 
        color: this.config.pathColor,
        linewidth: this.config.pathWidth
      });
      const path = new Line(geometry, material);
      this.pathGroup.add(path);

      // Add waypoints
      this.addWaypoints(route.segments);

      // Add distance labels
      this.addDistanceLabels(route.segments);

      const renderTime = performance.now() - startTime;
      this.renderTimeHistogram.observe({ method: 'route_update' }, renderTime);

    } catch (error) {
      this.logger.error('Error updating AR route:', error);
      metrics.increment('ar_route_update_errors');
    }
  }

  /**
   * Updates the camera position and orientation based on device pose
   */
  public updateDevicePose(position: Position, rotation: { x: number; y: number; z: number }): void {
    this.camera.position.set(position.x, position.y, position.z);
    this.camera.rotation.set(rotation.x, rotation.y, rotation.z);
  }

  /**
   * Adds waypoint markers at key navigation points
   */
  private addWaypoints(segments: RouteSegment[]): void {
    segments.forEach(segment => {
      if (segment.type === PathType.TRANSITION) {
        // Add special marker for floor transitions
        const geometry = new SphereGeometry(this.config.waypointSize);
        const material = new MeshBasicMaterial({ color: this.config.waypointColor });
        const waypoint = new Mesh(geometry, material);
        waypoint.position.set(segment.end.x, segment.end.y, segment.end.z);
        this.waypointGroup.add(waypoint);
      }
    });
  }

  /**
   * Adds distance labels along the path
   */
  private addDistanceLabels(segments: RouteSegment[]): void {
    if (!this.font) return;

    let totalDistance = 0;
    segments.forEach(segment => {
      totalDistance += segment.distance;
      
      // Add distance marker every 10 meters
      if (totalDistance % 10 < segment.distance) {
        const text = new TextGeometry(`${Math.round(totalDistance)}m`, {
          font: this.font,
          size: this.config.labelSize,
          height: 0.1
        });
        const material = new MeshBasicMaterial({ color: this.config.pathColor });
        const label = new Mesh(text, material);
        label.position.set(segment.end.x, segment.end.y + 1, segment.end.z);
        this.labelGroup.add(label);
      }
    });
  }

  /**
   * Main render loop
   */
  private animate(): void {
    const startTime = performance.now();

    try {
      // Render scene
      this.renderer.render(this.scene, this.camera);

      // Calculate and record frame rate
      const frameTime = performance.now() - startTime;
      const fps = 1000 / frameTime;
      this.frameRateGauge.set({ type: 'render' }, fps);

      // Log warning if frame rate drops below minimum
      if (fps < this.config.minFrameRate) {
        this.logger.warn('Low frame rate detected:', { fps });
        metrics.increment('ar_low_frame_rate');
      }

    } catch (error) {
      this.logger.error('Error in render loop:', error);
      metrics.increment('ar_render_errors');
    }

    requestAnimationFrame(() => this.animate());
  }

  /**
   * Handles window resize events
   */
  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * Clears the current navigation path
   */
  private clearPath(): void {
    while (this.pathGroup.children.length > 0) {
      this.pathGroup.remove(this.pathGroup.children[0]);
    }
    while (this.waypointGroup.children.length > 0) {
      this.waypointGroup.remove(this.waypointGroup.children[0]);
    }
    while (this.labelGroup.children.length > 0) {
      this.labelGroup.remove(this.labelGroup.children[0]);
    }
  }

  /**
   * Loads the font for text labels
   */
  public async loadFont(fontUrl: string): Promise<void> {
    try {
      // Load font asynchronously
      const response = await fetch(fontUrl);
      const fontData = await response.json();
      this.font = new Font(fontData);
    } catch (error) {
      this.logger.error('Error loading font:', error);
      metrics.increment('ar_font_load_errors');
    }
  }

  /**
   * Cleans up resources
   */
  public dispose(): void {
    this.renderer.dispose();
    window.removeEventListener('resize', this.onWindowResize.bind(this));
  }
} 