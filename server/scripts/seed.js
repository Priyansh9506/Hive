/**
 * Database seed script
 * Run: node scripts/seed.js
 * 
 * Creates a test user to verify the database connection is working.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if test user already exists
    const existing = await User.findOne({ email: 'test@studysync.com' });
    if (existing) {
      console.log('Test user already exists:', existing.email);
    } else {
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash('password123', salt);

      const user = await User.create({
        name: 'Test User',
        email: 'test@studysync.com',
        password: hashedPassword,
      });
      console.log('Test user created:', user.email);
    }

    // Print all users
    const users = await User.find({}).select('name email createdAt');
    console.log(`\nTotal users in DB: ${users.length}`);
    users.forEach((u) => {
      console.log(`  - ${u.name} (${u.email}) — ${u.createdAt.toISOString()}`);
    });

    await mongoose.disconnect();
    console.log('\nDone. Disconnected.');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  }
};

seedDB();
