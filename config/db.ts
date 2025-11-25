import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "";

export async function connectMongo() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not set in environment variables.");
    return;
  }
  try {
    mongoose.set('strictQuery', false);

    await mongoose.connect(MONGODB_URI, {
      dbName: "chatbot_db",
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    });

    console.log("[MongoDB] Connected successfully to chatbot_db.");
    console.log("[MongoDB] Connection pool size: 10");
  } catch (err) {
    console.error("[MongoDB] Connection error:", err);
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] Connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Disconnected. Attempting to reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[MongoDB] Reconnected successfully.');
  });
}
