/**
 * @fileoverview AeroFusionXR AI Concierge Service - Offline Service
 * @version 1.0.0
 * @author AeroFusionXR AI Engineering Team
 * @created 2024-01-15
 * @updated 2024-01-15
 * 
 * Feature 19: Offline & Low-Bandwidth Support
 * Core offline functionality with local caching, SMS fallback, and BLE beacon support
 */

import winston from 'winston';
import { ConfigurationManager } from '../core/ConfigurationManager';
import { UUID } from '../types';

/**
 * Network connectivity status enumeration
 */
export enum NetworkStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  LIMITED = 'limited'
}

/**
 * Cache type enumeration
 */
export enum CacheType {
  FLIGHTS = 'flights',
  FAQS = 'faqs',
  POI = 'poi',
  BOARDING_PASSES = 'boarding_passes'
}

/**
 * Offline flight info interface
 */
export interface OfflineFlightInfo {
  flightID: string;
  status: string;
  departureGate: string;
  arrivalGate: string;
  scheduledTime: string;
  lastUpdated: string;
  expiresAt: string;
}

/**
 * Offline FAQ interface
 */
export interface OfflineFAQ {
  questionID: string;
  questionText: string;
  answerText: string;
  keywords: string;
  lastSynced: string;
  confidence?: number;
}

/**
 * Offline POI interface
 */
export interface OfflinePOI {
  poiID: string;
  name: string;
  category: string;
  floor: number;
  x: number;
  y: number;
  description: string;
  lastSynced: string;
}

/**
 * Pending action interface
 */
export interface PendingAction {
  actionID: string;
  actionType: string;
  payload: string;
  retryCount: number;
  lastAttempt: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  maxRetries: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
}

/**
 * Offline boarding pass interface
 */
export interface OfflineBoardingPass {
  flightID: string;
  passPath: string;
  qrCode: string;
  downloadedAt: string;
  expiresAt: string;
  passengerName: string;
  seatNumber: string;
  boardingGroup: string;
}

/**
 * BLE beacon payload interface
 */
export interface BLEBeaconPayload {
  type: 'gateChange' | 'delayAlert' | 'cancellation' | 'boarding';
  flightID: string;
  oldGate?: string;
  newGate?: string;
  timestamp: string;
  message?: string;
}

/**
 * SMS registration interface
 */
export interface SMSRegistration {
  userID: UUID;
  phoneNumber: string;
  flightID: string;
  consent: boolean;
  registrationID: string;
  alertTypes: string[];
}

/**
 * Offline Service Class
 * Handles all offline functionality including caching, sync, and fallback mechanisms
 */
export class OfflineService {
  private config: ConfigurationManager;
  private logger: winston.Logger;
  private networkStatus: NetworkStatus = NetworkStatus.ONLINE;
  private lastSyncTime: Date = new Date();
  
  // In-memory cache simulation (in real implementation, would use SQLite)
  private flightCache: Map<string, OfflineFlightInfo> = new Map();
  private faqCache: Map<string, OfflineFAQ> = new Map();
  private poiCache: Map<string, OfflinePOI> = new Map();
  private boardingPassCache: Map<string, OfflineBoardingPass> = new Map();
  private pendingActions: Map<string, PendingAction> = new Map();
  private smsRegistrations: Map<UUID, SMSRegistration> = new Map();

  constructor(config: ConfigurationManager, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;
    
    this.initializeOfflineSupport();
    
    this.logger.info('OfflineService initialized successfully', {
      component: 'OfflineService',
      cacheTypes: Object.values(CacheType),
      maxCacheSize: '50MB'
    });
  }

  /**
   * Initialize offline support with default data
   */
  private initializeOfflineSupport(): void {
    // Initialize with sample cached data
    this.populateSampleCache();
    
    // Start network monitoring
    this.startNetworkMonitoring();
    
    // Start periodic cache cleanup
    this.startCacheCleanup();
  }

