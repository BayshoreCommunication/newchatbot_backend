import express from "express";
import {
  deleteUnknownQuestion,
  getUnknownQuestions,
  markAsResolved,
  saveUnknownQuestion,
} from "../controllers/unknownQuestionController";

const router = express.Router();

// Save unknown question
router.post("/unknown-questions", saveUnknownQuestion);

// Get all unknown questions (with optional filters)
router.get("/unknown-questions", getUnknownQuestions);

// Mark question as resolved
router.patch("/unknown-questions/:id/resolve", markAsResolved);

// Delete unknown question
router.delete("/unknown-questions/:id", deleteUnknownQuestion);

export default router;
