import { createLogger } from '@aerofusionxr/shared';
import { PerformanceMonitor } from '@aerofusionxr/shared';
import { SecurityService, SyncSecurityContext } from '../security/SecurityService';
import { LocalStorageService } from '../storage/LocalStorageService';
import { SyncEngine } from '../sync/SyncEngine';
import { ConflictResolver } from '../sync/ConflictResolver';
import { NetworkMonitor } from '../network/NetworkMonitor';
import { QueueManager } from '../queue/QueueManager';
import { CacheManager } from '../cache/CacheManager';
import { MediaCacheService } from '../media/MediaCacheService';

// Core sync interfaces
export interface SyncableEntity {
  id: string;
  lastUpdated: Date;
  version?: number;
  checksum?: string;
  deleted?: boolean;
}

export interface POILocal extends SyncableEntity {
  poiID: string;
  nameLocal: { [locale: string]: string };
  category: string;
  location: {
    x: number;
    y: number;
    floor: number;
  };
  rating: number;
  metadata?: any;
}

export interface MediaAssetLocal extends SyncableEntity {
  mediaID: string;
  type: 'image' | 'video';
  localPath: string;
  url: string;
  sizeBytes: number;
  lastAccessed: Date;
  metadata?: any;
}

export interface LoyaltyBalanceLocal extends SyncableEntity {
  userID: string;
  pointsBalance: number;
  tierID: string;
  tierName: string;
  lastSyncTime: Date;
}

export interface RewardLocal extends SyncableEntity {
  rewardID: string;
  tierID: string;
  nameLocal: { [locale: string]: string };
  descriptionLocal: { [locale: string]: string };
  pointsCost: number;
  quantityAvailable: number;
  imageLocalPath?: string;
  expiryDate: Date;
}

export interface UserProfileLocal extends SyncableEntity {
  userID: string;
  locale: string;
  preferences: {
    language: string;
    notificationsEnabled: boolean;
    theme: string;
    accessibility?: any;
  };
}

export interface QueuedTransaction {
  queueID: string;
  userID: string;
  type: 'earn' | 'redeem' | 'profile_update' | 'analytics_event';
  payload: any;
  status: 'pending' | 'synced' | 'conflict' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  retryCount: number;
  priority: number;
}

export interface QueuedAnalyticsEvent {
  eventID: string;
  eventType: string;
  payload: any;
  status: 'pending' | 'sent' | 'failed';
  createdAt: Date;
  retryCount: number;
}

export interface SyncBatchRequest {
  userID: string;
  transactions: QueuedTransaction[];
  analyticsEvents: QueuedAnalyticsEvent[];
  lastSyncTimes: {
    poi?: Date;
    media?: Date;
    rewards?: Date;
    profile?: Date;
    loyalty?: Date;
  };
}

export interface SyncBatchResponse {
  transactionsResult: Array<{
    queueID: string;
    status: 'synced' | 'conflict' | 'failed';
    error?: string;
    serverData?: any;
  }>;
  analyticsResult: Array<{
    eventID: string;
    status: 'sent' | 'failed';
    error?: string;
  }>;
  updates: {
    poiUpdates?: POILocal[];
    mediaUpdates?: Array<{
      mediaID: string;
      type: string;
      url: string;
      lastUpdated: Date;
    }>;
    loyaltyBalanceUpdate?: LoyaltyBalanceLocal;
    rewardsCatalogUpdates?: RewardLocal[];
    userProfileUpdate?: UserProfileLocal;
  };
}

export interface ConflictResolution {
  entityType: string;
  entityId: string;
  conflictType: 'version' | 'simultaneous_edit' | 'deleted_dependency';
  localData: any;
  serverData: any;
  resolutionStrategy: 'server_wins' | 'client_wins' | 'merge' | 'manual';
  resolvedData?: any;
}

export interface SyncStats {
  totalCachedEntities: number;
  totalPendingTransactions: number;
  totalPendingEvents: number;
  lastSyncTime: Date;
  cacheSize: {
    poi: number;
    media: number;
    rewards: number;
    profile: number;
    loyalty: number;
  };
  syncHistory: Array<{
    timestamp: Date;
    status: 'success' | 'partial' | 'failed';
    entitiesSynced: number;
    conflictsResolved: number;
    duration: number;
  }>;
}

