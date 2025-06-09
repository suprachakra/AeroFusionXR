import { Schema, model, Document } from 'mongoose';

export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  CONFIRMED = 'CONFIRMED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED'
}

export enum FulfillmentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  RETURNED = 'RETURNED'
}

export interface OrderItem {
  productId: string;
  variantId?: string;
  quantity: number;
  price: number;
  name: string;
  sku: string;
  metadata?: {
    [key: string]: any;
  };
}

export interface PaymentDetails {
  provider: string;
  transactionId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  threeDSecure?: boolean;
  metadata?: {
    [key: string]: any;
  };
}

export interface ShippingDetails {
  carrier: string;
  method: string;
  trackingNumber?: string;
  estimatedDelivery?: Date;
  cost: number;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
}

export interface Order extends Document {
  orderId: string;
  userId: string;
  status: OrderStatus;
  items: OrderItem[];
  payment: PaymentDetails;
  shipping: ShippingDetails;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  metadata?: {
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
  fulfillmentStatus: FulfillmentStatus;
}

const OrderItemSchema = new Schema<OrderItem>({
  productId: { 
    type: String, 
    required: true,
    index: true
  },
  variantId: { 
    type: String,
    index: true
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
  name: { 
    type: String, 
    required: true
  },
  sku: { 
    type: String, 
    required: true
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed
  }
});

const PaymentDetailsSchema = new Schema<PaymentDetails>({
  provider: { 
    type: String, 
    required: true
  },
  transactionId: { 
    type: String, 
    required: true,
    unique: true
  },
  amount: { 
    type: Number, 
    required: true,
    min: 0
  },
  currency: { 
    type: String, 
    required: true
  },
  status: { 
    type: String, 
    enum: Object.values(PaymentStatus),
    required: true,
    default: PaymentStatus.PENDING
  },
  method: { 
    type: String, 
    required: true
  },
  last4: String,
  expiryMonth: Number,
  expiryYear: Number,
  threeDSecure: Boolean,
  metadata: {
    type: Map,
    of: Schema.Types.Mixed
  }
});

const ShippingDetailsSchema = new Schema<ShippingDetails>({
  carrier: { 
    type: String, 
    required: true
  },
  method: { 
    type: String, 
    required: true
  },
  trackingNumber: String,
  estimatedDelivery: Date,
  cost: { 
    type: Number, 
    required: true,
    min: 0
  },
  address: {
    line1: { type: String, required: true },
    line2: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true },
    postalCode: { type: String, required: true }
  }
});

const OrderSchema = new Schema<Order>({
  orderId: { 
    type: String, 
    required: true,
    unique: true,
    index: true
  },
  userId: { 
    type: String, 
    required: true,
    index: true
  },
  status: { 
    type: String, 
    enum: Object.values(OrderStatus),
    required: true,
    default: OrderStatus.PENDING,
    index: true
  },
  items: [OrderItemSchema],
  payment: PaymentDetailsSchema,
  shipping: ShippingDetailsSchema,
  subtotal: { 
    type: Number, 
    required: true,
    min: 0
  },
  tax: { 
    type: Number, 
    required: true,
    min: 0
  },
  total: { 
    type: Number, 
    required: true,
    min: 0
  },
  currency: { 
    type: String, 
    required: true,
    default: 'USD'
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed
  },
  fulfillmentStatus: {
    type: String,
    enum: Object.values(FulfillmentStatus),
    required: true,
    default: FulfillmentStatus.PENDING,
    index: true
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
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ 'payment.status': 1, status: 1 });
OrderSchema.index({ fulfillmentStatus: 1, status: 1 });

// Virtual for item count
OrderSchema.virtual('itemCount').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Method to update order status
OrderSchema.methods.updateStatus = async function(
  status: OrderStatus,
  metadata?: { [key: string]: any }
): Promise<void> {
  this.status = status;
  if (metadata) {
    this.metadata = { ...this.metadata, ...metadata };
  }
  await this.save();
};

// Method to update payment status
OrderSchema.methods.updatePaymentStatus = async function(
  status: PaymentStatus,
  metadata?: { [key: string]: any }
): Promise<void> {
  this.payment.status = status;
  if (metadata) {
    this.payment.metadata = { ...this.payment.metadata, ...metadata };
  }
  await this.save();
};

// Method to update fulfillment status
OrderSchema.methods.updateFulfillmentStatus = async function(
  status: FulfillmentStatus,
  trackingNumber?: string,
  metadata?: { [key: string]: any }
): Promise<void> {
  this.fulfillmentStatus = status;
  if (trackingNumber) {
    this.shipping.trackingNumber = trackingNumber;
  }
  if (metadata) {
    this.metadata = { ...this.metadata, ...metadata };
  }
  await this.save();
};

// Method to calculate refund amount
OrderSchema.methods.calculateRefundAmount = function(): number {
  if (this.status === OrderStatus.DELIVERED) {
    return 0;
  }

  const now = new Date();
  const orderDate = this.createdAt;
  const hoursSinceOrder = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60);

  if (hoursSinceOrder <= 24) {
    return this.total; // Full refund within 24 hours
  } else if (hoursSinceOrder <= 72) {
    return this.total * 0.75; // 75% refund within 72 hours
  } else if (this.status === OrderStatus.PROCESSING) {
    return this.total * 0.50; // 50% refund if still processing
  }

  return 0; // No refund
};

// Static method to find user's orders
OrderSchema.statics.findUserOrders = function(
  userId: string,
  status?: OrderStatus[]
) {
  const query: any = { userId };
  if (status?.length) {
    query.status = { $in: status };
  }
  return this.find(query).sort({ createdAt: -1 });
};

export const OrderModel = model<Order>('Order', OrderSchema); 