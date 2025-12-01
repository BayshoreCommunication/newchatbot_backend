import mongoose, { Schema, Document } from "mongoose";

export interface ISubscription extends Document {
  userId: mongoose.Types.ObjectId;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  plan: string; // trial, professional, enterprise
  interval: string; // month, year
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema: Schema<ISubscription> = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    stripeCustomerId: {
      type: String,
      required: true,
    },
    stripeSubscriptionId: {
      type: String,
      required: true,
      unique: true,
    },
    stripePriceId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: [
        "active",
        "canceled",
        "incomplete",
        "incomplete_expired",
        "past_due",
        "trialing",
        "unpaid",
        "paused",
      ],
    },
    currentPeriodStart: {
      type: Date,
      required: true,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    plan: {
      type: String,
      enum: ["trial", "professional", "enterprise"],
      required: true,
    },
    interval: {
      type: String,
      enum: ["month", "year"],
      default: "month"
    },
  },
  {
    timestamps: true,
  }
);

const Subscription = mongoose.model<ISubscription>(
  "Subscription",
  subscriptionSchema
);

export default Subscription;
