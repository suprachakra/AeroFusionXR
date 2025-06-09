import { AppError, ErrorCode } from '../../../ai-concierge/src/shared/errors/index';
import { createLogger } from '@aerofusionxr/shared';
import { PerformanceMonitor } from '@aerofusionxr/shared';
import { SecurityService } from '../security/SecurityService';
import { ARVRBridgeService, UserProfile, FlightContext, Product, ProductFilters } from '../../../ar-vr-bridge/src/core/ARVRBridgeService';

// MR Concierge interfaces
export interface MRSessionConfig {
  sessionId: string;
  deviceCapabilities: MRDeviceCapabilities;
  featureFlags: MRFeatureFlags;
  performanceProfile: MRPerformanceProfile;
  kioskAnchorID: string;
  locale?: string;
}

export interface MRDeviceCapabilities {
  supportsHolographicDisplay: boolean;
  supportsSpatialAudio: boolean;
  supportsFaceTracking: boolean;
  supportsGestures: boolean;
  processingPower: 'low' | 'medium' | 'high';
  batteryLevel: number;
}

export interface MRFeatureFlags {
  enableFaceMatch: boolean;
  enableVoiceCommands: boolean;
  enableMultiLanguage: boolean;
  enablePromoDisplay: boolean;
  enableWayfinding: boolean;
}

export interface MRPerformanceProfile {
  avatarQuality: 'low' | 'medium' | 'high';
  maxConcurrentHolograms: number;
  audioQuality: 'standard' | 'enhanced';
}

export interface HologramAvatar {
  avatarId: string;
  model: string;
  position: { x: number; y: number; z: number };
  scale: number;
  animations: Map<string, string>;
  currentAnimation: string;
}

export interface FaceMatchResult {
  success: boolean;
  confidence: number;
  userId?: string;
  profile?: UserProfile;
}

export interface NLPQuery {
  queryId: string;
  text: string;
  intent: string;
  entities: Record<string, any>;
  confidence: number;
}

export interface NLPResponse {
  responseId: string;
  text: string;
  intent: string;
  actions: ConversationAction[];
  followUpQuestions?: string[];
}

export interface ConversationAction {
  type: 'display_info' | 'show_directions' | 'display_promotions' | 'transfer_human';
  data: Record<string, any>;
}

export interface PromoProduct {
  productId: string;
  name: string;
  price: number;
  currency: string;
  model3DUrl: string;
  stockLevel: number;
  category: string;
}

export interface MRSession {
  sessionId: string;
  userId?: string;
  status: 'initializing' | 'face_matching' | 'active' | 'ended';
  createdAt: Date;
  lastActivity: Date;
  avatar: HologramAvatar;
  currentConversation?: Conversation;
  userProfile?: UserProfile;
  flightContext?: FlightContext;
}

export interface Conversation {
  conversationId: string;
  queries: NLPQuery[];
  responses: NLPResponse[];
  context: ConversationContext;
}

export interface ConversationContext {
  currentIntent: string;
  language: string;
  userPreferences: Record<string, any>;
  flightInfo?: FlightContext;
}

// MR-specific error types
export class MRConciergeError extends AppError {
  readonly statusCode = 422;
  readonly errorCode = ErrorCode.BUSINESS_RULE_VIOLATION;
  readonly isOperational = true;

  constructor(message: string, context: any) {
    super(message, context);
  }
}

export class MRFaceMatchError extends AppError {
  readonly statusCode = 401;
  readonly errorCode = ErrorCode.AUTHENTICATION_FAILED;
  readonly isOperational = true;

  constructor(message: string, context: any) {
    super(message, context);
  }
}

export class MRHologramError extends AppError {
  readonly statusCode = 503;
  readonly errorCode = ErrorCode.SERVICE_UNAVAILABLE;
  readonly isOperational = true;

  constructor(message: string, context: any) {
    super(message, context);
  }
}

