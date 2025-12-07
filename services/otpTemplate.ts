/**
 * Generate OTP Email HTML
 */
export const getOTPEmail = (otp: string) => {
  return {
    subject: "Your AI Assistant Verification Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Verify Your Email</h2>
        <p>Your verification code for AI Assistant is:</p>
        <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #333; border-radius: 5px;">
          ${otp}
        </div>
        <p>This code will expire in 5 minutes.</p>
        <p style="color: #777; font-size: 12px; margin-top: 20px;">If you didn't request this code, please ignore this email.</p>
      </div>
    `,
  };
};
