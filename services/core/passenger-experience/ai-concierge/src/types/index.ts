/**
 * @fileoverview AI Concierge Service - Core Type Definitions
 * @version 1.0.0
 * @author AeroFusionXR AI Engineering Team
 * @created 2024-01-15
 * @updated 2024-01-15
 * 
 * Comprehensive type definitions for all 11 AI Concierge features:
 * 1. Virtual Concierge Kiosks / Digital Human Agents
 * 2. Multilingual Virtual Assistant  
 * 3. VIP Services & Premium Passenger Coordination
 * 4. Itinerary Management & Proactive Trip Orchestration
 * 5. Customer Service & Complex Query Automation
 * 6. Loyalty Program Integration & Miles Management
 * 7. Real-time Communication & Notification Hub
 * 8. Baggage Management & Smart Tracking
 * 9. Ground Transportation & Logistics Coordination
 * 10. Emergency & Crisis Management
 * 11. Analytics & Personalization Engine
 */

// =============================================================================
// CORE BASE TYPES
// =============================================================================

/**
 * Universal unique identifier type
 */
export type UUID = string;

/**
 * ISO 8601 timestamp string
 */
export type Timestamp = string;

/**
 * Supported languages in the system
 */
export type SupportedLanguage = 
  | 'en' | 'ar' | 'fr' | 'de' | 'es' | 'it' | 'ru' | 'zh' 
  | 'ja' | 'ko' | 'hi' | 'ur' | 'fa' | 'pt' | 'nl' | 'tr';

/**
 * Priority levels for requests, notifications, and tasks
 */
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL';

/**
 * Standard API response wrapper
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: Timestamp;
    requestId: UUID;
    executionTime: number;
  };
}

/**
 * Geolocation coordinates
 */
export interface GeoLocation {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  timestamp: Timestamp;
}

/**
 * Contact information structure
 */
export interface ContactInfo {
  email?: string;
  phone?: string;
  whatsapp?: string;
  telegram?: string;
  wechat?: string;
}

// =============================================================================
// FEATURE 1: VIRTUAL CONCIERGE KIOSKS / DIGITAL HUMAN AGENTS
// =============================================================================

/**
 * Digital kiosk configuration and capabilities
 */
export interface VirtualKiosk {
  id: UUID;
  name: string;
  location: {
    terminal: string;
    area: string;
    coordinates: GeoLocation;
    nearbyLandmarks: string[];
  };
  capabilities: {
    speechToText: boolean;
    textToSpeech: boolean;
    videoCall: boolean;
    documentScanning: boolean;
    printServices: boolean;
    accessibilityFeatures: string[];
  };
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'BUSY';
  lastHeartbeat: Timestamp;
  metrics: KioskMetrics;
}

/**
 * Kiosk performance and usage metrics
 */
export interface KioskMetrics {
  dailyInteractions: number;
  averageSessionDuration: number;
  successfulResolutions: number;
  escalationsToHuman: number;
  languageDistribution: Record<SupportedLanguage, number>;
  commonQueries: Array<{
    query: string;
    frequency: number;
    avgResolutionTime: number;
  }>;
}

/**
 * Conversation session with a kiosk
 */
export interface KioskSession {
  id: UUID;
  kioskId: UUID;
  userId?: UUID;
  startTime: Timestamp;
  endTime?: Timestamp;
  language: SupportedLanguage;
  conversationState: ConversationState;
  transcript: ConversationMessage[];
  escalatedToHuman: boolean;
  humanAgentId?: UUID;
  satisfaction?: {
    rating: number; // 1-5
    feedback?: string;
    timestamp: Timestamp;
  };
}

/**
 * Individual message in a conversation
 */
export interface ConversationMessage {
  id: UUID;
  sessionId: UUID;
  sender: 'USER' | 'AI' | 'HUMAN_AGENT';
  content: {
    text?: string;
    audio?: {
      url: string;
      duration: number;
      format: string;
    };
    attachments?: Array<{
      type: 'IMAGE' | 'DOCUMENT' | 'VIDEO';
      url: string;
      metadata?: any;
    }>;
  };
  timestamp: Timestamp;
  processed: boolean;
  intent?: DetectedIntent;
}

/**
 * AI-detected user intent from conversation
 */
export interface DetectedIntent {
  category: string;
  confidence: number;
  entities: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;
  followUpActions?: string[];
}

