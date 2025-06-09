/**
 * POI Multimedia Overlay Service
 * Feature 11: POI_OVERLAY_001
 * 
 * Enterprise-grade service for rendering rich multimedia overlays (images, videos, 3D icons, 
 * ratings, descriptions) for Points-of-Interest in AR and 2D map views.
 * 
 * @version 1.0.0
 * @author AeroFusionXR Platform Team
 * @since 2025-01-27
 */

export interface SupportedMediaFormat {
  format: string;
  quality: 'low' | 'medium' | 'high' | 'ultra';
  maxSize: number; // bytes
  extensions: string[];
  mimeTypes: string[];
}

export interface POIAsset {
  assetID: string;
  type: 'image' | 'video' | 'model3d' | 'audio';
  url: string;
  fallbackUrl?: string;
  metadata: {
    width?: number;
    height?: number;
    duration?: number; // for videos/audio
    fileSize: number;
    format: string;
    quality: 'low' | 'medium' | 'high' | 'ultra';
    lastModified: string;
    checksum: string; // SHA-256
  };
  localPath?: string; // for cached assets
  cacheExpiry?: string;
}

export interface POIModel3D {
  modelID: string;
  lodVersions: {
    high: POIAsset;
    medium: POIAsset;
    low: POIAsset;
  };
  boundingBox: {
    width: number;
    height: number;
    depth: number;
  };
  renderingSettings: {
    scale: number;
    rotation: { x: number; y: number; z: number };
    materialType: 'standard' | 'pbr' | 'toon';
    castShadows: boolean;
    receiveShadows: boolean;
  };
}

export interface POIMultimedia {
  poiID: string;
  name: { [locale: string]: string };
  category: string;
  description: { [locale: string]: string };
  location: {
    x: number;
    y: number;
    z: number;
    floor: string;
    zone: string;
  };
  rating: {
    average: number; // 0.0-5.0
    count: number;
    breakdown: { [stars: number]: number };
  };
  operatingHours: {
    [day: string]: { open: string; close: string; } | null;
  };
  images: POIAsset[];
  videos: POIAsset[];
  model3D: POIModel3D;
  offers: POIOffer[];
  accessibility: POIAccessibilityInfo;
  socialData: {
    checkInCount: number;
    lastCheckIn?: string;
    popularTimes: { [hour: number]: number };
  };
}

export interface POIOffer {
  offerID: string;
  title: { [locale: string]: string };
  description: { [locale: string]: string };
  discountPercent?: number;
  discountAmount?: number;
  validFrom: string;
  validUntil: string;
  restrictions: string[];
  applicableServices: string[];
  priority: number; // 1-10, higher = more prominent
}

export interface POIAccessibilityInfo {
  wheelchairAccessible: boolean;
  brailleSignage: boolean;
  audioDescription: boolean;
  visualAlerts: boolean;
  hearingLoop: boolean;
  accessibilityNotes: { [locale: string]: string };
}

export interface OverlayAnchor {
  anchorID: string;
  poiID: string;
  position: { x: number; y: number; z: number };
  orientation: { x: number; y: number; z: number; w: number };
  scale: { x: number; y: number; z: number };
  isVisible: boolean;
  lodLevel: 'high' | 'medium' | 'low';
  lastUpdate: number; // timestamp
}

export interface OverlayCard {
  cardID: string;
  poiID: string;
  isVisible: boolean;
  position: { x: number; y: number };
  dimensions: { width: number; height: number };
  zIndex: number;
  content: {
    header: {
      title: string;
      subtitle: string;
      rating: number;
      reviewCount: number;
    };
    media: {
      currentImageIndex: number;
      videoThumbnail?: string;
      isVideoPlaying: boolean;
    };
    description: string;
    offers: POIOffer[];
    actions: OverlayAction[];
  };
  animations: {
    showAnimation: 'fade' | 'slide' | 'scale';
    hideAnimation: 'fade' | 'slide' | 'scale';
    duration: number; // milliseconds
  };
}

export interface OverlayAction {
  actionID: string;
  type: 'navigate' | 'more_info' | 'share' | 'call' | 'website' | 'offer_redeem';
  label: { [locale: string]: string };
  iconUrl?: string;
  actionData: { [key: string]: any };
  enabled: boolean;
  priority: number;
}

