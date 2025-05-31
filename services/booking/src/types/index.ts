/**
 * Core booking types
 */
export interface Flight {
  id: string;
  flightNumber: string;
  airline: string;
  origin: Airport;
  destination: Airport;
  departureTime: Date;
  arrivalTime: Date;
  aircraft: Aircraft;
  status: FlightStatus;
  gates: {
    departure: string;
    arrival: string;
  };
  availableSeats: number;
  price: {
    economy: number;
    business?: number;
    first?: number;
  };
}

export interface Airport {
  code: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

export interface Aircraft {
  type: string;
  registration: string;
  capacity: {
    economy: number;
    business?: number;
    first?: number;
  };
}

export enum FlightStatus {
  SCHEDULED = 'SCHEDULED',
  BOARDING = 'BOARDING',
  DEPARTED = 'DEPARTED',
  ARRIVED = 'ARRIVED',
  DELAYED = 'DELAYED',
  CANCELLED = 'CANCELLED'
}

export interface Booking {
  id: string;
  flightId: string;
  userId: string;
  status: BookingStatus;
  passengers: Passenger[];
  seats: string[];
  class: CabinClass;
  price: number;
  paymentStatus: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
  extras?: BookingExtra[];
}

export interface Passenger {
  title: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  passportNumber?: string;
  nationality?: string;
  specialRequirements?: string[];
}

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED'
}

export enum CabinClass {
  ECONOMY = 'ECONOMY',
  BUSINESS = 'BUSINESS',
  FIRST = 'FIRST'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}

export interface BookingExtra {
  type: ExtraType;
  quantity: number;
  price: number;
  notes?: string;
}

export enum ExtraType {
  BAGGAGE = 'BAGGAGE',
  MEAL = 'MEAL',
  SEAT_SELECTION = 'SEAT_SELECTION',
  LOUNGE_ACCESS = 'LOUNGE_ACCESS',
  FAST_TRACK = 'FAST_TRACK',
  WIFI = 'WIFI'
}

export interface SearchCriteria {
  origin?: string;
  destination?: string;
  departureDate?: Date;
  returnDate?: Date;
  passengers?: number;
  cabinClass?: CabinClass;
  maxPrice?: number;
  airline?: string;
  directOnly?: boolean;
} 