/**
 * Email Templates Service
 * Professional HTML email templates for subscription management
 */

interface EmailTemplate {
  subject: string;
  html: string;
}

// Base email template with styling
const getEmailLayout = (content: string, preheader?: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Assistant</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background-color: #f4f4f4;
      color: #333333;
      line-height: 1.6;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 28px;
      font-weight: 700;
    }
    .logo {
      font-size: 36px;
      margin-bottom: 10px;
    }
    .content {
      padding: 40px 30px;
    }
    .content h2 {
      color: #1f2937;
      font-size: 24px;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .content p {
      color: #4b5563;
      font-size: 16px;
      margin: 15px 0;
    }
    .highlight-box {
      background-color: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 20px;
      margin: 25px 0;
      border-radius: 4px;
    }
    .highlight-box p {
      margin: 0;
      color: #1e40af;
      font-weight: 500;
    }
    .success-box {
      background-color: #f0fdf4;
      border-left: 4px solid #10b981;
      padding: 20px;
      margin: 25px 0;
      border-radius: 4px;
    }
    .success-box p {
      margin: 0;
      color: #065f46;
      font-weight: 500;
    }
    .warning-box {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 20px;
      margin: 25px 0;
      border-radius: 4px;
    }
    .warning-box p {
      margin: 0;
      color: #92400e;
      font-weight: 500;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      margin: 20px 0;
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      text-align: center;
    }
    .button:hover {
      opacity: 0.9;
    }
    .plan-details {
      background-color: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      margin: 25px 0;
    }
    .plan-details table {
      width: 100%;
      border-collapse: collapse;
    }
    .plan-details td {
      padding: 10px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .plan-details td:first-child {
      color: #6b7280;
      font-weight: 500;
    }
    .plan-details td:last-child {
      color: #1f2937;
      font-weight: 600;
      text-align: right;
    }
    .footer {
      background-color: #1f2937;
      padding: 30px 20px;
      text-align: center;
      color: #9ca3af;
      font-size: 14px;
    }
    .footer a {
      color: #60a5fa;
      text-decoration: none;
    }
    .footer p {
      margin: 10px 0;
      color: #9ca3af;
    }
    .divider {
      height: 1px;
      background-color: #e5e7eb;
      margin: 30px 0;
    }
    @media only screen and (max-width: 600px) {
      .content {
        padding: 30px 20px;
      }
      .header h1 {
        font-size: 24px;
      }
      .button {
        display: block;
        width: 100%;
      }
    }
  </style>
</head>
<body>
  ${preheader ? `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</div>` : ''}
  <div class="email-container">
    <div class="header">
      <div class="logo">🤖</div>
      <h1>AI Assistant</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p><strong>AI Assistant</strong></p>
      <p>Transform your business with AI-powered customer engagement</p>
      <p style="margin-top: 20px;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}">Visit Dashboard</a> |
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/support">Support</a> |
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/unsubscribe">Unsubscribe</a>
      </p>
      <p style="margin-top: 20px; font-size: 12px;">
        © ${new Date().getFullYear()} AI Assistant. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
`;

/**
 * Subscription Confirmation Email
 */
export const getSubscriptionConfirmationEmail = (
  planName: string,
  interval: string,
  amount: number,
  nextBillingDate: Date
): EmailTemplate => {
  const formattedDate = nextBillingDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const content = `
    <h2>🎉 Welcome to Your ${planName} Plan!</h2>
    <p>Congratulations! Your subscription has been successfully activated.</p>

    <div class="success-box">
      <p>✅ Your payment has been processed and your account is now active.</p>
    </div>

    <div class="plan-details">
      <table>
        <tr>
          <td>Plan</td>
          <td>${planName}</td>
        </tr>
        <tr>
          <td>Billing Cycle</td>
          <td>${interval === 'month' ? 'Monthly' : 'Yearly'}</td>
        </tr>
        <tr>
          <td>Amount</td>
          <td>$${amount.toFixed(2)}</td>
        </tr>
        <tr>
          <td>Next Billing Date</td>
          <td>${formattedDate}</td>
        </tr>
      </table>
    </div>

    <p><strong>What's Next?</strong></p>
    <ul>
      <li>Access all premium features immediately</li>
      <li>Set up your AI assistant dashboard</li>
      <li>Integrate with your favorite tools</li>
      <li>Get 24/7 priority support</li>
    </ul>

    <center>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" class="button">
        Go to Dashboard
      </a>
    </center>

    <div class="divider"></div>

    <p style="font-size: 14px; color: #6b7280;">
      Need help getting started? Check out our <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/docs" style="color: #3b82f6;">documentation</a> or contact our support team.
    </p>
  `;

  return {
    subject: `🎉 Welcome to ${planName} - Your Subscription is Active!`,
    html: getEmailLayout(content, `Your ${planName} subscription is now active!`)
  };
};

/**
 * Subscription Cancellation Email
 */
export const getSubscriptionCancellationEmail = (
  planName: string,
  accessEndDate: Date
): EmailTemplate => {
  const formattedDate = accessEndDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const content = `
    <h2>Subscription Cancellation Confirmed</h2>
    <p>We're sorry to see you go. Your subscription cancellation has been processed.</p>

    <div class="warning-box">
      <p>⚠️ Your access will continue until ${formattedDate}</p>
    </div>

    <p><strong>What This Means:</strong></p>
    <ul>
      <li>You will not be charged again</li>
      <li>Your access remains active until <strong>${formattedDate}</strong></li>
      <li>All your data will be preserved for 30 days after cancellation</li>
      <li>You can reactivate anytime before the end date</li>
    </ul>

    <div class="highlight-box">
      <p><strong>Changed your mind?</strong> You can reactivate your subscription at any time before ${formattedDate}.</p>
    </div>

    <center>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/pricing" class="button">
        Reactivate Subscription
      </a>
    </center>

    <div class="divider"></div>

    <p><strong>We'd Love Your Feedback</strong></p>
    <p>Help us improve! Let us know why you canceled:</p>
    <center>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/feedback" style="color: #3b82f6; text-decoration: none;">
        Share Feedback
      </a>
    </center>
  `;

  return {
    subject: 'Subscription Cancellation Confirmed',
    html: getEmailLayout(content, 'Your subscription has been cancelled')
  };
};

/**
 * Renewal Reminder Email (7 days or 1 day)
 */
export const getRenewalReminderEmail = (
  planName: string,
  daysLeft: number,
  amount: number,
  renewalDate: Date
): EmailTemplate => {
  const formattedDate = renewalDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const urgencyClass = daysLeft === 1 ? 'warning-box' : 'highlight-box';
  const emoji = daysLeft === 1 ? '⚠️' : '📅';

  const content = `
    <h2>${emoji} Subscription Renewal Reminder</h2>
    <p>Your ${planName} subscription will renew in <strong>${daysLeft} day${daysLeft > 1 ? 's' : ''}</strong>.</p>

    <div class="${urgencyClass}">
      <p>Your subscription will automatically renew on ${formattedDate}</p>
    </div>

    <div class="plan-details">
      <table>
        <tr>
          <td>Current Plan</td>
          <td>${planName}</td>
        </tr>
        <tr>
          <td>Renewal Date</td>
          <td>${formattedDate}</td>
        </tr>
        <tr>
          <td>Renewal Amount</td>
          <td>$${amount.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <p><strong>What Happens Next?</strong></p>
    <ul>
      <li>Your subscription will automatically renew on ${formattedDate}</li>
      <li>Your card ending will be charged $${amount.toFixed(2)}</li>
      <li>You'll continue enjoying all premium features</li>
      <li>No action needed unless you want to make changes</li>
    </ul>

    <center>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/billing" class="button">
        Manage Subscription
      </a>
    </center>

    <div class="divider"></div>

    <p style="font-size: 14px; color: #6b7280;">
      Want to cancel or change your plan? Visit your <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/billing" style="color: #3b82f6;">billing settings</a> anytime.
    </p>
  `;

  return {
    subject: `${emoji} Your subscription renews in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`,
    html: getEmailLayout(content, `Renewal reminder: ${daysLeft} day${daysLeft > 1 ? 's' : ''} left`)
  };
};

/**
 * Payment Failed Email
 */
export const getPaymentFailedEmail = (
  planName: string,
  retryDate: Date
): EmailTemplate => {
  const formattedDate = retryDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const content = `
    <h2>⚠️ Payment Failed</h2>
    <p>We couldn't process your payment for your ${planName} subscription.</p>

    <div class="warning-box">
      <p>Your subscription is at risk of being cancelled</p>
    </div>

    <p><strong>What You Need to Do:</strong></p>
    <ul>
      <li>Update your payment method immediately</li>
      <li>Ensure your card has sufficient funds</li>
      <li>Check that your card details are correct</li>
    </ul>

    <p>We'll automatically retry the payment on ${formattedDate}. If the payment fails again, your subscription will be cancelled.</p>

    <center>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/billing" class="button">
        Update Payment Method
      </a>
    </center>

    <div class="divider"></div>

    <p style="font-size: 14px; color: #6b7280;">
      Questions about this charge? <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/support" style="color: #3b82f6;">Contact support</a> - we're here to help!
    </p>
  `;

  return {
    subject: '⚠️ Payment Failed - Action Required',
    html: getEmailLayout(content, 'Update your payment method to avoid service interruption')
  };
};

/**
 * Trial Ending Email
 */
export const getTrialEndingEmail = (daysLeft: number): EmailTemplate => {
  const content = `
    <h2>📅 Your Free Trial is Ending Soon</h2>
    <p>Your free trial will end in <strong>${daysLeft} day${daysLeft > 1 ? 's' : ''}</strong>.</p>

    <div class="highlight-box">
      <p>Don't lose access to your premium features!</p>
    </div>

    <p><strong>What You've Accomplished:</strong></p>
    <ul>
      <li>Explored all premium features</li>
      <li>Experienced AI-powered customer engagement</li>
      <li>Discovered how we can transform your business</li>
    </ul>

    <p><strong>Continue Your Journey:</strong></p>
    <p>Subscribe now to keep all your settings, integrations, and data.</p>

    <center>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/pricing" class="button">
        View Pricing Plans
      </a>
    </center>

    <div class="divider"></div>

    <p style="font-size: 14px; color: #6b7280;">
      Questions about pricing? <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/support" style="color: #3b82f6;">Chat with our team</a> - we're happy to help!
    </p>
  `;

  return {
    subject: `📅 Your trial ends in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`,
    html: getEmailLayout(content, `Trial ending: ${daysLeft} day${daysLeft > 1 ? 's' : ''} left`)
  };
};

export default {
  getSubscriptionConfirmationEmail,
  getSubscriptionCancellationEmail,
  getRenewalReminderEmail,
  getPaymentFailedEmail,
  getTrialEndingEmail,
};