/**
 * Current state of conversation flow
 */
export interface ConversationState {
  currentStep: string;
  collectedInfo: Record<string, any>;
  pendingActions: string[];
  awaitingInput: boolean;
  contextHistory: string[];
}

// =============================================================================
// FEATURE 2: MULTILINGUAL VIRTUAL ASSISTANT
// =============================================================================

/**
 * Virtual assistant configuration per language
 */
export interface VirtualAssistant {
  id: UUID;
  name: string;
  language: SupportedLanguage;
  personality: {
    tone: 'PROFESSIONAL' | 'FRIENDLY' | 'CASUAL' | 'FORMAL';
    culturalAdaptations: string[];
    localExpressions: Record<string, string>;
  };
  capabilities: AssistantCapabilities;
  knowledgeBase: KnowledgeBase;
  status: 'ACTIVE' | 'TRAINING' | 'MAINTENANCE';
}

/**
 * Assistant's functional capabilities
 */
export interface AssistantCapabilities {
  languages: SupportedLanguage[];
  domains: Array<{
    name: string;
    confidence: number;
    lastTraining: Timestamp;
  }>;
  integrations: string[];
  realTimeTranslation: boolean;
  contextAwareness: boolean;
  emotionDetection: boolean;
}

/**
 * Knowledge base for assistant responses
 */
export interface KnowledgeBase {
  lastUpdated: Timestamp;
  categories: Array<{
    name: string;
    articles: number;
    coverage: number; // percentage
  }>;
  faqCount: number;
  proceduresCount: number;
  policiesCount: number;
}

// =============================================================================
// FEATURE 3: VIP SERVICES & PREMIUM PASSENGER COORDINATION
// =============================================================================

/**
 * VIP passenger profile and preferences
 */
export interface VIPPassenger {
  id: UUID;
  personalInfo: {
    title: string;
    firstName: string;
    lastName: string;
    preferredName?: string;
    nationality: string;
    passportNumber: string;
    diplomaticStatus?: DiplomaticStatus;
  };
  contactInfo: ContactInfo;
  preferences: VIPPreferences;
  services: VIPServiceHistory[];
  currentBooking?: VIPBooking;
  securityClearance?: SecurityClearance;
  specialRequirements: string[];
}

/**
 * Diplomatic status information
 */
export interface DiplomaticStatus {
  type: 'DIPLOMAT' | 'CONSULAR' | 'OFFICIAL' | 'SERVICE';
  rank: string;
  country: string;
  diplomaticPassport: boolean;
  immunityLevel: 'FULL' | 'FUNCTIONAL' | 'LIMITED' | 'NONE';
}

/**
 * VIP passenger preferences
 */
export interface VIPPreferences {
  communication: {
    preferredLanguage: SupportedLanguage;
    contactMethod: 'EMAIL' | 'PHONE' | 'WHATSAPP' | 'TELEGRAM';
    notificationTiming: string[];
  };
  services: {
    loungePreference: string[];
    mealPreferences: string[];
    transportPreference: 'LIMOUSINE' | 'HELICOPTER' | 'PRIVATE_JET' | 'STANDARD';
    accommodationPreference: string[];
  };
  accessibility: {
    wheelchairAssistance: boolean;
    visualImpairment: boolean;
    hearingImpairment: boolean;
    otherRequirements: string[];
  };
}

/**
 * VIP service booking and coordination
 */
export interface VIPBooking {
  id: UUID;
  passengerId: UUID;
  flightDetails: {
    outbound: FlightInfo;
    return?: FlightInfo;
    connections: FlightInfo[];
  };
  services: VIPService[];
  timeline: VIPTimeline;
  coordination: CoordinationDetails;
  status: 'PLANNED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

/**
 * Individual VIP service
 */
export interface VIPService {
  id: UUID;
  type: VIPServiceType;
  provider: string;
  scheduledTime: Timestamp;
  location: string;
  status: 'BOOKED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  cost: {
    amount: number;
    currency: string;
    billTo: 'PASSENGER' | 'COMPANY' | 'AIRLINE';
  };
  notes?: string;
}

/**
 * Types of VIP services available
 */
