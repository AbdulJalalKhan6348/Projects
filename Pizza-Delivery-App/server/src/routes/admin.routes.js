import { Router } from 'express';
import Inventory from '../models/Inventory.js';
import Order from '../models/Order.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/inventory', async (_req, res, next) => {
  try {
    const items = await Inventory.find().sort({ category: 1, name: 1 }).lean();
    res.json({ items });
  } catch (error) { next(error); }
});

router.patch('/inventory/:id', async (req, res, next) => {
  try {
    const stock = Number(req.body.stock);
    const lowStockThreshold = req.body.lowStockThreshold === undefined ? undefined : Number(req.body.lowStockThreshold);
    if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) return res.status(400).json({ message: 'Stock must be a whole number from 0 to 1,000,000.' });
    if (lowStockThreshold !== undefined && (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0 || lowStockThreshold > 1000000)) {
      return res.status(400).json({ message: 'Threshold must be a non-negative whole number.' });
    }
    const existing = await Inventory.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Inventory item not found.' });
    const effectiveThreshold = lowStockThreshold ?? existing.lowStockThreshold;
    const update = { stock, ...(lowStockThreshold !== undefined ? { lowStockThreshold } : {}) };
    if (stock >= effectiveThreshold) update.lastNotifiedAt = null;
    const item = await Inventory.findByIdAndUpdate(req.params.id, { $set: update }, { returnDocument: 'after', runValidators: true });
    res.json({ item });
  } catch (error) { next(error); }
});

router.get('/orders', async (_req, res, next) => {
  try {
    const orders = await Order.find({ paymentStatus: 'paid' })
      .populate('user', 'name email').sort({ createdAt: -1 }).limit(100).lean();
    res.json({ orders });
  } catch (error) { next(error); }
});

router.patch('/orders/:id/status', async (req, res, next) => {
  try {
    const allowed = ['order_received', 'in_kitchen', 'sent_to_delivery'];
    const { status } = req.body;
    if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid order status.' });
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, paymentStatus: 'paid' },
      { $set: { status } },
      { returnDocument: 'after' }
    ).populate('user', 'name email');
    if (!order) return res.status(404).json({ message: 'Paid order not found.' });
    res.json({ order });
  } catch (error) { next(error); }
});

export default router;
