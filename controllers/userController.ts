import { Response } from "express";
import User from "../models/userModel";
import { AuthRequest } from "../middleware/jwtAuth";

/**
 * @desc    Get current user data
 * @route   GET /api/user
 * @access  Private (requires JWT token)
 */
export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    // User is already attached to request by authenticateJWT middleware
    if (!req.user) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Get full user data from database
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Return user data in format expected by frontend
    res.status(200).json({
      payload: {
        user: {
          _id: user._id,
          email: user.email,
          companyName: user.companyName,
          companyType: user.companyType,
          website: user.website,
          avatar: user.avatar,
          googleId: user.googleId,
          subscription: {
            plan: user.subscription.plan,
            startDate: user.subscription.startDate,
            endDate: user.subscription.endDate,
            isActive: user.subscription.isActive,
          },
        },
      },
    });
  } catch (error: any) {
    console.error("Get current user error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc    Get all users (admin only)
 * @route   GET /api/users
 * @access  Private
 */
export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { search = "", page = "1", limit = "10" } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build search query with proper typing
    const searchString = typeof search === "string" ? search : "";
    const searchQuery = searchString
      ? {
          $or: [
            { email: { $regex: searchString, $options: "i" } },
            { companyName: { $regex: searchString, $options: "i" } },
          ],
        }
      : {};

    // Get users with pagination
    const users = await User.find(searchQuery)
      .select("-password")
      .skip(skip)
      .limit(limitNum)
      .sort({ _id: -1 });

    const total = await User.countDocuments(searchQuery);

    res.status(200).json({
      payload: {
        users,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error: any) {
    console.error("Get all users error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc    Delete user by ID
 * @route   DELETE /api/user/:id
 * @access  Private
 */
export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await User.findByIdAndDelete(id);

    res.status(200).json({
      payload: {
        message: "User deleted successfully",
      },
    });
  } catch (error: any) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc    Update user data
 * @route   PUT /api/user
 * @access  Private
 */
export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const allowedUpdates = [
      "companyName",
      "companyType",
      "website",
      "avatar",
    ];
    const updates: any = {};

    // Only allow specific fields to be updated
    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      payload: {
        user,
        message: "User updated successfully",
      },
    });
  } catch (error: any) {
    console.error("Update user error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