export interface NetworkStatus {
  isOnline: boolean;
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  strength: number; // 0-100
  lastOnlineTime?: Date;
  lastOfflineTime?: Date;
}

// Error classes
export class OfflineSyncError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'OfflineSyncError';
  }
}

export class SyncConflictError extends OfflineSyncError {
  constructor(entityType: string, entityId: string, details: any) {
    super(`Sync conflict for ${entityType}:${entityId}`, 'SYNC_CONFLICT', details);
  }
}

export class StorageQuotaExceededError extends OfflineSyncError {
  constructor(quotaUsed: number, quotaLimit: number) {
    super(`Storage quota exceeded: ${quotaUsed}/${quotaLimit} bytes`, 'STORAGE_QUOTA_EXCEEDED', {
      quotaUsed,
      quotaLimit
    });
  }
}

export class NetworkUnavailableError extends OfflineSyncError {
  constructor() {
    super('Network is unavailable for sync operation', 'NETWORK_UNAVAILABLE');
  }
}

export class EntityNotFoundError extends OfflineSyncError {
  constructor(entityType: string, entityId: string) {
    super(`Entity not found: ${entityType}:${entityId}`, 'ENTITY_NOT_FOUND', {
      entityType,
      entityId
    });
  }
}

export class OfflineSyncService {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private securityService: SecurityService;
  private localStorageService: LocalStorageService;
  private syncEngine: SyncEngine;
  private conflictResolver: ConflictResolver;
  private networkMonitor: NetworkMonitor;
  private queueManager: QueueManager;
  private cacheManager: CacheManager;
  private mediaCacheService: MediaCacheService;

  // Configuration
  private readonly MAX_CACHE_SIZE_MB = 200;
  private readonly MAX_TRANSACTION_QUEUE_SIZE = 500;
  private readonly MAX_ANALYTICS_QUEUE_SIZE = 1000;
  private readonly SYNC_INTERVAL_MINUTES = 5;
  private readonly SYNC_RETRY_ATTEMPTS = 5;
  private readonly SYNC_RETRY_BACKOFF_MS = 1000;
  private readonly MEDIA_CACHE_TTL_HOURS = 24;
  private readonly ENTITY_CACHE_TTL_HOURS = 6;

  // Network monitoring
  private networkStatus: NetworkStatus = {
    isOnline: false,
    connectionType: 'unknown',
    strength: 0
  };
  
  private syncInProgress = false;
  private backgroundSyncTimer?: NodeJS.Timeout;

  constructor() {
    this.logger = new Logger('OfflineSyncService');
    this.performanceMonitor = new PerformanceMonitor('OfflineSyncService');
    this.securityService = new SecurityService();
    this.localStorageService = new LocalStorageService();
    this.syncEngine = new SyncEngine();
    this.conflictResolver = new ConflictResolver();
    this.networkMonitor = new NetworkMonitor();
    this.queueManager = new QueueManager();
    this.cacheManager = new CacheManager();
    this.mediaCacheService = new MediaCacheService();
  }

