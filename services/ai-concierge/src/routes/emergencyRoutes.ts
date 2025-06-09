/**
 * @fileoverview AeroFusionXR AI Concierge Service - Emergency & Crisis Management Routes
 * @version 1.0.0
 * @author AeroFusionXR AI Engineering Team
 * @created 2024-01-15
 * @updated 2024-01-15
 * 
 * Feature 20: Emergency & Crisis Management
 * Large-scale, multi-channel crisis communications and automated assistance workflows
 */

import { Router } from 'express';
import { Request, Response } from 'express';

const router = Router();

/**
 * POST /api/v1/emergency/incident/create
 * Create and process emergency incident
 */
router.post('/incident/create', async (req: Request, res: Response) => {
  try {
    const { 
      incidentID,
      type,
      location,
      scope,
      details,
      affectedFlights,
      affectedGroups
    } = req.body;
    
    if (!incidentID || !type || !location) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'IncidentID, type, and location are required'
      });
    }

    // Validate incident type
    const validTypes = ['Evacuation', 'FlightCancel', 'SecurityLockdown', 'WeatherClosure'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_INCIDENT_TYPE',
        message: 'Incident type must be one of: ' + validTypes.join(', ')
      });
    }

    // Mock incident creation and processing
    const incident = {
      incidentID,
      type,
      location,
      scope: scope || 'Local',
      details: details || {},
      timestamp: new Date().toISOString(),
      status: 'Open',
      affectedFlights: affectedFlights || [],
      affectedGroups: affectedGroups || [],
      followUpSent: false,
      notificationsSent: 0,
      psoCreated: 0,
      estimatedAffectedPassengers: calculateAffectedPassengers(type, scope, affectedFlights)
    };

    // Trigger immediate response based on incident type
    const response = await processIncidentResponse(incident);

    res.status(201).json({
      success: true,
      data: {
        incident,
        response,
        estimatedResponseTime: getEstimatedResponseTime(type, scope),
        nextActions: getNextActions(type, scope)
      },
      message: 'Emergency incident created and response initiated'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'INCIDENT_CREATION_ERROR',
      message: 'Failed to create emergency incident'
    });
  }
});

/**
 * GET /api/v1/emergency/incident/:incidentID
 * Get incident details and status
 */
router.get('/incident/:incidentID', async (req: Request, res: Response) => {
  try {
    const { incidentID } = req.params;
    
    // Mock incident retrieval
    const incident = {
      incidentID,
      type: 'Evacuation',
      location: 'Terminal1',
      scope: 'Local',
      details: {
        description: 'Fire detected in Concourse A mechanical room',
        severity: 'High',
        estimatedDuration: '45 minutes'
      },
      timestamp: '2024-01-15T12:00:00Z',
      status: 'Open',
      affectedFlights: ['EK234', 'EK567'],
      affectedGroups: [],
      followUpSent: false,
      notificationsSent: 1247,
      psoCreated: 23,
      responseTimeline: [
        {
          timestamp: '2024-01-15T12:00:05Z',
          action: 'Initial notifications sent',
          status: 'completed',
          details: '1247 push notifications, 89 SMS fallbacks'
        },
        {
          timestamp: '2024-01-15T12:00:15Z',
          action: 'Digital signage updated',
          status: 'completed',
          details: 'All Terminal 1 displays showing evacuation instructions'
        },
        {
          timestamp: '2024-01-15T12:01:30Z',
          action: 'PA announcements triggered',
          status: 'completed',
          details: 'Multi-language evacuation instructions broadcast'
        }
      ]
    };

    res.json({
      success: true,
      data: incident,
      message: 'Incident details retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'INCIDENT_RETRIEVAL_ERROR',
      message: 'Failed to retrieve incident details'
    });
  }
});

/**
 * POST /api/v1/emergency/notify/multi
 * Send multi-channel notifications for emergency
 */
