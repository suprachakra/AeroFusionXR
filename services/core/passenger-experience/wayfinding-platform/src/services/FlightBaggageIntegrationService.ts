/**
 * Flight & Baggage Integration Service
 * Feature 13: FLIGHT_BAGGAGE_001
 * 
 * Enterprise-grade service for automatic flight and baggage data integration
 * with dynamic AR routing adjustments and real-time status updates.
 * 
 * @version 1.0.0
 * @author AeroFusionXR Platform Team
 * @since 2025-01-27
 */

export interface FlightInformation {
  flightID: string;
  airlineCode: string;
  flightNumber: string;
  aircraftType: string;
  origin: AirportInfo;
  destination: AirportInfo;
  scheduledDeparture: string;
  actualDeparture?: string;
  scheduledArrival: string;
  actualArrival?: string;
  status: 'Scheduled' | 'Boarding' | 'Departed' | 'Delayed' | 'Cancelled' | 'Arrived' | 'Diverted';
  departureGate?: string;
  arrivalGate?: string;
  terminal: string;
  checkInCounters?: string[];
  boardingTime?: string;
  lastUpdated: string;
  delayMinutes?: number;
  delayReason?: string;
  passengerCount?: number;
  seatMapAvailable: boolean;
}

export interface AirportInfo {
  iataCode: string;
  icaoCode: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
}

export interface BaggageInformation {
  flightID: string;
  baggageClaimCarousel?: number;
  baggageStatus: 'Not Available' | 'Carousel Assigned' | 'Bags Arriving' | 'Available' | 'Completed';
  lastUpdated: string;
  estimatedArrivalTime?: string;
  specialBaggage?: SpecialBaggageInfo[];
  unclaimed?: UnclaimedBaggage[];
  alerts?: BaggageAlert[];
}

export interface SpecialBaggageInfo {
  type: 'oversized' | 'fragile' | 'valuable' | 'sports_equipment' | 'musical_instruments';
  claimLocation: string;
  instructions: string;
  availableFrom?: string;
}

export interface UnclaimedBaggage {
  baggageID: string;
  description: string;
  claimLocation: string;
  availableSince: string;
  contactInfo: string;
}

export interface BaggageAlert {
  alertID: string;
  type: 'delayed' | 'missing' | 'damaged' | 'security_hold';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  actionRequired?: string;
  contactInfo?: string;
}

export interface PNRInformation {
  pnr: string;
  passengerName: string;
  flights: FlightInformation[];
  bookingStatus: 'Confirmed' | 'Pending' | 'Cancelled';
  travelClass: 'Economy' | 'Premium Economy' | 'Business' | 'First';
  seatAssignments: { [flightID: string]: string };
  mealPreferences?: { [flightID: string]: string };
  specialRequests?: string[];
  loyaltyProgram?: {
    program: string;
    memberNumber: string;
    status: string;
  };
  contactInfo: {
    email: string;
    phone: string;
  };
}

export interface RouteUpdate {
  updateID: string;
  type: 'gate_change' | 'terminal_change' | 'baggage_assigned' | 'delay_lounge' | 'boarding_call';
  flightID: string;
  fromLocation?: string;
  toLocation: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timestamp: string;
  autoNavigation: boolean;
  estimatedWalkingTime?: number; // minutes
}

export interface LoungeRecommendation {
  loungeID: string;
  name: string;
  location: {
    terminal: string;
    floor: string;
    coordinates: { x: number; y: number; z: number };
  };
  distance: number; // meters
  walkingTime: number; // minutes
  eligibility: 'free' | 'paid' | 'loyalty_program' | 'day_pass';
  amenities: string[];
  operatingHours: { open: string; close: string };
  currentCapacity: number; // percentage 0-100
  accessRequirements?: string[];
  pricing?: {
    adult: number;
    child: number;
    currency: string;
  };
}

