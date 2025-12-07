import nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import dotenv from "dotenv";
import {
  getSubscriptionConfirmationEmail,
  getSubscriptionCancellationEmail,
  getRenewalReminderEmail,
  getPaymentFailedEmail,
  getTrialEndingEmail,
} from "../services/emailTemplates";
import { getOTPEmail } from "../services/otpTemplate";

dotenv.config();

// Create transporter with better configuration
const createTransporter = () => {
  const config = {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true", // true for 465, false for 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Additional configuration for better reliability
    pool: true, // Use pooled connections
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000, // 1 second between messages
    rateLimit: 5, // max 5 messages per rateDelta
  };

  return nodemailer.createTransport(config);
};

const transporter = createTransporter();

/**
 * Verify SMTP connection
 */
export const verifyEmailConnection = async (): Promise<boolean> => {
  if (!process.env.SMTP_HOST || process.env.SMTP_HOST === "localhost") {
    console.log("[Email Service] SMTP not configured. Running in simulation mode.");
    return false;
  }

  try {
    await transporter.verify();
    console.log("[Email Service] SMTP connection verified successfully");
    return true;
  } catch (error) {
    console.error("[Email Service] SMTP connection verification failed:", error);
    return false;
  }
};

/**
 * Base email sending function with error handling and retry logic
 */
export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  retries = 3
): Promise<any> => {
  // Check if SMTP is configured
  if (!process.env.SMTP_HOST || process.env.SMTP_HOST === "localhost") {
    console.log("---------------------------------------------------");
    console.log(`[Email Service] SMTP not configured. Simulating email to: ${to}`);
    console.log(`[Email Service] Subject: ${subject}`);
    console.log(`[Email Service] Content preview: ${html.substring(0, 100)}...`);
    console.log("---------------------------------------------------");
    return { messageId: "simulated-id-" + Date.now() };
  }

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    throw new Error(`Invalid email address: ${to}`);
  }

  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"AI Assistant" <noreply@aiassistant.com>',
        to,
        subject,
        html,
        // Add text version for better deliverability
        text: html.replace(/<[^>]*>/g, ''), // Simple HTML to text conversion
        headers: {
          'X-Entity-Ref-ID': `${Date.now()}-${Math.random().toString(36).substring(7)}`,
        },
      });

      console.log(`[Email Service] ✅ Email sent successfully to ${to}`);
      console.log(`[Email Service] Message ID: ${info.messageId}`);
      console.log(`[Email Service] Response: ${info.response}`);

      return info;
    } catch (error: any) {
      lastError = error;
      console.error(`[Email Service] ❌ Attempt ${attempt}/${retries} failed:`, error.message);

      if (attempt < retries) {
        const waitTime = attempt * 1000; // Exponential backoff
        console.log(`[Email Service] Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  console.error(`[Email Service] ❌ All ${retries} attempts failed for email to ${to}`);
  throw lastError;
};

/**
 * Send Subscription Confirmation Email
 */
export const sendSubscriptionSuccessEmail = async (
  email: string,
  plan: string,
  interval: string = "month",
  amount: number = 0,
  nextBillingDate: Date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
) => {
  try {
    const template = getSubscriptionConfirmationEmail(
      plan,
      interval,
      amount,
      nextBillingDate
    );

    await sendEmail(email, template.subject, template.html);
    console.log(`[Email Service] Subscription confirmation sent to ${email}`);
  } catch (error) {
    console.error(`[Email Service] Failed to send subscription confirmation to ${email}:`, error);
    throw error;
  }
};

/**
 * Send Subscription Cancellation Email
 */
export const sendSubscriptionCancelledEmail = async (
  email: string,
  planName: string = "Premium",
  accessEndDate: Date = new Date()
) => {
  try {
    const template = getSubscriptionCancellationEmail(planName, accessEndDate);

    await sendEmail(email, template.subject, template.html);
    console.log(`[Email Service] Cancellation confirmation sent to ${email}`);
  } catch (error) {
    console.error(`[Email Service] Failed to send cancellation email to ${email}:`, error);
    throw error;
  }
};

/**
 * Send Renewal Reminder Email
 */
export const sendRenewalReminderEmail = async (
  email: string,
  daysLeft: number,
  planName: string = "Premium",
  amount: number = 0,
  renewalDate: Date = new Date()
) => {
  try {
    const template = getRenewalReminderEmail(planName, daysLeft, amount, renewalDate);

    await sendEmail(email, template.subject, template.html);
    console.log(`[Email Service] Renewal reminder (${daysLeft} days) sent to ${email}`);
  } catch (error) {
    console.error(`[Email Service] Failed to send renewal reminder to ${email}:`, error);
    throw error;
  }
};

/**
 * Send Payment Failed Email
 */
export const sendPaymentFailedEmail = async (
  email: string,
  planName: string = "Premium",
  retryDate: Date = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
) => {
  try {
    const template = getPaymentFailedEmail(planName, retryDate);

    await sendEmail(email, template.subject, template.html);
    console.log(`[Email Service] Payment failed notification sent to ${email}`);
  } catch (error) {
    console.error(`[Email Service] Failed to send payment failed email to ${email}:`, error);
    throw error;
  }
};

/**
 * Send Trial Ending Email
 */
export const sendTrialEndingEmail = async (
  email: string,
  daysLeft: number
) => {
  try {
    const template = getTrialEndingEmail(daysLeft);

    await sendEmail(email, template.subject, template.html);
    console.log(`[Email Service] Trial ending reminder (${daysLeft} days) sent to ${email}`);
  } catch (error) {
    console.error(`[Email Service] Failed to send trial ending email to ${email}:`, error);
    throw error;
  }
};

/**
 * Send OTP Email
 */
export const sendOTPEmail = async (email: string, otp: string) => {
  try {
    const template = getOTPEmail(otp);
    await sendEmail(email, template.subject, template.html);
    console.log(`[Email Service] OTP sent to ${email}`);
  } catch (error) {
    console.error(`[Email Service] Failed to send OTP to ${email}:`, error);
    throw error;
  }
};

// Export for testing SMTP configuration
export { transporter };

export default {
  sendEmail,
  sendSubscriptionSuccessEmail,
  sendSubscriptionCancelledEmail,
  sendRenewalReminderEmail,
  sendPaymentFailedEmail,
  sendTrialEndingEmail,
  sendOTPEmail,
  verifyEmailConnection,
};
