"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const webScraperService_1 = require("../services/webScraperService");
const router = express_1.default.Router();
// POST /scrape - Start scraping job (returns immediately)
router.post("/scrape", async (req, res) => {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
        return res
            .status(400)
            .json({ error: "Missing or invalid 'url' in request body." });
    }
    try {
        const job = await webScraperService_1.scrapeQueue.add("scrape-website", { url }, {
            attempts: 3,
            backoff: { type: "exponential", delay: 2000 },
            timeout: 600000, // 10 minutes
        });
        return res.json({
            success: true,
            jobId: job.id,
            status: "queued",
            message: "Scraping job started. Use /scrape/status/:jobId to check progress.",
        });
    }
    catch (err) {
        return res
            .status(500)
            .json({ error: err.message || "Failed to queue scraping job." });
    }
});
// GET /scrape/status/:jobId - Check job status
router.get("/status/:jobId", async (req, res) => {
    const { jobId } = req.params;
    try {
        const status = await (0, webScraperService_1.getJobStatus)(jobId);
        return res.json(status);
    }
    catch (err) {
        return res.status(404).json({ error: err.message || "Job not found." });
    }
});
// GET /scrape/result/:jobId - Get completed job results with metadata
router.get("/result/:jobId", async (req, res) => {
    const { jobId } = req.params;
    try {
        const job = await webScraperService_1.scrapeQueue.getJob(jobId);
        if (!job) {
            return res.status(404).json({ error: "Job not found." });
        }
        const state = await job.getState();
        if (state !== "completed") {
            return res.status(400).json({
                error: `Job is not completed yet. Current state: ${state}`,
            });
        }
        const result = job.returnvalue;
        return res.json({
            success: true,
            data: result.data,
            metadata: result.metadata,
            summary: {
                totalPages: result.metadata.totalUrlsFound,
                successful: result.metadata.successfulScrapes,
                failed: result.metadata.failedScrapes,
                method: result.metadata.scrapingMethod,
                duration: result.metadata.duration,
            },
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.default = router;