/**
 * MR Digital Concierge Service
 * Provides interactive holographic concierge functionality with face recognition,
 * natural language processing, and personalized assistance
 */
export class MRConciergeService {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private securityService: SecurityService;
  private bridgeService: ARVRBridgeService;
  private activeSessions: Map<string, MRSession>;
  private avatarAssets: Map<string, any>; // Cached avatar assets

  constructor() {
    this.logger = new Logger('MRConciergeService');
    this.performanceMonitor = new PerformanceMonitor();
    this.securityService = new SecurityService();
    this.bridgeService = new ARVRBridgeService();
    this.activeSessions = new Map();
    this.avatarAssets = new Map();
  }

  /**
   * Initialize MR Concierge Session
   */
  async initializeMRSession(config: MRSessionConfig): Promise<MRSession> {
    const startTime = Date.now();

    try {
      this.logger.info('Initializing MR Concierge session', {
        sessionId: config.sessionId,
        kioskAnchorID: config.kioskAnchorID
      });

      // Validate session configuration
      await this.validateSessionConfig(config);

      // Check device capabilities
      if (!this.isDeviceCapable(config.deviceCapabilities)) {
        throw new MRConciergeError('Device does not meet minimum MR requirements', {
          deviceCapabilities: config.deviceCapabilities,
          sessionId: config.sessionId
        });
      }

      // Create hologram avatar
      const avatar = await this.createHologramAvatar(config);

      // Initialize MR session
      const session: MRSession = {
        sessionId: config.sessionId,
        status: 'initializing',
        createdAt: new Date(),
        lastActivity: new Date(),
        avatar
      };

      // Anchor avatar to kiosk position
      await this.anchorAvatarToKiosk(avatar, config.kioskAnchorID);

      session.status = 'active';
      this.activeSessions.set(config.sessionId, session);

      // Record performance metrics
      const initTime = Date.now() - startTime;
      await this.performanceMonitor.recordMetric('mr_session_init_time', initTime);

      this.logger.info('MR Concierge session initialized successfully', {
        sessionId: config.sessionId,
        initTime
      });

      return session;

    } catch (error) {
      this.logger.error('Failed to initialize MR Concierge session', {
        sessionId: config.sessionId,
        error: error.message
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new MRConciergeError('MR Concierge session initialization failed', {
        sessionId: config.sessionId,
        originalError: error.message
      });
    }
  }

  /**
   * Perform face match verification
   */
  async performFaceMatch(sessionId: string, imageData: string, passengerID?: string): Promise<FaceMatchResult> {
    const startTime = Date.now();

    try {
      this.logger.debug('Performing face match', { sessionId, passengerID });

      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new MRConciergeError('Session not found', { sessionId });
      }

      session.status = 'face_matching';

      // Perform biometric verification
      const faceMatchResult = await this.performBiometricVerification(imageData, passengerID);

      if (faceMatchResult.success && faceMatchResult.userId) {
        // Fetch user profile
        const userProfile = await this.bridgeService.getUserProfile(faceMatchResult.userId);
        session.userProfile = userProfile;
        session.userId = faceMatchResult.userId;

        // Get flight context if available
        try {
          const flightContext = await this.getFlightContextForUser(faceMatchResult.userId);
          session.flightContext = flightContext;
        } catch (error) {
          this.logger.warn('Failed to get flight context', { 
            userId: faceMatchResult.userId, 
            error: error.message 
          });
        }

        // Personalize avatar greeting
        await this.personalizeAvatarGreeting(session);
      }

      session.status = 'active';

      const matchTime = Date.now() - startTime;
      await this.performanceMonitor.recordMetric('mr_face_match_time', matchTime);

      this.logger.info('Face match completed', {
        sessionId,
        success: faceMatchResult.success,
        matchTime
      });

      return faceMatchResult;

    } catch (error) {
      this.logger.error('Face match failed', { sessionId, error: error.message });
      throw new MRFaceMatchError('Face match verification failed', {
        sessionId,
        originalError: error.message
      });
    }
  }

  /**
   * Process natural language query
   */
  async processNLPQuery(sessionId: string, queryText: string): Promise<NLPResponse> {
    try {
      this.logger.debug('Processing NLP query', { sessionId, query: queryText });

      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new MRConciergeError('Session not found', { sessionId });
      }

      // Create NLP query object
      const query: NLPQuery = {
        queryId: `query_${Date.now()}`,
        text: queryText,
        intent: '',
        entities: {},
        confidence: 0
      };

      // Process with NLP service
      const nlpResult = await this.callNLPService(queryText, session);
      query.intent = nlpResult.intent;
      query.entities = nlpResult.entities;
      query.confidence = nlpResult.confidence;

      // Generate response based on intent
      const response = await this.generateResponse(query, session);

      // Store conversation
      if (!session.currentConversation) {
        session.currentConversation = {
          conversationId: `conv_${Date.now()}`,
          queries: [],
          responses: [],
          context: {
            currentIntent: query.intent,
            language: session.userProfile?.preferences.language || 'en',
            userPreferences: session.userProfile?.preferences || {},
            flightInfo: session.flightContext
          }
        };
      }

      session.currentConversation.queries.push(query);
      session.currentConversation.responses.push(response);
      session.lastActivity = new Date();

      // Animate avatar speech
      await this.animateAvatarSpeech(session.avatar, response.text);

      await this.performanceMonitor.recordMetric('mr_nlp_query_processed', 1, {
        intent: query.intent,
        sessionId
      });

      return response;

    } catch (error) {
      this.logger.error('NLP query processing failed', {
        sessionId,
        query: queryText,
        error: error.message
      });

      throw new MRConciergeError('Query processing failed', {
        sessionId,
        query: queryText,
        originalError: error.message
      });
    }
  }

