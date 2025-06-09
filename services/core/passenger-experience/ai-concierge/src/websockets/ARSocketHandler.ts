/**
 * @fileoverview AeroFusionXR AI Concierge Service - AR Socket Handler
 * @version 1.0.0
 * @author AeroFusionXR AI Engineering Team
 * @created 2024-01-15
 * @updated 2024-01-15
 * 
 * Feature 16: Augmented Reality & Virtual Preview (Selective)
 * Handles real-time AR/VR session management, asset streaming, and interaction events
 */

import { Socket } from 'socket.io';
import winston from 'winston';
import { ConfigurationManager } from '../core/ConfigurationManager';
import { SecurityManager } from '../core/SecurityManager';
import { ARAssetManager, ARAssetType, LODLevel } from '../services/ARAssetManager';

/**
 * AR session interface
 */
export interface ARSession {
  sessionID: string;
  userID: string;
  assetID: string;
  assetType: ARAssetType;
  lodLevel: LODLevel;
  startTime: string;
  deviceCapabilities: {
    gpuLevel: string;
    memory: number;
    networkSpeed: string;
  };
  isActive: boolean;
}

/**
 * AR interaction event interface
 */
export interface ARInteractionEvent {
  sessionID: string;
  eventType: 'modelRotate' | 'modelZoom' | 'vrEntered' | 'vrExited' | 'markerDetected' | 'surfacePlaced';
  data: Record<string, any>;
  timestamp: string;
}

/**
 * AR Socket Handler Class
 * Manages WebSocket connections for AR/VR sessions
 */
export class ARSocketHandler {
  private config: ConfigurationManager;
  private logger: winston.Logger;
  private securityManager: SecurityManager;
  private arAssetManager: ARAssetManager;
  private activeSessions: Map<string, ARSession> = new Map();
  private socketSessions: Map<string, string> = new Map(); // socketId -> sessionId

  constructor(
    config: ConfigurationManager,
    logger: winston.Logger,
    securityManager: SecurityManager,
    arAssetManager: ARAssetManager
  ) {
    this.config = config;
    this.logger = logger;
    this.securityManager = securityManager;
    this.arAssetManager = arAssetManager;

    this.logger.info('ARSocketHandler initialized successfully', {
      component: 'ARSocketHandler'
    });
  }

  /**
   * Handle new socket connection
   */
  public handleConnection(socket: Socket): void {
    this.logger.info('AR client connected', {
      component: 'ARSocketHandler',
      action: 'handleConnection',
      socketId: socket.id,
      userAgent: socket.handshake.headers['user-agent']
    });

    // Set up event listeners
    this.setupEventListeners(socket);

    // Send welcome message
    socket.emit('ar:connected', {
      message: 'Connected to AR service',
      timestamp: new Date().toISOString(),
      supportedAssetTypes: Object.values(ARAssetType)
    });
  }

  /**
   * Handle socket disconnection
   */
  public handleDisconnection(socket: Socket): void {
    const sessionID = this.socketSessions.get(socket.id);
    
    if (sessionID) {
      this.endARSession(sessionID);
      this.socketSessions.delete(socket.id);
    }

    this.logger.info('AR client disconnected', {
      component: 'ARSocketHandler',
      action: 'handleDisconnection',
      socketId: socket.id,
      sessionID
    });
  }

  /**
   * Set up socket event listeners
   */
  private setupEventListeners(socket: Socket): void {
    // Start AR session
    socket.on('ar:startSession', async (data) => {
      await this.handleStartSession(socket, data);
    });

    // End AR session
    socket.on('ar:endSession', async (data) => {
      await this.handleEndSession(socket, data);
    });

    // Log interaction
    socket.on('ar:interaction', async (data) => {
      await this.handleInteraction(socket, data);
    });

    // Request asset streaming
    socket.on('ar:requestAsset', async (data) => {
      await this.handleAssetRequest(socket, data);
    });

    // Update device capabilities
    socket.on('ar:updateCapabilities', async (data) => {
      await this.handleCapabilitiesUpdate(socket, data);
    });

    // Handle VR tour events
    socket.on('vr:tourStarted', async (data) => {
      await this.handleVRTourStarted(socket, data);
    });

    socket.on('vr:tourEnded', async (data) => {
      await this.handleVRTourEnded(socket, data);
    });

    // Handle error events
    socket.on('ar:error', async (data) => {
      await this.handleARError(socket, data);
    });
  }

