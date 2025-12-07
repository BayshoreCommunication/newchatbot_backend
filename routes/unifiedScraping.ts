import express from "express";
import {
  processCompanyForLLM,
  getUserScrapingData,
  getScrapingDataById,
  getScrapingChunks,
  getCompanyChunksByUser,
  deleteScrapingData,
  getUserScrapingStats,
} from "../controllers/unifiedScrapingController";
import { authenticateJWT } from "../middleware/jwtAuth";

const router = express.Router();

/**
 * @route   POST /api/unified-scraping/process
 * @desc    🚀 ALL-IN-ONE: Search Google + Deep Scrape + Return LLM-Ready Data
 * @access  Private (Authenticated users only)
 */
router.post("/process", authenticateJWT, processCompanyForLLM);

/**
 * @route   GET /api/unified-scraping/user
 * @desc    Get all scraping data for the authenticated user
 * @query   limit, page, status, companyName
 * @access  Private (Authenticated users only)
 */
router.get("/user", authenticateJWT, getUserScrapingData);

/**
 * @route   GET /api/unified-scraping/user/stats
 * @desc    Get scraping statistics for the authenticated user
 * @access  Private (Authenticated users only)
 */
router.get("/user/stats", authenticateJWT, getUserScrapingStats);

/**
 * @route   GET /api/unified-scraping/:id
 * @desc    Get single scraping data by ID with full details
 * @access  Private (Authenticated users only - user must own the data)
 */
router.get("/:id", authenticateJWT, getScrapingDataById);

/**
 * @route   GET /api/unified-scraping/:id/chunks
 * @desc    Get LLM-ready chunks for a specific scraping session
 * @access  Private (Authenticated users only - user must own the data)
 */
router.get("/:id/chunks", authenticateJWT, getScrapingChunks);

/**
 * @route   GET /api/unified-scraping/company/:companyName/chunks
 * @desc    Get all chunks for a company (most recent scraping session)
 * @access  Private (Authenticated users only)
 */
router.get("/company/:companyName/chunks", authenticateJWT, getCompanyChunksByUser);

/**
 * @route   DELETE /api/unified-scraping/:id
 * @desc    Delete scraping data by ID
 * @access  Private (Authenticated users only - user must own the data)
 */
router.delete("/:id", authenticateJWT, deleteScrapingData);

export default router;
