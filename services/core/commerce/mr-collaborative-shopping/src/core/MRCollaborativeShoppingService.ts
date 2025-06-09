import { AppError, ErrorCode } from '../../../ai-concierge/src/shared/errors/index';
import { createLogger } from '@aerofusionxr/shared';
import { PerformanceMonitor } from '@aerofusionxr/shared';
import { SecurityService } from '../security/SecurityService';
import { ARVRBridgeService, Product, ProductFilters } from '../../../ar-vr-bridge/src/core/ARVRBridgeService';

// MR Collaborative Shopping interfaces
export interface CollabSessionConfig {
  sessionId: string;
  travelerID: string;
  productID: string;
  maxUsers: number;
  performanceProfile: CollabPerformanceProfile;
  rtcConfig: RTCConfiguration;
}

export interface CollabPerformanceProfile {
  modelLOD: 'low' | 'medium' | 'high';
  syncFrameRate: number;
  videoBandwidth: number;
  audioBandwidth: number;
}

export interface RTCConfiguration {
  stunServers: string[];
  turnServers: RTCTurnServer[];
  bandwidth: RTCBandwidthConfig;
}

export interface RTCTurnServer {
  url: string;
  username: string;
  credential: string;
}

export interface RTCBandwidthConfig {
  audio: number;
  video: number;
  data: number;
}

export interface CollabSession {
  sessionId: string;
  roomToken: string;
  productId: string;
  participants: CollabParticipant[];
  sharedModel: Shared3DModel;
  annotations: Map<string, Annotation>;
  status: 'initializing' | 'active' | 'ended';
  createdAt: Date;
  lastActivity: Date;
}

export interface CollabParticipant {
  role: 'traveler' | 'ambassador';
  userId: string;
  displayName: string;
  isConnected: boolean;
  lastSeen: Date;
  deviceCapabilities: DeviceCapabilities;
}

export interface DeviceCapabilities {
  supportsVideo: boolean;
  supportsAudio: boolean;
  supports3D: boolean;
  gpuTier: 'low' | 'medium' | 'high';
  networkSpeed: 'slow' | 'moderate' | 'fast';
}

export interface Shared3DModel {
  modelId: string;
  productId: string;
  lodLevel: string;
  url: string;
  position: Position3D;
  orientation: Orientation3D;
  scale: number;
  materials: ModelMaterial[];
}

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface Orientation3D {
  rotX: number;
  rotY: number;
  rotZ: number;
}

export interface ModelMaterial {
  materialId: string;
  diffuseMap: string;
  normalMap?: string;
  roughnessMap?: string;
}

export interface Annotation {
  annotationId: string;
  authorId: string;
  position: Position3D;
  color: string;
  type: 'highlight' | 'arrow' | 'text' | 'measurement';
  content?: string;
  timestamp: Date;
}

export interface ModelTransform {
  sessionId: string;
  userId: string;
  position: Position3D;
  orientation: Orientation3D;
  scale: number;
  timestamp: Date;
}

export interface PoseUpdate {
  sessionId: string;
  userId: string;
  headPosition: Position3D;
  headOrientation: Orientation3D;
  controllerPositions: Position3D[];
  timestamp: Date;
}

export interface InventoryStatus {
  productId: string;
  variant: string;
  stock: number;
  location: string;
  lastUpdated: Date;
}

export interface ChatMessage {
  messageId: string;
  senderId: string;
  type: 'text' | 'voice' | 'system';
  content: string;
  timestamp: Date;
}

export interface PurchaseRequest {
  sessionId: string;
  userId: string;
  productId: string;
  variant: string;
  quantity: number;
  paymentMethod: string;
}

export interface PurchaseResult {
  success: boolean;
  orderId?: string;
  error?: string;
  estimatedDelivery?: Date;
}

// MR Collaborative Shopping error types
export class CollabSessionError extends AppError {
  readonly statusCode = 422;
  readonly errorCode = ErrorCode.BUSINESS_RULE_VIOLATION;
  readonly isOperational = true;