export interface MediaPlayerState {
  playerID: string;
  asset: POIAsset;
  state: 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  bufferHealth: number; // 0-1
  quality: 'auto' | 'low' | 'medium' | 'high';
}

export interface ProximityThreshold {
  poiID: string;
  showThreshold: number; // meters
  hideThreshold: number; // meters
  lastProximityCheck: number;
  isUserInRange: boolean;
}

export interface CacheStatistics {
  totalSize: number; // bytes
  availableSize: number; // bytes
  itemCount: number;
  hitRate: number; // 0-1
  evictionCount: number;
  lastCleanup: number;
}

export class POIMultimediaOverlayService {
  private poiMultimedia: Map<string, POIMultimedia> = new Map();
  private overlayAnchors: Map<string, OverlayAnchor> = new Map();
  private overlayCards: Map<string, OverlayCard> = new Map();
  private mediaPlayers: Map<string, MediaPlayerState> = new Map();
  private proximityThresholds: Map<string, ProximityThreshold> = new Map();
  private assetCache: Map<string, POIAsset> = new Map();
  private cacheStatistics: CacheStatistics;
  private supportedFormats: Map<string, SupportedMediaFormat> = new Map();
  private arRenderer: any = null; // Mock AR rendering engine
  private mediaPlayerEngine: any = null;
  private model3DLoader: any = null;
  private proximityEngine: any = null;
  private readonly logger: any;
  private isInitialized: boolean = false;
  private lastPerformanceCheck: number = 0;
  private renderFrameRate: number = 60;
  private currentUserPosition: { x: number; y: number; z: number; floor: string } | null = null;
  private visiblePOIs: Set<string> = new Set();
  private loadingQueue: Map<string, Promise<any>> = new Map();

  constructor() {
    this.logger = {
      debug: (message: string, ...args: any[]) => console.log(`[DEBUG] POIOverlay: ${message}`, ...args),
      info: (message: string, ...args: any[]) => console.info(`[INFO] POIOverlay: ${message}`, ...args),
      warn: (message: string, ...args: any[]) => console.warn(`[WARN] POIOverlay: ${message}`, ...args),
      error: (message: string, ...args: any[]) => console.error(`[ERROR] POIOverlay: ${message}`, ...args)
    };

    this.cacheStatistics = {
      totalSize: 0,
      availableSize: 200 * 1024 * 1024, // 200MB default
      itemCount: 0,
      hitRate: 0,
      evictionCount: 0,
      lastCleanup: Date.now()
    };

    this.initializePOIOverlayService();
  }

  private async initializePOIOverlayService(): Promise<void> {
    try {
      this.logger.info('Initializing POI Multimedia Overlay Service');

      await Promise.all([
        this.initializeSupportedFormats(),
        this.initializeARRenderer(),
        this.initializeMediaPlayerEngine(),
        this.initialize3DModelLoader(),
        this.initializeProximityEngine(),
        this.loadPOIMultimediaData(),
        this.initializeAssetCache()
      ]);

      this.startPerformanceMonitoring();
      this.startProximityChecking();

      this.isInitialized = true;
      this.logger.info('POI Multimedia Overlay Service initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize POI Multimedia Overlay Service:', error);
      throw error;
    }
  }

  private async initializeSupportedFormats(): Promise<void> {
    const formats = [
      {
        format: 'JPEG',
        quality: 'high' as const,
        maxSize: 5 * 1024 * 1024,
        extensions: ['.jpg', '.jpeg'],
        mimeTypes: ['image/jpeg']
      },
      {
        format: 'PNG',
        quality: 'high' as const,
        maxSize: 5 * 1024 * 1024,
        extensions: ['.png'],
        mimeTypes: ['image/png']
      },
      {
        format: 'MP4',
        quality: 'high' as const,
        maxSize: 50 * 1024 * 1024,
        extensions: ['.mp4'],
        mimeTypes: ['video/mp4']
      },
      {
        format: 'GLTF',
        quality: 'high' as const,
        maxSize: 10 * 1024 * 1024,
        extensions: ['.gltf', '.glb'],
        mimeTypes: ['model/gltf+json', 'model/gltf-binary']
      }
    ];

    formats.forEach(format => {
      this.supportedFormats.set(format.format, format);
    });

    this.logger.debug(`Initialized ${formats.length} supported media formats`);
  }

