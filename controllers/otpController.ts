import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { OTP } from "../models/otpModel";
import User from "../models/userModel";
import { sendOTPEmail } from "../utils/emailService";

const generateToken = (id: string) => {
  return jwt.sign({ id }, process.env.JWT_SECRET as string, {
    expiresIn: "30d",
  });
};

/**
 * @desc    Send OTP for signup
 * @route   POST /api/auth/send-otp
 * @access  Public
 */
export const sendOTP = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists. Please sign in instead.",
      });
    }

    // Generate 6 digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any old OTPs for this email
    await OTP.deleteMany({ email });

    // Create new OTP (will expire in 2 minutes)
    await OTP.create({ email, otp: otpCode });

    // Send Email
    await sendOTPEmail(email, otpCode);

    console.log(`✅ OTP sent to ${email}. OTP will expire in 2 minutes.`);

    res.status(200).json({
      success: true,
      message:
        "OTP sent successfully to your email. Please verify within 2 minutes.",
      expiresIn: 120, // seconds
    });
  } catch (error: any) {
    console.error("Send OTP Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to send OTP",
        error: error.message,
      });
  }
};

/**
 * @desc    Verify OTP and Create User Account
 * @route   POST /api/auth/verify-otp
 * @access  Public
 * @required email, otp, password, companyName, companyType, website
 * @optional language, timezone
 */
export const verifyOTPAndSignup = async (req: Request, res: Response) => {
  const {
    email,
    otp,
    password,
    companyName,
    companyType,
    website,
    language,
    timezone,
  } = req.body;

  // Validate required fields: email, otp, password, companyName, companyType, website
  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: "Email and OTP are required",
    });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password is required and must be at least 6 characters",
    });
  }

  if (!companyName) {
    return res.status(400).json({
      success: false,
      message: "Company name is required",
    });
  }

  if (!companyType) {
    return res.status(400).json({
      success: false,
      message: "Company type is required",
    });
  }

  if (!website) {
    return res.status(400).json({
      success: false,
      message: "Company website URL is required",
    });
  }

  try {
    // Verify OTP exists and is valid (not expired)
    const validOTP = await OTP.findOne({ email, otp });

    if (!validOTP) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP. OTP is valid for 2 minutes only.",
      });
    }

    // Check if user already exists (should not happen if send-otp works correctly)
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // Delete the OTP
      await OTP.deleteOne({ _id: validOTP._id });

      return res.status(400).json({
        success: false,
        message: "User already exists. Please sign in instead.",
      });
    }

    // Create new user account WITHOUT automatic free trial
    const user = await User.create({
      email,
      password, // Will be hashed by pre-save hook in User model
      companyName,
      companyType,
      website,
      language,
      timezone,
      subscription: {
        plan: "none",
        isActive: false,
        // No startDate or endDate - user must manually activate trial
      },
    });

    // Delete used OTP
    await OTP.deleteOne({ _id: validOTP._id });

    // Generate JWT Token
    const token = generateToken(user._id.toString());

    console.log(`✅ User account created successfully for ${email}`);

    res.status(201).json({
      success: true,
      message: "Account created successfully! You are now signed in.",
      user: {
        _id: user._id,
        email: user.email,
        companyName: user.companyName,
        companyType: user.companyType,
        website: user.website,
        subscription: user.subscription,
      },
      token,
    });
  } catch (error: any) {
    console.error("Verify OTP Error:", error);

    // Handle duplicate email error (shouldn't happen but good to catch)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create account",
      error: error.message,
    });
  }
};
