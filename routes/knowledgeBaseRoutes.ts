import express from "express";
import {
  addKnowledgeToBase,
  batchAddKnowledge,
  rescrapeWebsite,
  getKnowledgeBaseStats,
} from "../controllers/knowledgeBaseController";

const router = express.Router();

/**
 * POST /api/knowledge/add
 * Add single Q&A to knowledge base
 * Body: { assistantId, question, answer, unknownQuestionId? }
 */
router.post("/knowledge/add", addKnowledgeToBase);

/**
 * POST /api/knowledge/batch
 * Add multiple Q&A pairs to knowledge base
 * Body: { assistantId, qaList: [{question, answer}, ...] }
 */
router.post("/knowledge/batch", batchAddKnowledge);

/**
 * POST /api/knowledge/rescrape
 * Re-scrape website to update knowledge base
 * Body: { assistantId, websiteUrl }
 */
router.post("/knowledge/rescrape", rescrapeWebsite);

/**
 * GET /api/knowledge/stats/:assistantId
 * Get knowledge base statistics
 */
router.get("/knowledge/stats/:assistantId", getKnowledgeBaseStats);

export default router;