export type VIPServiceType = 
  | 'FAST_TRACK_IMMIGRATION'
  | 'PRIVATE_LOUNGE'
  | 'MEET_AND_GREET'
  | 'BAGGAGE_HANDLING'
  | 'LIMOUSINE_TRANSFER'
  | 'HELICOPTER_TRANSFER'
  | 'CUSTOMS_ASSISTANCE'
  | 'CONCIERGE_SERVICE'
  | 'DIPLOMATIC_PROTOCOL'
  | 'SECURITY_ESCORT';

/**
 * VIP service timeline coordination
 */
export interface VIPTimeline {
  departure: {
    arrivalAtAirport: Timestamp;
    checkInTime: Timestamp;
    securityTime: Timestamp;
    loungeTime?: Timestamp;
    boardingTime: Timestamp;
  };
  arrival: {
    landingTime: Timestamp;
    immigrationTime: Timestamp;
    baggageTime: Timestamp;
    customsTime: Timestamp;
    exitTime: Timestamp;
  };
  buffer: {
    immigrationBuffer: number; // minutes
    securityBuffer: number;
    connectionBuffer: number;
  };
}

/**
 * Service coordination details
 */
export interface CoordinationDetails {
  primaryCoordinator: {
    name: string;
    phone: string;
    email: string;
    whatsapp?: string;
  };
  backupCoordinator?: {
    name: string;
    phone: string;
    email: string;
  };
  serviceProviders: Array<{
    service: VIPServiceType;
    contactPerson: string;
    phone: string;
    confirmationCode?: string;
  }>;
  emergencyContacts: ContactInfo[];
}

// =============================================================================
// FEATURE 4: ITINERARY MANAGEMENT & PROACTIVE TRIP ORCHESTRATION
// =============================================================================

/**
 * Complete travel itinerary
 */
export interface TravelItinerary {
  id: UUID;
  passengerId: UUID;
  tripName: string;
  startDate: Timestamp;
  endDate: Timestamp;
  segments: TravelSegment[];
  reminders: ProactiveReminder[];
  documents: TravelDocument[];
  emergencyContacts: ContactInfo[];
  status: 'DRAFT' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  syncedServices: string[];
}

/**
 * Individual travel segment
 */
export interface TravelSegment {
  id: UUID;
  type: 'FLIGHT' | 'HOTEL' | 'TRANSPORT' | 'ACTIVITY' | 'MEETING';
  sequence: number;
  details: FlightSegment | HotelSegment | TransportSegment | ActivitySegment;
  status: 'BOOKED' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED';
  notifications: SegmentNotification[];
}

/**
 * Flight segment details
 */
export interface FlightSegment {
  airline: string;
  flightNumber: string;
  departure: {
    airport: string;
    terminal?: string;
    gate?: string;
    time: Timestamp;
  };
  arrival: {
    airport: string;
    terminal?: string;
    gate?: string;
    time: Timestamp;
  };
  seatNumber?: string;
  bookingReference: string;
  status: FlightStatus;
}

/**
 * Hotel accommodation segment
 */
export interface HotelSegment {
  hotelName: string;
  address: string;
  checkIn: Timestamp;
  checkOut: Timestamp;
  roomType: string;
  confirmationNumber: string;
  contactInfo: ContactInfo;
  amenities: string[];
}

/**
 * Ground transport segment
 */
export interface TransportSegment {
  type: 'TAXI' | 'UBER' | 'LIMOUSINE' | 'BUS' | 'TRAIN' | 'RENTAL_CAR';
  provider: string;
  pickup: {
    location: string;
    time: Timestamp;
    coordinates?: GeoLocation;
  };
  dropoff: {
    location: string;
    estimatedTime: Timestamp;
    coordinates?: GeoLocation;
  };
  confirmationCode?: string;
  driverInfo?: {
    name: string;
    phone: string;
    vehicleDetails: string;
  };
}

/**
 * Activity or meeting segment
 */
export interface ActivitySegment {
  title: string;
  description: string;
  location: string;
  startTime: Timestamp;
  endTime: Timestamp;
  attendees?: string[];
  requirements?: string[];
  confirmationDetails?: string;
}

/**
 * Proactive reminder system
 */
export interface ProactiveReminder {
  id: UUID;
  itineraryId: UUID;
  type: ReminderType;
  triggerTime: Timestamp;
  content: {
    title: string;
    message: string;
    actionItems?: string[];
    links?: Array<{
      text: string;
      url: string;
    }>;
  };
  channels: NotificationChannel[];
  status: 'SCHEDULED' | 'SENT' | 'ACKNOWLEDGED' | 'CANCELLED';
  priority: Priority;
}

