import cron from 'node-cron';
import Inventory from '../models/Inventory.js';
import Order from '../models/Order.js';
import { sendEmail } from '../utils/mailer.js';

async function expireAbandonedOrders() {
  const minutes = Math.max(5, Number(process.env.PENDING_ORDER_EXPIRY_MINUTES || 30));
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  const expired = await Order.find({ status: 'pending_payment', paymentStatus: 'pending', stockReserved: true, stockReleased: false, createdAt: { $lt: cutoff } });
  for (const order of expired) {
    for (const ingredient of order.ingredients) {
      await Inventory.updateOne({ _id: ingredient.inventoryId }, { $inc: { stock: 1 } });
    }
    order.stockReserved = false;
    order.stockReleased = true;
    order.status = 'cancelled';
    order.paymentStatus = 'failed';
    await order.save();
  }
  if (expired.length) console.log(`Expired ${expired.length} unpaid order(s) and released reserved stock`);
}

export function startLowStockJob() {
  const expression = process.env.LOW_STOCK_CHECK_CRON || '*/5 * * * *';
  cron.schedule(expression, async () => {
    try {
      await expireAbandonedOrders();
      const recipient = process.env.ADMIN_NOTIFICATION_EMAIL;
      if (!recipient) return;
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const lowItems = await Inventory.find({
        $expr: { $lt: ['$stock', '$lowStockThreshold'] },
        $or: [{ lastNotifiedAt: null }, { lastNotifiedAt: { $lt: cutoff } }]
      });
      if (!lowItems.length) return;
      const lines = lowItems.map(item => `${item.name} (${item.category}): ${item.stock} left; threshold ${item.lowStockThreshold}`);
      await sendEmail({
        to: recipient,
        subject: 'Pizza House low-stock alert',
        text: `The following ingredients are below their configured thresholds:\n\n${lines.join('\n')}`
      });
      await Inventory.updateMany(
        { _id: { $in: lowItems.map(item => item._id) } },
        { $set: { lastNotifiedAt: new Date() } }
      );
      console.log(`Low-stock alert sent for ${lowItems.length} inventory item(s)`);
    } catch (error) {
      console.error('Low-stock job failed:', error);
    }
  });
  console.log(`Low-stock scheduler started: ${expression}`);
}