  /**
   * Display promotional content
   */
  async displayPromotions(sessionId: string, location?: string): Promise<PromoProduct[]> {
    try {
      this.logger.debug('Displaying promotions', { sessionId, location });

      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new MRConciergeError('Session not found', { sessionId });
      }

      // Get promotional products
      const filters: ProductFilters = {
        category: 'promotional',
        inStockOnly: true
      };

      const products = await this.bridgeService.getProductCatalog(filters);
      const promoProducts = products.slice(0, 3).map(product => ({
        productId: product.productId,
        name: product.name,
        price: product.price,
        currency: product.currency,
        model3DUrl: product.model3DUrl || '',
        stockLevel: product.inStock ? 5 : 0, // Mock stock level
        category: product.category
      }));

      // Create 3D product models in carousel
      await this.create3DPromoCarousel(session, promoProducts);

      await this.performanceMonitor.recordMetric('mr_promotions_displayed', promoProducts.length, {
        sessionId,
        location: location || 'unknown'
      });

      return promoProducts;

    } catch (error) {
      this.logger.error('Failed to display promotions', {
        sessionId,
        location,
        error: error.message
      });

      throw new MRConciergeError('Promotion display failed', {
        sessionId,
        originalError: error.message
      });
    }
  }

  /**
   * Provide wayfinding directions
   */
  async provideDirections(sessionId: string, destination: string): Promise<void> {
    try {
      this.logger.debug('Providing directions', { sessionId, destination });

      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new MRConciergeError('Session not found', { sessionId });
      }

      // Get current location and navigation path
      const currentLocation = await this.bridgeService.getCurrentLocation();
      
      // Mock destination location - in real implementation would query POI service
      const destinationLocation = {
        latitude: currentLocation.latitude + 0.001,
        longitude: currentLocation.longitude + 0.001,
        altitude: currentLocation.altitude,
        accuracy: 5.0
      };

      const navigationPath = await this.bridgeService.getNavigationPath(currentLocation, destinationLocation);

      // Display AR arrows through avatar
      await this.displayWayfindingArrows(session, navigationPath);

      // Provide voice guidance
      await this.provideVoiceGuidance(session.avatar, `Follow these arrows to ${destination}`);

      await this.performanceMonitor.recordMetric('mr_directions_provided', 1, {
        sessionId,
        destination
      });

    } catch (error) {
      this.logger.error('Failed to provide directions', {
        sessionId,
        destination,
        error: error.message
      });

      throw new MRConciergeError('Direction guidance failed', {
        sessionId,
        destination,
        originalError: error.message
      });
    }
  }

  /**
   * End MR session
   */
  async endMRSession(sessionId: string): Promise<void> {
    try {
      this.logger.info('Ending MR Concierge session', { sessionId });

      const session = this.activeSessions.get(sessionId);
      if (!session) {
        this.logger.warn('Attempted to end non-existent session', { sessionId });
        return;
      }

      // Cleanup avatar and 3D elements
      await this.cleanupAvatarAssets(session.avatar);

      // Update session status
      session.status = 'ended';

      // Remove from active sessions
      this.activeSessions.delete(sessionId);

      this.logger.info('MR Concierge session ended successfully', { sessionId });

    } catch (error) {
      this.logger.error('Failed to end MR session', {
        sessionId,
        error: error.message
      });

      throw new MRConciergeError('Session termination failed', {
        sessionId,
        originalError: error.message
      });
    }
  }

  // Private helper methods
  private async validateSessionConfig(config: MRSessionConfig): Promise<void> {
    if (!config.sessionId || !config.kioskAnchorID) {
      throw new MRConciergeError('Invalid session configuration', {
        hasSessionId: !!config.sessionId,
        hasKioskAnchorID: !!config.kioskAnchorID
      });
    }
  }

  private isDeviceCapable(capabilities: MRDeviceCapabilities): boolean {
    return capabilities.supportsHolographicDisplay && 
           capabilities.supportsSpatialAudio &&
           capabilities.processingPower !== 'low';
  }

  private async createHologramAvatar(config: MRSessionConfig): Promise<HologramAvatar> {
    const avatar: HologramAvatar = {
      avatarId: `avatar_${config.sessionId}`,
      model: `concierge_${config.performanceProfile.avatarQuality}.glb`,
      position: { x: 0, y: 1.5, z: 2 }, // 1.8m tall, 2m from kiosk
      scale: 1.0,
      animations: new Map([
        ['idle', 'breathing_loop'],
        ['speak', 'talking_gestures'],
        ['listen', 'lean_forward'],
        ['point', 'arm_point']
      ]),
      currentAnimation: 'idle'
    };

    return avatar;
  }

  private async anchorAvatarToKiosk(avatar: HologramAvatar, kioskAnchorID: string): Promise<void> {
    // In a real implementation, this would use Azure Spatial Anchors or similar
    this.logger.debug('Anchoring avatar to kiosk', {
      avatarId: avatar.avatarId,
      kioskAnchorID
    });
  }

  private async performBiometricVerification(imageData: string, passengerID?: string): Promise<FaceMatchResult> {
    // Mock face match implementation
    // In real implementation, this would call face recognition service
    return {
      success: true,
      confidence: 0.96,
      userId: 'user_12345',
      profile: undefined // Will be fetched separately
    };
  }

  private async getFlightContextForUser(userId: string): Promise<FlightContext> {
    // Mock flight lookup - in real implementation would query flight service
    return this.bridgeService.getFlightContext('FL_12345');
  }

  private async personalizeAvatarGreeting(session: MRSession): Promise<void> {
    if (!session.userProfile || !session.flightContext) return;

    const greeting = `Welcome, ${session.userProfile.firstName}! Your flight to ${session.flightContext.destination} departs at ${session.flightContext.departureTime} from Gate ${session.flightContext.gate}. Would you like directions?`;
    
    await this.animateAvatarSpeech(session.avatar, greeting);
  }

  private async callNLPService(queryText: string, session: MRSession): Promise<any> {
    // Mock NLP service call
    // In real implementation, this would call Azure Cognitive Services or similar
    return {
      intent: this.classifyIntent(queryText),
      entities: {},
      confidence: 0.85
    };
  }

  private classifyIntent(queryText: string): string {
    const lowerQuery = queryText.toLowerCase();
    
    if (lowerQuery.includes('gate') || lowerQuery.includes('direction')) return 'gate_info';
    if (lowerQuery.includes('promotion') || lowerQuery.includes('shop')) return 'promotions';
    if (lowerQuery.includes('flight') || lowerQuery.includes('status')) return 'flight_info';
    if (lowerQuery.includes('help')) return 'general_help';
    
    return 'general_info';
  }

  private async generateResponse(query: NLPQuery, session: MRSession): Promise<NLPResponse> {
    const actions: ConversationAction[] = [];
    let responseText = '';

    switch (query.intent) {
      case 'gate_info':
        if (session.flightContext) {
          responseText = `Your gate is ${session.flightContext.gate}. Would you like directions?`;
          actions.push({
            type: 'show_directions',
            data: { destination: session.flightContext.gate }
          });
        } else {
          responseText = 'I need your flight information to provide gate details. Please show me your boarding pass.';
        }
        break;

      case 'promotions':
        responseText = 'Here are today\'s featured promotions for you:';
        actions.push({
          type: 'display_promotions',
          data: { location: 'kiosk_zone' }
        });
        break;

      case 'flight_info':
        if (session.flightContext) {
          responseText = `Your flight ${session.flightContext.flightId} to ${session.flightContext.destination} is ${session.flightContext.status}.`;
        } else {
          responseText = 'Please show me your boarding pass to get flight information.';
        }
        break;

      default:
        responseText = 'How can I help you today? I can provide gate information, show promotions, or answer questions about your flight.';
    }

    return {
      responseId: `resp_${Date.now()}`,
      text: responseText,
      intent: query.intent,
      actions,
      followUpQuestions: this.generateFollowUpQuestions(query.intent)
    };
  }

  private generateFollowUpQuestions(intent: string): string[] {
    switch (intent) {
      case 'gate_info':
        return ['Would you like directions to your gate?', 'Do you need information about nearby amenities?'];
      case 'promotions':
        return ['Would you like to see more details about any item?', 'Shall I help you navigate to a store?'];
      case 'flight_info':
        return ['Do you need directions to your gate?', 'Would you like to see departure lounge amenities?'];
      default:
        return ['Is there anything specific I can help you with?'];
    }
  }

  private async animateAvatarSpeech(avatar: HologramAvatar, text: string): Promise<void> {
    // In real implementation, this would trigger TTS and lip-sync animation
    avatar.currentAnimation = 'speak';
    this.logger.debug('Avatar speaking', {
      avatarId: avatar.avatarId,
      text: text.substring(0, 50) + '...'
    });
  }

  private async create3DPromoCarousel(session: MRSession, products: PromoProduct[]): Promise<void> {
    // In real implementation, this would create 3D models in MR space
    this.logger.debug('Creating 3D promotion carousel', {
      sessionId: session.sessionId,
      productCount: products.length
    });
  }

  private async displayWayfindingArrows(session: MRSession, navigationPath: any): Promise<void> {
    // In real implementation, this would create AR arrows
    this.logger.debug('Displaying wayfinding arrows', {
      sessionId: session.sessionId,
      pathLength: navigationPath.waypoints?.length || 0
    });
  }

  private async provideVoiceGuidance(avatar: HologramAvatar, message: string): Promise<void> {
    await this.animateAvatarSpeech(avatar, message);
  }

  private async cleanupAvatarAssets(avatar: HologramAvatar): Promise<void> {
    // In real implementation, this would cleanup 3D assets and animations
    this.logger.debug('Cleaning up avatar assets', { avatarId: avatar.avatarId });
  }
} 
