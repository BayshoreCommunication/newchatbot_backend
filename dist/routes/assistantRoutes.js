"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const assistantController_1 = require("../controller/assistantController");
const validateAssistant_1 = require("../middleware/validateAssistant");
const router = express_1.default.Router();
// Apply authentication to all routes (optional - comment out if not needed)
// router.use(authenticateApiKey);
// Create Assistant
router.post("/assistant", validateAssistant_1.validateCreateAssistant, assistantController_1.createAssistant);
// List Assistants (with pagination support: ?page=1&limit=10)
router.get("/assistant", assistantController_1.listAssistants);
// Retrieve Assistant
router.get("/assistant/:id", validateAssistant_1.validateIdParam, assistantController_1.retrieveAssistant);
// Modify Assistant
router.put("/assistant/:id", validateAssistant_1.validateIdParam, validateAssistant_1.validateUpdateAssistant, assistantController_1.modifyAssistant);
// Delete Assistant
router.delete("/assistant/:id", validateAssistant_1.validateIdParam, assistantController_1.deleteAssistant);
// Train from Website
router.post("/assistant/:id/train-website", validateAssistant_1.validateIdParam, assistantController_1.trainFromWebsite);
// Get Training History
router.get("/assistant/:id/training-history", validateAssistant_1.validateIdParam, assistantController_1.getTrainingHistory);
// File Management
router.get("/assistant/:id/files", validateAssistant_1.validateIdParam, assistantController_1.listAssistantFiles);
router.delete("/assistant/:id/files/:fileId", validateAssistant_1.validateIdParam, assistantController_1.deleteFileFromAssistant);
// Thread Management Routes
// Create Thread
router.post("/threads", assistantController_1.createThread);
// Retrieve Thread
router.get("/threads/:threadId", assistantController_1.retrieveThread);
// Modify Thread
router.put("/threads/:threadId", assistantController_1.modifyThread);
// Delete Thread
router.delete("/threads/:threadId", assistantController_1.deleteThread);
// Create Message in Thread
router.post("/threads/:threadId/messages", assistantController_1.createMessage);
// Run Thread with Assistant
router.post("/threads/:threadId/runs", assistantController_1.runThread);
// Get Thread Messages (with pagination: ?limit=20&order=desc&after=msg_id&before=msg_id)
router.get("/threads/:threadId/messages", assistantController_1.getThreadMessages);
// Get Run Status
router.get("/threads/:threadId/runs/:runId", assistantController_1.getRunStatus);
exports.default = router;