router.post('/notify/multi', async (req: Request, res: Response) => {
  try {
    const { 
      incidentID,
      channels,
      message,
      audience,
      priority = 'high'
    } = req.body;
    
    if (!incidentID || !channels || !message || !audience) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'IncidentID, channels, message, and audience are required'
      });
    }

    // Mock multi-channel notification dispatch
    const batchID = `BATCH_${Date.now()}`;
    const dispatchResult = {
      batchID,
      incidentID,
      dispatchedAt: new Date().toISOString(),
      channels: channels.map((channel: string) => ({
        channel,
        status: 'dispatched',
        recipientCount: getRecipientCount(channel, audience),
        estimatedDeliveryTime: getDeliveryTime(channel)
      })),
      totalRecipients: getTotalRecipients(audience),
      priority,
      retryPolicy: {
        maxRetries: 2,
        retryInterval: '30 seconds',
        fallbackEnabled: true
      },
      deliveryTracking: {
        push: { sent: 0, delivered: 0, failed: 0 },
        sms: { sent: 0, delivered: 0, failed: 0 },
        email: { sent: 0, delivered: 0, failed: 0 },
        signage: { sent: 0, displayed: 0, failed: 0 },
        pa: { sent: 0, broadcast: 0, failed: 0 }
      }
    };

    res.status(201).json({
      success: true,
      data: dispatchResult,
      message: 'Multi-channel notifications dispatched successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'NOTIFICATION_DISPATCH_ERROR',
      message: 'Failed to dispatch multi-channel notifications'
    });
  }
});

/**
 * POST /api/v1/emergency/pso/create
 * Create Passenger Support Order (PSO) for assistance
 */
router.post('/pso/create', async (req: Request, res: Response) => {
  try {
    const { 
      userID,
      staffID,
      task,
      fromLocation,
      toLocation,
      priority = 'medium',
      specialInstructions
    } = req.body;
    
    if (!userID || !task || !fromLocation) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'UserID, task, and fromLocation are required'
      });
    }

    // Mock PSO creation
    const pso = {
      psoID: `PSO_${Date.now()}`,
      userID,
      staffID: staffID || await assignNearestStaff(fromLocation),
      task, // Escort, MedicalAssist, LanguageSupport, etc.
      fromLocation,
      toLocation: toLocation || 'SafeZone',
      priority,
      specialInstructions: specialInstructions || '',
      status: 'Created',
      createdAt: new Date().toISOString(),
      estimatedCompletionTime: getTaskCompletionTime(task),
      trackingUpdates: [],
      passengerProfile: {
        name: 'John Doe',
        specialNeeds: ['Wheelchair', 'Hearing Impaired'],
        preferredLanguage: 'English',
        emergencyContact: '+971501234567'
      }
    };

    res.status(201).json({
      success: true,
      data: pso,
      message: 'Passenger Support Order created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'PSO_CREATION_ERROR',
      message: 'Failed to create Passenger Support Order'
    });
  }
});

/**
 * GET /api/v1/emergency/pso/:psoID/status
 * Get PSO status and tracking information
 */
router.get('/pso/:psoID/status', async (req: Request, res: Response) => {
  try {
    const { psoID } = req.params;
    
    // Mock PSO status retrieval
    const psoStatus = {
      psoID,
      userID: 'user_12345',
      staffID: 'staff_67890',
      task: 'Escort',
      fromLocation: 'GateA15',
      toLocation: 'ExitC1',
      priority: 'high',
      status: 'InProgress',
      createdAt: '2024-01-15T12:05:00Z',
      startedAt: '2024-01-15T12:07:00Z',
      estimatedCompletionTime: '2024-01-15T12:15:00Z',
      currentLocation: 'ConcourseA-MidPoint',
      progressPercentage: 65,
      trackingUpdates: [
        {
          timestamp: '2024-01-15T12:07:00Z',
          status: 'Staff assigned and en route',
          location: 'StaffStation-A',
          estimatedArrival: '2024-01-15T12:09:00Z'
        },
        {
          timestamp: '2024-01-15T12:09:30Z',
          status: 'Staff arrived at passenger location',
          location: 'GateA15',
          notes: 'Passenger located and assistance begun'
        },
        {
          timestamp: '2024-01-15T12:12:00Z',
          status: 'Escort in progress',
          location: 'ConcourseA-MidPoint',
          estimatedCompletion: '2024-01-15T12:15:00Z'
        }
      ],
      staffDetails: {
        name: 'Ahmed Al-Rashid',
        role: 'Passenger Services Officer',
        languages: ['English', 'Arabic', 'Hindi'],
        phoneNumber: '+971501234567'
      }
    };

    res.json({
      success: true,
      data: psoStatus,
      message: 'PSO status retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'PSO_STATUS_ERROR',
      message: 'Failed to retrieve PSO status'
    });
  }
});