  /**
   * Handle start AR session
   */
  private async handleStartSession(socket: Socket, data: any): Promise<void> {
    try {
      const { userID, assetID, assetType, deviceCapabilities } = data;

      // Validate input
      if (!userID || !assetID || !assetType || !deviceCapabilities) {
        socket.emit('ar:error', {
          error: 'MISSING_REQUIRED_FIELDS',
          message: 'UserID, assetID, assetType, and deviceCapabilities are required'
        });
        return;
      }

      // Determine optimal LOD
      const lodLevel = this.arAssetManager.selectOptimalLOD(deviceCapabilities);

      // Create AR session
      const session: ARSession = {
        sessionID: `ar_session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        userID,
        assetID,
        assetType,
        lodLevel,
        startTime: new Date().toISOString(),
        deviceCapabilities,
        isActive: true
      };

      // Store session
      this.activeSessions.set(session.sessionID, session);
      this.socketSessions.set(socket.id, session.sessionID);

      // Generate asset URL
      const assetURL = await this.arAssetManager.generateAssetURL(assetID, lodLevel);

      // Log session start
      await this.arAssetManager.logInteraction({
        assetID,
        eventType: 'previewOpened',
        details: {
          sessionID: session.sessionID,
          lodLevel,
          deviceCapabilities
        },
        userID
      });

      // Send session details to client
      socket.emit('ar:sessionStarted', {
        sessionID: session.sessionID,
        assetURL,
        lodLevel,
        assetType,
        timestamp: session.startTime
      });

      this.logger.info('AR session started', {
        component: 'ARSocketHandler',
        action: 'handleStartSession',
        sessionID: session.sessionID,
        assetID,
        lodLevel
      });

    } catch (error) {
      this.logger.error('Failed to start AR session', {
        component: 'ARSocketHandler',
        action: 'handleStartSession',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      socket.emit('ar:error', {
        error: 'SESSION_START_FAILED',
        message: 'Failed to start AR session'
      });
    }
  }

  /**
   * Handle end AR session
   */
  private async handleEndSession(socket: Socket, data: any): Promise<void> {
    try {
      const { sessionID } = data;
      const session = this.activeSessions.get(sessionID);

      if (!session) {
        socket.emit('ar:error', {
          error: 'SESSION_NOT_FOUND',
          message: 'AR session not found'
        });
        return;
      }

      // Calculate session duration
      const startTime = new Date(session.startTime);
      const endTime = new Date();
      const durationSec = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

      // Log session end
      await this.arAssetManager.logInteraction({
        assetID: session.assetID,
        eventType: 'tourCompleted',
        details: {
          sessionID,
          durationSec,
          lodLevel: session.lodLevel
        },
        userID: session.userID
      });

      // Clean up session
      this.endARSession(sessionID);
      this.socketSessions.delete(socket.id);

      // Confirm session end to client
      socket.emit('ar:sessionEnded', {
        sessionID,
        durationSec,
        timestamp: endTime.toISOString()
      });

      this.logger.info('AR session ended', {
        component: 'ARSocketHandler',
        action: 'handleEndSession',
        sessionID,
        durationSec
      });

    } catch (error) {
      this.logger.error('Failed to end AR session', {
        component: 'ARSocketHandler',
        action: 'handleEndSession',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      socket.emit('ar:error', {
        error: 'SESSION_END_FAILED',
        message: 'Failed to end AR session'
      });
    }
  }

  /**
   * Handle AR interaction events
   */
  private async handleInteraction(socket: Socket, data: any): Promise<void> {
    try {
      const { sessionID, eventType, interactionData } = data;
      const session = this.activeSessions.get(sessionID);

      if (!session) {
        socket.emit('ar:error', {
          error: 'SESSION_NOT_FOUND',
          message: 'AR session not found'
        });
        return;
      }

      // Log interaction
      await this.arAssetManager.logInteraction({
        assetID: session.assetID,
        eventType,
        details: {
          sessionID,
          ...interactionData
        },
        userID: session.userID
      });

      // Acknowledge interaction
      socket.emit('ar:interactionLogged', {
        sessionID,
        eventType,
        timestamp: new Date().toISOString()
      });

      this.logger.debug('AR interaction logged', {
        component: 'ARSocketHandler',
        action: 'handleInteraction',
        sessionID,
        eventType
      });

    } catch (error) {
      this.logger.error('Failed to handle AR interaction', {
        component: 'ARSocketHandler',
        action: 'handleInteraction',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      socket.emit('ar:error', {
        error: 'INTERACTION_LOG_FAILED',
        message: 'Failed to log AR interaction'
      });
    }
  }

  /**
   * Handle asset request
   */
  private async handleAssetRequest(socket: Socket, data: any): Promise<void> {
    try {
      const { sessionID, requestType } = data; // requestType: 'model' | 'video' | 'texture'
      const session = this.activeSessions.get(sessionID);

      if (!session) {
        socket.emit('ar:error', {
          error: 'SESSION_NOT_FOUND',
          message: 'AR session not found'
        });
        return;
      }

      let assetURL: string;
      
      if (requestType === 'video') {
        assetURL = await this.arAssetManager.generateVRVideoURL(session.assetID, '4k');
      } else {
        assetURL = await this.arAssetManager.generateAssetURL(session.assetID, session.lodLevel);
      }

      // Send asset URL to client
      socket.emit('ar:assetReady', {
        sessionID,
        requestType,
        assetURL,
        timestamp: new Date().toISOString()
      });

      this.logger.debug('Asset requested and served', {
        component: 'ARSocketHandler',
        action: 'handleAssetRequest',
        sessionID,
        requestType
      });

    } catch (error) {
      this.logger.error('Failed to handle asset request', {
        component: 'ARSocketHandler',
        action: 'handleAssetRequest',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      socket.emit('ar:error', {
        error: 'ASSET_REQUEST_FAILED',
        message: 'Failed to process asset request'
      });
    }
  }

  /**
   * Handle device capabilities update
   */
  private async handleCapabilitiesUpdate(socket: Socket, data: any): Promise<void> {
    try {
      const { sessionID, deviceCapabilities } = data;
      const session = this.activeSessions.get(sessionID);

      if (!session) {
        socket.emit('ar:error', {
          error: 'SESSION_NOT_FOUND',
          message: 'AR session not found'
        });
        return;
      }

      // Update session capabilities
      session.deviceCapabilities = deviceCapabilities;

      // Recalculate optimal LOD
      const newLODLevel = this.arAssetManager.selectOptimalLOD(deviceCapabilities);
      
      if (newLODLevel !== session.lodLevel) {
        session.lodLevel = newLODLevel;
        
        // Generate new asset URL with updated LOD
        const newAssetURL = await this.arAssetManager.generateAssetURL(session.assetID, newLODLevel);
        
        // Notify client of LOD change
        socket.emit('ar:lodUpdated', {
          sessionID,
          newLODLevel,
          newAssetURL,
          timestamp: new Date().toISOString()
        });
      }

      this.logger.debug('Device capabilities updated', {
        component: 'ARSocketHandler',
        action: 'handleCapabilitiesUpdate',
        sessionID,
        newLODLevel
      });

    } catch (error) {
      this.logger.error('Failed to update device capabilities', {
        component: 'ARSocketHandler',
        action: 'handleCapabilitiesUpdate',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      socket.emit('ar:error', {
        error: 'CAPABILITIES_UPDATE_FAILED',
        message: 'Failed to update device capabilities'
      });
    }
  }

  /**
   * Handle VR tour started
   */
  private async handleVRTourStarted(socket: Socket, data: any): Promise<void> {
    try {
      const { sessionID } = data;
      const session = this.activeSessions.get(sessionID);

      if (session) {
        await this.arAssetManager.logInteraction({
          assetID: session.assetID,
          eventType: 'vrEntered',
          details: { sessionID },
          userID: session.userID
        });
      }

      this.logger.debug('VR tour started', {
        component: 'ARSocketHandler',
        action: 'handleVRTourStarted',
        sessionID
      });

    } catch (error) {
      this.logger.error('Failed to handle VR tour start', {
        component: 'ARSocketHandler',
        action: 'handleVRTourStarted',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle VR tour ended
   */
  private async handleVRTourEnded(socket: Socket, data: any): Promise<void> {
    try {
      const { sessionID, durationSec } = data;
      const session = this.activeSessions.get(sessionID);

      if (session) {
        await this.arAssetManager.logInteraction({
          assetID: session.assetID,
          eventType: 'vrExited',
          details: { sessionID, durationSec },
          userID: session.userID
        });
      }

      this.logger.debug('VR tour ended', {
        component: 'ARSocketHandler',
        action: 'handleVRTourEnded',
        sessionID,
        durationSec
      });

    } catch (error) {
      this.logger.error('Failed to handle VR tour end', {
        component: 'ARSocketHandler',
        action: 'handleVRTourEnded',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle AR errors
   */
  private async handleARError(socket: Socket, data: any): Promise<void> {
    try {
      const { sessionID, errorCode, errorMessage } = data;

      this.logger.error('AR client error received', {
        component: 'ARSocketHandler',
        action: 'handleARError',
        sessionID,
        errorCode,
        errorMessage
      });

      // Log error for analytics
      const session = this.activeSessions.get(sessionID);
      if (session) {
        await this.arAssetManager.logInteraction({
          assetID: session.assetID,
          eventType: 'vrExited', // Use closest available event type
          details: { 
            sessionID, 
            errorCode, 
            errorMessage,
            errorOccurred: true 
          },
          userID: session.userID
        });
      }

    } catch (error) {
      this.logger.error('Failed to handle AR error', {
        component: 'ARSocketHandler',
        action: 'handleARError',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * End AR session and cleanup
   */
  private endARSession(sessionID: string): void {
    const session = this.activeSessions.get(sessionID);
    if (session) {
      session.isActive = false;
      this.activeSessions.delete(sessionID);
    }
  }

  /**
   * Get active session count
   */
  public getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  /**
   * Get session by ID
   */
  public getSession(sessionID: string): ARSession | undefined {
    return this.activeSessions.get(sessionID);
  }
} 