  constructor(message: string, context: any) {
    super(message, context);
  }
}

export class CollabSyncError extends AppError {
  readonly statusCode = 503;
  readonly errorCode = ErrorCode.SERVICE_UNAVAILABLE;
  readonly isOperational = true;

  constructor(message: string, context: any) {
    super(message, context);
  }
}

export class CollabConnectionError extends AppError {
  readonly statusCode = 503;
  readonly errorCode = ErrorCode.SERVICE_UNAVAILABLE;
  readonly isOperational = true;

  constructor(message: string, context: any) {
    super(message, context);
  }
}

/**
 * MR Collaborative Shopping Service
 * Enables synchronized mixed-reality shopping sessions between travelers and brand ambassadors
 */
export class MRCollaborativeShoppingService {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private securityService: SecurityService;
  private bridgeService: ARVRBridgeService;
  private activeSessions: Map<string, CollabSession>;
  private rtcConnections: Map<string, any>; // WebRTC connections
  private modelCache: Map<string, Shared3DModel>;

  constructor() {
    this.logger = new Logger('MRCollaborativeShoppingService');
    this.performanceMonitor = new PerformanceMonitor();
    this.securityService = new SecurityService();
    this.bridgeService = new ARVRBridgeService();
    this.activeSessions = new Map();
    this.rtcConnections = new Map();
    this.modelCache = new Map();
  }

