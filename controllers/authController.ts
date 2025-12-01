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
 * @desc    Register a new user
 * @route   POST /api/auth/signup
 * @access  Public
 */
export const signup = async (req: Request, res: Response) => {
  const { email, password, companyName, companyType, website, language, timezone } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Please provide email and password" });
  }

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({
      email,
      password,
      companyName,
      companyType,
      website,
      language,
      timezone,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        email: user.email,
        companyName: user.companyName,
        token: generateToken(user._id.toString()),
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/signin
 * @access  Public
 */
export const signin = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Please provide email and password" });
  }

  try {
    const user = await User.findOne({ email });

    if (user && (await user.comparePassword(password))) {
      res.json({
        _id: user._id,
        email: user.email,
        companyName: user.companyName,
        subscription: user.subscription,
        token: generateToken(user._id.toString()),
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error: error.message });
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
 * @desc    Sync Google user with backend (for NextAuth integration)
 * @route   POST /api/auth/google/sync
 * @access  Public
 */
export const googleSync = async (req: Request, res: Response) => {
  const { googleId, email, name, avatar } = req.body;

  if (!googleId || !email) {
    return res.status(400).json({ message: "Google ID and email are required" });
  }

  try {
    // Check if user already exists by Google ID
    let user = await User.findOne({ googleId });

    if (user) {
      // User exists, update avatar if provided
      if (avatar && !user.avatar) {
        user.avatar = avatar;
        await user.save();
      }

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
      });
    }

    // Check if user exists by email (might have registered with credentials)
    user = await User.findOne({ email });

    if (user) {
      // Link Google ID to existing account
      user.googleId = googleId;
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
      });
    }

    // Create new user
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
    });
  } catch (error: any) {
    console.error("Google sync error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
