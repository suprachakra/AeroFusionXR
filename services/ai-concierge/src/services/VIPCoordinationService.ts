/**
 * @fileoverview AeroFusionXR AI Concierge Service - VIP Coordination Service
 * @version 1.0.0
 * @author AeroFusionXR AI Engineering Team
 * @created 2024-01-15
 * @updated 2024-01-15
 * 
 * Feature 12: VIP, Meet & Greet & Event Coordination
 * Premium service orchestration with human resource management, VIP passenger coordination, and event management
 */

import winston from 'winston';
import { ConfigurationManager } from '../core/ConfigurationManager';
import { UUID } from '../types';

/**
 * VIP Service types enumeration
 */
export enum VIPServiceType {
  MEET_GREET = 'meetGreet',
  LOUNGE_ESCORT = 'loungeEscort',
  FAST_TRACK = 'fastTrack',
  LUGGAGE_ASSISTANCE = 'luggageAssistance',
  GROUND_TRANSPORT = 'groundTransport',
  CONCIERGE = 'concierge',
  SECURITY_ESCORT = 'securityEscort',
  MEDICAL_ASSISTANCE = 'medicalAssistance'
}

/**
 * Staff specialization enumeration
 */
export enum StaffSpecialization {
  VIP_COORDINATOR = 'vipCoordinator',
  GUEST_RELATIONS = 'guestRelations',
  SECURITY_ESCORT = 'securityEscort',
  LANGUAGE_SPECIALIST = 'languageSpecialist',
  MEDICAL_ASSISTANT = 'medicalAssistant',
  TRANSPORT_COORDINATOR = 'transportCoordinator'
}

/**
 * VIP Service Request interface
 */
export interface VIPServiceRequest {
  requestID: string;
  passengerID: UUID;
  flightNumber: string;
  serviceType: VIPServiceType;
  requirements: Record<string, any>;
  preferredTime: string;
  specialRequests: string[];
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  assignedStaff?: StaffMember;
  estimatedCost: { amount: number; currency: string };
  createdAt: string;
}

/**
 * Staff Member interface
 */
export interface StaffMember {
  staffID: string;
  name: string;
  role: string;
  specializations: StaffSpecialization[];
  languages: string[];
  currentLocation: string;
  availability: {
    status: 'available' | 'busy' | 'break' | 'off_duty';
    nextAvailable?: string;
  };
  rating: number;
  phone: string;
}

/**
 * VIP Event interface
 */
export interface VIPEvent {
  eventID: string;
  type: 'vipDeparture' | 'vipArrival' | 'delegation' | 'celebrity' | 'diplomatic';
  title: string;
  flightNumber: string;
  passengerCount: number;
  scheduledTime: string;
  terminal: string;
  requirements: {
    staffNeeded: number;
    specialServices: VIPServiceType[];
    equipmentNeeded: string[];
  };
  coordinator: {
    name: string;
    phone: string;
  };
  status: 'planned' | 'confirmed' | 'in_progress' | 'completed';
}

/**
 * VIP Coordination Service Class
 * Handles VIP service requests, staff management, and event coordination
 */
export class VIPCoordinationService {
  private config: ConfigurationManager;
  private logger: winston.Logger;
  private activeRequests: Map<string, VIPServiceRequest> = new Map();
  private staffMembers: Map<string, StaffMember> = new Map();
  private upcomingEvents: Map<string, VIPEvent> = new Map();

  constructor(config: ConfigurationManager, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;
    
    this.initializeStaffData();
    
    this.logger.info('VIPCoordinationService initialized successfully', {
      component: 'VIPCoordinationService',
      staffCount: this.staffMembers.size
    });
  }