  /**
   * Initiate collaborative shopping session
   */
  async initiateCollabSession(config: CollabSessionConfig): Promise<CollabSession> {
    const startTime = Date.now();

    try {
      this.logger.info('Initiating collaborative shopping session', {
        sessionId: config.sessionId,
        travelerID: config.travelerID,
        productID: config.productID
      });

      // Validate session configuration
      await this.validateSessionConfig(config);

      // Get product information
      const product = await this.getProductInfo(config.productID);
      
      // Create shared 3D model
      const sharedModel = await this.createShared3DModel(product, config.performanceProfile);

      // Generate room token for RTC
      const roomToken = await this.generateRoomToken(config.sessionId);

      // Create collaborative session
      const session: CollabSession = {
        sessionId: config.sessionId,
        roomToken,
        productId: config.productID,
        participants: [
          {
            role: 'traveler',
            userId: config.travelerID,
            displayName: 'Traveler',
            isConnected: false,
            lastSeen: new Date(),
            deviceCapabilities: {
              supportsVideo: true,
              supportsAudio: true,
              supports3D: true,
              gpuTier: 'medium',
              networkSpeed: 'moderate'
            }
          }
        ],
        sharedModel,
        annotations: new Map(),
        status: 'initializing',
        createdAt: new Date(),
        lastActivity: new Date()
      };

      this.activeSessions.set(config.sessionId, session);

      // Initialize RTC connection
      await this.initializeRTCConnection(session, config.rtcConfig);

      session.status = 'active';

      const initTime = Date.now() - startTime;
      await this.performanceMonitor.recordMetric('mr_collab_session_init_time', initTime);

      this.logger.info('Collaborative shopping session initiated successfully', {
        sessionId: config.sessionId,
        initTime
      });

      return session;

    } catch (error) {
      this.logger.error('Failed to initiate collaborative session', {
        sessionId: config.sessionId,
        error: error.message
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new CollabSessionError('Collaborative session initiation failed', {
        sessionId: config.sessionId,
        originalError: error.message
      });
    }
  }

  /**
   * Add ambassador to session
   */
  async addAmbassadorToSession(sessionId: string, ambassadorId: string): Promise<void> {
    try {
      this.logger.debug('Adding ambassador to session', { sessionId, ambassadorId });

      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new CollabSessionError('Session not found', { sessionId });
      }

      // Check capacity
      if (session.participants.length >= 2) {
        throw new CollabSessionError('Session at maximum capacity', { sessionId });
      }

      // Add ambassador participant
      const ambassador: CollabParticipant = {
        role: 'ambassador',
        userId: ambassadorId,
        displayName: 'Brand Ambassador',
        isConnected: false,
        lastSeen: new Date(),
        deviceCapabilities: {
          supportsVideo: true,
          supportsAudio: true,
          supports3D: true,
          gpuTier: 'high',
          networkSpeed: 'fast'
        }
      };

      session.participants.push(ambassador);
      session.lastActivity = new Date();

      // Connect ambassador to RTC
      await this.connectParticipantToRTC(session, ambassador);

      this.logger.info('Ambassador added to session successfully', {
        sessionId,
        ambassadorId
      });

    } catch (error) {
      this.logger.error('Failed to add ambassador to session', {
        sessionId,
        ambassadorId,
        error: error.message
      });

      throw new CollabSessionError('Ambassador connection failed', {
        sessionId,
        ambassadorId,
        originalError: error.message
      });
    }
  }

  /**
   * Sync model transformation
   */
  async syncModelTransform(transform: ModelTransform): Promise<void> {
    try {
      const session = this.activeSessions.get(transform.sessionId);
      if (!session) {
        throw new CollabSessionError('Session not found', { sessionId: transform.sessionId });
      }

      // Update shared model
      session.sharedModel.position = transform.position;
      session.sharedModel.orientation = transform.orientation;
      session.sharedModel.scale = transform.scale;
      session.lastActivity = new Date();

      // Broadcast to other participants
      await this.broadcastModelTransform(session, transform);

      await this.performanceMonitor.recordMetric('mr_collab_model_sync', 1, {
        sessionId: transform.sessionId,
        userId: transform.userId
      });

    } catch (error) {
      this.logger.error('Failed to sync model transform', {
        sessionId: transform.sessionId,
        error: error.message
      });

      throw new CollabSyncError('Model synchronization failed', {
        sessionId: transform.sessionId,
        originalError: error.message
      });
    }
  }

  /**
   * Add annotation to shared model
   */
  async addAnnotation(sessionId: string, annotation: Annotation): Promise<void> {
    try {
      this.logger.debug('Adding annotation', { sessionId, annotationId: annotation.annotationId });

      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new CollabSessionError('Session not found', { sessionId });
      }

      // Store annotation
      session.annotations.set(annotation.annotationId, annotation);
      session.lastActivity = new Date();

      // Broadcast to participants
      await this.broadcastAnnotation(session, annotation);

      await this.performanceMonitor.recordMetric('mr_collab_annotation_added', 1, {
        sessionId,
        authorId: annotation.authorId
      });

    } catch (error) {
      this.logger.error('Failed to add annotation', {
        sessionId,
        annotationId: annotation.annotationId,
        error: error.message
      });

      throw new CollabSyncError('Annotation sync failed', {
        sessionId,
        originalError: error.message
      });
    }
  }

