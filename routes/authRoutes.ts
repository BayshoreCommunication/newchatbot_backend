import express from "express";
import {
  googleAuth,
  googleAuthCallback,
  googleSync,
  signin,
  signup,
} from "../controllers/authController";
import { sendOTP, verifyOTPAndSignup } from "../controllers/otpController";

const router = express.Router();

// ==========================================
// 🔐 SIGNUP FLOW (OTP Required)
// ==========================================

// @route   POST /api/auth/send-otp
// @desc    Step 1: Send OTP to email for signup (OTP expires in 2 minutes)
// @body    { email }
// @access  Public
router.post("/send-otp", sendOTP);

// @route   POST /api/auth/verify-otp
// @desc    Step 2: Verify OTP and create user account
// @body    { email, otp, password, companyName, companyType?, website?, language?, timezone? }
// @access  Public
router.post("/verify-otp", verifyOTPAndSignup);

// @route   POST /api/auth/signup
// @desc    DEPRECATED - Direct signup disabled (Use OTP flow above)
// @access  Public
router.post("/signup", signup);

// ==========================================
// 🔑 SIGNIN FLOW
// ==========================================

// @route   POST /api/auth/signin
// @desc    Authenticate user and get token
// @body    { email, password }
// @access  Public
router.post("/signin", signin);

// ==========================================
// 🌐 GOOGLE AUTH
// ==========================================

// @route   GET /api/auth/google
// @desc    Authenticate with Google
// @access  Public
router.get("/google", googleAuth);

// @route   GET /api/auth/google/callback
// @desc    Google auth callback
// @access  Public
router.get("/google/callback", googleAuthCallback);

// @route   POST /api/auth/google/sync
// @desc    Sync Google user with backend (NextAuth integration)
// @access  Public
router.post("/google/sync", googleSync);

export default router;
