import mongoose, { Document, Schema } from "mongoose";

export interface IChatMessage extends Document {
  organizationId: string;
  sender: "user" | "ai";
  text: string;
  timestamp: number;
}

const ChatMessageSchema = new Schema<IChatMessage>({
  organizationId: { type: String, required: true, index: true },
  sender: { type: String, enum: ["user", "ai"], required: true },
  text: { type: String, required: true },
  timestamp: { type: Number, required: true },
});

export const ChatMessageModel =
  mongoose.models.ChatMessage ||
  mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);
