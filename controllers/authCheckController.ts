import bcrypt from "bcrypt";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { OTP } from "../models/otpModel";
import User from "../models/userModel";
import { sendOTPEmail } from "../utils/emailService";

/**
 * Check if email exists and auto-signup if not
 * POST /api/auth/check-or-signup
 * Body: { email, companyName }
 */
export const checkOrSignup = async (req: Request, res: Response) => {
  try {
    const { email, companyName } = req.body;

    if (!email || !companyName) {
      return res.status(400).json({
        success: false,
        message: "Email and company name are required",
      });
    }

    // Check if user exists
    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      // User exists - generate token
      const token = jwt.sign(
        { id: user._id, email: user.email },
        process.env.JWT_SECRET || "your-secret-key",
        { expiresIn: "7d" }
      );

      return res.status(200).json({
        success: true,
        message: "User found",
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
        },
        isNewUser: false,
      });
    }

    // User doesn't exist - auto signup with default password
    const defaultPassword = `${companyName.replace(/\s+/g, "")}!123`;
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    user = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      name: companyName,
      role: "user",
      isVerified: false, // Will be verified after OTP
    });

    await user.save();

    // Generate token for new user
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
      isNewUser: true,
      defaultPassword, // Send password for user reference
    });
  } catch (error: unknown) {
    console.error("Check or signup error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
};

/**
 * Generate and send OTP for email verification
 * POST /api/auth/send-otp-quick
 * Body: { email }
 */
export const sendOTPQuick = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any existing OTPs for this email
    await OTP.deleteMany({ email: email.toLowerCase() });

    // Save new OTP (expires in 10 minutes)
    const otp = new OTP({
      email: email.toLowerCase(),
      otp: otpCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    await otp.save();

    // Send OTP via email
    try {
      await sendOTPEmail(email, otpCode);
      console.log(`📧 OTP sent to ${email}: ${otpCode}`);
    } catch (emailError) {
      console.error(`Failed to send OTP email to ${email}:`, emailError);
      // Continue even if email fails - user can still use OTP in development mode
    }

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      // For development only - remove in production
      otp: process.env.NODE_ENV === "development" ? otpCode : undefined,
    });
  } catch (error: unknown) {
    console.error("Send OTP error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to send OTP",
    });
  }
};

/**
 * Verify OTP and mark user as verified
 * POST /api/auth/verify-otp-quick
 * Body: { email, otp }
 */
export const verifyOTPQuick = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    // Find OTP
    const otpRecord = await OTP.findOne({
      email: email.toLowerCase(),
      otp: otp,
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // Check if OTP expired
    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    // Mark user as verified
    const user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      user.isVerified = true;
      await user.save();
    }

    // Delete used OTP
    await OTP.deleteOne({ _id: otpRecord._id });

    // Generate token
    const token = jwt.sign(
      { id: user?._id, email: user?.email },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      token,
      user: {
        id: user?._id,
        email: user?.email,
        name: user?.name,
      },
    });
  } catch (error: unknown) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to verify OTP",
    });
  }
};
