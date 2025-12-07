import { Request, Response } from "express";
import User, { IUser } from "../models/userModel";
import jwt from "jsonwebtoken";
import passport from "passport";

// Helper to generate JWT
const generateToken = (id: string) => {
  return jwt.sign({ id }, process.env.JWT_SECRET as string, {
    expiresIn: "30d",
  });
};

/**
 * @desc    Register a new user (DEPRECATED - Use OTP flow instead)
 * @route   POST /api/auth/signup
 * @access  Public
 * @deprecated Use /api/auth/send-otp and /api/auth/verify-otp instead
 */
export const signup = async (req: Request, res: Response) => {
  return res.status(403).json({
    success: false,
    message: "Direct signup is disabled. Please use OTP verification flow.",
    instructions: {
      step1: "Send POST to /api/auth/send-otp with { email }",
      step2: "Check your email for OTP (valid for 2 minutes)",
      step3: "Send POST to /api/auth/verify-otp with { email, otp, password, companyName, ... }"
    }
  });
};

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/signin
 * @access  Public
 */
export const signin = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  console.log("🔐 [Backend signin] Request received for:", email);

  if (!email || !password) {
    console.log("❌ [Backend signin] Missing credentials");
    return res.status(400).json({ message: "Please provide email and password" });
  }

  try {
    console.log("🔍 [Backend signin] Looking up user in database...");
    const user = await User.findOne({ email });

    if (!user) {
      console.log("❌ [Backend signin] User not found");
      return res.status(401).json({ message: "Invalid email or password" });
    }

    console.log("✅ [Backend signin] User found, comparing password...");
    const isPasswordValid = await user.comparePassword(password);

    if (isPasswordValid) {
      console.log("✅ [Backend signin] Password valid, generating token...");
      const token = generateToken(user._id.toString());

      const response = {
        _id: user._id,
        email: user.email,
        companyName: user.companyName,
        subscription: user.subscription,
        token: token,
      };

      console.log("✅ [Backend signin] Sending success response:", {
        _id: response._id,
        email: response.email,
        hasToken: !!response.token,
      });

      return res.json(response);
    } else {
      console.log("❌ [Backend signin] Invalid password");
      return res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error: any) {
    console.error("💥 [Backend signin] Exception:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc    Authenticate with Google
 * @route   GET /api/auth/google
 * @access  Public
 */
export const googleAuth = passport.authenticate("google", { scope: ["profile", "email"] });

/**
 * @desc    Google auth callback
 * @route   GET /api/auth/google/callback
 * @access  Public
 */
export const googleAuthCallback = (req: Request, res: Response) => {
    passport.authenticate("google", { failureRedirect: "/login" }, (err: any, user: IUser, info: any) => {
        if (err) {
            return res.status(500).json({ message: "Error authenticating with Google", error: err.message });
        }
        if (!user) {
            return res.status(401).json({ message: "Google authentication failed" });
        }
        // On success, Passport adds the user to the request object.
        // We can generate a token and send it back.
        const token = generateToken(user._id.toString());
        // You might want to redirect the user to a frontend page with the token
        // e.g., res.redirect(`https://yourfrontend.com/dashboard?token=${token}`);
        res.status(200).json({
            _id: user._id,
            email: user.email,
            token: token
        });
    })(req, res);
};

/**
 * @desc    Google Login/Signup (Single route for both signin and signup)
 * @route   POST /api/auth/google/sync
 * @access  Public
 * @info    Automatically handles both login and signup:
 *          - If email exists in database → Login (return existing user + token)
 *          - If email doesn't exist → Signup (create new user + return token)
 */
export const googleSync = async (req: Request, res: Response) => {
  const { googleId, email, name, avatar } = req.body;

  if (!googleId || !email) {
    return res.status(400).json({ message: "Google ID and email are required" });
  }

  try {
    // Check if user exists by email (primary identifier)
    let user = await User.findOne({ email });

    if (user) {
      // ===== USER EXISTS - SIGNIN FLOW =====
      // Update Google ID if not already linked
      if (!user.googleId) {
        user.googleId = googleId;
      }

      // Update avatar if not already set
      if (avatar && !user.avatar) {
        user.avatar = avatar;
      }

      await user.save();

      const token = generateToken(user._id.toString());
      return res.status(200).json({
        user: {
          _id: user._id,
          email: user.email,
          companyName: user.companyName,
          companyType: user.companyType,
          website: user.website,
          avatar: user.avatar,
          subscription: user.subscription,
        },
        token,
        isNewUser: false,
      });
    }

    // ===== USER DOESN'T EXIST - SIGNUP FLOW =====
    const newUser = await User.create({
      googleId,
      email,
      companyName: name || email.split("@")[0],
      avatar,
      subscription: {
        plan: "none",
        isActive: false,
      },
    });

    const token = generateToken(newUser._id.toString());
    return res.status(201).json({
      user: {
        _id: newUser._id,
        email: newUser.email,
        companyName: newUser.companyName,
        companyType: newUser.companyType,
        website: newUser.website,
        avatar: newUser.avatar,
        subscription: newUser.subscription,
      },
      token,
      isNewUser: true,
    });
  } catch (error: any) {
    console.error("Google auth error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
