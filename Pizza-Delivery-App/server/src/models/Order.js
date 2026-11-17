import mongoose from 'mongoose';

const ingredientSchema = new mongoose.Schema({
  inventoryId: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  pricePaise: { type: Number, required: true }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  ingredients: { type: [ingredientSchema], required: true },
  totalPaise: { type: Number, required: true, min: 1 },
  status: {
    type: String,
    enum: ['pending_payment', 'order_received', 'in_kitchen', 'sent_to_delivery', 'cancelled'],
    default: 'pending_payment',
    index: true
  },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  razorpayOrderId: { type: String, index: true },
  razorpayPaymentId: { type: String },
  stockReserved: { type: Boolean, default: true },
  stockReleased: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);
