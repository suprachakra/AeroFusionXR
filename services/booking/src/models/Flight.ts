import { Schema, model } from 'mongoose';
import { Flight, FlightStatus } from '../types';

const AirportSchema = new Schema({
  code: { type: String, required: true },
  name: { type: String, required: true },
  city: { type: String, required: true },
  country: { type: String, required: true },
  timezone: { type: String, required: true },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  }
});

const AircraftSchema = new Schema({
  type: { type: String, required: true },
  registration: { type: String, required: true },
  capacity: {
    economy: { type: Number, required: true },
    business: { type: Number },
    first: { type: Number }
  }
});

const FlightSchema = new Schema<Flight>({
  flightNumber: { 
    type: String, 
    required: true,
    unique: true,
    index: true
  },
  airline: { 
    type: String, 
    required: true,
    index: true
  },
  origin: { 
    type: AirportSchema, 
    required: true,
    index: { 'origin.code': 1 }
  },
  destination: { 
    type: AirportSchema, 
    required: true,
    index: { 'destination.code': 1 }
  },
  departureTime: { 
    type: Date, 
    required: true,
    index: true
  },
  arrivalTime: { 
    type: Date, 
    required: true,
    index: true
  },
  aircraft: { 
    type: AircraftSchema, 
    required: true 
  },
  status: { 
    type: String, 
    enum: Object.values(FlightStatus),
    required: true,
    default: FlightStatus.SCHEDULED,
    index: true
  },
  gates: {
    departure: { type: String, required: true },
    arrival: { type: String, required: true }
  },
  availableSeats: { 
    type: Number, 
    required: true,
    min: 0
  },
  price: {
    economy: { type: Number, required: true },
    business: { type: Number },
    first: { type: Number }
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
FlightSchema.index({ departureTime: 1, 'origin.code': 1 });
FlightSchema.index({ departureTime: 1, 'destination.code': 1 });
FlightSchema.index({ airline: 1, status: 1 });
FlightSchema.index({ 'price.economy': 1 });
FlightSchema.index({ 'price.business': 1 });
FlightSchema.index({ 'price.first': 1 });

// Virtual for flight duration
FlightSchema.virtual('duration').get(function() {
  return this.arrivalTime.getTime() - this.departureTime.getTime();
});

// Method to check seat availability
FlightSchema.methods.hasAvailableSeats = function(
  cabinClass: string,
  numberOfSeats: number
): boolean {
  const capacity = this.aircraft.capacity[cabinClass.toLowerCase()];
  return capacity && this.availableSeats >= numberOfSeats;
};

// Static method to search flights
FlightSchema.statics.searchFlights = async function(
  origin: string,
  destination: string,
  date: Date,
  cabinClass?: string
) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const query = {
    'origin.code': origin,
    'destination.code': destination,
    departureTime: {
      $gte: startOfDay,
      $lte: endOfDay
    },
    status: FlightStatus.SCHEDULED,
    availableSeats: { $gt: 0 }
  };

  if (cabinClass) {
    query[`aircraft.capacity.${cabinClass.toLowerCase()}`] = { $gt: 0 };
  }

  return this.find(query)
    .sort({ departureTime: 1 })
    .lean()
    .exec();
};

export const FlightModel = model<Flight>('Flight', FlightSchema); 