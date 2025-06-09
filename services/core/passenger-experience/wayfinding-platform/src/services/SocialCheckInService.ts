/**
 * Social Check-In Service
 * Feature 12: SOCIAL_CHECKIN_001
 * 
 * Enterprise-grade service for social features including friend connections,
 * live location sharing, POI check-ins, and AR-based messaging/beacons.
 * 
 * @version 1.0.0
 * @author AeroFusionXR Platform Team
 * @since 2025-01-27
 */

export interface UserProfile {
  userID: string;
  displayName: string;
  email: string;
  avatarURL: string;
  joinedDate: string;
  lastSeen: string;
  privacySettings: {
    shareLocation: boolean;
    shareCheckins: boolean;
    allowBeacons: boolean;
    visibleToFriends: boolean;
  };
  preferences: {
    notificationTypes: string[];
    autoCheckIn: boolean;
    defaultLocationAccuracy: number; // meters
  };
}

export interface Friendship {
  friendshipID: string;
  initiatorUserID: string;
  recipientUserID: string;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  requestDate: string;
  acceptedDate?: string;
  mutualFriends: number;
  sharedInterests: string[];
}

export interface LocationUpdate {
  updateID: string;
  userID: string;
  location: {
    x: number;
    y: number;
    z: number;
    latitude?: number;
    longitude?: number;
    floor: string;
    building: string;
    accuracy: number; // meters
  };
  timestamp: string;
  source: 'gps' | 'indoor' | 'beacon' | 'manual';
  isPublic: boolean;
  expiresAt: string;
}

export interface CheckIn {
  checkinID: string;
  userID: string;
  poiID: string;
  poiName: string;
  poiCategory: string;
  location: {
    x: number;
    y: number;
    z: number;
    floor: string;
    building: string;
  };
  content: {
    text?: string;
    photos: CheckInPhoto[];
    rating?: number; // 1-5 stars
    tags: string[];
  };
  visibility: 'public' | 'friends' | 'private';
  timestamp: string;
  expiresAt?: string;
  socialMetrics: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
}

export interface CheckInPhoto {
  photoID: string;
  url: string;
  thumbnailUrl: string;
  caption?: string;
  metadata: {
    width: number;
    height: number;
    fileSize: number;
    format: string;
    capturedAt: string;
  };
}

export interface ARBeacon {
  beaconID: string;
  fromUserID: string;
  toUserID: string;
  message: string;
  location: {
    x: number;
    y: number;
    z: number;
    floor: string;
    building: string;
  };
  beaconType: 'message' | 'meetup' | 'alert' | 'direction';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
  acknowledged: boolean;
  acknowledgedAt?: string;
  visualStyle: {
    color: string;
    icon: string;
    animation: 'pulse' | 'rotate' | 'bounce' | 'static';
    scale: number;
  };
}

export interface SocialFeed {
  feedID: string;
  userID: string;
  items: SocialFeedItem[];
  lastUpdated: string;
  unreadCount: number;
  filters: {
    friendsOnly: boolean;
    categories: string[];
    dateRange?: { start: string; end: string };
  };
}

export interface SocialFeedItem {
  itemID: string;
  type: 'checkin' | 'beacon' | 'friendship' | 'achievement' | 'location_share';
  sourceUserID: string;
  sourceUserName: string;
  sourceUserAvatar: string;
  content: any; // Type-specific content
  timestamp: string;
  isRead: boolean;
  priority: number;
  actionRequired: boolean;
  actions?: SocialAction[];
}

export interface SocialAction {
  actionID: string;
  type: 'like' | 'comment' | 'share' | 'navigate' | 'accept_friend' | 'view_beacon';
  label: string;
  actionData: { [key: string]: any };
  enabled: boolean;
}

export interface PresenceStatus {
  userID: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  location?: {
    building: string;
    floor: string;
    zone: string;
    approximateLocation: string; // "Near Gate A12"
  };
  lastActivity: string;
  currentActivity?: string; // "Viewing restaurants", "In AR mode"
  deviceType: 'mobile' | 'tablet' | 'ar_headset';
}

