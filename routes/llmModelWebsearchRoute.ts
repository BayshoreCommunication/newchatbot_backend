import express from "express";
import {
  buildKnowledgeBase,
  checkKnowledgeBase,
  deleteKnowledgeBase,
  getKnowledgeBase,
  queryKnowledgeBase,
  updateKnowledgeBase,
} from "../controllers/llmModelWebsearchController";
import { authenticateJWT } from "../middleware/jwtAuth";

const router = express.Router();

// ==========================================
// KNOWLEDGE BASE CHECK
// ==========================================

/**
 * GET /api/web-search/check-knowledge-base
 * Check if user has existing knowledge base
 * - Uses userId from JWT
 * - Returns knowledge base status and quality
 */
router.get("/check-knowledge-base", authenticateJWT, checkKnowledgeBase);

// ==========================================
// KNOWLEDGE BASE CRUD OPERATIONS
// ==========================================

/**
 * POST /api/web-search/knowledgebase
 * Create new knowledge base
 * - Uses userId from JWT
 * - Scrapes websites
 * - Performs web search
 * - Stores in MongoDB
 * - Indexes in Pinecone
 */
router.post("/knowledgebase", authenticateJWT, buildKnowledgeBase);

/**
 * GET /api/web-search/knowledgebase
 * Get knowledge base for authenticated user
 * - Uses userId from JWT
 * - Retrieves from MongoDB
 */
router.get("/knowledgebase", authenticateJWT, getKnowledgeBase);

/**
 * PUT /api/web-search/knowledgebase
 * Update existing knowledge base
 * - Uses userId from JWT
 * - Adds new sources
 * - Re-indexes in Pinecone
 * - Updates MongoDB
 */
router.put("/knowledgebase", authenticateJWT, updateKnowledgeBase);

/**
 * DELETE /api/web-search/knowledgebase
 * Delete knowledge base
 * - Uses userId from JWT
 * - Removes from Pinecone
 * - Archives in MongoDB
 */
router.delete("/knowledgebase", authenticateJWT, deleteKnowledgeBase);

// ==========================================
// VECTOR SEARCH OPERATIONS
// ==========================================

/**
 * POST /api/web-search/knowledgebase/query
 * Query knowledge base with semantic search
 * - Uses userId from JWT
 * - Searches Pinecone vectors
 * - Returns relevant chunks
 */
router.post("/knowledgebase/query", authenticateJWT, queryKnowledgeBase);

export default router;
