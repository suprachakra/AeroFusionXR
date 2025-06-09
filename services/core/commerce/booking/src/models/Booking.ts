import { Schema, model } from 'mongoose';
import { 
  Booking, 
  BookingStatus, 
  PaymentStatus, 
  CabinClass, 
  Passenger,
  BookingExtra,
  ExtraType
} from '../types';

const PassengerSchema = new Schema<Passenger>({
  title: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  dateOfBirth: { type: Date, required: true },
  passportNumber: { type: String },
  nationality: { type: String },
  specialRequirements: [{ type: String }]
});

const BookingExtraSchema = new Schema<BookingExtra>({
  type: { 
    type: String, 
    enum: Object.values(ExtraType),
    required: true 
  },
  quantity: { 
    type: Number, 
    required: true,
    min: 1 
  },
  price: { 
    type: Number, 
    required: true,
    min: 0 
  },
  notes: { type: String }
});

const BookingSchema = new Schema<Booking>({
  flightId: { 
    type: String, 
    required: true,
    index: true
  },
  userId: { 
    type: String, 
    required: true,
    index: true
  },
  status: { 
    type: String, 
    enum: Object.values(BookingStatus),
    required: true,
    default: BookingStatus.PENDING,
    index: true
  },
  passengers: [{ 
    type: PassengerSchema, 
    required: true,
    validate: [
      {
        validator: function(passengers: Passenger[]) {
          return passengers.length > 0;
        },
        message: 'At least one passenger is required'
      }
    ]
  }],
  seats: [{ 
    type: String,
    validate: [
      {
        validator: function(seats: string[]) {
          return seats.length === (this as any).passengers.length;
        },
        message: 'Number of seats must match number of passengers'
      }
    ]
  }],
  class: { 
    type: String, 
    enum: Object.values(CabinClass),
    required: true
  },
  price: { 
    type: Number, 
    required: true,
    min: 0
  },
  paymentStatus: { 
    type: String, 
    enum: Object.values(PaymentStatus),
    required: true,
    default: PaymentStatus.PENDING,
    index: true
  },
  extras: [BookingExtraSchema],
  createdAt: { 
    type: Date, 
    required: true,
    default: Date.now,
    index: true
  },
  updatedAt: { 
    type: Date, 
    required: true,
    default: Date.now
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
BookingSchema.index({ userId: 1, status: 1 });
BookingSchema.index({ flightId: 1, status: 1 });
BookingSchema.index({ createdAt: 1, status: 1 });
BookingSchema.index({ paymentStatus: 1, status: 1 });

// Virtual for total number of passengers
BookingSchema.virtual('passengerCount').get(function() {
  return this.passengers.length;
});

// Virtual for total extras cost
BookingSchema.virtual('extrasCost').get(function() {
  return this.extras?.reduce((total, extra) => total + (extra.price * extra.quantity), 0) || 0;
});

// Virtual for total booking cost
BookingSchema.virtual('totalCost').get(function() {
  return this.price + this.extrasCost;
});

// Method to check if booking can be cancelled
BookingSchema.methods.canBeCancelled = function(): boolean {
  if (this.status === BookingStatus.CANCELLED) {
    return false;
  }

  // Check if flight departure is within 24 hours
  const flight = this.populated('flightId');
  if (flight && (flight as any).departureTime) {
    const hoursUntilDeparture = ((flight as any).departureTime - new Date()) / (1000 * 60 * 60);
    return hoursUntilDeparture >= 24;
  }

  return true;
};

// Method to calculate refund amount
BookingSchema.methods.calculateRefundAmount = function(): number {
  if (!this.canBeCancelled()) {
    return 0;
  }

  const flight = this.populated('flightId');
  if (!flight) {
    return this.totalCost;
  }

  // Calculate refund based on time until departure
  const hoursUntilDeparture = ((flight as any).departureTime - new Date()) / (1000 * 60 * 60);
  
  if (hoursUntilDeparture >= 72) {
    return this.totalCost; // Full refund
  } else if (hoursUntilDeparture >= 48) {
    return this.totalCost * 0.75; // 75% refund
  } else if (hoursUntilDeparture >= 24) {
    return this.totalCost * 0.50; // 50% refund
  }

  return 0; // No refund
};

// Static method to find user's active bookings
BookingSchema.statics.findActiveBookings = function(userId: string) {
  return this.find({
    userId,
    status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] }
  })
  .sort({ createdAt: -1 })
  .populate('flightId')
  .exec();
};

export const BookingModel = model<Booking>('Booking', BookingSchema); 