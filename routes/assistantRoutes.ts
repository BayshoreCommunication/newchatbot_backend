import express from "express";
import {
  createAssistant,
  createMessage,
  createThread,
  deleteAssistant,
  deleteFileFromAssistant,
  deleteThread,
  getRunStatus,
  getThreadMessages,
  getTrainingHistory,
  listAssistantFiles,
  listAssistants,
  modifyAssistant,
  modifyThread,
  retrieveAssistant,
  retrieveThread,
  runThread,
  trainFromWebsite,
} from "../controller/assistantController";
import {
  validateCreateAssistant,
  validateIdParam,
  validateUpdateAssistant,
} from "../middleware/validateAssistant";

const router = express.Router();

// Apply authentication to all routes (optional - comment out if not needed)
// router.use(authenticateApiKey);

// Create Assistant
router.post("/assistant", validateCreateAssistant, createAssistant);

// List Assistants (with pagination support: ?page=1&limit=10)
router.get("/assistant", listAssistants);

// Retrieve Assistant
router.get("/assistant/:id", validateIdParam, retrieveAssistant);

// Modify Assistant
router.put(
  "/assistant/:id",
  validateIdParam,
  validateUpdateAssistant,
  modifyAssistant
);

// Delete Assistant
router.delete("/assistant/:id", validateIdParam, deleteAssistant);

// Train from Website
router.post("/assistant/:id/train-website", validateIdParam, trainFromWebsite);

// Get Training History
router.get(
  "/assistant/:id/training-history",
  validateIdParam,
  getTrainingHistory
);

// File Management
router.get("/assistant/:id/files", validateIdParam, listAssistantFiles);
router.delete(
  "/assistant/:id/files/:fileId",
  validateIdParam,
  deleteFileFromAssistant
);

// Thread Management Routes
// Create Thread
router.post("/threads", createThread);

// Retrieve Thread
router.get("/threads/:threadId", retrieveThread);

// Modify Thread
router.put("/threads/:threadId", modifyThread);

// Delete Thread
router.delete("/threads/:threadId", deleteThread);

// Create Message in Thread
router.post("/threads/:threadId/messages", createMessage);

// Run Thread with Assistant
router.post("/threads/:threadId/runs", runThread);

// Get Thread Messages (with pagination: ?limit=20&order=desc&after=msg_id&before=msg_id)
router.get("/threads/:threadId/messages", getThreadMessages);

// Get Run Status
router.get("/threads/:threadId/runs/:runId", getRunStatus);

export default router;