  /**
   * Sync data for offline caching
   */
  public async syncOfflineData(
    userID: UUID,
    syncTypes: CacheType[] = Object.values(CacheType),
    flightIDs?: string[]
  ): Promise<any> {
    try {
      this.logger.debug('Starting offline data sync', {
        component: 'OfflineService',
        action: 'syncOfflineData',
        userID,
        syncTypes,
        flightIDs
      });

      const syncResult = {
        syncID: `sync_${Date.now()}`,
        userID,
        syncedAt: new Date().toISOString(),
        syncTypes,
        data: {
          flights: syncTypes.includes(CacheType.FLIGHTS) ? await this.syncFlightData(flightIDs) : [],
          faqs: syncTypes.includes(CacheType.FAQS) ? await this.syncFAQData() : [],
          poi: syncTypes.includes(CacheType.POI) ? await this.syncPOIData() : [],
          boardingPasses: syncTypes.includes(CacheType.BOARDING_PASSES) ? await this.syncBoardingPassData(userID, flightIDs) : []
        },
        metadata: {
          totalSizeKB: this.calculateTotalCacheSize(),
          expiryTimes: this.getCacheExpiryTimes(),
          encryptionEnabled: true
        }
      };

      this.lastSyncTime = new Date();

      this.logger.info('Offline data sync completed', {
        component: 'OfflineService',
        action: 'syncOfflineData',
        syncID: syncResult.syncID,
        totalSizeKB: syncResult.metadata.totalSizeKB
      });

      return syncResult;
    } catch (error) {
      this.logger.error('Failed to sync offline data', {
        component: 'OfflineService',
        action: 'syncOfflineData',
        userID,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to sync offline data');
    }
  }

  /**
   * Get offline status and cached data summary
   */
  public getOfflineStatus(userID: UUID): any {
    return {
      userID,
      mode: this.networkStatus,
      lastSyncTime: this.lastSyncTime.toISOString(),
      cacheStatus: {
        flights: {
          count: this.flightCache.size,
          expired: this.getExpiredCacheCount(CacheType.FLIGHTS),
          sizeKB: this.getCacheSizeKB(CacheType.FLIGHTS)
        },
        faqs: {
          count: this.faqCache.size,
          expired: this.getExpiredCacheCount(CacheType.FAQS),
          sizeKB: this.getCacheSizeKB(CacheType.FAQS)
        },
        poi: {
          count: this.poiCache.size,
          expired: this.getExpiredCacheCount(CacheType.POI),
          sizeKB: this.getCacheSizeKB(CacheType.POI)
        },
        boardingPasses: {
          count: this.boardingPassCache.size,
          expired: this.getExpiredCacheCount(CacheType.BOARDING_PASSES),
          sizeKB: this.getCacheSizeKB(CacheType.BOARDING_PASSES)
        }
      },
      connectivity: this.getConnectivityInfo(),
      pendingActions: {
        count: this.pendingActions.size,
        queueSize: Array.from(this.pendingActions.values()).filter(a => a.status === 'queued').length
      },
      storage: {
        usedMB: this.calculateTotalCacheSize() / 1024,
        maxCacheMB: 50
      }
    };
  }

  /**
   * Register for SMS fallback notifications
   */
  public async registerSMSFallback(
    userID: UUID,
    phoneNumber: string,
    flightID: string,
    consent: boolean
  ): Promise<SMSRegistration> {
    try {
      if (!consent) {
        throw new Error('User consent is required for SMS registration');
      }

      // Validate phone number format (E.164)
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      if (!phoneRegex.test(phoneNumber)) {
        throw new Error('Invalid phone number format. Must be E.164 format');
      }

      const registration: SMSRegistration = {
        userID,
        phoneNumber,
        flightID,
        consent,
        registrationID: `sms_reg_${Date.now()}`,
        alertTypes: [
          'flight_delay',
          'gate_change',
          'boarding_call',
          'flight_cancellation',
          'baggage_update'
        ]
      };

      this.smsRegistrations.set(userID, registration);

      this.logger.info('SMS fallback registration successful', {
        component: 'OfflineService',
        action: 'registerSMSFallback',
        userID,
        registrationID: registration.registrationID,
        flightID
      });

      return registration;
    } catch (error) {
      this.logger.error('Failed to register SMS fallback', {
        component: 'OfflineService',
        action: 'registerSMSFallback',
        userID,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Query offline FAQ database
   */
  public async queryOfflineFAQ(query: string, offline: boolean = false): Promise<any> {
    try {
      const startTime = Date.now();
      
      // Simple keyword-based FAQ search
      const queryWords = query.toLowerCase().split(' ');
      const results: OfflineFAQ[] = [];
      
      for (const faq of this.faqCache.values()) {
        const keywords = faq.keywords.toLowerCase().split(',').map(k => k.trim());
        const matches = queryWords.filter(word => 
          keywords.some(keyword => keyword.includes(word))
        );
        
        if (matches.length > 0) {
          const confidence = matches.length / queryWords.length;
          results.push({ ...faq, confidence });
        }
      }

      // Sort by confidence
      results.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
      
      const processingTime = Date.now() - startTime;

      this.logger.debug('FAQ query processed', {
        component: 'OfflineService',
        action: 'queryOfflineFAQ',
        query,
        resultsCount: results.length,
        processingTime,
        offline
      });

      return {
        queryID: `faq_${Date.now()}`,
        query,
        offline,
        processingTime,
        results: results.slice(0, 3), // Top 3 results
        confidence: results.length > 0 ? results[0].confidence : 0,
        fallbackMessage: offline && results.length === 0 ? 
          "I'm offline and don't know the answer. Please reconnect for full service." : null
      };
    } catch (error) {
      this.logger.error('Failed to query offline FAQ', {
        component: 'OfflineService',
        action: 'queryOfflineFAQ',
        query,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to query offline FAQ');
    }
  }

  /**
   * Queue action for offline processing
   */
  public queuePendingAction(
    userID: UUID,
    actionType: string,
    payload: any
  ): PendingAction {
    const action: PendingAction = {
      actionID: `action_${Date.now()}`,
      actionType,
      payload: JSON.stringify(payload),
      retryCount: 0,
      lastAttempt: new Date().toISOString(),
      priority: this.getPriorityForActionType(actionType),
      maxRetries: 3,
      status: 'queued'
    };

    this.pendingActions.set(action.actionID, action);

    this.logger.info('Action queued for offline processing', {
      component: 'OfflineService',
      action: 'queuePendingAction',
      actionID: action.actionID,
      actionType,
      priority: action.priority
    });

    return action;
  }

  /**
   * Process BLE beacon alert
   */
  public processBLEBeacon(
    beaconData: BLEBeaconPayload,
    deviceID: string,
    userID?: UUID
  ): any {
    try {
      const beaconAlert = {
        alertID: `ble_${Date.now()}`,
        deviceID,
        userID,
        beaconUUID: '12345678-90AB-CDEF-1234-567890ABCDEF',
        receivedAt: new Date().toISOString(),
        signalStrength: -65, // dBm
        distance: 2.5, // meters
        payload: beaconData,
        alert: this.generateBeaconAlert(beaconData),
        priority: 'high',
        displayDuration: 5000
      };

      this.logger.info('BLE beacon alert processed', {
        component: 'OfflineService',
        action: 'processBLEBeacon',
        alertID: beaconAlert.alertID,
        beaconType: beaconData.type,
        flightID: beaconData.flightID
      });

      return beaconAlert;
    } catch (error) {
      this.logger.error('Failed to process BLE beacon', {
        component: 'OfflineService',
        action: 'processBLEBeacon',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to process BLE beacon');
    }
  }

  /**
   * Get offline boarding pass
   */
  public getOfflineBoardingPass(flightID: string, userID: UUID): OfflineBoardingPass | null {
    const pass = this.boardingPassCache.get(flightID);
    if (pass && new Date(pass.expiresAt) > new Date()) {
      return pass;
    }
    return null;
  }

  /**
   * Purge expired cache data
   */
  public purgeExpiredCache(cacheTypes: CacheType[] = Object.values(CacheType)): any {
    const purgeStats = {
      flights: { totalEntries: 0, expiredEntries: 0, purgedEntries: 0, freedSpaceKB: 0 },
      faqs: { totalEntries: 0, expiredEntries: 0, purgedEntries: 0, freedSpaceKB: 0 },
      poi: { totalEntries: 0, expiredEntries: 0, purgedEntries: 0, freedSpaceKB: 0 },
      boardingPasses: { totalEntries: 0, expiredEntries: 0, purgedEntries: 0, freedSpaceKB: 0 }
    };

    const now = new Date();

    // Purge expired flights
    if (cacheTypes.includes(CacheType.FLIGHTS)) {
      purgeStats.flights.totalEntries = this.flightCache.size;
      for (const [flightID, flight] of this.flightCache.entries()) {
        if (new Date(flight.expiresAt) <= now) {
          this.flightCache.delete(flightID);
          purgeStats.flights.expiredEntries++;
          purgeStats.flights.purgedEntries++;
          purgeStats.flights.freedSpaceKB += 2.5; // Estimated size
        }
      }
    }

    // Purge expired POI data
    if (cacheTypes.includes(CacheType.POI)) {
      purgeStats.poi.totalEntries = this.poiCache.size;
      for (const [poiID, poi] of this.poiCache.entries()) {
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (new Date(poi.lastSynced) <= hourAgo) {
          this.poiCache.delete(poiID);
          purgeStats.poi.expiredEntries++;
          purgeStats.poi.purgedEntries++;
          purgeStats.poi.freedSpaceKB += 1.5; // Estimated size
        }
      }
    }

    // Purge expired boarding passes
    if (cacheTypes.includes(CacheType.BOARDING_PASSES)) {
      purgeStats.boardingPasses.totalEntries = this.boardingPassCache.size;
      for (const [flightID, pass] of this.boardingPassCache.entries()) {
        if (new Date(pass.expiresAt) <= now) {
          this.boardingPassCache.delete(flightID);
          purgeStats.boardingPasses.expiredEntries++;
          purgeStats.boardingPasses.purgedEntries++;
          purgeStats.boardingPasses.freedSpaceKB += 450; // PDF size
        }
      }
    }

    const totalFreedSpaceKB = Object.values(purgeStats).reduce(
      (total, stat) => total + stat.freedSpaceKB, 0
    );

    this.logger.info('Cache purge completed', {
      component: 'OfflineService',
      action: 'purgeExpiredCache',
      totalFreedSpaceKB,
      purgeStats
    });

    return {
      purgeID: `purge_${Date.now()}`,
      purgedAt: new Date().toISOString(),
      cacheTypes,
      purgeStats,
      totalFreedSpaceKB
    };
  }

  /**
   * Process pending actions when back online
   */
  public async processPendingActions(): Promise<void> {
    if (this.networkStatus !== NetworkStatus.ONLINE) {
      return;
    }

    const queuedActions = Array.from(this.pendingActions.values())
      .filter(action => action.status === 'queued')
      .sort((a, b) => this.comparePriority(a.priority, b.priority));

    for (const action of queuedActions) {
      try {
        action.status = 'processing';
        await this.executeAction(action);
        action.status = 'completed';
        
        this.logger.info('Pending action processed successfully', {
          component: 'OfflineService',
          action: 'processPendingActions',
          actionID: action.actionID,
          actionType: action.actionType
        });
      } catch (error) {
        action.retryCount++;
        action.lastAttempt = new Date().toISOString();
        
        if (action.retryCount >= action.maxRetries) {
          action.status = 'failed';
          this.logger.error('Pending action failed after max retries', {
            component: 'OfflineService',
            action: 'processPendingActions',
            actionID: action.actionID,
            retryCount: action.retryCount
          });
        } else {
          action.status = 'queued';
        }
      }
    }
  }

  /**
   * Private helper methods
   */

  private populateSampleCache(): void {
    // Sample flight data
    this.flightCache.set('EK234', {
      flightID: 'EK234',
      status: 'On Time',
      departureGate: 'A15',
      arrivalGate: 'C3',
      scheduledTime: '2024-01-20T14:30:00Z',
      lastUpdated: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    });

    // Sample FAQ data
    this.faqCache.set('faq_001', {
      questionID: 'faq_001',
      questionText: 'Where is Gate A12?',
      answerText: 'Gate A12 is at the end of Concourse A, take the moving walkway for 3 minutes.',
      keywords: 'gate A12, location, concourse A',
      lastSynced: new Date().toISOString()
    });

    // Sample POI data
    this.poiCache.set('poi_001', {
      poiID: 'poi_001',
      name: 'Emirates Lounge',
      category: 'lounge',
      floor: 2,
      x: 125.5,
      y: 200.3,
      description: 'Premium lounge with dining and spa services',
      lastSynced: new Date().toISOString()
    });
  }

  private async syncFlightData(flightIDs?: string[]): Promise<OfflineFlightInfo[]> {
    // Mock flight data sync
    return [
      {
        flightID: 'EK234',
        status: 'On Time',
        departureGate: 'A15',
        arrivalGate: 'C3',
        scheduledTime: '2024-01-20T14:30:00Z',
        lastUpdated: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      }
    ];
  }

  private async syncFAQData(): Promise<OfflineFAQ[]> {
    // Mock FAQ data sync
    return Array.from(this.faqCache.values());
  }

  private async syncPOIData(): Promise<OfflinePOI[]> {
    // Mock POI data sync
    return Array.from(this.poiCache.values());
  }

  private async syncBoardingPassData(userID: UUID, flightIDs?: string[]): Promise<OfflineBoardingPass[]> {
    // Mock boarding pass sync
    return Array.from(this.boardingPassCache.values());
  }

  private startNetworkMonitoring(): void {
    // Mock network monitoring
    setInterval(() => {
      // In real implementation, would monitor actual network connectivity
      this.detectNetworkStatus();
    }, 5000);
  }

  private detectNetworkStatus(): void {
    // Mock network status detection
    // In real implementation, would use actual network monitoring
    const oldStatus = this.networkStatus;
    // this.networkStatus = ... actual network detection
    
    if (oldStatus !== this.networkStatus) {
      this.logger.info('Network status changed', {
        component: 'OfflineService',
        action: 'detectNetworkStatus',
        oldStatus,
        newStatus: this.networkStatus
      });

      if (this.networkStatus === NetworkStatus.ONLINE) {
        this.processPendingActions();
      }
    }
  }

  private startCacheCleanup(): void {
    // Run cache cleanup every hour
    setInterval(() => {
      this.purgeExpiredCache();
    }, 60 * 60 * 1000);
  }

  private calculateTotalCacheSize(): number {
    // Mock cache size calculation in KB
    return this.flightCache.size * 2.5 + 
           this.faqCache.size * 8 + 
           this.poiCache.size * 7 + 
           this.boardingPassCache.size * 450;
  }

  private getCacheExpiryTimes(): Record<string, string> {
    return {
      flights: '30 minutes',
      faqs: '24 hours',
      poi: '1 hour',
      boardingPasses: '24 hours'
    };
  }

  private getExpiredCacheCount(cacheType: CacheType): number {
    const now = new Date();
    
    switch (cacheType) {
      case CacheType.FLIGHTS:
        return Array.from(this.flightCache.values())
          .filter(flight => new Date(flight.expiresAt) <= now).length;
      case CacheType.POI:
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return Array.from(this.poiCache.values())
          .filter(poi => new Date(poi.lastSynced) <= hourAgo).length;
      case CacheType.BOARDING_PASSES:
        return Array.from(this.boardingPassCache.values())
          .filter(pass => new Date(pass.expiresAt) <= now).length;
      default:
        return 0;
    }
  }

  private getCacheSizeKB(cacheType: CacheType): number {
    switch (cacheType) {
      case CacheType.FLIGHTS:
        return this.flightCache.size * 2.5;
      case CacheType.FAQS:
        return this.faqCache.size * 8;
      case CacheType.POI:
        return this.poiCache.size * 7;
      case CacheType.BOARDING_PASSES:
        return this.boardingPassCache.size * 450;
      default:
        return 0;
    }
  }

  private getConnectivityInfo(): any {
    return {
      networkType: 'wifi',
      signalStrength: 'strong',
      bandwidth: '50mbps',
      latency: '45ms'
    };
  }

  private getPriorityForActionType(actionType: string): PendingAction['priority'] {
    const priorities: Record<string, PendingAction['priority']> = {
      emergency: 'critical',
      rebookRequest: 'high',
      serviceRequest: 'high',
      chatQuery: 'medium',
      feedbackSubmission: 'low'
    };
    return priorities[actionType] || 'medium';
  }

  private generateBeaconAlert(beaconData: BLEBeaconPayload): any {
    if (beaconData.type === 'gateChange') {
      return {
        type: 'gate_change',
        title: 'Gate Change',
        message: `${beaconData.flightID}: Gate ${beaconData.oldGate} → ${beaconData.newGate}`,
        urgency: 'high'
      };
    }
    
    return {
      type: 'general',
      title: 'Terminal Update',
      message: beaconData.message || 'New information available',
      urgency: 'medium'
    };
  }

  private comparePriority(a: PendingAction['priority'], b: PendingAction['priority']): number {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a] - priorityOrder[b];
  }

  private async executeAction(action: PendingAction): Promise<void> {
    // Mock action execution
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // In real implementation, would execute the actual action based on actionType
    this.logger.debug('Action executed', {
      component: 'OfflineService',
      action: 'executeAction',
      actionID: action.actionID,
      actionType: action.actionType
    });
  }
} 