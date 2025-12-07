import mongoose, { Schema, Document } from "mongoose";

export interface IOTP extends Document {
  email: string;
  otp: string;
  createdAt: Date;
}

const otpSchema = new Schema<IOTP>(
  {
    email: {
      type: String,
      required: true,
      index: true,
    },
    otp: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 120, // OTP expires in 2 minutes (120 seconds)
    },
  },
  {
    timestamps: true,
  }
);

export const OTP = mongoose.model<IOTP>("OTP", otpSchema);