export interface FlightNotification {
  notificationID: string;
  flightID: string;
  type: 'gate_change' | 'delay' | 'boarding' | 'baggage_ready' | 'final_call';
  title: string;
  message: string;
  actionRequired: boolean;
  actions?: NotificationAction[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timestamp: string;
  expiresAt?: string;
  acknowledged: boolean;
}

export interface NotificationAction {
  actionID: string;
  type: 'navigate' | 'view_details' | 'book_lounge' | 'check_in' | 'contact_airline';
  label: string;
  actionData: { [key: string]: any };
  enabled: boolean;
}

export interface FlightStatusSubscription {
  subscriptionID: string;
  flightID: string;
  userID: string;
  notificationTypes: string[];
  webSocketConnected: boolean;
  lastPing: string;
  pollingFrequency: number; // seconds
}

export class FlightBaggageIntegrationService {
  private flightInformation: Map<string, FlightInformation> = new Map();
  private baggageInformation: Map<string, BaggageInformation> = new Map();
  private pnrData: Map<string, PNRInformation> = new Map();
  private activeSubscriptions: Map<string, FlightStatusSubscription> = new Map();
  private routeUpdates: Map<string, RouteUpdate[]> = new Map(); // userID -> updates
  private flightNotifications: Map<string, FlightNotification[]> = new Map(); // userID -> notifications
  private webSocketConnection: any = null;
  private pollingInterval: any = null;
  private airlineAPI: any = null;
  private baggageAPI: any = null;
  private routingService: any = null;
  private notificationService: any = null;
  private readonly logger: any;
  private isInitialized: boolean = false;
  private currentUser: string | null = null;
  private offlineCache: Map<string, any> = new Map();
  private lastSyncTimestamp: number = 0;
  private performanceMetrics: {
    flightDataFetchTime: number;
    baggageDataFetchTime: number;
    routeComputeTime: number;
    notificationDeliveryTime: number;
  };

  constructor() {
    this.logger = {
      debug: (message: string, ...args: any[]) => console.log(`[DEBUG] FlightBaggage: ${message}`, ...args),
      info: (message: string, ...args: any[]) => console.info(`[INFO] FlightBaggage: ${message}`, ...args),
      warn: (message: string, ...args: any[]) => console.warn(`[WARN] FlightBaggage: ${message}`, ...args),
      error: (message: string, ...args: any[]) => console.error(`[ERROR] FlightBaggage: ${message}`, ...args)
    };

    this.performanceMetrics = {
      flightDataFetchTime: 0,
      baggageDataFetchTime: 0,
      routeComputeTime: 0,
      notificationDeliveryTime: 0
    };

    this.initializeFlightBaggageService();
  }

  private async initializeFlightBaggageService(): Promise<void> {
    try {
      this.logger.info('Initializing Flight & Baggage Integration Service');

      await Promise.all([
        this.initializeAirlineAPI(),
        this.initializeBaggageAPI(),
        this.initializeWebSocketConnection(),
        this.initializeRoutingService(),
        this.initializeNotificationService(),
        this.loadOfflineCache()
      ]);

      this.startPollingService();
      this.startPerformanceMonitoring();

      this.isInitialized = true;
      this.logger.info('Flight & Baggage Integration Service initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize Flight & Baggage Integration Service:', error);
      throw error;
    }
  }

  private async initializeAirlineAPI(): Promise<void> {
    this.airlineAPI = {
      async validatePNR(pnr: string, lastName: string): Promise<PNRInformation> {
        const startTime = Date.now();
        
        // Mock PNR validation with realistic delay
        await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 200));
        
        if (Math.random() < 0.1) { // 10% chance of failure for testing
          throw new Error('PNR not found or invalid');
        }

        const mockPNR: PNRInformation = {
          pnr: pnr.toUpperCase(),
          passengerName: lastName,
          flights: [
            {
              flightID: `${pnr}_flight_001`,
              airlineCode: 'EK',
              flightNumber: 'EK001',
              aircraftType: 'Boeing 777-300ER',
              origin: {
                iataCode: 'DXB',
                icaoCode: 'OMDB',
                name: 'Dubai International Airport',
                city: 'Dubai',
                country: 'UAE',
                timezone: 'Asia/Dubai'
              },
              destination: {
                iataCode: 'LHR',
                icaoCode: 'EGLL',
                name: 'London Heathrow Airport',
                city: 'London',
                country: 'UK',
                timezone: 'Europe/London'
              },
              scheduledDeparture: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
              scheduledArrival: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
              status: 'Scheduled',
              departureGate: 'A12',
              terminal: 'Terminal 3',
              checkInCounters: ['A1-A10'],
              lastUpdated: new Date().toISOString(),
              seatMapAvailable: true
            }
          ],
          bookingStatus: 'Confirmed',
          travelClass: 'Economy',
          seatAssignments: {},
          contactInfo: {
            email: 'passenger@example.com',
            phone: '+971501234567'
          }
        };

        this.performanceMetrics.flightDataFetchTime = Date.now() - startTime;
        return mockPNR;
      },