/**
 * POST /api/v1/emergency/group/message
 * Send message to specific group
 */
router.post('/group/message', async (req: Request, res: Response) => {
  try {
    const { 
      groupID,
      message,
      channels = ['SMS', 'Push'],
      urgent = false
    } = req.body;
    
    if (!groupID || !message) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'GroupID and message are required'
      });
    }

    // Mock group messaging
    const groupMessage = {
      messageID: `MSG_${Date.now()}`,
      groupID,
      message,
      channels,
      urgent,
      sentAt: new Date().toISOString(),
      groupInfo: {
        groupName: 'Tour Group G200',
        memberCount: 200,
        organizer: 'Emirates Tours',
        currentLocation: 'Terminal3-MeetingPoint'
      },
      deliveryStatus: {
        totalMembers: 200,
        smsDelivered: 0,
        pushDelivered: 0,
        failed: 0,
        pending: 200
      },
      retryPolicy: {
        enabled: true,
        maxRetries: urgent ? 3 : 2,
        retryInterval: urgent ? '15 seconds' : '30 seconds'
      }
    };

    res.status(201).json({
      success: true,
      data: groupMessage,
      message: 'Group message dispatched successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'GROUP_MESSAGE_ERROR',
      message: 'Failed to send group message'
    });
  }
});

/**
 * GET /api/v1/emergency/group/:groupID/members
 * Get group members for emergency communication
 */
router.get('/group/:groupID/members', async (req: Request, res: Response) => {
  try {
    const { groupID } = req.params;
    
    // Mock group members retrieval
    const groupMembers = {
      groupID,
      groupName: 'Tour Group G200',
      totalMembers: 200,
      organizer: 'Emirates Tours',
      organizerContact: '+971501234567',
      meetingPoint: 'Terminal3-GateB12',
      members: [
        {
          userID: 'user_001',
          name: 'John Smith',
          contactMethods: {
            push: { deviceToken: 'token_001', active: true },
            sms: { phoneNumber: '+447123456789', verified: true },
            email: { address: 'john@email.com', verified: true }
          },
          specialNeeds: [],
          lastSeen: '2024-01-15T11:45:00Z'
        },
        {
          userID: 'user_002',
          name: 'Sarah Johnson',
          contactMethods: {
            push: { deviceToken: 'token_002', active: false },
            sms: { phoneNumber: '+447987654321', verified: true },
            email: { address: 'sarah@email.com', verified: true }
          },
          specialNeeds: ['Wheelchair'],
          lastSeen: '2024-01-15T11:30:00Z'
        }
        // ... truncated for brevity
      ],
      emergencyContacts: [
        {
          name: 'Tour Guide - Ahmed Hassan',
          phoneNumber: '+971501111111',
          role: 'Primary Guide'
        }
      ]
    };

    res.json({
      success: true,
      data: groupMembers,
      message: 'Group members retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'GROUP_MEMBERS_ERROR',
      message: 'Failed to retrieve group members'
    });
  }
});

/**
 * POST /api/v1/emergency/gis/exitRoutes
 * Get emergency exit routes for location
 */