  /**
   * Initialize the offline sync service
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing OfflineSyncService');

      // Initialize all sub-services
      await this.localStorageService.initialize();
      await this.syncEngine.initialize();
      await this.conflictResolver.initialize();
      await this.queueManager.initialize();
      await this.cacheManager.initialize();
      await this.mediaCacheService.initialize();

      // Setup network monitoring
      await this.setupNetworkMonitoring();

      // Perform initial cache validation
      await this.validateAndCleanupCache();

      // Start background sync scheduler
      await this.startBackgroundSync();

      this.logger.info('OfflineSyncService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OfflineSyncService', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Preload initial data for offline access
   */
  async preloadData(
    userID: string,
    terminalID: string,
    context: SyncSecurityContext
  ): Promise<{
    status: string;
    entitiesLoaded: number;
    cacheSize: number;
  }> {
    const startTime = Date.now();

    try {
      this.logger.info('Preloading offline data', { userID, terminalID });

      // Validate access
      await this.securityService.validateSyncRequest('sync.read', context);

      let entitiesLoaded = 0;

      // Preload POI data for terminal
      const poiData = await this.fetchPOIData(terminalID);
      await this.cacheManager.storePOIs(poiData);
      entitiesLoaded += poiData.length;

      // Preload media assets for POIs
      const mediaAssets = await this.fetchMediaAssets(poiData);
      await this.mediaCacheService.preloadAssets(mediaAssets);
      entitiesLoaded += mediaAssets.length;

      // Preload user loyalty data
      const loyaltyData = await this.fetchLoyaltyData(userID);
      if (loyaltyData) {
        await this.cacheManager.storeLoyaltyBalance(loyaltyData);
        entitiesLoaded += 1;
      }

      // Preload rewards catalog
      const rewardsData = await this.fetchRewardsData(loyaltyData?.tierID);
      if (rewardsData) {
        await this.cacheManager.storeRewards(rewardsData);
        entitiesLoaded += rewardsData.length;
      }

      // Preload user profile
      const profileData = await this.fetchUserProfile(userID);
      if (profileData) {
        await this.cacheManager.storeUserProfile(profileData);
        entitiesLoaded += 1;
      }

      // Update last sync times
      await this.updateLastSyncTimes();

      const cacheSize = await this.cacheManager.getTotalSize();

      // Record metrics
      await this.performanceMonitor.recordTiming('data_preload_duration', startTime, {
        userID,
        terminalID,
        entitiesLoaded
      });

      await this.performanceMonitor.recordMetric('entities_preloaded', entitiesLoaded);

      this.logger.info('Data preload completed', {
        userID,
        terminalID,
        entitiesLoaded,
        cacheSize,
        duration: Date.now() - startTime
      });

      return {
        status: 'completed',
        entitiesLoaded,
        cacheSize
      };

    } catch (error) {
      this.logger.error('Failed to preload data', {
        userID,
        terminalID,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('data_preload_errors', 1, {
        userID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Queue a transaction for offline processing
   */
  async queueTransaction(
    transaction: Omit<QueuedTransaction, 'queueID' | 'status' | 'createdAt' | 'updatedAt' | 'retryCount'>,
    context: SyncSecurityContext
  ): Promise<{
    queueID: string;
    status: string;
    estimatedSync?: Date;
  }> {
    const startTime = Date.now();

    try {
      this.logger.debug('Queueing offline transaction', {
        userID: transaction.userID,
        type: transaction.type
      });

      // Validate access
      await this.securityService.validateSyncRequest('sync.write', context);

      // Check queue size limits
      const queueSize = await this.queueManager.getTransactionQueueSize();
      if (queueSize >= this.MAX_TRANSACTION_QUEUE_SIZE) {
        await this.evictOldestTransactions();
      }

      // Create queued transaction
      const queuedTransaction: QueuedTransaction = {
        queueID: this.generateQueueID(),
        userID: transaction.userID,
        type: transaction.type,
        payload: transaction.payload,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        retryCount: 0,
        priority: transaction.priority || 5
      };

      // Store in queue
      await this.queueManager.addTransaction(queuedTransaction);

      // Apply optimistic updates to local cache
      await this.applyOptimisticUpdate(queuedTransaction);

      // Estimate sync time
      const estimatedSync = this.estimateNextSyncTime();

      // Record metrics
      await this.performanceMonitor.recordTiming('queue_transaction_duration', startTime, {
        userID: transaction.userID,
        type: transaction.type
      });

      await this.performanceMonitor.recordMetric('transactions_queued', 1, {
        type: transaction.type
      });

      this.logger.debug('Transaction queued successfully', {
        queueID: queuedTransaction.queueID,
        userID: transaction.userID,
        type: transaction.type,
        estimatedSync,
        duration: Date.now() - startTime
      });

      return {
        queueID: queuedTransaction.queueID,
        status: 'queued',
        estimatedSync
      };

    } catch (error) {
      this.logger.error('Failed to queue transaction', {
        userID: transaction.userID,
        type: transaction.type,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('queue_transaction_errors', 1, {
        userID: transaction.userID,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Queue an analytics event for offline tracking
   */
  async queueAnalyticsEvent(
    event: Omit<QueuedAnalyticsEvent, 'eventID' | 'status' | 'createdAt' | 'retryCount'>,
    context?: SyncSecurityContext
  ): Promise<{
    eventID: string;
    status: string;
  }> {
    const startTime = Date.now();

    try {
      this.logger.debug('Queueing analytics event', {
        eventType: event.eventType
      });

      // Check queue size limits
      const queueSize = await this.queueManager.getAnalyticsQueueSize();
      if (queueSize >= this.MAX_ANALYTICS_QUEUE_SIZE) {
        await this.evictOldestAnalytics();
      }

      // Create queued event
      const queuedEvent: QueuedAnalyticsEvent = {
        eventID: this.generateEventID(),
        eventType: event.eventType,
        payload: event.payload,
        status: 'pending',
        createdAt: new Date(),
        retryCount: 0
      };

      // Store in queue
      await this.queueManager.addAnalyticsEvent(queuedEvent);

      // Record metrics
      await this.performanceMonitor.recordTiming('queue_analytics_duration', startTime, {
        eventType: event.eventType
      });

      await this.performanceMonitor.recordMetric('analytics_events_queued', 1, {
        eventType: event.eventType
      });

      return {
        eventID: queuedEvent.eventID,
        status: 'queued'
      };

    } catch (error) {
      this.logger.error('Failed to queue analytics event', {
        eventType: event.eventType,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('queue_analytics_errors', 1, {
        eventType: event.eventType,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Perform sync operation when network is available
   */
  async performSync(
    context: SyncSecurityContext,
    forceSync: boolean = false
  ): Promise<{
    status: 'success' | 'partial' | 'failed';
    syncedTransactions: number;
    syncedEvents: number;
    conflictsResolved: number;
    errors?: string[];
  }> {
    const startTime = Date.now();

    try {
      this.logger.info('Starting sync operation', { forceSync });

      // Check if sync is already in progress
      if (this.syncInProgress && !forceSync) {
        this.logger.warn('Sync already in progress, skipping');
        return {
          status: 'failed',
          syncedTransactions: 0,
          syncedEvents: 0,
          conflictsResolved: 0,
          errors: ['Sync already in progress']
        };
      }

      // Check network availability
      if (!this.networkStatus.isOnline && !forceSync) {
        throw new NetworkUnavailableError();
      }

      this.syncInProgress = true;
      let syncedTransactions = 0;
      let syncedEvents = 0;
      let conflictsResolved = 0;
      const errors: string[] = [];

      try {
        // Build sync batch
        const syncBatch = await this.buildSyncBatch(context);

        if (syncBatch.transactions.length === 0 && syncBatch.analyticsEvents.length === 0) {
          this.logger.debug('No pending items to sync');
          return {
            status: 'success',
            syncedTransactions: 0,
            syncedEvents: 0,
            conflictsResolved: 0
          };
        }

        // Send sync batch to server
        const response = await this.syncEngine.submitBatch(syncBatch, context);

        // Process transaction results
        for (const result of response.transactionsResult) {
          try {
            await this.processTransactionResult(result);
            if (result.status === 'synced') {
              syncedTransactions++;
            } else if (result.status === 'conflict') {
              const resolved = await this.resolveConflict(result);
              if (resolved) {
                conflictsResolved++;
              }
            }
          } catch (error) {
            errors.push(`Transaction ${result.queueID}: ${error.message}`);
          }
        }

        // Process analytics results
        for (const result of response.analyticsResult) {
          try {
            await this.processAnalyticsResult(result);
            if (result.status === 'sent') {
              syncedEvents++;
            }
          } catch (error) {
            errors.push(`Analytics ${result.eventID}: ${error.message}`);
          }
        }

        // Apply server updates
        if (response.updates) {
          await this.applyServerUpdates(response.updates);
        }

        // Update last sync times
        await this.updateLastSyncTimes();

        // Record sync history
        await this.recordSyncHistory({
          timestamp: new Date(),
          status: errors.length === 0 ? 'success' : 'partial',
          entitiesSynced: syncedTransactions + syncedEvents,
          conflictsResolved,
          duration: Date.now() - startTime
        });

        // Record metrics
        await this.performanceMonitor.recordTiming('sync_operation_duration', startTime);
        await this.performanceMonitor.recordMetric('sync_operations_completed', 1);
        await this.performanceMonitor.recordMetric('transactions_synced', syncedTransactions);
        await this.performanceMonitor.recordMetric('analytics_events_synced', syncedEvents);
        await this.performanceMonitor.recordMetric('conflicts_resolved', conflictsResolved);

        this.logger.info('Sync operation completed', {
          status: errors.length === 0 ? 'success' : 'partial',
          syncedTransactions,
          syncedEvents,
          conflictsResolved,
          errors: errors.length,
          duration: Date.now() - startTime
        });

        return {
          status: errors.length === 0 ? 'success' : 'partial',
          syncedTransactions,
          syncedEvents,
          conflictsResolved,
          errors: errors.length > 0 ? errors : undefined
        };

      } finally {
        this.syncInProgress = false;
      }

    } catch (error) {
      this.syncInProgress = false;

      this.logger.error('Sync operation failed', {
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('sync_operations_failed', 1, {
        errorType: error.constructor.name
      });

      // Record failed sync in history
      await this.recordSyncHistory({
        timestamp: new Date(),
        status: 'failed',
        entitiesSynced: 0,
        conflictsResolved: 0,
        duration: Date.now() - startTime
      });

      return {
        status: 'failed',
        syncedTransactions: 0,
        syncedEvents: 0,
        conflictsResolved: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Get cached data by entity type and ID
   */
  async getCachedData<T extends SyncableEntity>(
    entityType: string,
    entityId: string,
    context?: SyncSecurityContext
  ): Promise<T | null> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting cached data', { entityType, entityId });

      let cachedData: T | null = null;

      switch (entityType) {
        case 'poi':
          cachedData = await this.cacheManager.getPOI(entityId) as T;
          break;
        case 'media':
          cachedData = await this.cacheManager.getMediaAsset(entityId) as T;
          break;
        case 'loyalty':
          cachedData = await this.cacheManager.getLoyaltyBalance(entityId) as T;
          break;
        case 'reward':
          cachedData = await this.cacheManager.getReward(entityId) as T;
          break;
        case 'profile':
          cachedData = await this.cacheManager.getUserProfile(entityId) as T;
          break;
        default:
          throw new OfflineSyncError(`Unknown entity type: ${entityType}`, 'UNKNOWN_ENTITY_TYPE');
      }

      // Update last accessed time for cache eviction
      if (cachedData) {
        await this.cacheManager.updateLastAccessed(entityType, entityId);
      }

      // Record metrics
      await this.performanceMonitor.recordTiming('cache_read_duration', startTime, {
        entityType
      });

      if (cachedData) {
        await this.performanceMonitor.recordMetric('cache_hits', 1, { entityType });
      } else {
        await this.performanceMonitor.recordMetric('cache_misses', 1, { entityType });
      }

      return cachedData;

    } catch (error) {
      this.logger.error('Failed to get cached data', {
        entityType,
        entityId,
        error: error.message,
        duration: Date.now() - startTime
      });

      await this.performanceMonitor.recordMetric('cache_read_errors', 1, {
        entityType,
        errorType: error.constructor.name
      });

      throw error;
    }
  }

  /**
   * Get current network status
   */
  getNetworkStatus(): NetworkStatus {
    return { ...this.networkStatus };
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(context: SyncSecurityContext): Promise<SyncStats> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting sync statistics');

      // Validate access
      await this.securityService.validateSyncRequest('sync.read', context);

      const [
        totalCachedEntities,
        totalPendingTransactions,
        totalPendingEvents,
        cacheSize,
        syncHistory
      ] = await Promise.all([
        this.cacheManager.getTotalEntities(),
        this.queueManager.getTransactionQueueSize(),
        this.queueManager.getAnalyticsQueueSize(),
        this.getCacheSizeBreakdown(),
        this.getSyncHistory()
      ]);

      const lastSyncTime = await this.getLastSyncTime();

      const stats: SyncStats = {
        totalCachedEntities,
        totalPendingTransactions,
        totalPendingEvents,
        lastSyncTime,
        cacheSize,
        syncHistory
      };

      // Record metrics
      await this.performanceMonitor.recordTiming('sync_stats_duration', startTime);

      return stats;

    } catch (error) {
      this.logger.error('Failed to get sync statistics', {
        error: error.message,
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Clear offline cache (user-initiated)
   */
  async clearOfflineCache(
    userID: string,
    context: SyncSecurityContext
  ): Promise<{
    status: string;
    clearedEntities: number;
    freedSpace: number;
  }> {
    const startTime = Date.now();

    try {
      this.logger.info('Clearing offline cache', { userID });

      // Validate access
      await this.securityService.validateSyncRequest('sync.write', context);

      const initialSize = await this.cacheManager.getTotalSize();

      // Clear all cached data
      const clearedEntities = await this.cacheManager.clearAll();

      // Clear media cache
      await this.mediaCacheService.clearAll();

      // Clear queues (optional - confirm with user)
      await this.queueManager.clearAll();

      const finalSize = await this.cacheManager.getTotalSize();
      const freedSpace = initialSize - finalSize;

      // Record metrics
      await this.performanceMonitor.recordTiming('cache_clear_duration', startTime, {
        userID
      });

      await this.performanceMonitor.recordMetric('cache_cleared', 1, {
        userID,
        clearedEntities,
        freedSpace
      });

      this.logger.info('Offline cache cleared', {
        userID,
        clearedEntities,
        freedSpace,
        duration: Date.now() - startTime
      });

      return {
        status: 'cleared',
        clearedEntities,
        freedSpace
      };

    } catch (error) {
      this.logger.error('Failed to clear offline cache', {
        userID,
        error: error.message,
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async setupNetworkMonitoring(): Promise<void> {
    this.networkMonitor.on('online', async () => {
      this.logger.info('Network is online');
      this.networkStatus.isOnline = true;
      this.networkStatus.lastOnlineTime = new Date();
      
      // Trigger sync when network becomes available
      try {
        await this.performSync({ userID: 'system' } as SyncSecurityContext);
      } catch (error) {
        this.logger.error('Auto-sync failed after network reconnection', {
          error: error.message
        });
      }
    });

    this.networkMonitor.on('offline', () => {
      this.logger.info('Network is offline');
      this.networkStatus.isOnline = false;
      this.networkStatus.lastOfflineTime = new Date();
    });

    this.networkMonitor.on('status-change', (status: NetworkStatus) => {
      this.networkStatus = { ...this.networkStatus, ...status };
    });

    await this.networkMonitor.start();
  }

  private async startBackgroundSync(): Promise<void> {
    if (this.backgroundSyncTimer) {
      clearInterval(this.backgroundSyncTimer);
    }

    this.backgroundSyncTimer = setInterval(async () => {
      if (this.networkStatus.isOnline && !this.syncInProgress) {
        try {
          await this.performSync({ userID: 'system' } as SyncSecurityContext);
        } catch (error) {
          this.logger.error('Background sync failed', {
            error: error.message
          });
        }
      }
    }, this.SYNC_INTERVAL_MINUTES * 60 * 1000);

    this.logger.info('Background sync scheduler started', {
      intervalMinutes: this.SYNC_INTERVAL_MINUTES
    });
  }

  private async validateAndCleanupCache(): Promise<void> {
    // Check storage quota
    const totalSize = await this.cacheManager.getTotalSize();
    const maxSizeBytes = this.MAX_CACHE_SIZE_MB * 1024 * 1024;

    if (totalSize > maxSizeBytes) {
      this.logger.warn('Cache size exceeds limit, triggering cleanup', {
        totalSize,
        maxSizeBytes
      });
      await this.performCacheEviction();
    }

    // Validate entity integrity
    await this.cacheManager.validateIntegrity();

    // Clean up expired entities
    await this.cacheManager.cleanupExpired();
  }

  private async buildSyncBatch(context: SyncSecurityContext): Promise<SyncBatchRequest> {
    const [pendingTransactions, pendingEvents, lastSyncTimes] = await Promise.all([
      this.queueManager.getPendingTransactions(),
      this.queueManager.getPendingAnalyticsEvents(),
      this.getLastSyncTimes()
    ]);

    return {
      userID: context.userID,
      transactions: pendingTransactions.slice(0, 50), // Batch limit
      analyticsEvents: pendingEvents.slice(0, 100), // Batch limit
      lastSyncTimes
    };
  }

  private async applyOptimisticUpdate(transaction: QueuedTransaction): Promise<void> {
    // Apply optimistic updates to local cache based on transaction type
    switch (transaction.type) {
      case 'earn':
        await this.applyOptimisticEarnUpdate(transaction);
        break;
      case 'redeem':
        await this.applyOptimisticRedeemUpdate(transaction);
        break;
      case 'profile_update':
        await this.applyOptimisticProfileUpdate(transaction);
        break;
    }
  }

  private async applyOptimisticEarnUpdate(transaction: QueuedTransaction): Promise<void> {
    const loyalty = await this.cacheManager.getLoyaltyBalance(transaction.userID);
    if (loyalty && transaction.payload.points) {
      loyalty.pointsBalance += transaction.payload.points;
      loyalty.lastUpdated = new Date();
      await this.cacheManager.storeLoyaltyBalance(loyalty);
    }
  }

  private async applyOptimisticRedeemUpdate(transaction: QueuedTransaction): Promise<void> {
    const loyalty = await this.cacheManager.getLoyaltyBalance(transaction.userID);
    if (loyalty && transaction.payload.pointsCost) {
      loyalty.pointsBalance -= transaction.payload.pointsCost;
      loyalty.lastUpdated = new Date();
      await this.cacheManager.storeLoyaltyBalance(loyalty);
    }
  }

  private async applyOptimisticProfileUpdate(transaction: QueuedTransaction): Promise<void> {
    const profile = await this.cacheManager.getUserProfile(transaction.userID);
    if (profile && transaction.payload.preferences) {
      profile.preferences = { ...profile.preferences, ...transaction.payload.preferences };
      profile.lastUpdated = new Date();
      await this.cacheManager.storeUserProfile(profile);
    }
  }

  private async processTransactionResult(result: any): Promise<void> {
    const transaction = await this.queueManager.getTransaction(result.queueID);
    if (!transaction) return;

    switch (result.status) {
      case 'synced':
        await this.queueManager.markTransactionSynced(result.queueID);
        if (result.serverData) {
          await this.updateCacheWithServerData(transaction, result.serverData);
        }
        break;
      case 'conflict':
        await this.queueManager.markTransactionConflict(result.queueID, result.error);
        break;
      case 'failed':
        await this.queueManager.incrementRetryCount(result.queueID);
        break;
    }
  }

  private async processAnalyticsResult(result: any): Promise<void> {
    switch (result.status) {
      case 'sent':
        await this.queueManager.markAnalyticsEventSent(result.eventID);
        break;
      case 'failed':
        await this.queueManager.incrementAnalyticsRetryCount(result.eventID);
        break;
    }
  }

  private async resolveConflict(result: any): Promise<boolean> {
    try {
      const resolution = await this.conflictResolver.resolve({
        entityType: result.entityType,
        entityId: result.entityId,
        conflictType: result.conflictType,
        localData: result.localData,
        serverData: result.serverData,
        resolutionStrategy: 'server_wins' // Default strategy
      });

      if (resolution.resolvedData) {
        await this.applyResolvedData(resolution);
        return true;
      }
    } catch (error) {
      this.logger.error('Failed to resolve conflict', {
        queueID: result.queueID,
        error: error.message
      });
    }
    return false;
  }

  private async applyResolvedData(resolution: ConflictResolution): Promise<void> {
    // Apply resolved data to local cache
    switch (resolution.entityType) {
      case 'loyalty':
        await this.cacheManager.storeLoyaltyBalance(resolution.resolvedData);
        break;
      case 'profile':
        await this.cacheManager.storeUserProfile(resolution.resolvedData);
        break;
      case 'reward':
        await this.cacheManager.storeReward(resolution.resolvedData);
        break;
    }
  }

  private async applyServerUpdates(updates: any): Promise<void> {
    if (updates.poiUpdates) {
      await this.cacheManager.updatePOIs(updates.poiUpdates);
    }

    if (updates.mediaUpdates) {
      await this.mediaCacheService.updateAssets(updates.mediaUpdates);
    }

    if (updates.loyaltyBalanceUpdate) {
      await this.cacheManager.storeLoyaltyBalance(updates.loyaltyBalanceUpdate);
    }

    if (updates.rewardsCatalogUpdates) {
      await this.cacheManager.updateRewards(updates.rewardsCatalogUpdates);
    }

    if (updates.userProfileUpdate) {
      await this.cacheManager.storeUserProfile(updates.userProfileUpdate);
    }
  }

  private async updateCacheWithServerData(transaction: QueuedTransaction, serverData: any): Promise<void> {
    // Update local cache with authoritative server data
    switch (transaction.type) {
      case 'earn':
      case 'redeem':
        if (serverData.loyaltyBalance) {
          await this.cacheManager.storeLoyaltyBalance(serverData.loyaltyBalance);
        }
        break;
      case 'profile_update':
        if (serverData.userProfile) {
          await this.cacheManager.storeUserProfile(serverData.userProfile);
        }
        break;
    }
  }

  private async performCacheEviction(): Promise<void> {
    // Implement LRU eviction strategy
    await this.cacheManager.performLRUEviction(this.MAX_CACHE_SIZE_MB);
    await this.mediaCacheService.performLRUEviction(this.MAX_CACHE_SIZE_MB / 2);
  }

  private async evictOldestTransactions(): Promise<void> {
    const evicted = await this.queueManager.evictOldestTransactions(100);
    this.logger.warn('Evicted oldest transactions due to queue size limit', {
      evictedCount: evicted
    });
  }

  private async evictOldestAnalytics(): Promise<void> {
    const evicted = await this.queueManager.evictOldestAnalytics(200);
    this.logger.warn('Evicted oldest analytics events due to queue size limit', {
      evictedCount: evicted
    });
  }

  private async getCacheSizeBreakdown(): Promise<any> {
    return {
      poi: await this.cacheManager.getPOICacheSize(),
      media: await this.mediaCacheService.getCacheSize(),
      rewards: await this.cacheManager.getRewardsCacheSize(),
      profile: await this.cacheManager.getProfileCacheSize(),
      loyalty: await this.cacheManager.getLoyaltyCacheSize()
    };
  }

  private async getSyncHistory(): Promise<any[]> {
    return await this.localStorageService.getSyncHistory();
  }

  private async recordSyncHistory(entry: any): Promise<void> {
    await this.localStorageService.recordSyncHistory(entry);
  }

  private async getLastSyncTime(): Promise<Date> {
    return await this.localStorageService.getLastSyncTime();
  }

  private async getLastSyncTimes(): Promise<any> {
    return await this.localStorageService.getLastSyncTimes();
  }

  private async updateLastSyncTimes(): Promise<void> {
    await this.localStorageService.updateLastSyncTimes(new Date());
  }

  private estimateNextSyncTime(): Date {
    if (this.networkStatus.isOnline) {
      return new Date(); // Immediate if online
    }
    return new Date(Date.now() + (this.SYNC_INTERVAL_MINUTES * 60 * 1000));
  }

  private generateQueueID(): string {
    return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventID(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Mock data fetching methods (would integrate with actual APIs)
  private async fetchPOIData(terminalID: string): Promise<POILocal[]> {
    // Implementation would fetch from POI service
    return [];
  }

  private async fetchMediaAssets(pois: POILocal[]): Promise<any[]> {
    // Implementation would fetch media for POIs
    return [];
  }

  private async fetchLoyaltyData(userID: string): Promise<LoyaltyBalanceLocal | null> {
    // Implementation would fetch from loyalty service
    return null;
  }

  private async fetchRewardsData(tierID?: string): Promise<RewardLocal[] | null> {
    // Implementation would fetch from rewards service
    return null;
  }

  private async fetchUserProfile(userID: string): Promise<UserProfileLocal | null> {
    // Implementation would fetch from user profile service
    return null;
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    dependencies: { [key: string]: boolean };
    metrics: any;
  }> {
    const [storageHealth, syncEngineHealth, cacheHealth, queueHealth] = await Promise.all([
      this.localStorageService.getHealth(),
      this.syncEngine.getHealth(),
      this.cacheManager.getHealth(),
      this.queueManager.getHealth()
    ]);

    const healthyServices = [
      storageHealth.available,
      syncEngineHealth.available,
      cacheHealth.available,
      queueHealth.available
    ].filter(s => s).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyServices === 4) {
      status = 'healthy';
    } else if (healthyServices > 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      dependencies: {
        storage: storageHealth.available,
        syncEngine: syncEngineHealth.available,
        cache: cacheHealth.available,
        queue: queueHealth.available,
        network: this.networkStatus.isOnline
      },
      metrics: {
        avgSyncTime: this.performanceMonitor.getMetricStats('sync_operation_duration')?.avg || 0,
        pendingTransactions: await this.queueManager.getTransactionQueueSize(),
        pendingEvents: await this.queueManager.getAnalyticsQueueSize(),
        cacheSize: await this.cacheManager.getTotalSize(),
        lastSyncTime: await this.getLastSyncTime()
      }
    };
  }
} 
