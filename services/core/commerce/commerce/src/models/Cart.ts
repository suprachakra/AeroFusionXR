import { Schema, model, Document } from 'mongoose';

export interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
  price: number;
  metadata?: {
    [key: string]: any;
  };
}

export interface Cart extends Document {
  userId?: string;
  sessionId: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  currency: string;
  metadata?: {
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  lastActivity: Date;
}

const CartItemSchema = new Schema<CartItem>({
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
  metadata: {
    type: Map,
    of: Schema.Types.Mixed
  }
});

const CartSchema = new Schema<Cart>({
  userId: { 
    type: String,
    sparse: true,
    index: true
  },
  sessionId: { 
    type: String, 
    required: true,
    unique: true,
    index: true
  },
  items: [CartItemSchema],
  subtotal: { 
    type: Number, 
    required: true,
    default: 0,
    min: 0
  },
  total: { 
    type: Number, 
    required: true,
    default: 0,
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
  expiresAt: { 
    type: Date, 
    required: true,
    index: true
  },
  lastActivity: { 
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
CartSchema.index({ userId: 1, sessionId: 1 });
CartSchema.index({ lastActivity: 1 });
CartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for item count
CartSchema.virtual('itemCount').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Method to add item to cart
CartSchema.methods.addItem = async function(item: CartItem): Promise<void> {
  const existingItem = this.items.find(i => 
    i.productId === item.productId && i.variantId === item.variantId
  );

  if (existingItem) {
    existingItem.quantity += item.quantity;
  } else {
    this.items.push(item);
  }

  await this.recalculateTotals();
  this.lastActivity = new Date();
  await this.save();
};

// Method to remove item from cart
CartSchema.methods.removeItem = async function(productId: string, variantId?: string): Promise<void> {
  this.items = this.items.filter(item => 
    !(item.productId === productId && item.variantId === variantId)
  );

  await this.recalculateTotals();
  this.lastActivity = new Date();
  await this.save();
};

// Method to update item quantity
CartSchema.methods.updateItemQuantity = async function(
  productId: string, 
  quantity: number,
  variantId?: string
): Promise<void> {
  const item = this.items.find(i => 
    i.productId === productId && i.variantId === variantId
  );

  if (item) {
    if (quantity <= 0) {
      await this.removeItem(productId, variantId);
    } else {
      item.quantity = quantity;
      await this.recalculateTotals();
      this.lastActivity = new Date();
      await this.save();
    }
  }
};

// Method to recalculate totals
CartSchema.methods.recalculateTotals = async function(): Promise<void> {
  this.subtotal = this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
  this.total = this.subtotal; // Add tax, shipping, etc. calculations here
};

// Method to clear cart
CartSchema.methods.clear = async function(): Promise<void> {
  this.items = [];
  await this.recalculateTotals();
  this.lastActivity = new Date();
  await this.save();
};

// Method to merge carts (e.g., when user logs in)
CartSchema.methods.merge = async function(otherCart: Cart): Promise<void> {
  for (const item of otherCart.items) {
    await this.addItem(item);
  }
};

// Static method to find or create cart
CartSchema.statics.findOrCreate = async function(
  sessionId: string,
  userId?: string
): Promise<Cart> {
  let cart = await this.findOne({ sessionId });
  
  if (!cart) {
    cart = new this({
      sessionId,
      userId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });
    await cart.save();
  }
  
  return cart;
};

export const CartModel = model<Cart>('Cart', CartSchema); 