router.post('/gis/exitRoutes', async (req: Request, res: Response) => {
  try {
    const { location, emergency = false } = req.body;
    
    if (!location) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_LOCATION',
        message: 'Location is required'
      });
    }

    // Mock GIS exit routes
    const exitRoutes = {
      location,
      emergency,
      generatedAt: new Date().toISOString(),
      routes: [
        {
          exitID: 'ExitA1',
          exitName: 'Main Exit A1',
          distance: '150 meters',
          estimatedTime: '2 minutes',
          capacity: 'High',
          currentCongestion: 'Low',
          accessibleForDisabled: true,
          path: [
            { x: 10, y: 5, floor: 2, landmark: 'Current Location' },
            { x: 15, y: 8, floor: 2, landmark: 'Concourse A Junction' },
            { x: 25, y: 12, floor: 2, landmark: 'Moving Walkway Start' },
            { x: 35, y: 15, floor: 2, landmark: 'Exit A1' }
          ],
          instructions: [
            'Head north toward Concourse A',
            'Take moving walkway toward exits',
            'Follow green exit signs to Exit A1',
            'Proceed calmly, do not run'
          ]
        },
        {
          exitID: 'ExitA2',
          exitName: 'Secondary Exit A2',
          distance: '200 meters',
          estimatedTime: '3 minutes',
          capacity: 'Medium',
          currentCongestion: 'Medium',
          accessibleForDisabled: true,
          path: [
            { x: 10, y: 5, floor: 2, landmark: 'Current Location' },
            { x: 8, y: 10, floor: 2, landmark: 'Restroom Area' },
            { x: 5, y: 18, floor: 2, landmark: 'Food Court' },
            { x: 2, y: 25, floor: 2, landmark: 'Exit A2' }
          ],
          instructions: [
            'Head south toward food court area',
            'Pass restrooms on your left',
            'Follow alternate exit signs to Exit A2',
            'Use this route if Exit A1 is congested'
          ]
        }
      ],
      safetyInstructions: [
        'Remain calm and follow staff instructions',
        'Do not use elevators during emergency',
        'Assist others if you are able',
        'Report to assembly points outside'
      ],
      emergencyContacts: [
        {
          service: 'Emergency Services',
          number: '999',
          description: 'Fire, Medical, Police'
        },
        {
          service: 'Airport Operations',
          number: '+971-4-208-0000',
          description: 'Airport emergency coordination'
        }
      ]
    };

    res.json({
      success: true,
      data: exitRoutes,
      message: 'Emergency exit routes retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'EXIT_ROUTES_ERROR',
      message: 'Failed to retrieve exit routes'
    });
  }
});

/**
 * POST /api/v1/emergency/rebook/group
 * Mass rebooking for affected passengers
 */
router.post('/rebook/group', async (req: Request, res: Response) => {
  try {
    const { 
      flightID,
      options = ['NextDay', 'Refund'],
      passengerList,
      reason = 'Mass Cancellation'
    } = req.body;
    
    if (!flightID || !passengerList || passengerList.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'FlightID and passengerList are required'
      });
    }

    // Mock mass rebooking
    const rebookingResult = {
      rebookingID: `REBOOK_${Date.now()}`,
      originalFlightID: flightID,
      reason,
      totalPassengers: passengerList.length,
      processedAt: new Date().toISOString(),
      options,
      results: {
        rebooked: passengerList.slice(0, Math.floor(passengerList.length * 0.7)).map((userID: string, index: number) => ({
          userID,
          originalFlight: flightID,
          newFlightID: `EK${Number(flightID.slice(2)) + 1}`,
          newSeat: `${12 + index}A`,
          newDepartureTime: '2024-01-16T08:00:00Z',
          fareDifference: 0,
          status: 'confirmed'
        })),
        refunds: passengerList.slice(Math.floor(passengerList.length * 0.7)).map((userID: string) => ({
          userID,
          originalFlight: flightID,
          refundAmount: 850.00,
          currency: 'AED',
          processingTime: '3-5 business days',
          refundMethod: 'Original payment method',
          status: 'processing'
        })),
        failed: []
      },
      compensationOffered: {
        hotelVoucher: true,
        mealVoucher: true,
        mealVoucherValue: 150,
        transportVoucher: true,
        loungeAccess: true
      },
      notificationsSent: {
        sms: passengerList.length,
        email: passengerList.length,
        push: Math.floor(passengerList.length * 0.8)
      }
    };

    res.status(201).json({
      success: true,
      data: rebookingResult,
      message: 'Mass rebooking processed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'MASS_REBOOKING_ERROR',
      message: 'Failed to process mass rebooking'
    });
  }
});

