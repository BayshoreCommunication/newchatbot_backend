import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "";

export async function connectMongo() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not set in environment variables.");
    return;
  }
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: undefined, // Use default from URI
    });
    console.log("[MongoDB] Connected successfully.");
  } catch (err) {
    console.error("[MongoDB] Connection error:", err);
  }
}
