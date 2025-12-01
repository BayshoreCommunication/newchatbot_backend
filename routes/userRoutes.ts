import express from "express";
import {
  getCurrentUser,
  getAllUsers,
  deleteUser,
  updateUser,
} from "../controllers/userController";
import { authenticateJWT } from "../middleware/jwtAuth";

const router = express.Router();

// @route   GET /api/user
// @desc    Get current user data (requires JWT token)
// @access  Private
router.get("/user", authenticateJWT, getCurrentUser);

// @route   GET /api/users
// @desc    Get all users with pagination and search
// @access  Private
router.get("/users", authenticateJWT, getAllUsers);

// @route   DELETE /api/user/:id
// @desc    Delete user by ID
// @access  Private
router.delete("/user/:id", authenticateJWT, deleteUser);

// @route   PUT /api/user
// @desc    Update current user data
// @access  Private
router.put("/user", authenticateJWT, updateUser);

export default router;
