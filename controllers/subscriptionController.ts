import { Request, Response } from "express";
import { getPlanFromPriceId, getPriceId } from "../config/pricing";
import Subscription from "../models/subscriptionModel";
import User from "../models/userModel";
import {
  sendPaymentFailedEmail,
  sendRenewalReminderEmail,
  sendSubscriptionCancelledEmail,
  sendSubscriptionSuccessEmail,
} from "../utils/emailService";
import stripe from "../utils/stripe";

export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const { planId, interval } = req.body; // Expect planId (e.g., "professional") and interval ("month" or "year")
    const userId = (req as any).user._id;
    const userEmail = (req as any).user.email;

    if (!planId || !interval) {
      return res
        .status(400)
        .json({ message: "Plan ID and billing interval are required." });
    }

    const priceId = getPriceId(planId, interval as "month" | "year");
    if (!priceId) {
      return res
        .status(400)
        .json({ message: "Invalid plan or interval selected" });
    }

    // Check if user already has a stripe customer ID
    const user = await User.findById(userId);
    let customerId: string | undefined;

    // Better: fetch from Subscription model if exists, or create new Customer
    let existingSub = await Subscription.findOne({ userId });

    if (existingSub?.stripeCustomerId) {
      customerId = existingSub.stripeCustomerId;
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { userId: userId.toString() },
      });
      customerId = customer.id;

      // Save customer ID to user immediately
      await User.findByIdAndUpdate(userId, {
        "subscription.stripeCustomerId": customerId,
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.FRONTEND_URL}/dashboard?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/dashboard?canceled=true`,
      metadata: {
        userId: userId.toString(),
        plan: planId,
        interval: interval,
      },
    });

    res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const handleWebhook = async (req: Request, res: Response) => {
  console.log("[Webhook] Received webhook request");
  const sig = req.headers["stripe-signature"] as string;
  let event;

  try {
    // Use rawBody captured by express.json verify option in index.ts
    const payload = (req as any).rawBody;

    if (!payload) {
      console.error(
        "[Webhook] Error: No rawBody found. Ensure express.json is configured with verify."
      );
      return res.status(400).send("Webhook Error: No raw body");
    }

    event = stripe.webhooks.constructEvent(
      payload,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );
    console.log(`[Webhook] Event constructed successfully: ${event.type}`);
  } catch (err: any) {
    console.error(`[Webhook] Signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        console.log("[Webhook] Processing checkout.session.completed");
        await handleCheckoutSessionCompleted(event.data.object as any);
        break;
      case "customer.subscription.updated":
        console.log("[Webhook] Processing customer.subscription.updated");
        await handleSubscriptionUpdated(event.data.object as any);
        break;
      case "customer.subscription.deleted":
        console.log("[Webhook] Processing customer.subscription.deleted");
        await handleSubscriptionDeleted(event.data.object as any);
        break;
      case "invoice.payment_succeeded":
      case "invoice_payment.paid": // Alternative event name
        console.log("[Webhook] Processing invoice payment success");
        await handleInvoicePaymentSucceeded(event.data.object as any);
        break;
      case "invoice.payment_failed":
        console.log("[Webhook] Processing invoice.payment_failed");
        await handleInvoicePaymentFailed(event.data.object as any);
        break;
      default:
        console.log(`[Webhook] Unhandled event type ${event.type}`);
    }
    res.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Error handling webhook event:", error);
    res.status(500).send("Webhook handler failed");
  }
};

