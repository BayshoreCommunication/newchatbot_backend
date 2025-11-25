import mongoose, { Schema, Document } from "mongoose";

export interface ILead extends Document {
  name?: string;
  phone?: string;
  email?: string;
  assistantId?: string;
  threadId?: string;
  incidentType?: string; // Car accident, Slip & Fall, etc.
  conversationSummary?: string;
  timestamp: Date;
  contacted: boolean;
  notes?: string;
}

const LeadSchema: Schema = new Schema({
  name: {
    type: String,
  },
  phone: {
    type: String,
  },
  email: {
    type: String,
  },
  assistantId: {
    type: String,
    index: true,
  },
  threadId: {
    type: String,
    index: true,
  },
  incidentType: {
    type: String,
  },
  conversationSummary: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  contacted: {
    type: Boolean,
    default: false,
    index: true,
  },
  notes: {
    type: String,
  },
});

LeadSchema.index({ assistantId: 1, contacted: 1 });
LeadSchema.index({ timestamp: -1 });

export default mongoose.model<ILead>("Lead", LeadSchema);
