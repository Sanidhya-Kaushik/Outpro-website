// src/config/database.ts
// MongoDB connection using Mongoose — drop-in replacement for Supabase/PostgreSQL

import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/outpro_india';

let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) return;

  try {
    await mongoose.connect(MONGO_URI, {
      dbName: 'outpro_india',
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    console.log(`✅ MongoDB connected: ${MONGO_URI.replace(/\/\/.*@/, '//<credentials>@')}`);

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Attempting reconnect...');
      isConnected = false;
    });

  } catch (error) {
    console.error('❌ MongoDB initial connection failed:', error);
    process.exit(1);
  }
}

export async function disconnectDB(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  console.log('🔌 MongoDB disconnected cleanly.');
}

export async function checkDatabaseHealth(): Promise<{ status: 'ok' | 'error'; latencyMs?: number }> {
  try {
    const start = Date.now();
    await mongoose.connection.db?.admin().ping();
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch {
    return { status: 'error' };
  }
}

export default mongoose;