export interface SocialNotification {
  notificationID: string;
  recipientUserID: string;
  type: 'friend_request' | 'checkin_like' | 'beacon_received' | 'location_share' | 'achievement';
  title: string;
  message: string;
  actionData?: { [key: string]: any };
  timestamp: string;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high';
  expiresAt?: string;
}

export class SocialCheckInService {
  private userProfiles: Map<string, UserProfile> = new Map();
  private friendships: Map<string, Friendship> = new Map();
  private userFriends: Map<string, Set<string>> = new Map(); // userID -> friend userIDs
  private locationUpdates: Map<string, LocationUpdate> = new Map(); // userID -> latest location
  private checkIns: Map<string, CheckIn> = new Map();
  private arBeacons: Map<string, ARBeacon> = new Map();
  private socialFeeds: Map<string, SocialFeed> = new Map();
  private presenceStatuses: Map<string, PresenceStatus> = new Map();
  private socialNotifications: Map<string, SocialNotification[]> = new Map();
  private webSocketConnection: any = null;
  private photoUploadQueue: Map<string, File[]> = new Map();
  private offlineActions: Map<string, any[]> = new Map();
  private readonly logger: any;
  private isInitialized: boolean = false;
  private currentUserID: string | null = null;
  private locationSharingInterval: any = null;
  private presenceUpdateInterval: any = null;
  private beaconCleanupInterval: any = null;
  private socialMetrics: {
    totalCheckIns: number;
    totalBeacons: number;
    activeFriendships: number;
    averageResponseTime: number;
  };

  constructor() {
    this.logger = {
      debug: (message: string, ...args: any[]) => console.log(`[DEBUG] SocialCheckIn: ${message}`, ...args),
      info: (message: string, ...args: any[]) => console.info(`[INFO] SocialCheckIn: ${message}`, ...args),
      warn: (message: string, ...args: any[]) => console.warn(`[WARN] SocialCheckIn: ${message}`, ...args),
      error: (message: string, ...args: any[]) => console.error(`[ERROR] SocialCheckIn: ${message}`, ...args)
    };

    this.socialMetrics = {
      totalCheckIns: 0,
      totalBeacons: 0,
      activeFriendships: 0,
      averageResponseTime: 0
    };

    this.initializeSocialCheckInService();
  }

  private async initializeSocialCheckInService(): Promise<void> {
    try {
      this.logger.info('Initializing Social Check-In Service');

      await Promise.all([
        this.initializeWebSocketConnection(),
        this.loadUserProfiles(),
        this.loadFriendships(),
        this.initializePhotoUploadSystem(),
        this.setupOfflineQueueProcessing()
      ]);

      this.startLocationSharing();
      this.startPresenceUpdates();
      this.startBeaconCleanup();

      this.isInitialized = true;
      this.logger.info('Social Check-In Service initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize Social Check-In Service:', error);
      throw error;
    }
  }

  private async initializeWebSocketConnection(): Promise<void> {
    this.webSocketConnection = {
      isConnected: false,
      lastConnectionTime: 0,
      reconnectAttempts: 0,
      maxReconnectAttempts: 5,

      async connect(): Promise<void> {
        // Mock WebSocket connection
        this.isConnected = true;
        this.lastConnectionTime = Date.now();
        this.reconnectAttempts = 0;
      },

      async disconnect(): Promise<void> {
        this.isConnected = false;
      },

      send(message: any): void {
        if (!this.isConnected) {
          throw new Error('WebSocket not connected');
        }
        // Mock message sending
      },

      onMessage(callback: (message: any) => void): void {
        // Mock message receiving
        // In real implementation, this would set up WebSocket event handlers
      },

      async reconnect(): Promise<void> {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const backoffDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
          
          setTimeout(async () => {
            try {
              await this.connect();
            } catch (error) {
              console.error('WebSocket reconnection failed:', error);
              await this.reconnect();
            }
          }, backoffDelay);
        }
      }
    };

    await this.webSocketConnection.connect();