  private async initializeARRenderer(): Promise<void> {
    this.arRenderer = {
      async createAnchor(position: { x: number; y: number; z: number }): Promise<string> {
        return `anchor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      },

      async attachModel(anchorID: string, modelAsset: POIAsset, scale: number): Promise<void> {
        const loadTime = Math.random() * 200 + 50; // 50-250ms
        await new Promise(resolve => setTimeout(resolve, loadTime));
        
        if (Math.random() < 0.05) { // 5% failure rate for testing
          throw new Error(`Failed to attach model to anchor ${anchorID}`);
        }
      },

      updateAnchorPosition(anchorID: string, position: { x: number; y: number; z: number }): void {
        // Mock position update
      },

      setAnchorVisibility(anchorID: string, visible: boolean): void {
        // Mock visibility toggle
      },

      removeAnchor(anchorID: string): void {
        // Mock anchor removal
      },

      getCurrentFrameRate(): number {
        return this.renderFrameRate + (Math.random() - 0.5) * 5;
      },

      getGPUMemoryUsage(): number {
        return Math.random() * 100; // Mock GPU memory usage percentage
      }
    };
  }

  private async initializeMediaPlayerEngine(): Promise<void> {
    this.mediaPlayerEngine = {
      async createPlayer(playerID: string): Promise<void> {
        // Mock player creation
      },

      async loadMedia(playerID: string, asset: POIAsset): Promise<void> {
        const loadTime = Math.random() * 300 + 100; // 100-400ms
        await new Promise(resolve => setTimeout(resolve, loadTime));
        
        if (!this.mediaPlayers.has(playerID)) {
          this.mediaPlayers.set(playerID, {
            playerID,
            asset,
            state: 'loading',
            currentTime: 0,
            duration: asset.metadata.duration || 0,
            volume: 1.0,
            isMuted: false,
            isFullscreen: false,
            bufferHealth: 0,
            quality: 'auto'
          });
        }
      },

      async play(playerID: string): Promise<void> {
        const player = this.mediaPlayers.get(playerID);
        if (player) {
          player.state = 'playing';
        }
      },

      async pause(playerID: string): Promise<void> {
        const player = this.mediaPlayers.get(playerID);
        if (player) {
          player.state = 'paused';
        }
      },

      async stop(playerID: string): Promise<void> {
        const player = this.mediaPlayers.get(playerID);
        if (player) {
          player.state = 'idle';
          player.currentTime = 0;
        }
      },

      setVolume(playerID: string, volume: number): void {
        const player = this.mediaPlayers.get(playerID);
        if (player) {
          player.volume = Math.max(0, Math.min(1, volume));
        }
      },

      setMuted(playerID: string, muted: boolean): void {
        const player = this.mediaPlayers.get(playerID);
        if (player) {
          player.isMuted = muted;
        }
      }
    };
  }

  private async initialize3DModelLoader(): Promise<void> {
    this.model3DLoader = {
      async loadModel(modelAsset: POIAsset): Promise<any> {
        const loadTime = modelAsset.metadata.fileSize / (1024 * 100); // Simulate load based on file size
        await new Promise(resolve => setTimeout(resolve, Math.min(loadTime, 2000)));
        
        return {
          modelID: `model_${Date.now()}`,
          triangleCount: Math.floor(Math.random() * 10000) + 1000,
          textureCount: Math.floor(Math.random() * 5) + 1,
          boundingBox: {
            width: Math.random() * 2 + 0.5,
            height: Math.random() * 2 + 0.5,
            depth: Math.random() * 2 + 0.5
          }
        };
      },

      optimizeForLOD(model: any, targetLOD: 'high' | 'medium' | 'low'): any {
        const reductionFactors = { high: 1.0, medium: 0.6, low: 0.3 };
        const factor = reductionFactors[targetLOD];
        
        return {
          ...model,
          triangleCount: Math.floor(model.triangleCount * factor),
          textureCount: Math.min(model.textureCount, targetLOD === 'low' ? 1 : 3)
        };
      },

      unloadModel(modelID: string): void {
        // Mock model unloading
      }
    };
  }

  private async initializeProximityEngine(): Promise<void> {
    this.proximityEngine = {
      setUserPosition(position: { x: number; y: number; z: number; floor: string }): void {
        this.currentUserPosition = position;
      },

      calculateDistance(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): number {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = pos1.z - pos2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
      },

      getPOIsInRange(userPosition: { x: number; y: number; z: number; floor: string }, range: number): string[] {
        const poisInRange: string[] = [];
        
        for (const [poiID, poi] of this.poiMultimedia) {
          if (poi.location.floor === userPosition.floor) {
            const distance = this.proximityEngine.calculateDistance(userPosition, poi.location);
            if (distance <= range) {
              poisInRange.push(poiID);
            }
          }
        }
        
        return poisInRange;
      }
    };
  }

  private async loadPOIMultimediaData(): Promise<void> {
    // Mock POI data loading
    const mockPOIs = [
      {
        poiID: 'poi_cafe_barista_007',
        name: { 'en': 'Barista Café', 'ar': 'مقهى باريستا', 'fr': 'Café Barista' },
        category: 'cafe',
        description: { 'en': 'Premium coffee & pastries near Gate A1', 'ar': 'قهوة فاخرة ومعجنات بالقرب من البوابة A1' },
        location: { x: 12.34, y: 5.67, z: 0.0, floor: '2', zone: 'A' },
        rating: { average: 4.5, count: 237, breakdown: { 5: 150, 4: 60, 3: 20, 2: 5, 1: 2 } },
        operatingHours: {
          'Monday': { open: '06:00', close: '22:00' },
          'Tuesday': { open: '06:00', close: '22:00' },
          'Wednesday': { open: '06:00', close: '22:00' },
          'Thursday': { open: '06:00', close: '22:00' },
          'Friday': { open: '06:00', close: '22:00' },
          'Saturday': { open: '07:00', close: '21:00' },
          'Sunday': { open: '07:00', close: '21:00' }
        },
        images: [
          {
            assetID: 'img_cafe_001',
            type: 'image' as const,
            url: 'https://cdn.airport.com/poi/cafe_barista_007/img1.jpg',
            metadata: {
              width: 800,
              height: 600,
              fileSize: 245760,
              format: 'JPEG',
              quality: 'high' as const,
              lastModified: '2025-01-27T00:00:00Z',
              checksum: 'sha256_hash_example'
            }
          }
        ],
        videos: [
          {
            assetID: 'vid_cafe_001',
            type: 'video' as const,
            url: 'https://cdn.airport.com/poi/cafe_barista_007/preview.mp4',
            metadata: {
              width: 1920,
              height: 1080,
              duration: 15,
              fileSize: 2048000,
              format: 'MP4',
              quality: 'high' as const,
              lastModified: '2025-01-27T00:00:00Z',
              checksum: 'sha256_hash_example'
            }
          }
        ],
        model3D: {
          modelID: 'model_cafe_icon',
          lodVersions: {
            high: {
              assetID: 'model_cafe_high',
              type: 'model3d' as const,
              url: 'https://cdn.airport.com/models/cafe_high.glb',
              metadata: {
                fileSize: 2048000,
                format: 'GLTF',
                quality: 'high' as const,
                lastModified: '2025-01-27T00:00:00Z',
                checksum: 'sha256_hash_example'
              }
            },
            medium: {
              assetID: 'model_cafe_med',
              type: 'model3d' as const,
              url: 'https://cdn.airport.com/models/cafe_med.glb',
              metadata: {
                fileSize: 819200,
                format: 'GLTF',
                quality: 'medium' as const,
                lastModified: '2025-01-27T00:00:00Z',
                checksum: 'sha256_hash_example'
              }
            },
            low: {
              assetID: 'model_cafe_low',
              type: 'model3d' as const,
              url: 'https://cdn.airport.com/models/cafe_low.glb',
              metadata: {
                fileSize: 204800,
                format: 'GLTF',
                quality: 'low' as const,
                lastModified: '2025-01-27T00:00:00Z',
                checksum: 'sha256_hash_example'
              }
            }
          },
          boundingBox: { width: 0.3, height: 0.3, depth: 0.3 },
          renderingSettings: {
            scale: 1.0,
            rotation: { x: 0, y: 0, z: 0 },
            materialType: 'pbr',
            castShadows: true,
            receiveShadows: true
          }
        },
        offers: [
          {
            offerID: 'offer_cafe_001',
            title: { 'en': '10% off any latte after 14:00', 'ar': 'خصم 10% على أي لاتيه بعد الساعة 14:00' },
            description: { 'en': 'Valid for afternoon coffee lovers', 'ar': 'صالح لعشاق القهوة بعد الظهر' },
            discountPercent: 10,
            validFrom: '2025-01-27T14:00:00Z',
            validUntil: '2025-12-31T23:59:59Z',
            restrictions: ['Afternoon only', 'Latte drinks only'],
            applicableServices: ['latte', 'cappuccino'],
            priority: 1
          }
        ],
        accessibility: {
          wheelchairAccessible: true,
          brailleSignage: true,
          audioDescription: true,
          visualAlerts: false,
          hearingLoop: false,
          accessibilityNotes: { 'en': 'Wheelchair accessible entrance and seating', 'ar': 'مدخل ومقاعد يمكن الوصول إليها بالكرسي المتحرك' }
        },
        socialData: {
          checkInCount: 1250,
          lastCheckIn: '2025-01-27T15:30:00Z',
          popularTimes: { 8: 20, 9: 40, 10: 35, 11: 30, 12: 45, 13: 50, 14: 60, 15: 55, 16: 40, 17: 25, 18: 15 }
        }
      }
    ];

    for (const poi of mockPOIs) {
      this.poiMultimedia.set(poi.poiID, poi as POIMultimedia);
      
      // Initialize proximity threshold for each POI
      this.proximityThresholds.set(poi.poiID, {
        poiID: poi.poiID,
        showThreshold: 50, // meters
        hideThreshold: 75, // meters
        lastProximityCheck: 0,
        isUserInRange: false
      });
    }

    this.logger.info(`Loaded ${mockPOIs.length} POI multimedia definitions`);
  }

  private async initializeAssetCache(): Promise<void> {
    // Initialize asset cache with LRU eviction policy
    this.logger.debug('Initializing asset cache with 200MB capacity');
  }

  private startPerformanceMonitoring(): void {
    setInterval(() => {
      const currentTime = Date.now();
      if (currentTime - this.lastPerformanceCheck > 5000) { // Every 5 seconds
        this.renderFrameRate = this.arRenderer.getCurrentFrameRate();
        this.optimizeLODBasedOnPerformance();
        this.lastPerformanceCheck = currentTime;
      }
    }, 1000);
  }

  private startProximityChecking(): void {
    setInterval(() => {
      if (this.currentUserPosition) {
        this.checkPOIProximity();
      }
    }, 1000); // Check every second
  }

  private async checkPOIProximity(): Promise<void> {
    if (!this.currentUserPosition) return;

    const poisInRange = this.proximityEngine.getPOIsInRange(this.currentUserPosition, 100);
    
    // Show overlays for POIs in range
    for (const poiID of poisInRange) {
      if (!this.visiblePOIs.has(poiID)) {
        await this.showPOIOverlay(poiID);
      }
    }

    // Hide overlays for POIs out of range
    for (const poiID of this.visiblePOIs) {
      if (!poisInRange.includes(poiID)) {
        await this.hidePOIOverlay(poiID);
      }
    }
  }

  private optimizeLODBasedOnPerformance(): void {
    if (this.renderFrameRate < 25) {
      // Switch to lower LOD if performance drops
      for (const [anchorID, anchor] of this.overlayAnchors) {
        if (anchor.lodLevel === 'high') {
          anchor.lodLevel = 'medium';
          this.updateAnchorLOD(anchorID, 'medium');
        } else if (anchor.lodLevel === 'medium') {
          anchor.lodLevel = 'low';
          this.updateAnchorLOD(anchorID, 'low');
        }
      }
      this.logger.warn(`Performance optimization: Reduced LOD due to low framerate (${this.renderFrameRate.toFixed(1)} fps)`);
    }
  }

  private async updateAnchorLOD(anchorID: string, newLOD: 'high' | 'medium' | 'low'): Promise<void> {
    const anchor = this.overlayAnchors.get(anchorID);
    if (!anchor) return;

    const poi = this.poiMultimedia.get(anchor.poiID);
    if (!poi) return;

    try {
      const modelAsset = poi.model3D.lodVersions[newLOD];
      await this.arRenderer.attachModel(anchorID, modelAsset, anchor.scale.x);
      anchor.lodLevel = newLOD;
    } catch (error) {
      this.logger.error(`Failed to update LOD for anchor ${anchorID}:`, error);
    }
  }

  private async cacheAsset(asset: POIAsset): Promise<void> {
    if (this.assetCache.has(asset.assetID)) {
      this.cacheStatistics.hitRate = (this.cacheStatistics.hitRate * this.cacheStatistics.itemCount + 1) / (this.cacheStatistics.itemCount + 1);
      return;
    }

    // Check cache capacity
    if (this.cacheStatistics.totalSize + asset.metadata.fileSize > this.cacheStatistics.availableSize) {
      await this.evictCacheItems(asset.metadata.fileSize);
    }

    try {
      // Mock asset download and caching
      const downloadTime = asset.metadata.fileSize / (1024 * 500); // Simulate download speed
      await new Promise(resolve => setTimeout(resolve, Math.min(downloadTime, 5000)));

      asset.localPath = `/cache/${asset.assetID}`;
      asset.cacheExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

      this.assetCache.set(asset.assetID, asset);
      this.cacheStatistics.totalSize += asset.metadata.fileSize;
      this.cacheStatistics.itemCount++;

      this.logger.debug(`Cached asset ${asset.assetID} (${asset.metadata.fileSize} bytes)`);

    } catch (error) {
      this.logger.error(`Failed to cache asset ${asset.assetID}:`, error);
    }
  }

  private async evictCacheItems(requiredSpace: number): Promise<void> {
    const sortedAssets = Array.from(this.assetCache.entries())
      .sort(([, a], [, b]) => {
        const aExpiry = new Date(a.cacheExpiry || 0).getTime();
        const bExpiry = new Date(b.cacheExpiry || 0).getTime();
        return aExpiry - bExpiry; // Oldest first
      });

    let freedSpace = 0;
    for (const [assetID, asset] of sortedAssets) {
      if (freedSpace >= requiredSpace) break;

      this.assetCache.delete(assetID);
      this.cacheStatistics.totalSize -= asset.metadata.fileSize;
      this.cacheStatistics.itemCount--;
      this.cacheStatistics.evictionCount++;
      freedSpace += asset.metadata.fileSize;

      this.logger.debug(`Evicted asset ${assetID} (${asset.metadata.fileSize} bytes)`);
    }
  }

  public async showPOIOverlay(poiID: string): Promise<string> {
    try {
      const poi = this.poiMultimedia.get(poiID);
      if (!poi) {
        throw new Error(`POI not found: ${poiID}`);
      }

      // Create AR anchor
      const anchorID = await this.arRenderer.createAnchor(poi.location);
      
      // Determine optimal LOD based on performance
      let lodLevel: 'high' | 'medium' | 'low' = 'high';
      if (this.renderFrameRate < 30) lodLevel = 'medium';
      if (this.renderFrameRate < 20) lodLevel = 'low';

      // Cache and attach 3D model
      const modelAsset = poi.model3D.lodVersions[lodLevel];
      await this.cacheAsset(modelAsset);
      await this.arRenderer.attachModel(anchorID, modelAsset, 1.0);

      // Create overlay anchor record
      const overlayAnchor: OverlayAnchor = {
        anchorID,
        poiID,
        position: poi.location,
        orientation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
        isVisible: true,
        lodLevel,
        lastUpdate: Date.now()
      };

      this.overlayAnchors.set(anchorID, overlayAnchor);
      this.visiblePOIs.add(poiID);

      this.logger.info(`Displayed overlay for POI ${poiID} with anchor ${anchorID}`);
      return anchorID;

    } catch (error) {
      this.logger.error(`Failed to show POI overlay for ${poiID}:`, error);
      throw error;
    }
  }

  public async hidePOIOverlay(poiID: string): Promise<void> {
    try {
      const anchorToRemove = Array.from(this.overlayAnchors.entries())
        .find(([, anchor]) => anchor.poiID === poiID);

      if (anchorToRemove) {
        const [anchorID, anchor] = anchorToRemove;
        
        this.arRenderer.removeAnchor(anchorID);
        this.overlayAnchors.delete(anchorID);
        
        // Remove any associated overlay card
        const cardToRemove = Array.from(this.overlayCards.entries())
          .find(([, card]) => card.poiID === poiID);
        
        if (cardToRemove) {
          this.overlayCards.delete(cardToRemove[0]);
        }
      }

      this.visiblePOIs.delete(poiID);
      this.logger.info(`Hidden overlay for POI ${poiID}`);

    } catch (error) {
      this.logger.error(`Failed to hide POI overlay for ${poiID}:`, error);
    }
  }

  public async openOverlayCard(anchorID: string): Promise<string> {
    try {
      const anchor = this.overlayAnchors.get(anchorID);
      if (!anchor) {
        throw new Error(`Anchor not found: ${anchorID}`);
      }

      const poi = this.poiMultimedia.get(anchor.poiID);
      if (!poi) {
        throw new Error(`POI not found for anchor: ${anchorID}`);
      }

      // Create overlay card
      const cardID = `card_${anchorID}_${Date.now()}`;
      const overlayCard: OverlayCard = {
        cardID,
        poiID: anchor.poiID,
        isVisible: true,
        position: { x: 0, y: 0 }, // Will be positioned by UI framework
        dimensions: { width: 320, height: 400 },
        zIndex: 1000,
        content: {
          header: {
            title: poi.name['en'] || 'Unknown POI',
            subtitle: poi.category,
            rating: poi.rating.average,
            reviewCount: poi.rating.count
          },
          media: {
            currentImageIndex: 0,
            videoThumbnail: poi.videos.length > 0 ? poi.videos[0].url : undefined,
            isVideoPlaying: false
          },
          description: poi.description['en'] || '',
          offers: poi.offers,
          actions: [
            {
              actionID: 'navigate',
              type: 'navigate',
              label: { 'en': 'Navigate', 'ar': 'التنقل' },
              actionData: { poiID: poi.poiID },
              enabled: true,
              priority: 1
            },
            {
              actionID: 'more_info',
              type: 'more_info',
              label: { 'en': 'More Info', 'ar': 'مزيد من المعلومات' },
              actionData: { poiID: poi.poiID },
              enabled: true,
              priority: 2
            }
          ]
        },
        animations: {
          showAnimation: 'scale',
          hideAnimation: 'fade',
          duration: 200
        }
      };

      // Cache images for the card
      for (const image of poi.images.slice(0, 3)) {
        await this.cacheAsset(image);
      }

      this.overlayCards.set(cardID, overlayCard);
      this.logger.info(`Opened overlay card ${cardID} for POI ${anchor.poiID}`);
      
      return cardID;

    } catch (error) {
      this.logger.error(`Failed to open overlay card for anchor ${anchorID}:`, error);
      throw error;
    }
  }

  public closeOverlayCard(cardID: string): void {
    try {
      const card = this.overlayCards.get(cardID);
      if (card) {
        // Stop any playing video
        const videoPlayer = Array.from(this.mediaPlayers.values())
          .find(player => player.asset.url.includes(card.poiID));
        
        if (videoPlayer && videoPlayer.state === 'playing') {
          this.mediaPlayerEngine.stop(videoPlayer.playerID);
        }

        this.overlayCards.delete(cardID);
        this.logger.info(`Closed overlay card ${cardID}`);
      }
    } catch (error) {
      this.logger.error(`Failed to close overlay card ${cardID}:`, error);
    }
  }

  public async playVideo(cardID: string, videoAssetID: string): Promise<void> {
    try {
      const card = this.overlayCards.get(cardID);
      if (!card) {
        throw new Error(`Card not found: ${cardID}`);
      }

      const poi = this.poiMultimedia.get(card.poiID);
      if (!poi) {
        throw new Error(`POI not found for card: ${cardID}`);
      }

      const videoAsset = poi.videos.find(v => v.assetID === videoAssetID);
      if (!videoAsset) {
        throw new Error(`Video asset not found: ${videoAssetID}`);
      }

      // Cache video if not already cached
      await this.cacheAsset(videoAsset);

      // Create and configure media player
      const playerID = `player_${cardID}_${videoAssetID}`;
      await this.mediaPlayerEngine.createPlayer(playerID);
      await this.mediaPlayerEngine.loadMedia(playerID, videoAsset);
      await this.mediaPlayerEngine.play(playerID);

      // Update card state
      card.content.media.isVideoPlaying = true;

      this.logger.info(`Started video playback for asset ${videoAssetID} in card ${cardID}`);

    } catch (error) {
      this.logger.error(`Failed to play video ${videoAssetID} in card ${cardID}:`, error);
      throw error;
    }
  }

  public updateUserPosition(position: { x: number; y: number; z: number; floor: string }): void {
    this.currentUserPosition = position;
    this.proximityEngine.setUserPosition(position);
  }

  public getVisiblePOIs(): POIMultimedia[] {
    return Array.from(this.visiblePOIs)
      .map(poiID => this.poiMultimedia.get(poiID))
      .filter(poi => poi !== undefined) as POIMultimedia[];
  }

  public getOverlayCard(cardID: string): OverlayCard | null {
    return this.overlayCards.get(cardID) || null;
  }

  public getCacheStatistics(): CacheStatistics {
    return { ...this.cacheStatistics };
  }

  public getAnalytics(): any {
    const visibleOverlaysCount = this.overlayAnchors.size;
    const openCardsCount = this.overlayCards.size;
    const activeVideoPlayers = Array.from(this.mediaPlayers.values())
      .filter(player => player.state === 'playing').length;

    return {
      service: 'POIMultimediaOverlayService',
      status: this.isInitialized ? 'active' : 'initializing',
      metrics: {
        visibleOverlays: visibleOverlaysCount,
        openCards: openCardsCount,
        activeVideoPlayers,
        frameRate: this.renderFrameRate,
        cacheHitRate: this.cacheStatistics.hitRate,
        cacheSize: this.cacheStatistics.totalSize,
        cacheItemCount: this.cacheStatistics.itemCount
      },
      performance: {
        averageFrameRate: this.renderFrameRate,
        gpuMemoryUsage: this.arRenderer?.getGPUMemoryUsage() || 0,
        lastPerformanceCheck: this.lastPerformanceCheck
      },
      errors: {
        cacheEvictions: this.cacheStatistics.evictionCount,
        failedLoads: 0 // Could be tracked
      }
    };
  }

  public async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    const details: any = {
      initialized: this.isInitialized,
      arRenderer: !!this.arRenderer,
      mediaPlayerEngine: !!this.mediaPlayerEngine,
      model3DLoader: !!this.model3DLoader,
      proximityEngine: !!this.proximityEngine,
      frameRate: this.renderFrameRate,
      cacheHealth: this.cacheStatistics.totalSize < this.cacheStatistics.availableSize * 0.9,
      activeOverlays: this.overlayAnchors.size,
      activeCards: this.overlayCards.size
    };

    const healthy = this.isInitialized && 
                   !!this.arRenderer && 
                   !!this.mediaPlayerEngine &&
                   this.renderFrameRate > 15 &&
                   details.cacheHealth;

    return { healthy, details };
  }

  public async cleanup(): Promise<void> {
    try {
      this.logger.info('Cleaning up POI Multimedia Overlay Service');

      // Stop all video players
      for (const [playerID] of this.mediaPlayers) {
        await this.mediaPlayerEngine.stop(playerID);
      }
      this.mediaPlayers.clear();

      // Remove all AR anchors
      for (const [anchorID] of this.overlayAnchors) {
        this.arRenderer.removeAnchor(anchorID);
      }
      this.overlayAnchors.clear();

      // Close all overlay cards
      this.overlayCards.clear();

      // Clear caches
      this.assetCache.clear();
      this.visiblePOIs.clear();
      this.loadingQueue.clear();

      this.isInitialized = false;
      this.logger.info('POI Multimedia Overlay Service cleanup completed');

    } catch (error) {
      this.logger.error('Error during cleanup:', error);
      throw error;
    }
  }
} 