  /**
   * Remove annotation from shared model
   */
  async removeAnnotation(sessionId: string, annotationId: string): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new CollabSessionError('Session not found', { sessionId });
      }

      // Remove annotation
      session.annotations.delete(annotationId);
      session.lastActivity = new Date();

      // Broadcast removal to participants
      await this.broadcastAnnotationRemoval(session, annotationId);

    } catch (error) {
      this.logger.error('Failed to remove annotation', {
        sessionId,
        annotationId,
        error: error.message
      });

      throw new CollabSyncError('Annotation removal failed', {
        sessionId,
        originalError: error.message
      });
    }
  }

  /**
   * Check inventory status
   */
  async checkInventoryStatus(sessionId: string, productId: string, variant: string): Promise<InventoryStatus> {
    try {
      this.logger.debug('Checking inventory status', { sessionId, productId, variant });

      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new CollabSessionError('Session not found', { sessionId });
      }

      // Query inventory service (mock implementation)
      const inventoryStatus: InventoryStatus = {
        productId,
        variant,
        stock: Math.floor(Math.random() * 10), // Mock stock level
        location: 'Warehouse A1',
        lastUpdated: new Date()
      };

      // Broadcast inventory update to participants
      await this.broadcastInventoryUpdate(session, inventoryStatus);

      await this.performanceMonitor.recordMetric('mr_collab_inventory_check', 1, {
        sessionId,
        productId
      });

      return inventoryStatus;

    } catch (error) {
      this.logger.error('Failed to check inventory status', {
        sessionId,
        productId,
        variant,
        error: error.message
      });

      throw new CollabSessionError('Inventory check failed', {
        sessionId,
        originalError: error.message
      });
    }
  }

  /**
   * Process purchase request
   */
  async processPurchase(purchaseRequest: PurchaseRequest): Promise<PurchaseResult> {
    try {
      this.logger.info('Processing purchase request', {
        sessionId: purchaseRequest.sessionId,
        productId: purchaseRequest.productId,
        quantity: purchaseRequest.quantity
      });

      const session = this.activeSessions.get(purchaseRequest.sessionId);
      if (!session) {
        throw new CollabSessionError('Session not found', { sessionId: purchaseRequest.sessionId });
      }

      // Process payment through bridge service
      const paymentResult = await this.bridgeService.processPayment({
        userId: purchaseRequest.userId,
        amount: 100, // Mock amount
        currency: 'USD',
        description: `Purchase from collaborative shopping session`,
        paymentMethod: 'biometric',
        context: {
          source: 'mr_collaborative_shopping',
          itemId: purchaseRequest.productId,
          sessionId: purchaseRequest.sessionId
        }
      });

      const purchaseResult: PurchaseResult = {
        success: paymentResult.status === 'success',
        orderId: paymentResult.transactionId,
        estimatedDelivery: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };

      if (!purchaseResult.success) {
        purchaseResult.error = 'Payment processing failed';
      }

      // Broadcast purchase result to participants
      await this.broadcastPurchaseResult(session, purchaseResult);

      await this.performanceMonitor.recordMetric('mr_collab_purchase_processed', 1, {
        sessionId: purchaseRequest.sessionId,
        success: purchaseResult.success
      });

      return purchaseResult;

    } catch (error) {
      this.logger.error('Failed to process purchase', {
        sessionId: purchaseRequest.sessionId,
        error: error.message
      });

      throw new CollabSessionError('Purchase processing failed', {
        sessionId: purchaseRequest.sessionId,
        originalError: error.message
      });
    }
  }

  /**
   * Send chat message
   */
  async sendChatMessage(sessionId: string, message: ChatMessage): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new CollabSessionError('Session not found', { sessionId });
      }

      // Broadcast message to participants
      await this.broadcastChatMessage(session, message);
      session.lastActivity = new Date();

    } catch (error) {
      this.logger.error('Failed to send chat message', {
        sessionId,
        messageId: message.messageId,
        error: error.message
      });

      throw new CollabSyncError('Chat message failed', {
        sessionId,
        originalError: error.message
      });
    }
  }

  /**
   * End collaborative session
   */
  async endCollabSession(sessionId: string): Promise<void> {
    try {
      this.logger.info('Ending collaborative shopping session', { sessionId });

      const session = this.activeSessions.get(sessionId);
      if (!session) {
        this.logger.warn('Attempted to end non-existent session', { sessionId });
        return;
      }

      // Cleanup RTC connections
      await this.cleanupRTCConnections(sessionId);

      // Update session status
      session.status = 'ended';

      // Remove from active sessions
      this.activeSessions.delete(sessionId);

      this.logger.info('Collaborative shopping session ended successfully', { sessionId });

    } catch (error) {
      this.logger.error('Failed to end collaborative session', {
        sessionId,
        error: error.message
      });

      throw new CollabSessionError('Session termination failed', {
        sessionId,
        originalError: error.message
      });
    }
  }

  // Private helper methods
  private async validateSessionConfig(config: CollabSessionConfig): Promise<void> {
    if (!config.sessionId || !config.travelerID || !config.productID) {
      throw new CollabSessionError('Invalid session configuration', {
        hasSessionId: !!config.sessionId,
        hasTravelerID: !!config.travelerID,
        hasProductID: !!config.productID
      });
    }
  }

  private async getProductInfo(productId: string): Promise<Product> {
    const filters: ProductFilters = {};
    const products = await this.bridgeService.getProductCatalog(filters);
    const product = products.find(p => p.productId === productId);
    
    if (!product) {
      throw new CollabSessionError('Product not found', { productId });
    }
    
    return product;
  }

  private async createShared3DModel(product: Product, profile: CollabPerformanceProfile): Promise<Shared3DModel> {
    return {
      modelId: `model_${product.productId}`,
      productId: product.productId,
      lodLevel: profile.modelLOD,
      url: product.model3DUrl || `https://cdn.example.com/models/${product.productId}_${profile.modelLOD}.glb`,
      position: { x: 0, y: 0, z: 0 },
      orientation: { rotX: 0, rotY: 0, rotZ: 0 },
      scale: 1.0,
      materials: []
    };
  }

  private async generateRoomToken(sessionId: string): Promise<string> {
    // Mock room token generation
    return `room_token_${sessionId}_${Date.now()}`;
  }

  private async initializeRTCConnection(session: CollabSession, rtcConfig: RTCConfiguration): Promise<void> {
    // Mock RTC initialization
    this.logger.debug('Initializing RTC connection', {
      sessionId: session.sessionId,
      roomToken: session.roomToken
    });
  }

  private async connectParticipantToRTC(session: CollabSession, participant: CollabParticipant): Promise<void> {
    // Mock participant RTC connection
    participant.isConnected = true;
    this.logger.debug('Participant connected to RTC', {
      sessionId: session.sessionId,
      userId: participant.userId,
      role: participant.role
    });
  }

  private async broadcastModelTransform(session: CollabSession, transform: ModelTransform): Promise<void> {
    // Mock broadcast to all participants
    this.logger.debug('Broadcasting model transform', {
      sessionId: session.sessionId,
      userId: transform.userId
    });
  }

  private async broadcastAnnotation(session: CollabSession, annotation: Annotation): Promise<void> {
    // Mock broadcast annotation
    this.logger.debug('Broadcasting annotation', {
      sessionId: session.sessionId,
      annotationId: annotation.annotationId
    });
  }

  private async broadcastAnnotationRemoval(session: CollabSession, annotationId: string): Promise<void> {
    // Mock broadcast annotation removal
    this.logger.debug('Broadcasting annotation removal', {
      sessionId: session.sessionId,
      annotationId
    });
  }

  private async broadcastInventoryUpdate(session: CollabSession, inventory: InventoryStatus): Promise<void> {
    // Mock broadcast inventory update
    this.logger.debug('Broadcasting inventory update', {
      sessionId: session.sessionId,
      productId: inventory.productId,
      stock: inventory.stock
    });
  }

  private async broadcastPurchaseResult(session: CollabSession, result: PurchaseResult): Promise<void> {
    // Mock broadcast purchase result
    this.logger.debug('Broadcasting purchase result', {
      sessionId: session.sessionId,
      success: result.success,
      orderId: result.orderId
    });
  }

  private async broadcastChatMessage(session: CollabSession, message: ChatMessage): Promise<void> {
    // Mock broadcast chat message
    this.logger.debug('Broadcasting chat message', {
      sessionId: session.sessionId,
      messageId: message.messageId,
      type: message.type
    });
  }

  private async cleanupRTCConnections(sessionId: string): Promise<void> {
    // Mock RTC cleanup
    this.rtcConnections.delete(sessionId);
    this.logger.debug('Cleaned up RTC connections', { sessionId });
  }
} 
