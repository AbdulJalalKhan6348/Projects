import { Router } from 'express';
import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import Inventory from '../models/Inventory.js';
import Order from '../models/Order.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null;
  // Guard this teaching build against accidentally using live-mode keys.
  if (!process.env.RAZORPAY_KEY_ID.startsWith('rzp_test_')) return null;
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}

router.get('/catalog', async (_req, res, next) => {
  try {
    const ingredients = await Inventory.find({ active: true }).sort({ category: 1, name: 1 }).lean();
    const grouped = { base: [], sauce: [], cheese: [], vegetable: [] };
    for (const item of ingredients) grouped[item.category].push({
      id: item._id, name: item.name, stock: item.stock, pricePaise: item.pricePaise
    });
    res.json({ ingredients: grouped });
  } catch (error) { next(error); }
});

async function releaseReservedStock(order) {
  if (!order.stockReserved || order.stockReleased) return;
  for (const ingredient of order.ingredients) {
    await Inventory.updateOne({ _id: ingredient.inventoryId }, { $inc: { stock: 1 } });
  }
  order.stockReleased = true;
  order.stockReserved = false;
  await order.save();
}

router.post('/', requireAuth, async (req, res, next) => {
  const razorpay = getRazorpay();
  if (!razorpay) return res.status(503).json({ message: 'Razorpay test keys are not configured in server/.env.' });
  const { baseId, sauceId, cheeseId, vegetableIds = [] } = req.body;
  if (!baseId || !sauceId || !cheeseId || !Array.isArray(vegetableIds) || vegetableIds.length > 8) {
    return res.status(400).json({ message: 'Choose one base, one sauce, one cheese, and up to 8 vegetables.' });
  }
  const ids = [...new Set([baseId, sauceId, cheeseId, ...vegetableIds].map(String))];
  if (ids.length !== 3 + new Set(vegetableIds.map(String)).size) return res.status(400).json({ message: 'Duplicate ingredients are not allowed.' });
  let reserved = [];
  let order;
  try {
    const docs = await Inventory.find({ _id: { $in: ids }, active: true }).lean();
    if (docs.length !== ids.length) return res.status(400).json({ message: 'One or more selected ingredients are unavailable.' });
    const byId = new Map(docs.map(doc => [String(doc._id), doc]));
    if (byId.get(String(baseId))?.category !== 'base' || byId.get(String(sauceId))?.category !== 'sauce' || byId.get(String(cheeseId))?.category !== 'cheese') {
      return res.status(400).json({ message: 'Selected ingredient categories are invalid.' });
    }
    for (const vegetableId of vegetableIds) {
      if (byId.get(String(vegetableId))?.category !== 'vegetable') return res.status(400).json({ message: 'A selected vegetable is invalid.' });
    }
    let totalPaise = 0;
    const ingredients = ids.map(id => {
      const doc = byId.get(id);
      totalPaise += doc.pricePaise;
      return { inventoryId: doc._id, name: doc.name, category: doc.category, pricePaise: doc.pricePaise };
    });
    if (totalPaise < 100) return res.status(400).json({ message: 'Order total is too small.' });

    // Reserve one unit per selected ingredient atomically; roll back if any item runs out.
    for (const ingredient of ingredients) {
      const updated = await Inventory.findOneAndUpdate(
        { _id: ingredient.inventoryId, active: true, stock: { $gte: 1 } },
        { $inc: { stock: -1 } },
        { returnDocument: 'after' }
      );
      if (!updated) throw Object.assign(new Error(`${ingredient.name} is out of stock.`), { status: 409 });
      reserved.push(ingredient.inventoryId);
    }

    order = await Order.create({
      user: req.user._id, ingredients, totalPaise,
      status: 'pending_payment', paymentStatus: 'pending', stockReserved: true
    });

    const rpOrder = await razorpay.orders.create({
      amount: totalPaise,
      currency: 'INR',
      receipt: `pizza_${order._id.toString().slice(-18)}`,
      notes: { appOrderId: order._id.toString(), customerId: req.user._id.toString() }
    });
    order.razorpayOrderId = rpOrder.id;
    await order.save();
    res.status(201).json({
      appOrderId: order._id,
      razorpayOrderId: rpOrder.id,
      amount: rpOrder.amount,
      currency: rpOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      description: 'Pizza House custom pizza'
    });
  } catch (error) {
    if (order) {
      try { await releaseReservedStock(order); await Order.deleteOne({ _id: order._id }); } catch (rollbackError) { console.error('Order rollback failed:', rollbackError); }
    } else {
      for (const inventoryId of reserved) {
        try { await Inventory.updateOne({ _id: inventoryId }, { $inc: { stock: 1 } }); } catch (rollbackError) { console.error('Stock rollback failed:', rollbackError); }
      }
    }
    next(error);
  }
});

router.post('/:id/verify-payment', requireAuth, async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    if (order.paymentStatus === 'paid') return res.json({ message: 'Payment already verified.', order });
    if (!process.env.RAZORPAY_KEY_SECRET || razorpay_order_id !== order.razorpayOrderId) {
      return res.status(400).json({ message: 'Payment details could not be verified.' });
    }
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    const receivedBuffer = Buffer.from(String(razorpay_signature || ''), 'hex');
    const signatureValid = expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    if (!signatureValid) return res.status(400).json({ message: 'Payment signature verification failed.' });
    order.razorpayPaymentId = razorpay_payment_id;
    order.paymentStatus = 'paid';
    order.status = 'order_received';
    await order.save();
    res.json({ message: 'Payment verified. Your order has been received!', order });
  } catch (error) { next(error); }
});

router.post('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    if (order.paymentStatus === 'paid') return res.status(409).json({ message: 'Paid orders must be handled by the store admin.' });
    if (order.status !== 'cancelled') {
      await releaseReservedStock(order);
      order.status = 'cancelled';
      order.paymentStatus = 'failed';
      await order.save();
    }
    res.json({ message: 'Pending order cancelled and reserved stock released.' });
  } catch (error) { next(error); }
});

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30).lean();
    res.json({ orders });
  } catch (error) { next(error); }
});

export default router;