      async getFlightStatus(flightID: string): Promise<FlightInformation> {
        const startTime = Date.now();
        
        await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));
        
        const existingFlight = this.flightInformation.get(flightID);
        if (existingFlight) {
          // Simulate status updates
          const statusOptions = ['Scheduled', 'Boarding', 'Delayed', 'Departed'];
          const randomStatus = statusOptions[Math.floor(Math.random() * statusOptions.length)] as FlightInformation['status'];
          
          existingFlight.status = randomStatus;
          existingFlight.lastUpdated = new Date().toISOString();
          
          if (randomStatus === 'Delayed') {
            existingFlight.delayMinutes = Math.floor(Math.random() * 120) + 15;
            existingFlight.delayReason = 'Weather conditions';
          }
          
          if (Math.random() < 0.2) { // 20% chance of gate change
            const gates = ['A10', 'A12', 'A15', 'B05', 'B10', 'C12'];
            existingFlight.departureGate = gates[Math.floor(Math.random() * gates.length)];
          }

          this.performanceMetrics.flightDataFetchTime = Date.now() - startTime;
          return existingFlight;
        }

        throw new Error(`Flight not found: ${flightID}`);
      },

      async subscribeToFlightUpdates(flightID: string, callback: (update: FlightInformation) => void): Promise<string> {
        // Mock WebSocket subscription
        const subscriptionID = `sub_${Date.now()}_${flightID}`;
        
        // Simulate periodic updates
        setInterval(() => {
          const flight = this.flightInformation.get(flightID);
          if (flight) {
            callback(flight);
          }
        }, 30000); // Every 30 seconds

        return subscriptionID;
      }
    };
  }

  private async initializeBaggageAPI(): Promise<void> {
    this.baggageAPI = {
      async getBaggageStatus(flightID: string): Promise<BaggageInformation> {
        const startTime = Date.now();
        
        await new Promise(resolve => setTimeout(resolve, Math.random() * 250 + 150));

        const mockBaggage: BaggageInformation = {
          flightID,
          baggageClaimCarousel: Math.floor(Math.random() * 10) + 1,
          baggageStatus: 'Carousel Assigned',
          lastUpdated: new Date().toISOString(),
          estimatedArrivalTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          specialBaggage: [
            {
              type: 'oversized',
              claimLocation: 'Special Baggage Area - Level 0',
              instructions: 'Present boarding pass and ID at counter',
              availableFrom: new Date(Date.now() + 20 * 60 * 1000).toISOString()
            }
          ],
          alerts: []
        };

        // Simulate random baggage status progression
        const statuses: BaggageInformation['baggageStatus'][] = ['Carousel Assigned', 'Bags Arriving', 'Available'];
        mockBaggage.baggageStatus = statuses[Math.floor(Math.random() * statuses.length)];

        this.performanceMetrics.baggageDataFetchTime = Date.now() - startTime;
        return mockBaggage;
      },

      async getBaggageAlerts(flightID: string): Promise<BaggageAlert[]> {
        // Mock baggage alerts
        const alerts: BaggageAlert[] = [];
        
        if (Math.random() < 0.1) { // 10% chance of delayed baggage
          alerts.push({
            alertID: `alert_${Date.now()}`,
            type: 'delayed',
            message: 'Your baggage is delayed. Expected in 30 minutes.',
            severity: 'warning',
            timestamp: new Date().toISOString(),
            actionRequired: 'Please wait near carousel',
            contactInfo: 'Baggage Service: +971-4-216-2525'
          });
        }

        return alerts;
      }
    };
  }

  private async initializeWebSocketConnection(): Promise<void> {
    this.webSocketConnection = {
      isConnected: false,
      reconnectAttempts: 0,
      maxReconnectAttempts: 5,

      async connect(): Promise<void> {
        this.isConnected = true;
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
        // Mock message receiving with flight status updates
        setInterval(() => {
          if (this.isConnected && this.flightInformation.size > 0) {
            const flights = Array.from(this.flightInformation.values());
            const randomFlight = flights[Math.floor(Math.random() * flights.length)];
            
            callback({
              type: 'flight_status_update',
              data: randomFlight
            });
          }
        }, 45000); // Every 45 seconds
      },

      async reconnect(): Promise<void> {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const backoffDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
          
          setTimeout(async () => {
            try {
              await this.connect();
            } catch (error) {
              await this.reconnect();
            }
          }, backoffDelay);
        }
      }
    };

    await this.webSocketConnection.connect();

    this.webSocketConnection.onMessage((message: any) => {
      this.handleWebSocketMessage(message);
    });
  }

  private async initializeRoutingService(): Promise<void> {
    this.routingService = {
      async computeRoute(from: { x: number; y: number; z: number; floor: string }, 
                       to: { x: number; y: number; z: number; floor: string }): Promise<any> {
        const startTime = Date.now();
        
        // Mock route computation with realistic delay
        await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100));
        
        const distance = Math.sqrt(
          Math.pow(to.x - from.x, 2) + 
          Math.pow(to.y - from.y, 2) + 
          Math.pow(to.z - from.z, 2)
        );
        
        const walkingSpeed = 1.4; // meters per second
        const estimatedTime = Math.ceil(distance / walkingSpeed / 60); // minutes

        this.performanceMetrics.routeComputeTime = Date.now() - startTime;
        
        return {
          routeID: `route_${Date.now()}`,
          distance,
          estimatedWalkingTime: estimatedTime,
          waypoints: [from, to], // Simplified waypoints
          instructions: [`Walk ${distance.toFixed(0)}m to destination`]
        };
      },

      async getGateLocation(gateCode: string): Promise<{ x: number; y: number; z: number; floor: string }> {
        // Mock gate locations
        const gateLocations: { [key: string]: { x: number; y: number; z: number; floor: string } } = {
          'A10': { x: 100, y: 150, z: 0, floor: '2' },
          'A12': { x: 120, y: 150, z: 0, floor: '2' },
          'A15': { x: 150, y: 150, z: 0, floor: '2' },
          'B05': { x: 200, y: 100, z: 0, floor: '2' },
          'B10': { x: 250, y: 100, z: 0, floor: '2' },
          'C12': { x: 300, y: 200, z: 0, floor: '3' }
        };

        return gateLocations[gateCode] || { x: 0, y: 0, z: 0, floor: '1' };
      },

      async getBaggageClaimLocation(carousel: number): Promise<{ x: number; y: number; z: number; floor: string }> {
        // Mock baggage claim locations
        return {
          x: 50 + carousel * 30,
          y: 50,
          z: 0,
          floor: '0' // Ground floor
        };
      }
    };
  }

  private async initializeNotificationService(): Promise<void> {
    this.notificationService = {
      async sendNotification(userID: string, notification: FlightNotification): Promise<void> {
        const startTime = Date.now();
        
        // Mock notification delivery
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
        
        if (!this.flightNotifications.has(userID)) {
          this.flightNotifications.set(userID, []);
        }
        this.flightNotifications.get(userID)!.push(notification);

        this.performanceMetrics.notificationDeliveryTime = Date.now() - startTime;
        this.logger.info(`Notification sent to user ${userID}: ${notification.title}`);
      },

      async scheduleNotification(userID: string, notification: FlightNotification, deliveryTime: Date): Promise<void> {
        const delay = deliveryTime.getTime() - Date.now();
        if (delay > 0) {
          setTimeout(() => {
            this.sendNotification(userID, notification);
          }, delay);
        }
      }
    };
  }

  private async loadOfflineCache(): Promise<void> {
    // Mock offline cache loading
    this.logger.debug('Loaded offline cache for flight and baggage data');
  }

  private startPollingService(): void {
    this.pollingInterval = setInterval(async () => {
      if (!this.webSocketConnection.isConnected) {
        await this.pollFlightStatuses();
      }
    }, 30000); // Poll every 30 seconds when WebSocket is disconnected
  }

  private async pollFlightStatuses(): Promise<void> {
    for (const [flightID] of this.flightInformation) {
      try {
        const updatedFlight = await this.airlineAPI.getFlightStatus(flightID);
        await this.handleFlightStatusUpdate(updatedFlight);
      } catch (error) {
        this.logger.error(`Failed to poll status for flight ${flightID}:`, error);
      }
    }
  }

  private startPerformanceMonitoring(): void {
    setInterval(() => {
      this.lastSyncTimestamp = Date.now();
    }, 60000); // Update every minute
  }

  private handleWebSocketMessage(message: any): void {
    try {
      switch (message.type) {
        case 'flight_status_update':
          this.handleFlightStatusUpdate(message.data);
          break;
        case 'baggage_update':
          this.handleBaggageUpdate(message.data);
          break;
        case 'gate_change':
          this.handleGateChange(message.data);
          break;
        default:
          this.logger.warn(`Unknown WebSocket message type: ${message.type}`);
      }
    } catch (error) {
      this.logger.error('Error handling WebSocket message:', error);
    }
  }

  private async handleFlightStatusUpdate(flightData: FlightInformation): Promise<void> {
    const existingFlight = this.flightInformation.get(flightData.flightID);
    const hasStatusChange = !existingFlight || existingFlight.status !== flightData.status;
    const hasGateChange = !existingFlight || existingFlight.departureGate !== flightData.departureGate;
    const hasDelayChange = !existingFlight || existingFlight.delayMinutes !== flightData.delayMinutes;

    this.flightInformation.set(flightData.flightID, flightData);

    // Handle specific status changes
    if (hasStatusChange || hasGateChange || hasDelayChange) {
      await this.processFlightChanges(flightData, {
        statusChanged: hasStatusChange,
        gateChanged: hasGateChange,
        delayChanged: hasDelayChange
      });
    }
  }

  private async processFlightChanges(flight: FlightInformation, changes: {
    statusChanged: boolean;
    gateChanged: boolean;
    delayChanged: boolean;
  }): Promise<void> {
    const subscribedUsers = Array.from(this.activeSubscriptions.values())
      .filter(sub => sub.flightID === flight.flightID)
      .map(sub => sub.userID);

    for (const userID of subscribedUsers) {
      if (changes.gateChanged && flight.departureGate) {
        await this.handleGateChangeForUser(userID, flight);
      }

      if (changes.delayChanged && flight.delayMinutes && flight.delayMinutes > 60) {
        await this.handleLongDelayForUser(userID, flight);
      }

      if (changes.statusChanged) {
        await this.handleStatusChangeForUser(userID, flight);
      }
    }
  }

  private async handleGateChangeForUser(userID: string, flight: FlightInformation): Promise<void> {
    try {
      const oldGateLocation = await this.routingService.getGateLocation('A10'); // Mock old gate
      const newGateLocation = await this.routingService.getGateLocation(flight.departureGate!);
      
      const routeUpdate: RouteUpdate = {
        updateID: `update_${Date.now()}_${userID}`,
        type: 'gate_change',
        flightID: flight.flightID,
        fromLocation: 'A10',
        toLocation: flight.departureGate!,
        message: `Gate changed to ${flight.departureGate}`,
        priority: 'high',
        timestamp: new Date().toISOString(),
        autoNavigation: true,
        estimatedWalkingTime: 5
      };

      if (!this.routeUpdates.has(userID)) {
        this.routeUpdates.set(userID, []);
      }
      this.routeUpdates.get(userID)!.push(routeUpdate);

      // Send notification
      const notification: FlightNotification = {
        notificationID: `notif_${Date.now()}_${userID}`,
        flightID: flight.flightID,
        type: 'gate_change',
        title: 'Gate Change',
        message: `Flight ${flight.flightNumber} gate changed to ${flight.departureGate}`,
        actionRequired: true,
        actions: [
          {
            actionID: 'navigate_to_gate',
            type: 'navigate',
            label: 'Navigate to New Gate',
            actionData: { 
              destination: newGateLocation,
              gateCode: flight.departureGate 
            },
            enabled: true
          }
        ],
        priority: 'high',
        timestamp: new Date().toISOString(),
        acknowledged: false
      };

      await this.notificationService.sendNotification(userID, notification);

    } catch (error) {
      this.logger.error(`Failed to handle gate change for user ${userID}:`, error);
    }
  }

  private async handleLongDelayForUser(userID: string, flight: FlightInformation): Promise<void> {
    try {
      const loungeRecommendations = await this.findNearbyLounges(userID);
      
      if (loungeRecommendations.length > 0) {
        const bestLounge = loungeRecommendations[0];
        
        const notification: FlightNotification = {
          notificationID: `notif_${Date.now()}_${userID}`,
          flightID: flight.flightID,
          type: 'delay',
          title: 'Flight Delayed',
          message: `Flight ${flight.flightNumber} delayed ${flight.delayMinutes} minutes. Lounge nearby available.`,
          actionRequired: false,
          actions: [
            {
              actionID: 'navigate_to_lounge',
              type: 'navigate',
              label: 'Go to Lounge',
              actionData: { 
                destination: bestLounge.location.coordinates,
                loungeID: bestLounge.loungeID 
              },
              enabled: true
            },
            {
              actionID: 'dismiss',
              type: 'view_details',
              label: 'Later',
              actionData: {},
              enabled: true
            }
          ],
          priority: 'medium',
          timestamp: new Date().toISOString(),
          acknowledged: false
        };

        await this.notificationService.sendNotification(userID, notification);
      }

    } catch (error) {
      this.logger.error(`Failed to handle delay for user ${userID}:`, error);
    }
  }

  private async handleStatusChangeForUser(userID: string, flight: FlightInformation): Promise<void> {
    let notificationType: FlightNotification['type'] = 'boarding';
    let title = 'Flight Update';
    let message = `Flight ${flight.flightNumber} status: ${flight.status}`;
    let priority: FlightNotification['priority'] = 'medium';

    switch (flight.status) {
      case 'Boarding':
        notificationType = 'boarding';
        title = 'Boarding Started';
        message = `Flight ${flight.flightNumber} is now boarding at gate ${flight.departureGate}`;
        priority = 'high';
        break;
      case 'Arrived':
        title = 'Flight Arrived';
        message = `Flight ${flight.flightNumber} has arrived. Proceed to baggage claim.`;
        await this.handleFlightArrival(userID, flight);
        break;
      case 'Cancelled':
        title = 'Flight Cancelled';
        message = `Flight ${flight.flightNumber} has been cancelled. Please contact your airline.`;
        priority = 'urgent';
        break;
    }

    const notification: FlightNotification = {
      notificationID: `notif_${Date.now()}_${userID}`,
      flightID: flight.flightID,
      type: notificationType,
      title,
      message,
      actionRequired: flight.status === 'Boarding' || flight.status === 'Cancelled',
      priority,
      timestamp: new Date().toISOString(),
      acknowledged: false
    };

    await this.notificationService.sendNotification(userID, notification);
  }

  private async handleFlightArrival(userID: string, flight: FlightInformation): Promise<void> {
    try {
      // Get baggage information
      const baggageInfo = await this.airlineAPI.getBaggageStatus(flight.flightID);
      this.baggageInformation.set(flight.flightID, baggageInfo);

      if (baggageInfo.baggageClaimCarousel) {
        const baggageLocation = await this.routingService.getBaggageClaimLocation(baggageInfo.baggageClaimCarousel);
        
        const routeUpdate: RouteUpdate = {
          updateID: `update_${Date.now()}_${userID}`,
          type: 'baggage_assigned',
          flightID: flight.flightID,
          toLocation: `Baggage Carousel ${baggageInfo.baggageClaimCarousel}`,
          message: `Proceed to Baggage Carousel ${baggageInfo.baggageClaimCarousel}`,
          priority: 'medium',
          timestamp: new Date().toISOString(),
          autoNavigation: true,
          estimatedWalkingTime: 8
        };

        if (!this.routeUpdates.has(userID)) {
          this.routeUpdates.set(userID, []);
        }
        this.routeUpdates.get(userID)!.push(routeUpdate);
      }

    } catch (error) {
      this.logger.error(`Failed to handle flight arrival for user ${userID}:`, error);
    }
  }

  private async handleBaggageUpdate(baggageData: BaggageInformation): Promise<void> {
    this.baggageInformation.set(baggageData.flightID, baggageData);

    // Notify users with this flight
    const subscribedUsers = Array.from(this.activeSubscriptions.values())
      .filter(sub => sub.flightID === baggageData.flightID)
      .map(sub => sub.userID);

    for (const userID of subscribedUsers) {
      if (baggageData.baggageStatus === 'Available') {
        const notification: FlightNotification = {
          notificationID: `notif_${Date.now()}_${userID}`,
          flightID: baggageData.flightID,
          type: 'baggage_ready',
          title: 'Baggage Ready',
          message: `Your baggage is ready for pickup at Carousel ${baggageData.baggageClaimCarousel}`,
          actionRequired: true,
          priority: 'medium',
          timestamp: new Date().toISOString(),
          acknowledged: false
        };

        await this.notificationService.sendNotification(userID, notification);
      }
    }
  }

  private async findNearbyLounges(userID: string): Promise<LoungeRecommendation[]> {
    // Mock lounge recommendations
    const mockLounges: LoungeRecommendation[] = [
      {
        loungeID: 'lounge_emirates_001',
        name: 'Emirates Business Class Lounge',
        location: {
          terminal: 'Terminal 3',
          floor: '3',
          coordinates: { x: 200, y: 300, z: 0 }
        },
        distance: 150,
        walkingTime: 3,
        eligibility: 'loyalty_program',
        amenities: ['WiFi', 'Dining', 'Showers', 'Quiet Areas'],
        operatingHours: { open: '05:00', close: '02:00' },
        currentCapacity: 65,
        accessRequirements: ['Business Class ticket', 'Skywards Gold+']
      },
      {
        loungeID: 'lounge_al_majlis_002',
        name: 'Al Majlis Lounge',
        location: {
          terminal: 'Terminal 3',
          floor: '2',
          coordinates: { x: 180, y: 250, z: 0 }
        },
        distance: 120,
        walkingTime: 2,
        eligibility: 'paid',
        amenities: ['WiFi', 'Light Refreshments', 'Comfortable Seating'],
        operatingHours: { open: '04:30', close: '23:30' },
        currentCapacity: 40,
        pricing: {
          adult: 150,
          child: 75,
          currency: 'AED'
        }
      }
    ];

    return mockLounges.sort((a, b) => a.distance - b.distance);
  }

  public async importPNR(pnr: string, lastName: string): Promise<PNRInformation> {
    try {
      const pnrData = await this.airlineAPI.validatePNR(pnr, lastName);
      this.pnrData.set(pnr, pnrData);

      // Import all flights from PNR
      for (const flight of pnrData.flights) {
        this.flightInformation.set(flight.flightID, flight);
        
        // Subscribe to flight updates
        await this.subscribeToFlightUpdates(flight.flightID, this.currentUser!);
      }

      // Cache offline
      this.offlineCache.set(`pnr_${pnr}`, pnrData);

      this.logger.info(`Imported PNR ${pnr} with ${pnrData.flights.length} flights`);
      return pnrData;

    } catch (error) {
      this.logger.error(`Failed to import PNR ${pnr}:`, error);
      throw error;
    }
  }

  public async subscribeToFlightUpdates(flightID: string, userID: string): Promise<string> {
    try {
      const subscriptionID = `sub_${Date.now()}_${flightID}_${userID}`;
      
      const subscription: FlightStatusSubscription = {
        subscriptionID,
        flightID,
        userID,
        notificationTypes: ['gate_change', 'delay', 'boarding', 'baggage_ready'],
        webSocketConnected: this.webSocketConnection.isConnected,
        lastPing: new Date().toISOString(),
        pollingFrequency: 30
      };

      this.activeSubscriptions.set(subscriptionID, subscription);

      // Subscribe via airline API if WebSocket available
      if (this.webSocketConnection.isConnected) {
        await this.airlineAPI.subscribeToFlightUpdates(flightID, (update: FlightInformation) => {
          this.handleFlightStatusUpdate(update);
        });
      }

      this.logger.info(`Subscribed user ${userID} to flight ${flightID} updates`);
      return subscriptionID;

    } catch (error) {
      this.logger.error(`Failed to subscribe to flight updates:`, error);
      throw error;
    }
  }

  public async getBaggageStatus(flightID: string): Promise<BaggageInformation | null> {
    try {
      let baggageInfo = this.baggageInformation.get(flightID);
      
      if (!baggageInfo) {
        baggageInfo = await this.baggageAPI.getBaggageStatus(flightID);
        this.baggageInformation.set(flightID, baggageInfo);
      }

      return baggageInfo;

    } catch (error) {
      this.logger.error(`Failed to get baggage status for flight ${flightID}:`, error);
      return null;
    }
  }

  public async scheduleReminderNotification(userID: string, flightID: string, reminderType: 'boarding' | 'departure', minutesBefore: number): Promise<void> {
    try {
      const flight = this.flightInformation.get(flightID);
      if (!flight) {
        throw new Error(`Flight not found: ${flightID}`);
      }

      const targetTime = reminderType === 'boarding' && flight.boardingTime 
        ? new Date(flight.boardingTime) 
        : new Date(flight.scheduledDeparture);
      
      const reminderTime = new Date(targetTime.getTime() - minutesBefore * 60 * 1000);

      const notification: FlightNotification = {
        notificationID: `reminder_${Date.now()}_${userID}`,
        flightID,
        type: reminderType === 'boarding' ? 'boarding' : 'final_call',
        title: reminderType === 'boarding' ? 'Boarding Reminder' : 'Departure Reminder',
        message: `Flight ${flight.flightNumber} ${reminderType} in ${minutesBefore} minutes`,
        actionRequired: true,
        priority: 'high',
        timestamp: new Date().toISOString(),
        acknowledged: false
      };

      await this.notificationService.scheduleNotification(userID, notification, reminderTime);
      this.logger.info(`Scheduled ${reminderType} reminder for user ${userID}, flight ${flightID}`);

    } catch (error) {
      this.logger.error(`Failed to schedule reminder notification:`, error);
      throw error;
    }
  }

  public setCurrentUser(userID: string): void {
    this.currentUser = userID;
  }

  public getFlightInformation(flightID: string): FlightInformation | null {
    return this.flightInformation.get(flightID) || null;
  }

  public getUserFlights(userID: string): FlightInformation[] {
    return Array.from(this.activeSubscriptions.values())
      .filter(sub => sub.userID === userID)
      .map(sub => this.flightInformation.get(sub.flightID))
      .filter(flight => flight !== undefined) as FlightInformation[];
  }

  public getRouteUpdates(userID: string): RouteUpdate[] {
    return this.routeUpdates.get(userID) || [];
  }

  public getNotifications(userID: string): FlightNotification[] {
    return this.flightNotifications.get(userID) || [];
  }

  public acknowledgeNotification(userID: string, notificationID: string): void {
    const notifications = this.flightNotifications.get(userID) || [];
    const notification = notifications.find(n => n.notificationID === notificationID);
    if (notification) {
      notification.acknowledged = true;
    }
  }

  public getAnalytics(): any {
    const totalFlights = this.flightInformation.size;
    const activeSubscriptions = this.activeSubscriptions.size;
    const onTimeFlights = Array.from(this.flightInformation.values())
      .filter(flight => !flight.delayMinutes || flight.delayMinutes < 15).length;
    const delayedFlights = totalFlights - onTimeFlights;

    return {
      service: 'FlightBaggageIntegrationService',
      status: this.isInitialized ? 'active' : 'initializing',
      metrics: {
        totalFlights,
        activeSubscriptions,
        onTimeFlights,
        delayedFlights,
        averageFlightDataFetchTime: this.performanceMetrics.flightDataFetchTime,
        averageBaggageDataFetchTime: this.performanceMetrics.baggageDataFetchTime,
        averageRouteComputeTime: this.performanceMetrics.routeComputeTime,
        averageNotificationDeliveryTime: this.performanceMetrics.notificationDeliveryTime
      },
      connectivity: {
        webSocketConnected: this.webSocketConnection?.isConnected || false,
        pollingActive: !!this.pollingInterval,
        lastSyncTimestamp: this.lastSyncTimestamp
      },
      performance: this.performanceMetrics
    };
  }

  public async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    const details: any = {
      initialized: this.isInitialized,
      webSocketConnected: this.webSocketConnection?.isConnected || false,
      airlineAPIReachable: !!this.airlineAPI,
      baggageAPIReachable: !!this.baggageAPI,
      activeSubscriptions: this.activeSubscriptions.size,
      totalFlights: this.flightInformation.size,
      performanceWithinLimits: this.performanceMetrics.flightDataFetchTime < 1000 &&
                              this.performanceMetrics.baggageDataFetchTime < 1000
    };

    const healthy = this.isInitialized && 
                   !!this.airlineAPI && 
                   !!this.baggageAPI &&
                   details.performanceWithinLimits;

    return { healthy, details };
  }

  public async cleanup(): Promise<void> {
    try {
      this.logger.info('Cleaning up Flight & Baggage Integration Service');

      // Clear polling interval
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
      }

      // Disconnect WebSocket
      if (this.webSocketConnection) {
        await this.webSocketConnection.disconnect();
      }

      // Clear all data
      this.flightInformation.clear();
      this.baggageInformation.clear();
      this.pnrData.clear();
      this.activeSubscriptions.clear();
      this.routeUpdates.clear();
      this.flightNotifications.clear();
      this.offlineCache.clear();

      this.isInitialized = false;
      this.currentUser = null;

      this.logger.info('Flight & Baggage Integration Service cleanup completed');

    } catch (error) {
      this.logger.error('Error during cleanup:', error);
      throw error;
    }
  }
} 