/**
 * POST /api/v1/emergency/followup/send
 * Send post-crisis follow-up communications
 */
router.post('/followup/send', async (req: Request, res: Response) => {
  try {
    const { 
      incidentID,
      affectedPassengers,
      compensationDetails,
      templateType = 'apology_with_voucher'
    } = req.body;
    
    if (!incidentID || !affectedPassengers) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'IncidentID and affectedPassengers are required'
      });
    }

    // Mock follow-up communication
    const followUp = {
      followUpID: `FOLLOWUP_${Date.now()}`,
      incidentID,
      templateType,
      sentAt: new Date().toISOString(),
      recipients: affectedPassengers.map((userID: string) => ({
        userID,
        channels: ['email', 'push'],
        compensation: {
          voucherCode: `APOLOGY${Date.now().toString().slice(-6)}`,
          voucherValue: compensationDetails?.voucherValue || 100,
          currency: 'AED',
          expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          applicableServices: ['dining', 'duty_free', 'lounge']
        },
        deliveryStatus: 'sent'
      })),
      messageContent: {
        subject: 'Emirates Apology - Service Disruption Compensation',
        htmlTemplate: 'apology_with_voucher_template',
        personalization: {
          incidentDate: '2024-01-15',
          incidentType: 'Flight Cancellation',
          compensationType: 'Meal Voucher + Rebooking'
        }
      },
      deliveryStats: {
        totalSent: affectedPassengers.length,
        emailDelivered: 0,
        pushDelivered: 0,
        bounced: 0,
        failed: 0
      }
    };

    res.status(201).json({
      success: true,
      data: followUp,
      message: 'Post-crisis follow-up communications sent successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'FOLLOWUP_ERROR',
      message: 'Failed to send follow-up communications'
    });
  }
});

/**
 * GET /api/v1/emergency/analytics
 * Get emergency response analytics and metrics
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const { timeframe = '24h', incidentType } = req.query;
    
    // Mock emergency analytics
    const analytics = {
      timeframe,
      incidentType,
      generatedAt: new Date().toISOString(),
      incidentSummary: {
        totalIncidents: 12,
        byType: {
          Evacuation: 2,
          FlightCancel: 7,
          SecurityLockdown: 1,
          WeatherClosure: 2
        },
        bySeverity: {
          High: 3,
          Medium: 6,
          Low: 3
        },
        byStatus: {
          Open: 2,
          Resolved: 9,
          FollowUpSent: 1
        }
      },
      responseMetrics: {
        averageResponseTime: '4.2 seconds',
        notificationDeliveryRate: 0.987,
        psoCompletionRate: 0.94,
        fallbackActivationRate: 0.08
      },
      notificationStats: {
        totalSent: 15420,
        byChannel: {
          push: 12890,
          sms: 2100,
          email: 8750,
          signage: 45,
          pa: 15
        },
        deliveryRates: {
          push: 0.94,
          sms: 0.98,
          email: 0.89,
          signage: 1.0,
          pa: 1.0
        }
      },
      psoMetrics: {
        totalCreated: 156,
        byTask: {
          Escort: 89,
          MedicalAssist: 23,
          LanguageSupport: 31,
          SpecialNeeds: 13
        },
        averageCompletionTime: '8.5 minutes',
        successRate: 0.94
      },
      rebookingStats: {
        massRebookingEvents: 3,
        passengersRebooked: 2340,
        passengersRefunded: 890,
        averageProcessingTime: '12 minutes',
        compensationIssued: {
          hotelVouchers: 1200,
          mealVouchers: 3230,
          loungeAccess: 890
        }
      },
      systemPerformance: {
        averageLatency: {
          incidentIngestion: '1.2 seconds',
          notificationDispatch: '3.8 seconds',
          psoCreation: '2.1 seconds',
          gisRouteGeneration: '0.8 seconds'
        },
        errorRates: {
          notificationFailures: 0.013,
          psoFailures: 0.006,
          rebookingFailures: 0.002
        },
        systemAvailability: 0.999
      }
    };

    res.json({
      success: true,
      data: analytics,
      message: 'Emergency analytics retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'ANALYTICS_ERROR',
      message: 'Failed to retrieve emergency analytics'
    });
  }
});

/**
 * Helper functions
 */