/**
 * Types of proactive reminders
 */
export type ReminderType = 
  | 'CHECK_IN_REMINDER'
  | 'DEPARTURE_REMINDER'
  | 'DOCUMENT_CHECK'
  | 'WEATHER_ALERT'
  | 'TRAFFIC_ALERT'
  | 'GATE_CHANGE'
  | 'DELAY_NOTIFICATION'
  | 'CURRENCY_REMINDER'
  | 'VACCINATION_CHECK'
  | 'VISA_REQUIREMENT';

// =============================================================================
// FEATURE 5: CUSTOMER SERVICE & COMPLEX QUERY AUTOMATION
// =============================================================================

/**
 * Customer service request
 */
export interface ServiceRequest {
  id: UUID;
  customerId: UUID;
  category: ServiceCategory;
  priority: Priority;
  status: RequestStatus;
  details: RequestDetails;
  automation: AutomationFlow;
  escalation?: EscalationDetails;
  resolution?: ResolutionDetails;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Service request categories
 */
export type ServiceCategory = 
  | 'BOOKING_CHANGE'
  | 'REFUND_REQUEST'
  | 'CANCELLATION'
  | 'UPGRADE_REQUEST'
  | 'SPECIAL_ASSISTANCE'
  | 'BAGGAGE_CLAIM'
  | 'COMPLAINT'
  | 'COMPLIMENT'
  | 'INFORMATION_REQUEST'
  | 'TECHNICAL_SUPPORT';

/**
 * Request processing status
 */
export type RequestStatus = 
  | 'RECEIVED'
  | 'ANALYZING'
  | 'AUTOMATED_PROCESSING'
  | 'PENDING_APPROVAL'
  | 'HUMAN_REVIEW'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ESCALATED';

/**
 * Detailed request information
 */
export interface RequestDetails {
  subject: string;
  description: string;
  bookingReference?: string;
  flightDetails?: FlightInfo;
  affectedServices?: string[];
  customerPreferences?: any;
  attachments?: Array<{
    filename: string;
    url: string;
    type: string;
    size: number;
  }>;
}

/**
 * Automated processing workflow
 */
export interface AutomationFlow {
  workflowId: UUID;
  steps: AutomationStep[];
  currentStep: number;
  automationLevel: 'FULL' | 'PARTIAL' | 'MANUAL';
  decisionPoints: Array<{
    step: number;
    criteria: string;
    decision: boolean;
    reason: string;
  }>;
  processedBy: 'AI' | 'HYBRID' | 'HUMAN';
}

/**
 * Individual automation step
 */
export interface AutomationStep {
  id: UUID;
  name: string;
  type: 'VALIDATION' | 'CALCULATION' | 'API_CALL' | 'APPROVAL' | 'NOTIFICATION';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  input?: any;
  output?: any;
  executionTime?: number;
  errorMessage?: string;
}

// =============================================================================
// FEATURE 8: BAGGAGE MANAGEMENT & SMART TRACKING
// =============================================================================

/**
 * Baggage item with tracking information
 */
export interface BaggageItem {
  id: UUID;
  tagNumber: string;
  ownerId: UUID;
  flightDetails: FlightInfo;
  physicalInfo: {
    weight: number;
    dimensions: {
      length: number;
      width: number;
      height: number;
    };
    type: 'CHECKED' | 'CARRY_ON' | 'SPECIAL';
    specialHandling?: string[];
  };
  tracking: BaggageTracking;
  status: BaggageStatus;
  location: BaggageLocation;
  alerts: BaggageAlert[];
}

/**
 * Baggage tracking history
 */
export interface BaggageTracking {
  events: TrackingEvent[];
  currentLocation: BaggageLocation;
  estimatedDelivery?: Timestamp;
  delays?: Array<{
    reason: string;
    duration: number;
    impact: string;
  }>;
}

/**
 * Individual tracking event
 */
export interface TrackingEvent {
  id: UUID;
  type: TrackingEventType;
  timestamp: Timestamp;
  location: BaggageLocation;
  details: string;
  scannedBy?: string;
  equipment?: string;
}

/**
 * Types of baggage tracking events
 */
export type TrackingEventType = 
  | 'CHECK_IN'
  | 'SECURITY_SCAN'
  | 'CONVEYOR_SCAN'
  | 'LOADING'
  | 'IN_FLIGHT'
  | 'UNLOADING'
  | 'CUSTOMS_SCAN'
  | 'CAROUSEL_ARRIVAL'
  | 'COLLECTED'
  | 'DELAYED'
  | 'MISHANDLED'
  | 'FOUND';

/**
 * Baggage current status
 */
export type BaggageStatus = 
  | 'CHECKED_IN'
  | 'IN_TRANSIT'
  | 'LOADED'
  | 'IN_FLIGHT'
  | 'ARRIVED'
  | 'AVAILABLE_FOR_COLLECTION'
  | 'COLLECTED'
  | 'DELAYED'
  | 'MISSING'
  | 'FOUND'
  | 'DAMAGED';

/**
 * Baggage location information
 */
export interface BaggageLocation {
  terminal: string;
  area: string;
  equipment?: string;
  coordinates?: GeoLocation;
  lastUpdated: Timestamp;
  confidence: number;
}

/**
 * Baggage-related alerts
 */
export interface BaggageAlert {
  id: UUID;
  type: 'DELAY' | 'MISSING' | 'FOUND' | 'DAMAGE' | 'SECURITY';
  severity: Priority;
  message: string;
  timestamp: Timestamp;
  resolved: boolean;
  actions: string[];
}

// =============================================================================
// SHARED UTILITY TYPES
// =============================================================================

/**
 * Flight information structure
 */
export interface FlightInfo {
  airline: string;
  flightNumber: string;
  route: {
    departure: AirportInfo;
    arrival: AirportInfo;
  };
  schedule: {
    departure: Timestamp;
    arrival: Timestamp;
  };
  actual?: {
    departure?: Timestamp;
    arrival?: Timestamp;
  };
  status: FlightStatus;
  aircraft?: {
    type: string;
    registration: string;
  };
}

/**
 * Airport information
 */
export interface AirportInfo {
  code: string; // IATA code
  name: string;
  city: string;
  country: string;
  terminal?: string;
  gate?: string;
}

/**
 * Flight status enumeration
 */
export type FlightStatus = 
  | 'SCHEDULED'
  | 'BOARDING'
  | 'DEPARTED'
  | 'IN_FLIGHT'
  | 'ARRIVED'
  | 'DELAYED'
  | 'CANCELLED'
  | 'DIVERTED';

/**
 * Notification channels
 */
export type NotificationChannel = 
  | 'PUSH'
  | 'EMAIL'
  | 'SMS'
  | 'WHATSAPP'
  | 'IN_APP'
  | 'KIOSK';

/**
 * Segment notification
 */
export interface SegmentNotification {
  id: UUID;
  type: string;
  message: string;
  timestamp: Timestamp;
  acknowledged: boolean;
  channel: NotificationChannel;
}

/**
 * Travel document information
 */
export interface TravelDocument {
  id: UUID;
  type: 'PASSPORT' | 'VISA' | 'VACCINATION' | 'INSURANCE' | 'TICKET';
  number: string;
  issuingCountry?: string;
  expiryDate?: Timestamp;
  requiredFor: string[];
  status: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'REQUIRED';
}

/**
 * Security clearance levels
 */
export interface SecurityClearance {
  level: 'PUBLIC' | 'CONFIDENTIAL' | 'SECRET' | 'TOP_SECRET';
  issuingAuthority: string;
  expiryDate: Timestamp;
  restrictions?: string[];
}

/**
 * VIP service history
 */
export interface VIPServiceHistory {
  serviceDate: Timestamp;
  services: VIPServiceType[];
  satisfaction: number;
  feedback?: string;
  cost: {
    total: number;
    currency: string;
  };
}

/**
 * Escalation details for complex cases
 */
export interface EscalationDetails {
  escalatedAt: Timestamp;
  escalatedBy: 'AI' | 'CUSTOMER_REQUEST' | 'SYSTEM';
  reason: string;
  assignedAgent?: {
    id: UUID;
    name: string;
    department: string;
  };
  priority: Priority;
  sla: {
    responseTime: number; // minutes
    resolutionTime: number; // minutes
  };
}

/**
 * Service resolution details
 */
export interface ResolutionDetails {
  resolvedAt: Timestamp;
  resolvedBy: 'AI' | 'HUMAN';
  solution: string;
  customerSatisfaction?: {
    rating: number;
    feedback?: string;
  };
  followUpRequired: boolean;
  followUpDate?: Timestamp;
} 