const handleCheckoutSessionCompleted = async (session: any) => {
  const userId = session.metadata.userId;
  const plan = session.metadata.plan;
  const interval = session.metadata.interval || "month";
  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  console.log(
    `[Webhook] Checkout session completed for user ${userId}, plan: ${plan}`
  );

  // Retrieve subscription with retry logic to handle timing issues
  let stripeSub: any;
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      // If session.subscription is an object (expanded), use it directly
      if (
        typeof session.subscription === "object" &&
        session.subscription !== null &&
        retryCount === 0
      ) {
        stripeSub = session.subscription;
      } else {
        stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
      }

      // Check if we have the required data
      if (stripeSub.current_period_start && stripeSub.current_period_end) {
        break; // Data is valid, exit retry loop
      } else if (stripeSub.start_date || stripeSub.billing_cycle_anchor) {
        // Fallback: calculate period end based on billing cycle
        const periodStart =
          stripeSub.billing_cycle_anchor || stripeSub.start_date;
        const periodEndDate = new Date(periodStart * 1000);

        if (interval === "year") {
          periodEndDate.setFullYear(periodEndDate.getFullYear() + 1);
        } else {
          periodEndDate.setMonth(periodEndDate.getMonth() + 1);
        }

        stripeSub.current_period_start = periodStart;
        stripeSub.current_period_end = Math.floor(
          periodEndDate.getTime() / 1000
        );
        break;
      } else {
        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.error(`[Webhook] Error retrieving subscription:`, error);
      retryCount++;
      if (retryCount < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  // Final validation
  if (
    !stripeSub ||
    !stripeSub.current_period_end ||
    !stripeSub.current_period_start
  ) {
    console.error(
      `[Webhook] ERROR: Missing period data after ${maxRetries} attempts`
    );
    throw new Error("Invalid subscription data from Stripe");
  }

  // Check if subscription already exists for this user
  let existingSub = await Subscription.findOne({ userId });

  if (existingSub) {
    // Update existing subscription
    existingSub.stripeCustomerId = customerId;
    existingSub.stripeSubscriptionId = subscriptionId;
    existingSub.stripePriceId = stripeSub.items.data[0].price.id;
    existingSub.status = stripeSub.status;
    existingSub.currentPeriodStart = new Date(
      stripeSub.current_period_start * 1000
    );
    existingSub.currentPeriodEnd = new Date(
      stripeSub.current_period_end * 1000
    );
    existingSub.cancelAtPeriodEnd = stripeSub.cancel_at_period_end;
    existingSub.plan = plan;
    existingSub.interval = interval;
    await existingSub.save();
  } else {
    // Create new subscription
    const newSub = new Subscription({
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: stripeSub.items.data[0].price.id,
      status: stripeSub.status,
      currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      plan,
      interval,
    });

    await newSub.save();
  }

  // Update User model
  const startDate = new Date(stripeSub.current_period_start * 1000);
  const endDate = new Date(stripeSub.current_period_end * 1000);

  await User.findByIdAndUpdate(userId, {
    "subscription.plan": plan,
    "subscription.isActive": true,
    "subscription.startDate": startDate,
    "subscription.endDate": endDate,
    "subscription.stripeCustomerId": customerId,
  });

  console.log(
    `[Webhook] Subscription activated for user ${userId}, plan: ${plan}`
  );

  // Send confirmation email
  try {
    const user = await User.findById(userId);
    if (user) {
      const amount = stripeSub.items.data[0].price.unit_amount / 100;
      const nextBillingDate = new Date(stripeSub.current_period_end * 1000);

      await sendSubscriptionSuccessEmail(
        user.email,
        plan,
        interval,
        amount,
        nextBillingDate
      );
      console.log(`[Webhook] Confirmation email sent to ${user.email}`);
    }
  } catch (emailError) {
    console.error(`[Webhook] Failed to send email:`, emailError);
  }
};

const handleSubscriptionUpdated = async (stripeSub: any) => {
  const sub = await Subscription.findOne({
    stripeSubscriptionId: stripeSub.id,
  });

  if (sub) {
    sub.status = stripeSub.status;
    sub.currentPeriodStart = new Date(stripeSub.current_period_start * 1000);
    sub.currentPeriodEnd = new Date(stripeSub.current_period_end * 1000);
    sub.cancelAtPeriodEnd = stripeSub.cancel_at_period_end;

    // Try to identify plan if price changed
    const currentPriceId = stripeSub.items.data[0].price.id;
    if (sub.stripePriceId !== currentPriceId) {
      const planId = getPlanFromPriceId(currentPriceId);
      if (planId !== "unknown") {
        sub.plan = planId;
        sub.stripePriceId = currentPriceId;
        if (stripeSub.items.data[0].price.recurring?.interval) {
          sub.interval = stripeSub.items.data[0].price.recurring.interval;
        }
      }
    }

    await sub.save();

    // Update User model
    const isActive =
      stripeSub.status === "active" || stripeSub.status === "trialing";

    await User.findByIdAndUpdate(sub.userId, {
      "subscription.isActive": isActive,
      "subscription.plan": sub.plan,
      "subscription.endDate": sub.currentPeriodEnd,
    });

    console.log(
      `[Webhook] Subscription updated: ${sub.userId}, status: ${stripeSub.status}`
    );
  } else {
    console.warn(`[Webhook] Subscription not found: ${stripeSub.id}`);
  }
};

const handleSubscriptionDeleted = async (stripeSub: any) => {
  const sub = await Subscription.findOne({
    stripeSubscriptionId: stripeSub.id,
  });

  if (sub) {
    sub.status = "canceled";
    await sub.save();

    await User.findByIdAndUpdate(sub.userId, {
      "subscription.isActive": false,
      "subscription.plan": "none",
      "subscription.endDate": new Date(),
    });

    console.log(`[Webhook] Subscription cancelled for user ${sub.userId}`);

    // Send cancellation email
    try {
      const user = await User.findById(sub.userId);
      if (user) {
        const accessEndDate = stripeSub.current_period_end
          ? new Date(stripeSub.current_period_end * 1000)
          : sub.currentPeriodEnd;

        await sendSubscriptionCancelledEmail(
          user.email,
          sub.plan,
          accessEndDate
        );
        console.log(`[Webhook] Cancellation email sent to ${user.email}`);
      }
    } catch (emailError) {
      console.error(`[Webhook] Failed to send email:`, emailError);
    }
  } else {
    // Fallback: try to find user by customer ID
    const customerId = stripeSub.customer as string;
    if (customerId) {
      const user = await User.findOne({
        "subscription.stripeCustomerId": customerId,
      });
      if (user) {
        await User.findByIdAndUpdate(user._id, {
          "subscription.isActive": false,
          "subscription.plan": "none",
        });
        console.log(`[Webhook] Subscription cancelled (fallback): ${user._id}`);
      }
    }
  }
};

const handleInvoicePaymentSucceeded = async (invoice: any) => {
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) {
    return; // Not a subscription invoice
  }

  const sub = await Subscription.findOne({
    stripeSubscriptionId: subscriptionId,
  });

  if (sub) {
    sub.status = "active";
    await sub.save();

    await User.findByIdAndUpdate(sub.userId, {
      "subscription.isActive": true,
    });

    console.log(`[Webhook] Payment succeeded for user ${sub.userId}`);
  }
};

const handleInvoicePaymentFailed = async (invoice: any) => {
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) {
    return; // Not a subscription invoice
  }

  const sub = await Subscription.findOne({
    stripeSubscriptionId: subscriptionId,
  });

  if (sub) {
    sub.status = "past_due";
    await sub.save();

    console.log(`[Webhook] Payment failed for user ${sub.userId}`);

    // Send payment failed email
    try {
      const user = await User.findById(sub.userId);
      if (user) {
        const retryDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        await sendPaymentFailedEmail(user.email, sub.plan, retryDate);
        console.log(`[Webhook] Payment failed email sent to ${user.email}`);
      }
    } catch (emailError) {
      console.error(`[Webhook] Failed to send email:`, emailError);
    }
  }
};