function calculateAffectedPassengers(type: string, scope: string, affectedFlights: string[]): number {
  const basePassengers = {
    Evacuation: scope === 'Local' ? 2000 : 8000,
    FlightCancel: affectedFlights.length * 300,
    SecurityLockdown: scope === 'Local' ? 1500 : 12000,
    WeatherClosure: scope === 'Local' ? 5000 : 25000
  };
  return basePassengers[type as keyof typeof basePassengers] || 0;
}

async function processIncidentResponse(incident: any): Promise<any> {
  // Mock incident response processing
  return {
    notificationsSent: incident.type === 'Evacuation' ? 2000 : 500,
    channelsActivated: ['push', 'sms', 'signage', 'pa'],
    psoTriggered: incident.type === 'Evacuation' ? 15 : 0,
    rebookingInitiated: incident.type === 'FlightCancel',
    estimatedImpact: getEstimatedImpact(incident.type, incident.scope)
  };
}

function getEstimatedResponseTime(type: string, scope: string): string {
  const times = {
    Evacuation: scope === 'Local' ? '5 seconds' : '10 seconds',
    FlightCancel: '30 seconds',
    SecurityLockdown: '15 seconds',
    WeatherClosure: '60 seconds'
  };
  return times[type as keyof typeof times] || '30 seconds';
}

function getNextActions(type: string, scope: string): string[] {
  const actions: Record<string, string[]> = {
    Evacuation: [
      'Monitor passenger movement to exits',
      'Coordinate with emergency services',
      'Prepare assembly point attendance',
      'Update families and next of kin'
    ],
    FlightCancel: [
      'Process rebooking options',
      'Arrange hotel accommodations',
      'Issue meal vouchers',
      'Send follow-up communications'
    ],
    SecurityLockdown: [
      'Coordinate with security forces',
      'Monitor restricted areas',
      'Prepare all-clear communications',
      'Resume normal operations'
    ]
  };
  return actions[type] || ['Monitor situation', 'Prepare updates'];
}

function getRecipientCount(channel: string, audience: any): number {
  const baseCounts = {
    Push: 850,
    SMS: 120,
    Email: 950,
    Signage: 15,
    PA: 8
  };
  return baseCounts[channel as keyof typeof baseCounts] || 0;
}

function getDeliveryTime(channel: string): string {
  const times = {
    Push: '2-5 seconds',
    SMS: '5-30 seconds',
    Email: '10-60 seconds',
    Signage: '1-2 seconds',
    PA: '1-3 seconds'
  };
  return times[channel as keyof typeof times] || '30 seconds';
}

function getTotalRecipients(audience: any): number {
  if (audience.flightIDs) return audience.flightIDs.length * 300;
  if (audience.groupID) return 200;
  if (audience.zone) return 2000;
  return 1000;
}

async function assignNearestStaff(location: string): Promise<string> {
  // Mock staff assignment
  return `staff_${Date.now()}`;
}

function getTaskCompletionTime(task: string): string {
  const times = {
    Escort: '8-12 minutes',
    MedicalAssist: '15-30 minutes',
    LanguageSupport: '5-10 minutes',
    SpecialNeeds: '10-20 minutes'
  };
  return times[task as keyof typeof times] || '10 minutes';
}

function getEstimatedImpact(type: string, scope: string): any {
  return {
    passengers: calculateAffectedPassengers(type, scope, []),
    flights: type === 'FlightCancel' ? 5 : 0,
    terminals: scope === 'Local' ? 1 : 3,
    estimatedDuration: type === 'Evacuation' ? '45 minutes' : '2 hours'
  };
}

export { router as emergencyRoutes }; 