  /**
   * Create a new VIP service request
   */
  public async createServiceRequest(
    passengerID: UUID,
    flightNumber: string,
    serviceType: VIPServiceType,
    requirements: Record<string, any>,
    preferredTime: string,
    specialRequests: string[] = []
  ): Promise<VIPServiceRequest> {
    try {
      this.logger.debug('Creating VIP service request', {
        component: 'VIPCoordinationService',
        action: 'createServiceRequest',
        passengerID,
        serviceType,
        flightNumber
      });

      const request: VIPServiceRequest = {
        requestID: `vip_${Date.now()}`,
        passengerID,
        flightNumber,
        serviceType,
        requirements,
        preferredTime,
        specialRequests,
        status: 'pending',
        estimatedCost: this.calculateServiceCost(serviceType, requirements),
        createdAt: new Date().toISOString()
      };

      // Auto-assign staff if available
      const availableStaff = await this.findAvailableStaff(serviceType, preferredTime);
      if (availableStaff) {
        request.assignedStaff = availableStaff;
        request.status = 'assigned';
        await this.updateStaffAvailability(availableStaff.staffID, 'busy');
      }

      this.activeRequests.set(request.requestID, request);

      this.logger.info('VIP service request created', {
        component: 'VIPCoordinationService',
        action: 'createServiceRequest',
        requestID: request.requestID,
        serviceType,
        assigned: !!request.assignedStaff
      });

      return request;
    } catch (error) {
      this.logger.error('Failed to create VIP service request', {
        component: 'VIPCoordinationService',
        action: 'createServiceRequest',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to create VIP service request');
    }
  }

  /**
   * Get available staff for VIP services
   */
  public async getAvailableStaff(
    serviceType?: VIPServiceType,
    language?: string,
    timeSlot?: string
  ): Promise<StaffMember[]> {
    try {
      let availableStaff = Array.from(this.staffMembers.values()).filter(
        staff => staff.availability.status === 'available'
      );

      // Filter by service specialization
      if (serviceType) {
        const requiredSpecialization = this.getRequiredSpecialization(serviceType);
        availableStaff = availableStaff.filter(staff =>
          staff.specializations.includes(requiredSpecialization)
        );
      }

      // Filter by language
      if (language) {
        availableStaff = availableStaff.filter(staff =>
          staff.languages.some(lang =>
            lang.toLowerCase().includes(language.toLowerCase())
          )
        );
      }

      this.logger.debug('Retrieved available staff', {
        component: 'VIPCoordinationService',
        action: 'getAvailableStaff',
        totalAvailable: availableStaff.length,
        serviceType,
        language
      });

      return availableStaff;
    } catch (error) {
      this.logger.error('Failed to get available staff', {
        component: 'VIPCoordinationService',
        action: 'getAvailableStaff',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to get available staff');
    }
  }

  /**
   * Assign staff to a VIP service request
   */
  public async assignStaffToRequest(
    requestID: string,
    staffID: string,
    notes?: string
  ): Promise<{ assignmentID: string; success: boolean }> {
    try {
      const request = this.activeRequests.get(requestID);
      const staff = this.staffMembers.get(staffID);

      if (!request) {
        throw new Error('VIP service request not found');
      }

      if (!staff) {
        throw new Error('Staff member not found');
      }

      if (staff.availability.status !== 'available') {
        throw new Error('Staff member is not available');
      }

      // Update request with assigned staff
      request.assignedStaff = staff;
      request.status = 'assigned';

      // Update staff availability
      await this.updateStaffAvailability(staffID, 'busy');

      const assignmentID = `assign_${Date.now()}`;

      this.logger.info('Staff assigned to VIP request', {
        component: 'VIPCoordinationService',
        action: 'assignStaffToRequest',
        requestID,
        staffID,
        assignmentID
      });

      return { assignmentID, success: true };
    } catch (error) {
      this.logger.error('Failed to assign staff to request', {
        component: 'VIPCoordinationService',
        action: 'assignStaffToRequest',
        requestID,
        staffID,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to assign staff to request');
    }
  }

  /**
   * Create and coordinate a VIP event
   */
  public async createVIPEvent(
    eventType: VIPEvent['type'],
    flightNumber: string,
    passengerDetails: Record<string, any>,
    requirements: VIPEvent['requirements'],
    scheduledTime: string
  ): Promise<VIPEvent> {
    try {
      const event: VIPEvent = {
        eventID: `event_${Date.now()}`,
        type: eventType,
        title: this.generateEventTitle(eventType, passengerDetails),
        flightNumber,
        passengerCount: passengerDetails.count || 1,
        scheduledTime,
        terminal: passengerDetails.terminal || 'T3',
        requirements,
        coordinator: {
          name: 'VIP Events Coordinator',
          phone: '+971-50-vip-events'
        },
        status: 'planned'
      };

      this.upcomingEvents.set(event.eventID, event);

      // Pre-allocate resources
      await this.allocateEventResources(event);

      this.logger.info('VIP event created', {
        component: 'VIPCoordinationService',
        action: 'createVIPEvent',
        eventID: event.eventID,
        eventType,
        flightNumber
      });

      return event;
    } catch (error) {
      this.logger.error('Failed to create VIP event', {
        component: 'VIPCoordinationService',
        action: 'createVIPEvent',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to create VIP event');
    }
  }

  /**
   * Get upcoming VIP events
   */
  public async getUpcomingEvents(
    date?: string,
    terminal?: string
  ): Promise<VIPEvent[]> {
    try {
      let events = Array.from(this.upcomingEvents.values());

      // Filter by terminal if provided
      if (terminal) {
        events = events.filter(event =>
          event.terminal.toLowerCase() === terminal.toLowerCase()
        );
      }

      // Filter by date if provided
      if (date) {
        const targetDate = new Date(date).toDateString();
        events = events.filter(event =>
          new Date(event.scheduledTime).toDateString() === targetDate
        );
      }

      this.logger.debug('Retrieved upcoming VIP events', {
        component: 'VIPCoordinationService',
        action: 'getUpcomingEvents',
        eventCount: events.length,
        terminal,
        date
      });

      return events;
    } catch (error) {
      this.logger.error('Failed to get upcoming events', {
        component: 'VIPCoordinationService',
        action: 'getUpcomingEvents',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to get upcoming events');
    }
  }

  /**
   * Get active meet & greet services
   */
  public async getActiveMeetGreetServices(): Promise<any[]> {
    try {
      const activeMeetGreet = Array.from(this.activeRequests.values())
        .filter(request =>
          request.serviceType === VIPServiceType.MEET_GREET &&
          (request.status === 'assigned' || request.status === 'in_progress')
        )
        .map(request => ({
          serviceID: request.requestID,
          passengerID: request.passengerID,
          flightNumber: request.flightNumber,
          status: request.status,
          assignedStaff: request.assignedStaff,
          createdAt: request.createdAt
        }));

      this.logger.debug('Retrieved active meet & greet services', {
        component: 'VIPCoordinationService',
        action: 'getActiveMeetGreetServices',
        activeCount: activeMeetGreet.length
      });

      return activeMeetGreet;
    } catch (error) {
      this.logger.error('Failed to get active meet & greet services', {
        component: 'VIPCoordinationService',
        action: 'getActiveMeetGreetServices',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to get active meet & greet services');
    }
  }

  /**
   * Private helper methods
   */

  private initializeStaffData(): void {
    // Initialize sample staff data
    const sampleStaff: StaffMember[] = [
      {
        staffID: 'staff_001',
        name: 'Ahmed Hassan',
        role: 'VIP Coordinator',
        specializations: [StaffSpecialization.VIP_COORDINATOR, StaffSpecialization.GUEST_RELATIONS],
        languages: ['English', 'Arabic', 'French'],
        currentLocation: 'Terminal 3 - Arrivals',
        availability: { status: 'available' },
        rating: 4.9,
        phone: '+971-50-123-4567'
      },
      {
        staffID: 'staff_002',
        name: 'Fatima Al Zahra',
        role: 'Guest Relations Specialist',
        specializations: [StaffSpecialization.GUEST_RELATIONS, StaffSpecialization.LANGUAGE_SPECIALIST],
        languages: ['English', 'Arabic', 'Urdu', 'Hindi'],
        currentLocation: 'Terminal 1 - Departures',
        availability: { status: 'available' },
        rating: 4.8,
        phone: '+971-50-234-5678'
      }
    ];

    sampleStaff.forEach(staff => {
      this.staffMembers.set(staff.staffID, staff);
    });
  }

  private calculateServiceCost(
    serviceType: VIPServiceType,
    requirements: Record<string, any>
  ): { amount: number; currency: string } {
    const baseCosts: Record<VIPServiceType, number> = {
      [VIPServiceType.MEET_GREET]: 200,
      [VIPServiceType.LOUNGE_ESCORT]: 150,
      [VIPServiceType.FAST_TRACK]: 100,
      [VIPServiceType.LUGGAGE_ASSISTANCE]: 80,
      [VIPServiceType.GROUND_TRANSPORT]: 300,
      [VIPServiceType.CONCIERGE]: 250,
      [VIPServiceType.SECURITY_ESCORT]: 400,
      [VIPServiceType.MEDICAL_ASSISTANCE]: 350
    };

    let baseCost = baseCosts[serviceType] || 100;

    // Add premium for special requirements
    if (requirements.specialAssistance) baseCost += 50;
    if (requirements.multilingualService) baseCost += 30;
    if (requirements.urgentService) baseCost += 100;

    return { amount: baseCost, currency: 'AED' };
  }

  private async findAvailableStaff(
    serviceType: VIPServiceType,
    preferredTime: string
  ): Promise<StaffMember | null> {
    const requiredSpecialization = this.getRequiredSpecialization(serviceType);
    const availableStaff = Array.from(this.staffMembers.values()).find(
      staff =>
        staff.availability.status === 'available' &&
        staff.specializations.includes(requiredSpecialization)
    );

    return availableStaff || null;
  }

  private getRequiredSpecialization(serviceType: VIPServiceType): StaffSpecialization {
    const mappings: Record<VIPServiceType, StaffSpecialization> = {
      [VIPServiceType.MEET_GREET]: StaffSpecialization.VIP_COORDINATOR,
      [VIPServiceType.LOUNGE_ESCORT]: StaffSpecialization.GUEST_RELATIONS,
      [VIPServiceType.FAST_TRACK]: StaffSpecialization.VIP_COORDINATOR,
      [VIPServiceType.LUGGAGE_ASSISTANCE]: StaffSpecialization.GUEST_RELATIONS,
      [VIPServiceType.GROUND_TRANSPORT]: StaffSpecialization.TRANSPORT_COORDINATOR,
      [VIPServiceType.CONCIERGE]: StaffSpecialization.VIP_COORDINATOR,
      [VIPServiceType.SECURITY_ESCORT]: StaffSpecialization.SECURITY_ESCORT,
      [VIPServiceType.MEDICAL_ASSISTANCE]: StaffSpecialization.MEDICAL_ASSISTANT
    };

    return mappings[serviceType] || StaffSpecialization.VIP_COORDINATOR;
  }

  private async updateStaffAvailability(
    staffID: string,
    status: StaffMember['availability']['status']
  ): Promise<void> {
    const staff = this.staffMembers.get(staffID);
    if (staff) {
      staff.availability.status = status;
      this.staffMembers.set(staffID, staff);
    }
  }

  private generateEventTitle(
    eventType: VIPEvent['type'],
    passengerDetails: Record<string, any>
  ): string {
    const titles: Record<VIPEvent['type'], string> = {
      vipDeparture: 'VIP Departure - Business Delegation',
      vipArrival: 'VIP Arrival - Special Guest',
      delegation: 'Official Delegation Visit',
      celebrity: 'Celebrity Guest Arrival',
      diplomatic: 'Diplomatic Mission'
    };

    return passengerDetails.customTitle || titles[eventType] || 'VIP Event';
  }

  private async allocateEventResources(event: VIPEvent): Promise<void> {
    // Pre-allocate staff and resources for the event
    const requiredStaff = event.requirements.staffNeeded;
    const availableStaff = await this.getAvailableStaff();

    if (availableStaff.length >= requiredStaff) {
      event.status = 'confirmed';
      this.logger.info('VIP event resources allocated', {
        component: 'VIPCoordinationService',
        action: 'allocateEventResources',
        eventID: event.eventID,
        allocatedStaff: requiredStaff
      });
    }
  }
} 