export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    const sub = await Subscription.findOne({ userId, status: "active" });

    if (!sub) {
      return res.status(404).json({ message: "No active subscription found" });
    }

    // Cancel at end of period in Stripe
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Webhook will handle the DB update eventually, but we can update local state optimistically or just let the user know
    // Usually we wait for webhook, but we can also update `cancelAtPeriodEnd` locally
    sub.cancelAtPeriodEnd = true;
    await sub.save();

    res.json({
      message:
        "Subscription will be canceled at the end of the billing period.",
    });
  } catch (error) {
    console.error("Error canceling subscription:", error);
    res.status(500).json({ message: "Failed to cancel subscription" });
  }
};

// Reminder Check Function (to be called by cron)
export const checkSubscriptionReminders = async () => {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

  // Helper to normalize date range for query (e.g. matching the exact day)
  const startOfDay = (d: Date) => new Date(d.setHours(0, 0, 0, 0));
  const endOfDay = (d: Date) => new Date(d.setHours(23, 59, 59, 999));

  // 7 Days Reminder
  const subs7Days = await Subscription.find({
    status: "active",
    currentPeriodEnd: {
      $gte: startOfDay(new Date(sevenDaysFromNow)),
      $lte: endOfDay(new Date(sevenDaysFromNow)),
    },
  }).populate("userId");

  for (const sub of subs7Days) {
    const user = sub.userId as any;
    if (user && user.email) {
      try {
        // Get price from Stripe subscription
        const stripeSub = await stripe.subscriptions.retrieve(
          sub.stripeSubscriptionId
        );
        const amount = stripeSub.items.data[0].price.unit_amount! / 100;

        await sendRenewalReminderEmail(
          user.email,
          7,
          sub.plan,
          amount,
          sub.currentPeriodEnd
        );
        console.log(`[Reminders] Sent 7-day reminder to ${user.email}`);
      } catch (error) {
        console.error(
          `[Reminders] Failed to send 7-day reminder to ${user.email}:`,
          error
        );
      }
    }
  }

  // 1 Day Reminder
  const subs1Day = await Subscription.find({
    status: "active",
    currentPeriodEnd: {
      $gte: startOfDay(new Date(oneDayFromNow)),
      $lte: endOfDay(new Date(oneDayFromNow)),
    },
  }).populate("userId");

  for (const sub of subs1Day) {
    const user = sub.userId as any;
    if (user && user.email) {
      try {
        // Get price from Stripe subscription
        const stripeSub = await stripe.subscriptions.retrieve(
          sub.stripeSubscriptionId
        );
        const amount = stripeSub.items.data[0].price.unit_amount! / 100;

        await sendRenewalReminderEmail(
          user.email,
          1,
          sub.plan,
          amount,
          sub.currentPeriodEnd
        );
        console.log(`[Reminders] Sent 1-day reminder to ${user.email}`);
      } catch (error) {
        console.error(
          `[Reminders] Failed to send 1-day reminder to ${user.email}:`,
          error
        );
      }
    }
  }
};

// Activate Free Trial - Manual activation by user
export const activateFreeTrial = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user already has an active subscription or trial
    if (user.subscription.isActive) {
      return res.status(400).json({
        success: false,
        message: "You already have an active subscription or trial",
      });
    }

    // Check if user has already used their trial (had trial plan before)
    if (user.subscription.plan === "trial" && !user.subscription.isActive) {
      return res.status(400).json({
        success: false,
        message: "You have already used your free trial",
      });
    }

    // Activate 14-day free trial
    const startDate = new Date();
    const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

    user.subscription = {
      plan: "trial",
      isActive: true,
      startDate,
      endDate,
    };

    await user.save();

    console.log(`✅ Free trial activated for user ${user.email}`);

    res.status(200).json({
      success: true,
      message:
        "Free trial activated successfully! Enjoy 14 days of full access.",
      subscription: {
        plan: user.subscription.plan,
        isActive: user.subscription.isActive,
        startDate: user.subscription.startDate,
        endDate: user.subscription.endDate,
      },
    });
  } catch (error: any) {
    console.error("Error activating free trial:", error);
    res.status(500).json({
      success: false,
      message: "Failed to activate free trial",
      error: error.message,
    });
  }
};
