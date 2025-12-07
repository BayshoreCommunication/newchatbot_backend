import express from "express";
import {
  checkOrSignup,
  sendOTPQuick,
  verifyOTPQuick,
} from "../controllers/authCheckController";

const router = express.Router();

/**
 * POST /api/auth-check/check-or-signup
 * Check if email exists, auto-signup if not
 * Body: { email, companyName }
 */
router.post("/check-or-signup", checkOrSignup);

/**
 * POST /api/auth-check/send-otp
 * Send OTP for email verification
 * Body: { email }
 */
router.post("/send-otp", sendOTPQuick);

/**
 * POST /api/auth-check/verify-otp
 * Verify OTP and mark user as verified
 * Body: { email, otp }
 */
router.post("/verify-otp", verifyOTPQuick);

export default router;
