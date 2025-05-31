export interface Airport {
  code: string;
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  terminals?: Terminal[];
}

export interface Terminal {
  id: string;
  name: string;
  gates: Gate[];
  facilities: Facility[];
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export interface Gate {
  id: string;
  number: string;
  terminal: string;
  status: GateStatus;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  facilities: string[];
}

export enum GateStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  MAINTENANCE = 'maintenance',
  CLOSED = 'closed'
}

export interface Facility {
  id: string;
  type: FacilityType;
  name: string;
  description?: string;
  location: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  operatingHours: {
    open: string;
    close: string;
    timezone: string;
  };
  amenities: string[];
}

export enum FacilityType {
  RESTAURANT = 'restaurant',
  SHOP = 'shop',
  LOUNGE = 'lounge',
  RESTROOM = 'restroom',
  ATM = 'atm',
  CURRENCY_EXCHANGE = 'currency_exchange',
  INFORMATION_DESK = 'information_desk',
  SECURITY_CHECKPOINT = 'security_checkpoint',
  CUSTOMS = 'customs',
  BAGGAGE_CLAIM = 'baggage_claim',
  CHECK_IN = 'check_in',
  GATE = 'gate',
  PARKING = 'parking',
  TRANSPORT = 'transport'
}

export interface Flight {
  id: string;
  flightNumber: string;
  airline: Airline;
  aircraft: Aircraft;
  route: Route;
  schedule: FlightSchedule;
  status: FlightStatus;
  gates: {
    departure?: Gate;
    arrival?: Gate;
  };
  passengers: number;
  capacity: number;
  baggage: BaggageInfo;
  services: FlightService[];
  weather?: WeatherInfo;
  realTimeUpdates: FlightUpdate[];
}

export interface Airline {
  code: string;
  iata: string;
  icao: string;
  name: string;
  logo: string;
  alliance?: string;
  website: string;
  headquarters: string;
}

export interface Aircraft {
  id: string;
  type: string;
  manufacturer: string;
  model: string;
  registration: string;
  capacity: {
    total: number;
    economy: number;
    business: number;
    first: number;
  };
  features: string[];
  wifiAvailable: boolean;
  entertainmentSystem: boolean;
}

export interface Route {
  departure: Airport;
  arrival: Airport;
  distance: number;
  duration: number;
  stops: Airport[];
}

export interface FlightSchedule {
  departure: {
    scheduled: Date;
    estimated: Date;
    actual?: Date;
    gate?: string;
    terminal?: string;
  };
  arrival: {
    scheduled: Date;
    estimated: Date;
    actual?: Date;
    gate?: string;
    terminal?: string;
  };
  timezone: {
    departure: string;
    arrival: string;
  };
}

export enum FlightStatus {
  SCHEDULED = 'scheduled',
  BOARDING = 'boarding',
  DEPARTED = 'departed',
  IN_FLIGHT = 'in_flight',
  LANDED = 'landed',
  ARRIVED = 'arrived',
  DELAYED = 'delayed',
  CANCELLED = 'cancelled',
  DIVERTED = 'diverted'
}

export interface BaggageInfo {
  allowance: {
    checkedBags: number;
    weight: number;
    carryOn: number;
    personal: number;
  };
  restrictions: string[];
  fees: {
    excess: number;
    overweight: number;
    oversized: number;
  };
}

export interface FlightService {
  id: string;
  type: ServiceType;
  name: string;
  description: string;
  available: boolean;
  cost?: number;
  requirements?: string[];
}

export enum ServiceType {
  MEAL = 'meal',
  BEVERAGE = 'beverage',
  ENTERTAINMENT = 'entertainment',
  WIFI = 'wifi',
  PRIORITY_BOARDING = 'priority_boarding',
  EXTRA_LEGROOM = 'extra_legroom',
  LOUNGE_ACCESS = 'lounge_access',
  FAST_TRACK_SECURITY = 'fast_track_security'
}

export interface WeatherInfo {
  current: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    windDirection: number;
    visibility: number;
    conditions: string;
    icon: string;
  };
  forecast: {
    temperature: {
      high: number;
      low: number;
    };
    conditions: string;
    precipitation: number;
    icon: string;
  }[];
}

export interface FlightUpdate {
  id: string;
  timestamp: Date;
  type: UpdateType;
  message: string;
  priority: Priority;
  affected: {
    gates?: string[];
    terminals?: string[];
    services?: string[];
  };
}

export enum UpdateType {
  GATE_CHANGE = 'gate_change',
  DELAY = 'delay',
  CANCELLATION = 'cancellation',
  BOARDING = 'boarding',
  DEPARTURE = 'departure',
  ARRIVAL = 'arrival',
  WEATHER = 'weather',
  SECURITY = 'security',
  GENERAL = 'general'
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface FlightSearchQuery {
  departure: string;
  arrival: string;
  departureDate: Date;
  returnDate?: Date;
  passengers: {
    adults: number;
    children: number;
    infants: number;
  };
  class: CabinClass;
  flexible?: boolean;
  directOnly?: boolean;
  preferredAirlines?: string[];
}

export enum CabinClass {
  ECONOMY = 'economy',
  PREMIUM_ECONOMY = 'premium_economy',
  BUSINESS = 'business',
  FIRST = 'first'
}

export interface FlightSearchResult {
  flights: Flight[];
  totalResults: number;
  searchTime: number;
  filters: SearchFilter[];
  sorting: SortOption[];
}

export interface SearchFilter {
  id: string;
  name: string;
  type: FilterType;
  options: FilterOption[];
  applied: boolean;
}

export enum FilterType {
  AIRLINE = 'airline',
  PRICE = 'price',
  DURATION = 'duration',
  STOPS = 'stops',
  DEPARTURE_TIME = 'departure_time',
  ARRIVAL_TIME = 'arrival_time',
  AIRCRAFT = 'aircraft'
}

export interface FilterOption {
  id: string;
  label: string;
  value: any;
  count?: number;
  selected: boolean;
}

export interface SortOption {
  id: string;
  label: string;
  field: string;
  direction: 'asc' | 'desc';
  active: boolean;
} 