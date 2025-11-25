import mongoose, { Schema, Document } from "mongoose";

export interface IUnknownQuestion extends Document {
  question: string;
  assistantId?: string;
  threadId?: string;
  userMessage?: string;
  assistantResponse?: string;
  timestamp: Date;
  resolved: boolean;
}

const UnknownQuestionSchema: Schema = new Schema({
  question: {
    type: String,
    required: true,
  },
  assistantId: {
    type: String,
    index: true,
  },
  threadId: {
    type: String,
    index: true,
  },
  userMessage: {
    type: String,
  },
  assistantResponse: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  resolved: {
    type: Boolean,
    default: false,
    index: true,
  },
});

UnknownQuestionSchema.index({ assistantId: 1, resolved: 1 });
UnknownQuestionSchema.index({ timestamp: -1 });

export default mongoose.model<IUnknownQuestion>(
  "UnknownQuestion",
  UnknownQuestionSchema
);