    // Set up message handlers
    this.webSocketConnection.onMessage((message: any) => {
      this.handleWebSocketMessage(message);
    });
  }

  private async loadUserProfiles(): Promise<void> {
    // Mock user profiles loading
    const mockProfiles = [
      {
        userID: 'user_alice_001',
        displayName: 'Alice Johnson',
        email: 'alice@example.com',
        avatarURL: 'https://cdn.airport.com/avatars/alice.jpg',
        joinedDate: '2024-12-01T00:00:00Z',
        lastSeen: new Date().toISOString(),
        privacySettings: {
          shareLocation: true,
          shareCheckins: true,
          allowBeacons: true,
          visibleToFriends: true
        },
        preferences: {
          notificationTypes: ['friend_request', 'checkin_like', 'beacon_received'],
          autoCheckIn: false,
          defaultLocationAccuracy: 5
        }
      },
      {
        userID: 'user_bob_002',
        displayName: 'Bob Smith',
        email: 'bob@example.com',
        avatarURL: 'https://cdn.airport.com/avatars/bob.jpg',
        joinedDate: '2024-11-15T00:00:00Z',
        lastSeen: new Date(Date.now() - 300000).toISOString(),
        privacySettings: {
          shareLocation: true,
          shareCheckins: true,
          allowBeacons: true,
          visibleToFriends: true
        },
        preferences: {
          notificationTypes: ['friend_request', 'beacon_received'],
          autoCheckIn: true,
          defaultLocationAccuracy: 10
        }
      }
    ];

    for (const profile of mockProfiles) {
      this.userProfiles.set(profile.userID, profile);
    }

    this.logger.info(`Loaded ${mockProfiles.length} user profiles`);
  }

  private async loadFriendships(): Promise<void> {
    // Mock friendships data
    const mockFriendships = [
      {
        friendshipID: 'friendship_001',
        initiatorUserID: 'user_alice_001',
        recipientUserID: 'user_bob_002',
        status: 'accepted' as const,
        requestDate: '2024-12-15T10:00:00Z',
        acceptedDate: '2024-12-15T10:30:00Z',
        mutualFriends: 5,
        sharedInterests: ['coffee', 'travel', 'photography']
      }
    ];

    for (const friendship of mockFriendships) {
      this.friendships.set(friendship.friendshipID, friendship);
      
      // Update user friends mapping
      if (friendship.status === 'accepted') {
        this.addToFriendsMapping(friendship.initiatorUserID, friendship.recipientUserID);
        this.addToFriendsMapping(friendship.recipientUserID, friendship.initiatorUserID);
        this.socialMetrics.activeFriendships++;
      }
    }

    this.logger.info(`Loaded ${mockFriendships.length} friendships`);
  }

  private addToFriendsMapping(userID: string, friendUserID: string): void {
    if (!this.userFriends.has(userID)) {
      this.userFriends.set(userID, new Set());
    }
    this.userFriends.get(userID)!.add(friendUserID);
  }

  private async initializePhotoUploadSystem(): Promise<void> {
    // Mock photo upload system
    this.logger.debug('Initialized photo upload system with queue processing');
  }

  private setupOfflineQueueProcessing(): void {
    // Process offline actions when connection is restored
    setInterval(() => {
      if (this.webSocketConnection.isConnected) {
        this.processOfflineQueue();
      }
    }, 5000);
  }

  private async processOfflineQueue(): Promise<void> {
    for (const [userID, actions] of this.offlineActions) {
      for (const action of actions) {
        try {
          await this.executeOfflineAction(action);
        } catch (error) {
          this.logger.error(`Failed to process offline action for user ${userID}:`, error);
        }
      }
      this.offlineActions.delete(userID);
    }
  }

  private async executeOfflineAction(action: any): Promise<void> {
    switch (action.type) {
      case 'checkin':
        await this.createCheckIn(action.data.userID, action.data.checkInData);
        break;
      case 'beacon':
        await this.sendBeacon(action.data.fromUserID, action.data.toUserID, action.data.beaconData);
        break;
      case 'location_update':
        await this.updateUserLocation(action.data.userID, action.data.location);
        break;
      default:
        this.logger.warn(`Unknown offline action type: ${action.type}`);
    }
  }

  private handleWebSocketMessage(message: any): void {
    try {
      switch (message.type) {
        case 'location_update':
          this.handleLocationUpdate(message.data);
          break;
        case 'checkin_broadcast':
          this.handleCheckInBroadcast(message.data);
          break;
        case 'beacon_receive':
          this.handleBeaconReceive(message.data);
          break;
        case 'friend_request':
          this.handleFriendRequest(message.data);
          break;
        case 'presence_update':
          this.handlePresenceUpdate(message.data);
          break;
        default:
          this.logger.warn(`Unknown WebSocket message type: ${message.type}`);
      }
    } catch (error) {
      this.logger.error('Error handling WebSocket message:', error);
    }
  }

  private handleLocationUpdate(data: LocationUpdate): void {
    this.locationUpdates.set(data.userID, data);
    this.updateSocialFeed(data.userID, {
      type: 'location_share',
      content: data,
      timestamp: data.timestamp
    });
  }

  private handleCheckInBroadcast(data: CheckIn): void {
    this.checkIns.set(data.checkinID, data);
    this.updateSocialFeed(data.userID, {
      type: 'checkin',
      content: data,
      timestamp: data.timestamp
    });
  }

  private handleBeaconReceive(data: ARBeacon): void {
    this.arBeacons.set(data.beaconID, data);
    this.sendNotification(data.toUserID, {
      type: 'beacon_received',
      title: 'New Beacon',
      message: `${this.userProfiles.get(data.fromUserID)?.displayName} sent you a beacon`,
      actionData: { beaconID: data.beaconID }
    });
  }

  private handleFriendRequest(data: Friendship): void {
    this.friendships.set(data.friendshipID, data);
    this.sendNotification(data.recipientUserID, {
      type: 'friend_request',
      title: 'Friend Request',
      message: `${this.userProfiles.get(data.initiatorUserID)?.displayName} wants to be your friend`,
      actionData: { friendshipID: data.friendshipID }
    });
  }

  private handlePresenceUpdate(data: PresenceStatus): void {
    this.presenceStatuses.set(data.userID, data);
  }

  private updateSocialFeed(userID: string, feedItem: Partial<SocialFeedItem>): void {
    const friends = this.userFriends.get(userID) || new Set();
    
    for (const friendID of friends) {
      let feed = this.socialFeeds.get(friendID);
      if (!feed) {
        feed = {
          feedID: `feed_${friendID}`,
          userID: friendID,
          items: [],
          lastUpdated: new Date().toISOString(),
          unreadCount: 0,
          filters: {
            friendsOnly: true,
            categories: []
          }
        };
        this.socialFeeds.set(friendID, feed);
      }

      const fullFeedItem: SocialFeedItem = {
        itemID: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sourceUserID: userID,
        sourceUserName: this.userProfiles.get(userID)?.displayName || 'Unknown User',
        sourceUserAvatar: this.userProfiles.get(userID)?.avatarURL || '',
        isRead: false,
        priority: 1,
        actionRequired: false,
        ...feedItem
      } as SocialFeedItem;

      feed.items.unshift(fullFeedItem);
      feed.items = feed.items.slice(0, 100); // Keep only latest 100 items
      feed.unreadCount++;
      feed.lastUpdated = new Date().toISOString();
    }
  }

  private sendNotification(userID: string, notification: Partial<SocialNotification>): void {
    const fullNotification: SocialNotification = {
      notificationID: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      recipientUserID: userID,
      timestamp: new Date().toISOString(),
      isRead: false,
      priority: 'medium',
      ...notification
    } as SocialNotification;

    if (!this.socialNotifications.has(userID)) {
      this.socialNotifications.set(userID, []);
    }
    this.socialNotifications.get(userID)!.push(fullNotification);

    // Send push notification in real implementation
    this.logger.info(`Notification sent to user ${userID}: ${fullNotification.title}`);
  }

  private startLocationSharing(): void {
    this.locationSharingInterval = setInterval(() => {
      if (this.currentUserID && this.webSocketConnection.isConnected) {
        const userProfile = this.userProfiles.get(this.currentUserID);
        if (userProfile?.privacySettings.shareLocation) {
          // Mock location sharing
          this.shareCurrentLocation();
        }
      }
    }, 5000); // Every 5 seconds
  }

  private startPresenceUpdates(): void {
    this.presenceUpdateInterval = setInterval(() => {
      if (this.currentUserID) {
        this.updatePresenceStatus(this.currentUserID, 'online');
      }
    }, 30000); // Every 30 seconds
  }

  private startBeaconCleanup(): void {
    this.beaconCleanupInterval = setInterval(() => {
      this.cleanupExpiredBeacons();
    }, 60000); // Every minute
  }

  private cleanupExpiredBeacons(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [beaconID, beacon] of this.arBeacons) {
      if (new Date(beacon.expiresAt) < now) {
        this.arBeacons.delete(beaconID);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired beacons`);
    }
  }

  private async shareCurrentLocation(): Promise<void> {
    // Mock current location - in real implementation, this would come from location service
    const mockLocation = {
      x: Math.random() * 100,
      y: Math.random() * 100,
      z: 0,
      latitude: 25.2532 + (Math.random() - 0.5) * 0.01,
      longitude: 55.3657 + (Math.random() - 0.5) * 0.01,
      floor: '2',
      building: 'Terminal 3',
      accuracy: 5
    };

    await this.updateUserLocation(this.currentUserID!, mockLocation);
  }

  public async authenticateUser(userID: string): Promise<UserProfile> {
    try {
      this.currentUserID = userID;
      
      let profile = this.userProfiles.get(userID);
      if (!profile) {
        // Create new user profile
        profile = {
          userID,
          displayName: `User ${userID.slice(-4)}`,
          email: `${userID}@example.com`,
          avatarURL: `https://cdn.airport.com/avatars/default.jpg`,
          joinedDate: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          privacySettings: {
            shareLocation: false,
            shareCheckins: true,
            allowBeacons: true,
            visibleToFriends: true
          },
          preferences: {
            notificationTypes: ['friend_request'],
            autoCheckIn: false,
            defaultLocationAccuracy: 10
          }
        };
        this.userProfiles.set(userID, profile);
      }

      // Update last seen
      profile.lastSeen = new Date().toISOString();

      // Initialize social feed if not exists
      if (!this.socialFeeds.has(userID)) {
        this.socialFeeds.set(userID, {
          feedID: `feed_${userID}`,
          userID,
          items: [],
          lastUpdated: new Date().toISOString(),
          unreadCount: 0,
          filters: {
            friendsOnly: true,
            categories: []
          }
        });
      }

      this.logger.info(`User ${userID} authenticated successfully`);
      return profile;

    } catch (error) {
      this.logger.error(`Failed to authenticate user ${userID}:`, error);
      throw error;
    }
  }

  public async sendFriendRequest(fromUserID: string, toUserID: string): Promise<string> {
    try {
      const friendshipID = `friendship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const friendship: Friendship = {
        friendshipID,
        initiatorUserID: fromUserID,
        recipientUserID: toUserID,
        status: 'pending',
        requestDate: new Date().toISOString(),
        mutualFriends: 0,
        sharedInterests: []
      };

      this.friendships.set(friendshipID, friendship);

      // Send via WebSocket if connected, otherwise queue for offline processing
      if (this.webSocketConnection.isConnected) {
        this.webSocketConnection.send({
          type: 'friend_request',
          data: friendship
        });
      } else {
        this.queueOfflineAction(fromUserID, {
          type: 'friend_request',
          data: friendship
        });
      }

      this.logger.info(`Friend request sent from ${fromUserID} to ${toUserID}`);
      return friendshipID;

    } catch (error) {
      this.logger.error(`Failed to send friend request:`, error);
      throw error;
    }
  }

  public async acceptFriendRequest(friendshipID: string): Promise<void> {
    try {
      const friendship = this.friendships.get(friendshipID);
      if (!friendship) {
        throw new Error(`Friendship not found: ${friendshipID}`);
      }

      friendship.status = 'accepted';
      friendship.acceptedDate = new Date().toISOString();

      // Add to friends mapping
      this.addToFriendsMapping(friendship.initiatorUserID, friendship.recipientUserID);
      this.addToFriendsMapping(friendship.recipientUserID, friendship.initiatorUserID);
      this.socialMetrics.activeFriendships++;

      this.logger.info(`Friendship ${friendshipID} accepted`);

    } catch (error) {
      this.logger.error(`Failed to accept friend request ${friendshipID}:`, error);
      throw error;
    }
  }

  public async updateUserLocation(userID: string, location: Partial<LocationUpdate['location']>): Promise<void> {
    try {
      const userProfile = this.userProfiles.get(userID);
      if (!userProfile?.privacySettings.shareLocation) {
        return; // User has disabled location sharing
      }

      const locationUpdate: LocationUpdate = {
        updateID: `loc_${Date.now()}_${userID}`,
        userID,
        location: {
          x: location.x || 0,
          y: location.y || 0,
          z: location.z || 0,
          latitude: location.latitude,
          longitude: location.longitude,
          floor: location.floor || '1',
          building: location.building || 'Terminal 3',
          accuracy: location.accuracy || userProfile.preferences.defaultLocationAccuracy
        },
        timestamp: new Date().toISOString(),
        source: 'indoor', // Mock source
        isPublic: false,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
      };

      this.locationUpdates.set(userID, locationUpdate);

      // Broadcast to friends if connected
      if (this.webSocketConnection.isConnected) {
        this.webSocketConnection.send({
          type: 'location_update',
          data: locationUpdate
        });
      } else {
        this.queueOfflineAction(userID, {
          type: 'location_update',
          data: { userID, location }
        });
      }

    } catch (error) {
      this.logger.error(`Failed to update location for user ${userID}:`, error);
      throw error;
    }
  }

  public async createCheckIn(userID: string, checkInData: {
    poiID: string;
    poiName: string;
    poiCategory: string;
    location: CheckIn['location'];
    content?: Partial<CheckIn['content']>;
    visibility?: CheckIn['visibility'];
  }): Promise<string> {
    try {
      const checkinID = `checkin_${Date.now()}_${userID}`;
      
      const checkIn: CheckIn = {
        checkinID,
        userID,
        poiID: checkInData.poiID,
        poiName: checkInData.poiName,
        poiCategory: checkInData.poiCategory,
        location: checkInData.location,
        content: {
          text: checkInData.content?.text || '',
          photos: checkInData.content?.photos || [],
          rating: checkInData.content?.rating,
          tags: checkInData.content?.tags || []
        },
        visibility: checkInData.visibility || 'friends',
        timestamp: new Date().toISOString(),
        socialMetrics: {
          likes: 0,
          comments: 0,
          shares: 0,
          views: 0
        }
      };

      this.checkIns.set(checkinID, checkIn);
      this.socialMetrics.totalCheckIns++;

      // Broadcast to friends if connected
      if (this.webSocketConnection.isConnected) {
        this.webSocketConnection.send({
          type: 'checkin_broadcast',
          data: checkIn
        });
      } else {
        this.queueOfflineAction(userID, {
          type: 'checkin',
          data: { userID, checkInData }
        });
      }

      this.logger.info(`Check-in created: ${checkinID} at ${checkInData.poiName}`);
      return checkinID;

    } catch (error) {
      this.logger.error(`Failed to create check-in for user ${userID}:`, error);
      throw error;
    }
  }

  public async sendBeacon(fromUserID: string, toUserID: string, beaconData: {
    message: string;
    location: ARBeacon['location'];
    beaconType?: ARBeacon['beaconType'];
    priority?: ARBeacon['priority'];
    expirationMinutes?: number;
  }): Promise<string> {
    try {
      const toUserProfile = this.userProfiles.get(toUserID);
      if (!toUserProfile?.privacySettings.allowBeacons) {
        throw new Error(`User ${toUserID} does not allow beacons`);
      }

      const beaconID = `beacon_${Date.now()}_${fromUserID}`;
      const expirationTime = beaconData.expirationMinutes || 30;
      
      const beacon: ARBeacon = {
        beaconID,
        fromUserID,
        toUserID,
        message: beaconData.message,
        location: beaconData.location,
        beaconType: beaconData.beaconType || 'message',
        priority: beaconData.priority || 'medium',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + expirationTime * 60 * 1000).toISOString(),
        isActive: true,
        acknowledged: false,
        visualStyle: {
          color: this.getBeaconColor(beaconData.beaconType || 'message'),
          icon: this.getBeaconIcon(beaconData.beaconType || 'message'),
          animation: 'pulse',
          scale: 1.0
        }
      };

      this.arBeacons.set(beaconID, beacon);
      this.socialMetrics.totalBeacons++;

      // Send beacon if connected
      if (this.webSocketConnection.isConnected) {
        this.webSocketConnection.send({
          type: 'beacon_send',
          data: beacon
        });
      } else {
        this.queueOfflineAction(fromUserID, {
          type: 'beacon',
          data: { fromUserID, toUserID, beaconData }
        });
      }

      this.logger.info(`Beacon sent from ${fromUserID} to ${toUserID}: ${beaconData.message}`);
      return beaconID;

    } catch (error) {
      this.logger.error(`Failed to send beacon:`, error);
      throw error;
    }
  }

  private getBeaconColor(beaconType: ARBeacon['beaconType']): string {
    const colors = {
      message: '#2196F3',
      meetup: '#4CAF50',
      alert: '#FF9800',
      direction: '#9C27B0'
    };
    return colors[beaconType] || colors.message;
  }

  private getBeaconIcon(beaconType: ARBeacon['beaconType']): string {
    const icons = {
      message: 'message',
      meetup: 'group',
      alert: 'warning',
      direction: 'navigation'
    };
    return icons[beaconType] || icons.message;
  }

  public async acknowledgeBeacon(beaconID: string, userID: string): Promise<void> {
    try {
      const beacon = this.arBeacons.get(beaconID);
      if (!beacon) {
        throw new Error(`Beacon not found: ${beaconID}`);
      }

      if (beacon.toUserID !== userID) {
        throw new Error(`User ${userID} is not authorized to acknowledge beacon ${beaconID}`);
      }

      beacon.acknowledged = true;
      beacon.acknowledgedAt = new Date().toISOString();

      this.logger.info(`Beacon ${beaconID} acknowledged by user ${userID}`);

    } catch (error) {
      this.logger.error(`Failed to acknowledge beacon ${beaconID}:`, error);
      throw error;
    }
  }

  private updatePresenceStatus(userID: string, status: PresenceStatus['status']): void {
    const presenceStatus: PresenceStatus = {
      userID,
      status,
      lastActivity: new Date().toISOString(),
      deviceType: 'mobile' // Mock device type
    };

    this.presenceStatuses.set(userID, presenceStatus);

    if (this.webSocketConnection.isConnected) {
      this.webSocketConnection.send({
        type: 'presence_update',
        data: presenceStatus
      });
    }
  }

  private queueOfflineAction(userID: string, action: any): void {
    if (!this.offlineActions.has(userID)) {
      this.offlineActions.set(userID, []);
    }
    this.offlineActions.get(userID)!.push(action);
  }

  public getFriends(userID: string): UserProfile[] {
    const friendIDs = this.userFriends.get(userID) || new Set();
    return Array.from(friendIDs)
      .map(friendID => this.userProfiles.get(friendID))
      .filter(profile => profile !== undefined) as UserProfile[];
  }

  public getSocialFeed(userID: string): SocialFeed | null {
    return this.socialFeeds.get(userID) || null;
  }

  public getActiveBeacons(userID: string): ARBeacon[] {
    const now = new Date();
    return Array.from(this.arBeacons.values())
      .filter(beacon => 
        beacon.toUserID === userID && 
        beacon.isActive && 
        new Date(beacon.expiresAt) > now
      );
  }

  public getUserCheckIns(userID: string): CheckIn[] {
    return Array.from(this.checkIns.values())
      .filter(checkIn => checkIn.userID === userID)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public getFriendsNearby(userID: string, radiusMeters: number = 100): Array<{user: UserProfile; location: LocationUpdate; distance: number}> {
    const userLocation = this.locationUpdates.get(userID);
    if (!userLocation) return [];

    const friends = this.getFriends(userID);
    const nearbyFriends: Array<{user: UserProfile; location: LocationUpdate; distance: number}> = [];

    for (const friend of friends) {
      const friendLocation = this.locationUpdates.get(friend.userID);
      if (friendLocation && friendLocation.location.floor === userLocation.location.floor) {
        const distance = Math.sqrt(
          Math.pow(friendLocation.location.x - userLocation.location.x, 2) +
          Math.pow(friendLocation.location.y - userLocation.location.y, 2)
        );

        if (distance <= radiusMeters) {
          nearbyFriends.push({
            user: friend,
            location: friendLocation,
            distance
          });
        }
      }
    }

    return nearbyFriends.sort((a, b) => a.distance - b.distance);
  }

  public getNotifications(userID: string): SocialNotification[] {
    return this.socialNotifications.get(userID) || [];
  }

  public markNotificationAsRead(userID: string, notificationID: string): void {
    const notifications = this.socialNotifications.get(userID) || [];
    const notification = notifications.find(n => n.notificationID === notificationID);
    if (notification) {
      notification.isRead = true;
    }
  }

  public updatePrivacySettings(userID: string, settings: Partial<UserProfile['privacySettings']>): void {
    const profile = this.userProfiles.get(userID);
    if (profile) {
      Object.assign(profile.privacySettings, settings);
      
      // If location sharing disabled, stop sharing
      if (settings.shareLocation === false) {
        this.locationUpdates.delete(userID);
      }
    }
  }

  public getAnalytics(): any {
    const totalUsers = this.userProfiles.size;
    const onlineUsers = Array.from(this.presenceStatuses.values())
      .filter(status => status.status === 'online').length;
    const activeBeacons = Array.from(this.arBeacons.values())
      .filter(beacon => beacon.isActive && new Date(beacon.expiresAt) > new Date()).length;

    return {
      service: 'SocialCheckInService',
      status: this.isInitialized ? 'active' : 'initializing',
      metrics: {
        totalUsers,
        onlineUsers,
        activeFriendships: this.socialMetrics.activeFriendships,
        totalCheckIns: this.socialMetrics.totalCheckIns,
        totalBeacons: this.socialMetrics.totalBeacons,
        activeBeacons,
        averageResponseTime: this.socialMetrics.averageResponseTime
      },
      connectivity: {
        webSocketConnected: this.webSocketConnection?.isConnected || false,
        offlineQueueSize: Array.from(this.offlineActions.values()).reduce((sum, actions) => sum + actions.length, 0)
      },
      performance: {
        messageProcessingRate: 0, // Could be tracked
        locationUpdateFrequency: 5000 // ms
      }
    };
  }

  public async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    const details: any = {
      initialized: this.isInitialized,
      webSocketConnected: this.webSocketConnection?.isConnected || false,
      totalUsers: this.userProfiles.size,
      activeFriendships: this.socialMetrics.activeFriendships,
      activeBeacons: Array.from(this.arBeacons.values()).filter(b => b.isActive).length,
      offlineQueueSize: Array.from(this.offlineActions.values()).reduce((sum, actions) => sum + actions.length, 0)
    };

    const healthy = this.isInitialized && 
                   (this.webSocketConnection?.isConnected || details.offlineQueueSize < 100);

    return { healthy, details };
  }

  public async cleanup(): Promise<void> {
    try {
      this.logger.info('Cleaning up Social Check-In Service');

      // Clear intervals
      if (this.locationSharingInterval) {
        clearInterval(this.locationSharingInterval);
      }
      if (this.presenceUpdateInterval) {
        clearInterval(this.presenceUpdateInterval);
      }
      if (this.beaconCleanupInterval) {
        clearInterval(this.beaconCleanupInterval);
      }

      // Disconnect WebSocket
      if (this.webSocketConnection) {
        await this.webSocketConnection.disconnect();
      }

      // Clear data
      this.userProfiles.clear();
      this.friendships.clear();
      this.userFriends.clear();
      this.locationUpdates.clear();
      this.checkIns.clear();
      this.arBeacons.clear();
      this.socialFeeds.clear();
      this.presenceStatuses.clear();
      this.socialNotifications.clear();
      this.offlineActions.clear();

      this.isInitialized = false;
      this.currentUserID = null;

      this.logger.info('Social Check-In Service cleanup completed');

    } catch (error) {
      this.logger.error('Error during cleanup:', error);
      throw error;
    }
  }
} 