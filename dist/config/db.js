"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectMongo = connectMongo;
const mongoose_1 = __importDefault(require("mongoose"));
const MONGODB_URI = process.env.MONGODB_URI || "";
async function connectMongo() {
    if (!MONGODB_URI) {
        console.error("MONGODB_URI not set in environment variables.");
        return;
    }
    try {
        await mongoose_1.default.connect(MONGODB_URI, {
            dbName: undefined, // Use default from URI
        });
        console.log("[MongoDB] Connected successfully.");
    }
    catch (err) {
        console.error("[MongoDB] Connection error:", err);
    }
}
