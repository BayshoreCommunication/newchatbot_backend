import express from "express";
import { signup, signin, googleAuth, googleAuthCallback, googleSync } from "../controllers/authController";

const router = express.Router();

// @route   POST /api/auth/signup
// @desc    Register user
// @access  Public
router.post("/signup", signup);

// @route   POST /api/auth/signin
// @desc    Authenticate user and get token
// @access  Public
router.post("/signin", signin);

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
