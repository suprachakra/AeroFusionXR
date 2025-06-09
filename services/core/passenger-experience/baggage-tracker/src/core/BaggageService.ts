/**
 * BaggageService - Real-time Baggage Tracking System
 * 
 * Tracks baggage throughout the airport journey using RFID, barcode scanning,
 * and computer vision. Provides real-time updates to passengers and staff.
 * 
 * @author AeroFusionXR Engineering Team
 * @version 2.0.0
 */

import { Logger } from '@aerofusionxr/common/logger';
import { PerformanceMonitor } from '@aerofusionxr/common/performance';

// Core baggage types
interface BaggageItem {
  id: string;
  tagNumber: string;
  passengerId: string;
  flightNumber: string;
  weight: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  status: BaggageStatus;
  currentLocation: BaggageLocation;
  journey: BaggageJourneyPoint[];
  createdAt: Date;
  updatedAt: Date;
}

interface BaggageLocation {
  id: string;
  name: string;
  type: 'CHECK_IN' | 'SECURITY' | 'SORTING' | 'LOADING' | 'AIRCRAFT' | 'UNLOADING' | 'CLAIM';
  coordinates: {
    x: number;
    y: number;
    floor: number;
  };
  timestamp: Date;
}

interface BaggageJourneyPoint {
  location: BaggageLocation;
  timestamp: Date;
  scannedBy: string;
  method: 'RFID' | 'BARCODE' | 'MANUAL' | 'COMPUTER_VISION';
}

enum BaggageStatus {
  CHECKED_IN = 'CHECKED_IN',
  IN_TRANSIT = 'IN_TRANSIT', 
  LOADED = 'LOADED',
  IN_FLIGHT = 'IN_FLIGHT',
  ARRIVED = 'ARRIVED',
  AT_CLAIM = 'AT_CLAIM',
  COLLECTED = 'COLLECTED',
  DELAYED = 'DELAYED',
  LOST = 'LOST'
}

interface TrackingUpdate {
  baggageId: string;
  location: BaggageLocation;
  status: BaggageStatus;
  method: string;
  confidence: number;
}

/**
 * Main Baggage Tracking Service
 * Handles all baggage operations from check-in to collection
 */
export class BaggageService {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private baggageItems: Map<string, BaggageItem> = new Map();
  private locationMap: Map<string, BaggageLocation> = new Map();

  constructor() {
    this.logger = createLogger('BaggageService');
    this.performanceMonitor = new PerformanceMonitor('BaggageService');
    
    this.initializeLocations();
    this.logger.info('BaggageService initialized');
  }

