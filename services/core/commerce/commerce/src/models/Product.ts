import { Schema, model } from 'mongoose';

export interface ARAsset {
  gltfUrl: string;
  usdcUrl?: string;
  thumbnailUrl: string;
  size: {
    width: number;
    height: number;
    depth: number;
  };
  lods: {
    level: number;
    url: string;
    triangleCount: number;
  }[];
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  categories: string[];
  tags: string[];
  arAssets: ARAsset;
  inventory: {
    available: number;
    reserved: number;
    backorder: boolean;
  };
  dimensions: {
    width: number;
    height: number;
    depth: number;
    weight: number;
  };
  variants: {
    id: string;
    name: string;
    sku: string;
    price: number;
    arAssets?: ARAsset;
  }[];
  metadata: {
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ARAssetSchema = new Schema<ARAsset>({
  gltfUrl: { type: String, required: true },
  usdcUrl: { type: String },
  thumbnailUrl: { type: String, required: true },
  size: {
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    depth: { type: Number, required: true }
  },
  lods: [{
    level: { type: Number, required: true },
    url: { type: String, required: true },
    triangleCount: { type: Number, required: true }
  }]
});

const ProductSchema = new Schema<Product>({
  sku: { 
    type: String, 
    required: true, 
    unique: true,
    index: true
  },
  name: { 
    type: String, 
    required: true,
    index: true
  },
  description: { type: String, required: true },
  price: { 
    type: Number, 
    required: true,
    min: 0
  },
  currency: { 
    type: String, 
    required: true,
    default: 'USD'
  },
  categories: [{ 
    type: String,
    index: true
  }],
  tags: [{ type: String }],
  arAssets: { 
    type: ARAssetSchema, 
    required: true 
  },
  inventory: {
    available: { 
      type: Number, 
      required: true,
      min: 0
    },
    reserved: { 
      type: Number, 
      required: true,
      default: 0,
      min: 0
    },
    backorder: { 
      type: Boolean, 
      required: true,
      default: false
    }
  },
  dimensions: {
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    depth: { type: Number, required: true },
    weight: { type: Number, required: true }
  },
  variants: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    price: { type: Number, required: true },
    arAssets: ARAssetSchema
  }],
  metadata: {
    type: Map,
    of: Schema.Types.Mixed
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
ProductSchema.index({ price: 1 });
ProductSchema.index({ 'inventory.available': 1 });
ProductSchema.index({ categories: 1, price: 1 });
ProductSchema.index({ tags: 1 });
ProductSchema.index({ 'variants.sku': 1 });

// Virtual for checking if product is in stock
ProductSchema.virtual('inStock').get(function() {
  return this.inventory.available > 0 || this.inventory.backorder;
});

// Method to reserve inventory
ProductSchema.methods.reserveInventory = async function(quantity: number): Promise<boolean> {
  if (quantity <= 0) return false;
  
  if (this.inventory.available >= quantity) {
    this.inventory.available -= quantity;
    this.inventory.reserved += quantity;
    await this.save();
    return true;
  }
  
  return this.inventory.backorder;
};

// Method to release reserved inventory
ProductSchema.methods.releaseInventory = async function(quantity: number): Promise<void> {
  if (quantity <= 0) return;
  
  const releaseAmount = Math.min(quantity, this.inventory.reserved);
  this.inventory.reserved -= releaseAmount;
  this.inventory.available += releaseAmount;
  await this.save();
};

// Static method to search products
ProductSchema.statics.searchProducts = function(criteria: {
  query?: string;
  categories?: string[];
  priceRange?: { min: number; max: number };
  inStock?: boolean;
}) {
  const query: any = {};
  
  if (criteria.query) {
    query.$or = [
      { name: new RegExp(criteria.query, 'i') },
      { description: new RegExp(criteria.query, 'i') },
      { tags: new RegExp(criteria.query, 'i') }
    ];
  }
  
  if (criteria.categories?.length) {
    query.categories = { $in: criteria.categories };
  }
  
  if (criteria.priceRange) {
    query.price = {
      $gte: criteria.priceRange.min,
      $lte: criteria.priceRange.max
    };
  }
  
  if (criteria.inStock !== undefined) {
    if (criteria.inStock) {
      query.$or = [
        { 'inventory.available': { $gt: 0 } },
        { 'inventory.backorder': true }
      ];
    } else {
      query['inventory.available'] = 0;
      query['inventory.backorder'] = false;
    }
  }
  
  return this.find(query).sort({ price: 1 });
};

export const ProductModel = model<Product>('Product', ProductSchema); 