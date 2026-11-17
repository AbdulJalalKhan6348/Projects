import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Inventory from '../models/Inventory.js';

const starterInventory = [
  ['base', 'Thin Crust', 100, 20, 1800],
  ['base', 'Classic Hand Tossed', 100, 20, 2000],
  ['base', 'Whole Wheat', 80, 20, 2200],
  ['base', 'Cheese Burst', 70, 20, 2800],
  ['base', 'Gluten Free', 50, 15, 3000],
  ['sauce', 'Classic Tomato', 100, 20, 500],
  ['sauce', 'BBQ', 80, 20, 600],
  ['sauce', 'Alfredo', 60, 15, 700],
  ['sauce', 'Pesto', 50, 15, 800],
  ['sauce', 'Peri Peri', 70, 15, 650],
  ['cheese', 'Mozzarella', 100, 20, 1000],
  ['cheese', 'Cheddar', 80, 20, 1100],
  ['cheese', 'Parmesan', 60, 15, 1300],
  ['cheese', 'Vegan Cheese', 45, 12, 1500],
  ['cheese', 'Four Cheese Blend', 55, 15, 1700],
  ['vegetable', 'Onion', 100, 20, 200],
  ['vegetable', 'Capsicum', 100, 20, 250],
  ['vegetable', 'Mushroom', 80, 15, 350],
  ['vegetable', 'Olives', 60, 15, 400],
  ['vegetable', 'Sweet Corn', 90, 20, 250],
  ['vegetable', 'Jalapeno', 50, 10, 300]
];

export async function seedInventory() {
  const count = await Inventory.countDocuments();
  if (count === 0) {
    await Inventory.insertMany(starterInventory.map(([category, name, stock, lowStockThreshold, pricePaise]) => ({
      category, name, stock, lowStockThreshold, pricePaise
    })));
    console.log('Starter pizza inventory created');
  }
}

export async function seedAdmin() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.warn('Admin not seeded: set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env');
    return;
  }
  const email = ADMIN_EMAIL.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== 'admin') {
      throw new Error('ADMIN_EMAIL is already registered as a customer. Choose a different ADMIN_EMAIL.');
    }
    return;
  }
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await User.create({
    name: ADMIN_NAME || 'Pizza Admin', email, passwordHash,
    role: 'admin', emailVerified: true
  });
  console.log(`Admin account seeded: ${email}`);
}