  /**
   * Register new baggage item at check-in
   * 
   * @param passengerId - Passenger ID
   * @param flightNumber - Flight number
   * @param weight - Baggage weight in kg
   * @param dimensions - Baggage dimensions
   * @returns Created baggage item with tracking number
   */
  async checkInBaggage(
    passengerId: string,
    flightNumber: string,
    weight: number,
    dimensions: { length: number; width: number; height: number }
  ): Promise<BaggageItem> {
    const timer = this.performanceMonitor.startTimer('checkInBaggage');
    
    try {
      // Generate unique baggage ID and tag number
      const baggageId = this.generateBaggageId();
      const tagNumber = this.generateTagNumber(flightNumber);
      
      // Get check-in location
      const checkInLocation = this.locationMap.get('CHECK_IN_DESK_1');
      if (!checkInLocation) {
        throw new Error('Check-in location not available');
      }

      // Create baggage item
      const baggageItem: BaggageItem = {
        id: baggageId,
        tagNumber,
        passengerId,
        flightNumber,
        weight,
        dimensions,
        status: BaggageStatus.CHECKED_IN,
        currentLocation: checkInLocation,
        journey: [{
          location: checkInLocation,
          timestamp: new Date(),
          scannedBy: 'CHECK_IN_SYSTEM',
          method: 'BARCODE'
        }],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store baggage item
      this.baggageItems.set(baggageId, baggageItem);
      
      this.logger.info('Baggage checked in', {
        baggageId,
        tagNumber,
        passengerId,
        flightNumber,
        weight
      });

      return baggageItem;
      
    } catch (error) {
      this.logger.error('Baggage check-in failed', { 
        error: error.message,
        passengerId,
        flightNumber 
      });
      throw new Error('Baggage check-in failed');
    } finally {
      timer.end();
    }
  }

  /**
   * Update baggage location and status
   * 
   * @param baggageId - Baggage ID or tag number
   * @param locationId - New location ID
   * @param scannedBy - Scanner/operator ID
   * @param method - Scanning method used
   * @returns Updated baggage item
   */
  async updateBaggageLocation(
    baggageId: string,
    locationId: string,
    scannedBy: string,
    method: 'RFID' | 'BARCODE' | 'MANUAL' | 'COMPUTER_VISION' = 'BARCODE'
  ): Promise<BaggageItem> {
    const timer = this.performanceMonitor.startTimer('updateBaggageLocation');
    
    try {
      // Find baggage item
      const baggage = this.findBaggageItem(baggageId);
      if (!baggage) {
        throw new Error(`Baggage not found: ${baggageId}`);
      }

      // Get new location
      const newLocation = this.locationMap.get(locationId);
      if (!newLocation) {
        throw new Error(`Location not found: ${locationId}`);
      }

      // Update baggage status based on location
      const newStatus = this.determineStatusFromLocation(newLocation.type);
      
      // Add journey point
      const journeyPoint: BaggageJourneyPoint = {
        location: newLocation,
        timestamp: new Date(),
        scannedBy,
        method
      };

      // Update baggage item
      baggage.currentLocation = newLocation;
      baggage.status = newStatus;
      baggage.journey.push(journeyPoint);
      baggage.updatedAt = new Date();

      this.logger.info('Baggage location updated', {
        baggageId: baggage.id,
        tagNumber: baggage.tagNumber,
        newLocation: newLocation.name,
        status: newStatus,
        method
      });

      // Notify passengers if significant status change
      if (this.isSignificantStatusChange(newStatus)) {
        await this.notifyPassenger(baggage);
      }

      return baggage;
      
    } catch (error) {
      this.logger.error('Failed to update baggage location', {
        error: error.message,
        baggageId,
        locationId
      });
      throw new Error('Location update failed');
    } finally {
      timer.end();
    }
  }

  /**
   * Track baggage by ID or tag number
   * 
   * @param identifier - Baggage ID or tag number
   * @returns Baggage item with current status and journey
   */
  async trackBaggage(identifier: string): Promise<BaggageItem | null> {
    const timer = this.performanceMonitor.startTimer('trackBaggage');
    
    try {
      const baggage = this.findBaggageItem(identifier);
      
      if (baggage) {
        this.logger.debug('Baggage tracked', {
          baggageId: baggage.id,
          tagNumber: baggage.tagNumber,
          status: baggage.status,
          location: baggage.currentLocation.name
        });
      }

      return baggage;
      
    } catch (error) {
      this.logger.error('Baggage tracking failed', {
        error: error.message,
        identifier
      });
      return null;
    } finally {
      timer.end();
    }
  }

  /**
   * Get all baggage for a passenger
   * 
   * @param passengerId - Passenger ID
   * @returns Array of baggage items
   */
  async getPassengerBaggage(passengerId: string): Promise<BaggageItem[]> {
    const timer = this.performanceMonitor.startTimer('getPassengerBaggage');
    
    try {
      const passengerBaggage = Array.from(this.baggageItems.values())
        .filter(baggage => baggage.passengerId === passengerId);

      this.logger.debug('Retrieved passenger baggage', {
        passengerId,
        count: passengerBaggage.length
      });

      return passengerBaggage;
      
    } catch (error) {
      this.logger.error('Failed to get passenger baggage', {
        error: error.message,
        passengerId
      });
      throw new Error('Failed to retrieve baggage');
    } finally {
      timer.end();
    }
  }

  /**
   * Get baggage statistics for monitoring
   * 
   * @returns Current baggage statistics
   */
  async getBaggageStats(): Promise<any> {
    const timer = this.performanceMonitor.startTimer('getBaggageStats');
    
    try {
      const allBaggage = Array.from(this.baggageItems.values());
      
      const stats = {
        total: allBaggage.length,
        byStatus: this.groupByStatus(allBaggage),
        byLocation: this.groupByLocation(allBaggage),
        averageJourneyTime: this.calculateAverageJourneyTime(allBaggage),
        delayedCount: allBaggage.filter(b => b.status === BaggageStatus.DELAYED).length,
        lostCount: allBaggage.filter(b => b.status === BaggageStatus.LOST).length
      };

      this.logger.debug('Baggage statistics generated', stats);
      return stats;
      
    } catch (error) {
      this.logger.error('Failed to generate baggage statistics', {
        error: error.message
      });
      throw new Error('Statistics generation failed');
    } finally {
      timer.end();
    }
  }

  // Private helper methods

  /**
   * Initialize airport locations for baggage tracking
   */
  private initializeLocations(): void {
    const locations: BaggageLocation[] = [
      {
        id: 'CHECK_IN_DESK_1',
        name: 'Check-in Desk 1',
        type: 'CHECK_IN',
        coordinates: { x: 100, y: 50, floor: 1 },
        timestamp: new Date()
      },
      {
        id: 'SECURITY_CHECKPOINT',
        name: 'Security Checkpoint',
        type: 'SECURITY',
        coordinates: { x: 200, y: 100, floor: 1 },
        timestamp: new Date()
      },
      {
        id: 'BAGGAGE_SORTING',
        name: 'Baggage Sorting Facility',
        type: 'SORTING',
        coordinates: { x: 300, y: 150, floor: 0 },
        timestamp: new Date()
      },
      {
        id: 'AIRCRAFT_LOADING',
        name: 'Aircraft Loading Area',
        type: 'LOADING',
        coordinates: { x: 500, y: 200, floor: 0 },
        timestamp: new Date()
      },
      {
        id: 'BAGGAGE_CLAIM_1',
        name: 'Baggage Claim Carousel 1',
        type: 'CLAIM',
        coordinates: { x: 150, y: 300, floor: 1 },
        timestamp: new Date()
      }
    ];

    locations.forEach(location => {
      this.locationMap.set(location.id, location);
    });

    this.logger.info('Baggage locations initialized', { 
      count: locations.length 
    });
  }

  /**
   * Find baggage item by ID or tag number
   */
  private findBaggageItem(identifier: string): BaggageItem | null {
    // Try by ID first
    let baggage = this.baggageItems.get(identifier);
    
    // If not found, try by tag number
    if (!baggage) {
      baggage = Array.from(this.baggageItems.values())
        .find(item => item.tagNumber === identifier) || null;
    }

    return baggage;
  }

  /**
   * Generate unique baggage ID
   */
  private generateBaggageId(): string {
    return `BAG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate baggage tag number
   */
  private generateTagNumber(flightNumber: string): string {
    const timestamp = Date.now().toString().slice(-6);
    return `${flightNumber}${timestamp}`;
  }

  /**
   * Determine baggage status from location type
   */
  private determineStatusFromLocation(locationType: string): BaggageStatus {
    switch (locationType) {
      case 'CHECK_IN': return BaggageStatus.CHECKED_IN;
      case 'SECURITY':
      case 'SORTING': return BaggageStatus.IN_TRANSIT;
      case 'LOADING': return BaggageStatus.LOADED;
      case 'AIRCRAFT': return BaggageStatus.IN_FLIGHT;
      case 'UNLOADING': return BaggageStatus.ARRIVED;
      case 'CLAIM': return BaggageStatus.AT_CLAIM;
      default: return BaggageStatus.IN_TRANSIT;
    }
  }

  /**
   * Check if status change is significant enough to notify passenger
   */
  private isSignificantStatusChange(status: BaggageStatus): boolean {
    return [
      BaggageStatus.LOADED,
      BaggageStatus.ARRIVED,
      BaggageStatus.AT_CLAIM,
      BaggageStatus.DELAYED,
      BaggageStatus.LOST
    ].includes(status);
  }

  /**
   * Notify passenger of baggage status change
   */
  private async notifyPassenger(baggage: BaggageItem): Promise<void> {
    // This would integrate with notification service
    this.logger.info('Passenger notification sent', {
      passengerId: baggage.passengerId,
      baggageId: baggage.id,
      status: baggage.status,
      location: baggage.currentLocation.name
    });
  }

  /**
   * Group baggage by status for statistics
   */
  private groupByStatus(baggage: BaggageItem[]): Record<string, number> {
    return baggage.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Group baggage by location for statistics
   */
  private groupByLocation(baggage: BaggageItem[]): Record<string, number> {
    return baggage.reduce((acc, item) => {
      acc[item.currentLocation.name] = (acc[item.currentLocation.name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Calculate average journey time for completed baggage
   */
  private calculateAverageJourneyTime(baggage: BaggageItem[]): number {
    const completedBaggage = baggage.filter(item => 
      item.status === BaggageStatus.COLLECTED
    );

    if (completedBaggage.length === 0) return 0;

    const totalTime = completedBaggage.reduce((sum, item) => {
      const startTime = item.createdAt.getTime();
      const endTime = item.updatedAt.getTime();
      return sum + (endTime - startTime);
    }, 0);

    return totalTime / completedBaggage.length / (1000 * 60); // Return in minutes
  }
} 