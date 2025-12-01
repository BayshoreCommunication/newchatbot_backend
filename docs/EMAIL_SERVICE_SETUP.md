# Email Service Setup Guide

## Overview

This application includes a comprehensive email notification system for subscription management, including:
- Subscription confirmation emails
- Subscription cancellation emails
- Renewal reminder emails (7 days and 1 day before renewal)
- Payment failed notifications
- Trial ending reminders

## SMTP Configuration

### Gmail Setup (Recommended)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Go to Google Account Settings → Security
   - Enable 2-Step Verification
   - Go to "App passwords"
   - Generate a new app password for "Mail"
   - Copy the 16-character password

3. **Update `.env` file**:
```env
SMTP_SERVICE=gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
SMTP_FROM="Your Company Name" <your-email@gmail.com>
```

### Other Email Providers

#### SendGrid
```env
SMTP_SERVICE=SendGrid
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM="Your Company" <noreply@yourdomain.com>
```

#### Mailgun
```env
SMTP_SERVICE=Mailgun
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your-mailgun-password
SMTP_FROM="Your Company" <noreply@yourdomain.com>
```

#### AWS SES
```env
SMTP_SERVICE=SES
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
SMTP_FROM="Your Company" <noreply@yourdomain.com>
```

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `SMTP_SERVICE` | Email service provider | `gmail` |
| `SMTP_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port (587 for TLS, 465 for SSL) | `587` |
| `SMTP_SECURE` | Use SSL (true for port 465, false for 587) | `false` |
| `SMTP_USER` | SMTP authentication username/email | `your-email@gmail.com` |
| `SMTP_PASS` | SMTP authentication password/app password | `your-app-password` |
| `SMTP_FROM` | Sender name and email address | `"AI Assistant" <noreply@example.com>` |

## Email Templates

The system includes 5 professional HTML email templates located in `backend/services/emailTemplates.ts`:

### 1. Subscription Confirmation Email
**Trigger**: When a user successfully subscribes to a plan
**Includes**: Plan name, billing interval, amount, next billing date
**Function**: `getSubscriptionConfirmationEmail(planName, interval, amount, nextBillingDate)`

### 2. Subscription Cancellation Email
**Trigger**: When a user cancels their subscription
**Includes**: Plan name, access end date
**Function**: `getSubscriptionCancellationEmail(planName, accessEndDate)`

### 3. Renewal Reminder Email
**Trigger**: 7 days and 1 day before subscription renewal
**Includes**: Plan name, days until renewal, amount, renewal date
**Function**: `getRenewalReminderEmail(planName, daysLeft, amount, renewalDate)`

### 4. Payment Failed Email
**Trigger**: When a subscription payment fails
**Includes**: Plan name, retry date
**Function**: `getPaymentFailedEmail(planName, retryDate)`

### 5. Trial Ending Email
**Trigger**: Before trial period ends
**Includes**: Days remaining in trial
**Function**: `getTrialEndingEmail(daysLeft)`

## Email Service Features

### Retry Logic
- Automatically retries failed emails up to 3 times
- Exponential backoff between retries (1s, 2s, 3s)
- Detailed error logging for debugging

### Connection Pooling
- Maintains persistent SMTP connections
- Max 5 concurrent connections
- Rate limiting: 5 emails per second

### Email Validation
- Validates email format before sending
- Prevents sending to invalid addresses

### Error Handling
- Graceful fallback when SMTP is not configured
- Simulation mode for development/testing
- Detailed logging for troubleshooting

## Cron Job Scheduler

The system automatically checks for upcoming renewals and sends reminder emails.

**Schedule**: Daily at 9:00 AM (configurable in `backend/services/cronScheduler.ts`)

**Configuration**:
```typescript
cron.schedule('0 9 * * *', async () => {
  await checkSubscriptionReminders();
}, {
  scheduled: true,
  timezone: "America/New_York" // Adjust to your timezone
});
```

**Reminder Schedule**:
- 7 days before renewal
- 1 day before renewal

## Testing Email Service

### 1. Verify SMTP Connection

Start the server and check logs:
```bash
npm run dev
```

Look for:
```
[Email] Verifying SMTP connection...
[Email] ✅ SMTP service is ready
```

### 2. Test Email Sending

You can test the email service by creating a test subscription or using the webhook endpoint.

### 3. Simulation Mode

If SMTP is not configured, the system runs in simulation mode and logs email content to console:
```
---------------------------------------------------
[Email Service] SMTP not configured. Simulating email to: user@example.com
[Email Service] Subject: Subscription Confirmed
[Email Service] Content preview: <!DOCTYPE html>...
---------------------------------------------------
```

## Troubleshooting

### Common Issues

#### 1. "SMTP not configured"
**Solution**: Check that all SMTP environment variables are set correctly in `.env`

#### 2. "Invalid login" or "Authentication failed"
**Solution**:
- For Gmail: Generate a new App Password (not your regular password)
- Ensure 2-Factor Authentication is enabled
- Check SMTP_USER and SMTP_PASS are correct

#### 3. "Connection timeout"
**Solution**:
- Check SMTP_HOST and SMTP_PORT are correct
- Verify firewall allows outbound connections on port 587/465
- Try different port (587 for TLS, 465 for SSL)

#### 4. Emails going to spam
**Solution**:
- Use a custom domain instead of Gmail for production
- Set up SPF, DKIM, and DMARC records
- Use a professional email service (SendGrid, AWS SES)

#### 5. Rate limiting errors
**Solution**:
- Current limit: 5 emails per second
- Adjust in `backend/utils/emailService.ts`:
```typescript
rateDelta: 1000,
rateLimit: 5,
```

### Debug Logging

Enable detailed logging by checking the console output. Look for:
- `[Email Service]` - Email sending operations
- `[Cron]` - Scheduled task execution
- `[Webhook]` - Stripe webhook events
- `[Reminders]` - Reminder email sending

## Production Recommendations

### 1. Use Professional Email Service
- **SendGrid**: 100 free emails/day, excellent deliverability
- **AWS SES**: $0.10 per 1000 emails, high volume support
- **Mailgun**: 5000 free emails/month, good API

### 2. Set Up Email Domain
- Use a custom domain instead of Gmail
- Configure SPF, DKIM, and DMARC records
- Use subdomain for transactional emails (e.g., `mail.yourdomain.com`)

### 3. Monitor Email Delivery
- Track bounce rates and complaints
- Set up webhook notifications for failed deliveries
- Monitor daily/monthly sending limits

### 4. Compliance
- Include unsubscribe link in marketing emails
- Follow CAN-SPAM and GDPR guidelines
- Keep email logs for audit purposes

## Email Template Customization

Templates can be customized in `backend/services/emailTemplates.ts`:

### Change Colors
```typescript
background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
// Change to your brand colors
```

### Update Logo/Branding
Add your logo URL:
```typescript
<img src="https://yourdomain.com/logo.png" alt="Company Logo" style="height: 40px;">
```

### Modify Content
Edit the HTML content in each template function to match your brand voice.

## API Reference

### Email Service Functions

#### `verifyEmailConnection()`
Verifies SMTP connection on startup.
```typescript
const isConnected = await verifyEmailConnection();
```

#### `sendEmail(to, subject, html, retries)`
Base email sending function with retry logic.
```typescript
await sendEmail('user@example.com', 'Subject', '<html>...</html>', 3);
```

#### `sendSubscriptionSuccessEmail(email, plan, interval, amount, nextBillingDate)`
Sends subscription confirmation email.
```typescript
await sendSubscriptionSuccessEmail(
  'user@example.com',
  'professional',
  'month',
  29.99,
  new Date('2025-01-01')
);
```

#### `sendSubscriptionCancelledEmail(email, planName, accessEndDate)`
Sends cancellation confirmation.
```typescript
await sendSubscriptionCancelledEmail(
  'user@example.com',
  'Professional',
  new Date('2025-01-31')
);
```

#### `sendRenewalReminderEmail(email, daysLeft, planName, amount, renewalDate)`
Sends renewal reminder.
```typescript
await sendRenewalReminderEmail(
  'user@example.com',
  7,
  'Professional',
  29.99,
  new Date('2025-01-15')
);
```

## File Structure

```
backend/
├── services/
│   ├── emailTemplates.ts      # HTML email templates
│   └── cronScheduler.ts        # Cron job scheduler
├── utils/
│   └── emailService.ts         # Email sending service
├── controllers/
│   └── subscriptionController.ts  # Webhook handlers
└── docs/
    └── EMAIL_SERVICE_SETUP.md  # This file
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review console logs for error messages
3. Verify all environment variables are set correctly
4. Test in simulation mode first

## Version History

- **v1.0** - Initial email service implementation
  - Professional HTML templates
  - Retry logic and connection pooling
  - Automated reminder system
  - Gmail/SendGrid/SES support
