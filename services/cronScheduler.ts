/**
 * Cron Scheduler for Subscription Reminders
 * Automatically sends reminder emails at scheduled intervals
 */

import cron from 'node-cron';
import { checkSubscriptionReminders } from '../controllers/subscriptionController';
import { verifyEmailConnection } from '../utils/emailService';

/**
 * Schedule subscription reminder checks
 * Runs daily at 9:00 AM
 */
export const scheduleSubscriptionReminders = () => {
  // Run every day at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('[Cron] Running subscription reminder check at', new Date().toISOString());

    try {
      await checkSubscriptionReminders();
      console.log('[Cron] Subscription reminder check completed successfully');
    } catch (error) {
      console.error('[Cron] Error running subscription reminder check:', error);
    }
  }, {
    timezone: "America/New_York" // Adjust to your timezone
  });

  console.log('[Cron] Subscription reminder scheduler initialized - runs daily at 9:00 AM');
};

/**
 * Verify email service on startup
 */
export const initializeEmailService = async () => {
  console.log('[Email] Verifying SMTP connection...');
  const isConnected = await verifyEmailConnection();

  if (isConnected) {
    console.log('[Email] ✅ SMTP service is ready');
  } else {
    console.warn('[Email] ⚠️  SMTP not configured - emails will be simulated');
  }
};

/**
 * Initialize all scheduled tasks
 */
export const initializeCronJobs = async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('[Cron] Initializing scheduled tasks...');
  console.log('═══════════════════════════════════════════════════════');

  // Verify email service first
  await initializeEmailService();

  // Schedule reminder emails
  scheduleSubscriptionReminders();

  // You can add more cron jobs here
  // Example: Daily cleanup, report generation, etc.

  console.log('[Cron] All scheduled tasks initialized successfully');
  console.log('═══════════════════════════════════════════════════════');
};

export default {
  initializeCronJobs,
  scheduleSubscriptionReminders,
  initializeEmailService,
};
