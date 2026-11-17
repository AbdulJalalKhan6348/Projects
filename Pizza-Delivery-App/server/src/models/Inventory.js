import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema({
  category: { type: String, enum: ['base', 'sauce', 'cheese', 'vegetable'], required: true, index: true },
  name: { type: String, required: true, trim: true },
  stock: { type: Number, required: true, min: 0, default: 0 },
  lowStockThreshold: { type: Number, required: true, min: 0, default: 20 },
  pricePaise: { type: Number, required: true, min: 0, default: 0 },
  active: { type: Boolean, default: true },
  lastNotifiedAt: { type: Date, default: null }
}, { timestamps: true });

inventorySchema.index({ category: 1, name: 1 }, { unique: true });
export default mongoose.model('Inventory', inventorySchema);
