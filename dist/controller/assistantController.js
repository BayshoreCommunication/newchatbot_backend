"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFileToAssistant = exports.trainFromWebsite = exports.runThread = exports.retrieveThread = exports.retrieveAssistant = exports.modifyThread = exports.modifyAssistant = exports.listAssistants = exports.listAssistantFiles = exports.getTrainingHistory = exports.getThreadMessages = exports.getRunStatus = exports.deleteThread = exports.deleteFileFromAssistant = exports.deleteAssistant = exports.createThread = exports.createMessage = exports.createAssistant = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const fs_1 = __importDefault(require("fs"));
const openai_1 = __importDefault(require("openai"));
const path_1 = __importDefault(require("path"));
const assistantModel_1 = require("../model/assistantModel");
const openai = new openai_1.default();
const createAssistant = async (req, res) => {
    try {
        const { name, instructions, tools = [], model } = req.body;
        const assistant = await openai.beta.assistants.create({
            name,
            instructions,
            tools,
            model,
        });
        // Store in DB
        const dbAssistant = new assistantModel_1.AssistantModel({
            openaiId: assistant.id,
            name,
            instructions,
            tools,
            model,
            metadata: {
                openaiCreatedAt: assistant.created_at,
                openaiObject: assistant.object,
            },
        });
        await dbAssistant.save();
        res.json({ success: true, assistant: dbAssistant });
    }
    catch (err) {
        console.error("Create assistant error:", err);
        res.status(500).json({
            error: "Failed to create assistant",
            message: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};
exports.createAssistant = createAssistant;
const listAssistants = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const [assistants, total] = await Promise.all([
            assistantModel_1.AssistantModel.find().skip(skip).limit(limit).sort({ createdAt: -1 }),
            assistantModel_1.AssistantModel.countDocuments(),
        ]);
        res.json({
            success: true,
            assistants,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (err) {
        console.error("List assistants error:", err);
        res.status(500).json({
            error: "Failed to fetch assistants",
            message: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};
exports.listAssistants = listAssistants;
const retrieveAssistant = async (req, res) => {
    try {
        const assistant = await assistantModel_1.AssistantModel.findById(req.params.id);
        if (!assistant) {
            res.status(404).json({ error: "Assistant not found" });
            return;
        }
        res.json({ success: true, assistant });
    }
    catch (err) {
        console.error("Retrieve assistant error:", err);
        res.status(500).json({
            error: "Failed to retrieve assistant",
            message: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};
exports.retrieveAssistant = retrieveAssistant;
const modifyAssistant = async (req, res) => {
    try {
        const { name, instructions, tools, model } = req.body;
        const assistant = await assistantModel_1.AssistantModel.findById(req.params.id);
        if (!assistant) {
            res.status(404).json({ error: "Assistant not found" });
            return;
        }
        // Update OpenAI assistant
        await openai.beta.assistants.update(assistant.openaiId, {
            name,
            instructions,
            tools,
            model,
        });
        // Update DB
        const updatedAssistant = await assistantModel_1.AssistantModel.findByIdAndUpdate(req.params.id, { name, instructions, tools, model }, { new: true });
        res.json({ success: true, assistant: updatedAssistant });
    }
    catch (err) {
        console.error("Modify assistant error:", err);
        res.status(500).json({
            error: "Failed to modify assistant",
            message: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};
exports.modifyAssistant = modifyAssistant;
const deleteAssistant = async (req, res) => {
    try {
        const assistant = await assistantModel_1.AssistantModel.findById(req.params.id);
        if (!assistant) {
            res.status(404).json({ error: "Assistant not found" });
            return;
        }
        // Delete from OpenAI
        await openai.beta.assistants.delete(assistant.openaiId);
        // Delete from DB
        await assistantModel_1.AssistantModel.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Assistant deleted successfully" });
    }
    catch (err) {
        console.error("Delete assistant error:", err);
        res.status(500).json({
            error: "Failed to delete assistant",
            message: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};
exports.deleteAssistant = deleteAssistant;
// Upload file to assistant (using file_ids, no vector store)
const uploadFileToAssistant = async (req, res) => {
    try {
        const assistantId = req.params.id;
        const assistant = await assistantModel_1.AssistantModel.findById(assistantId);
        if (!assistant) {
            res.status(404).json({ error: "Assistant not found" });
            return;
        }
        // Check if file was uploaded (this would require multer middleware)
        // For now, return error - file upload needs proper setup
        res.status(400).json({
            error: "File upload not implemented. Use website training instead.",
        });
        return;
        // Note: To implement file upload, you need:
        // 1. Install multer: npm install multer
        // 2. Add multer middleware to the route
        // 3. Then uncomment and fix the code below
        /*
        // Upload file to OpenAI
        const file = await openai.files.create({
          file: fs.createReadStream(req.file.path),
          purpose: "assistants",
        });
    
        // Update assistant to use file_search tool
        const fileIds = Array.isArray(assistant.fileIds) ? [...assistant.fileIds, file.id] : [file.id];
        const hasFileSearch = Array.isArray(assistant.tools) && assistant.tools.some(
          (tool: any) => tool.type === "file_search"
        );
        const updatedTools = hasFileSearch
          ? assistant.tools
          : [...(assistant.tools || []), { type: "file_search" }];
    
        await openai.beta.assistants.update(assistant.openaiId, {
          file_ids: fileIds,
          tools: updatedTools,
        });
    
        // Update database
        const updatedAssistant = await AssistantModel.findByIdAndUpdate(
          assistantId,
          {
            $push: { fileIds: file.id },
            tools: updatedTools,
          },
          { new: true }
        );
    
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
    
        res.json({
          success: true,
          file: {
            id: file.id,
            filename: file.filename,
            bytes: file.bytes,
          },
          assistant: updatedAssistant,
        });
        */
    }
    catch (err) {
        console.error("Upload file error:", err);
        res.status(500).json({
            error: "Failed to upload file",
            message: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};
exports.uploadFileToAssistant = uploadFileToAssistant;
// List files for an assistant
const listAssistantFiles = async (req, res) => {
    try {
        const assistant = await assistantModel_1.AssistantModel.findById(req.params.id);
        if (!assistant) {
            res.status(404).json({ error: "Assistant not found" });
            return;
        }
        const fileIds = assistant.fileIds || [];
        const files = await Promise.all(fileIds.map(async (fileId) => {
            try {
                const file = await openai.files.retrieve(fileId);
                return file;
            }
            catch (err) {
                return null;
            }
        }));
        res.json({
            success: true,
            files: files.filter((f) => f !== null),
        });
    }
    catch (err) {
        console.error("List files error:", err);
        res.status(500).json({
            error: "Failed to list files",
            message: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};
exports.listAssistantFiles = listAssistantFiles;
// Delete file from assistant
const deleteFileFromAssistant = async (req, res) => {
    try {
        const { id: assistantId, fileId } = req.params;
        const assistant = await assistantModel_1.AssistantModel.findById(assistantId);
        if (!assistant) {
            res.status(404).json({ error: "Assistant not found" });
            return;
        }
        // Remove file from assistant in OpenAI
        const fileIds = Array.isArray(assistant.fileIds)
            ? assistant.fileIds.filter((id) => id !== fileId)
            : [];
        // Update assistant with remaining files
        const hasFileSearch = Array.isArray(assistant.tools) &&
            assistant.tools.some((tool) => tool.type === "file_search");
        if (hasFileSearch && fileIds.length > 0) {
            // For OpenAI Assistants, file_ids are managed at the assistant level
            await openai.beta.assistants.update(assistant.openaiId, {
                tools: assistant.tools, // Keep existing tools
            });
        }
        else if (hasFileSearch && fileIds.length === 0) {
            // Remove file_search tool if no files left
            const updatedTools = assistant.tools.filter((tool) => tool.type !== "file_search");
            await openai.beta.assistants.update(assistant.openaiId, {
                tools: updatedTools,
            });
        }
        // Delete file from OpenAI
        try {
            await openai.files.delete(fileId);
        }
        catch (err) {
            // File might already be deleted
        }
        // Update database
        await assistantModel_1.AssistantModel.findByIdAndUpdate(assistantId, {
            $pull: { fileIds: fileId },
        });
        res.json({ success: true, message: "File deleted successfully" });
    }
    catch (err) {
        console.error("Delete file error:", err);
        res.status(500).json({
            error: "Failed to delete file",
            message: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};
exports.deleteFileFromAssistant = deleteFileFromAssistant;
// Train assistant from website (advanced scraping with history)
const trainFromWebsite = async (req, res) => {
    try {
        const assistantId = req.params.id;
        const { websiteUrl } = req.body;
        if (!websiteUrl) {
            res.status(400).json({ error: "Website URL is required" });
            return;
        }
        const assistant = await assistantModel_1.AssistantModel.findById(assistantId);
        if (!assistant) {
            res.status(404).json({ error: "Assistant not found" });
            return;
        }
        const trainingId = `training_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;
        const startTime = new Date();
        try {
            // Use advanced scraper with unlimited pages
            const { scrapeWebsiteOptimized } = await Promise.resolve().then(() => __importStar(require("../services/webScraperService")));
            // Create a mock job for the scraper
            const mockJob = {
                progress: async (progress) => {
                    // Progress tracking
                },
            };
            const scrapeResult = await scrapeWebsiteOptimized(websiteUrl, mockJob);
            if (!scrapeResult.data || Object.keys(scrapeResult.data).length === 0) {
                throw new Error("No content found on website");
            }
            // Convert scraped data to text document
            const pages = Object.entries(scrapeResult.data).map(([url, content]) => ({
                url,
                title: url.split("/").pop() || "Page",
                content,
            }));
            const content = convertPagesToDocument(pages, websiteUrl);
            // Save to temporary file
            const uploadsDir = path_1.default.join(__dirname, "../uploads");
            if (!fs_1.default.existsSync(uploadsDir)) {
                fs_1.default.mkdirSync(uploadsDir, { recursive: true });
            }
            const filename = `training_${trainingId}.txt`;
            const filepath = path_1.default.join(uploadsDir, filename);
            fs_1.default.writeFileSync(filepath, content, "utf-8");
            // Upload to OpenAI
            const file = await openai.files.create({
                file: fs_1.default.createReadStream(filepath),
                purpose: "assistants",
            });
            // Update assistant in OpenAI (add file_id and file_search tool)
            // Clean tools array (remove MongoDB fields and ensure required fields)
            const cleanTools = (assistant.tools || [])
                .map((tool) => {
                // Deep clean to remove all MongoDB-specific fields recursively
                const cleaned = JSON.parse(JSON.stringify(tool, (key, value) => {
                    // Remove MongoDB-specific fields
                    if (key === "_id" ||
                        key === "__v" ||
                        key === "$__" ||
                        key.startsWith("$")) {
                        return undefined;
                    }
                    return value;
                }));
                // Ensure the tool has a type field
                if (!cleaned.type) {
                    console.warn("Tool missing type field:", cleaned);
                    return null; // Filter out invalid tools
                }
                return cleaned;
            })
                .filter(Boolean); // Remove null entries
            const fileIds = Array.isArray(assistant.fileIds)
                ? [...assistant.fileIds, file.id]
                : [file.id];
            const hasFileSearch = Array.isArray(cleanTools) &&
                cleanTools.some((tool) => tool.type === "file_search");
            const updatedTools = hasFileSearch
                ? cleanTools
                : [...cleanTools, { type: "file_search" }];
            await openai.beta.assistants.update(assistant.openaiId, {
                tools: updatedTools,
            });
            const endTime = new Date();
            const duration = ((endTime.getTime() - startTime.getTime()) /
                1000).toFixed(2);
            // Create training session record
            const trainingSession = {
                id: trainingId,
                websiteUrl,
                scrapingMethod: scrapeResult.metadata.scrapingMethod,
                totalUrlsFound: scrapeResult.metadata.totalUrlsFound,
                successfulScrapes: scrapeResult.metadata.successfulScrapes,
                failedScrapes: scrapeResult.metadata.failedScrapes,
                pagesScraped: scrapeResult.metadata.successfulScrapes,
                duration: scrapeResult.metadata.duration,
                startTime: scrapeResult.metadata.startTime,
                endTime: scrapeResult.metadata.endTime,
                fileId: file.id,
                sitemapUrls: scrapeResult.metadata.sitemapUrls,
                status: "completed",
            };
            // Update database with file and training history
            const updatedAssistant = await assistantModel_1.AssistantModel.findByIdAndUpdate(assistantId, {
                $push: {
                    fileIds: file.id,
                    trainingHistory: trainingSession,
                },
                tools: updatedTools,
            }, { new: true });
            // Clean up temp file
            fs_1.default.unlinkSync(filepath);
            res.json({
                success: true,
                message: `Successfully trained assistant with ${scrapeResult.metadata.successfulScrapes} pages from ${websiteUrl}`,
                training: trainingSession,
                file: {
                    id: file.id,
                    filename: file.filename,
                    bytes: file.bytes,
                },
                pagesScraped: scrapeResult.metadata.successfulScrapes,
                scrapingMetadata: scrapeResult.metadata,
                assistant: updatedAssistant,
            });
        }
        catch (scrapeError) {
            const endTime = new Date();
            const duration = ((endTime.getTime() - startTime.getTime()) /
                1000).toFixed(2);
            // Record failed training session
            const failedSession = {
                id: trainingId,
                websiteUrl,
                scrapingMethod: "recursive_crawl",
                totalUrlsFound: 0,
                successfulScrapes: 0,
                failedScrapes: 1,
                pagesScraped: 0,
                duration: `${duration}s`,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                status: "failed",
                error: scrapeError.message,
            };
            await assistantModel_1.AssistantModel.findByIdAndUpdate(assistantId, {
                $push: { trainingHistory: failedSession },
            });
            throw scrapeError;
        }
    }
    catch (err) {
        console.error("Train from website error:", err);
        res.status(500).json({
            error: "Failed to train from website",
            message: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};
exports.trainFromWebsite = trainFromWebsite;
// Helper: Scrape website content
async function scrapeWebsiteContent(websiteUrl, maxPages = 30) {
    const visited = new Set();
    const toVisit = [websiteUrl];
    const pages = [];
    const baseHostname = new URL(websiteUrl).hostname;
    while (toVisit.length > 0 && visited.size < maxPages) {
        const url = toVisit.shift();
        if (!url || visited.has(url))
            continue;
        visited.add(url);
        try {
            const { data: html } = await axios_1.default.get(url, {
                timeout: 10000,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                },
            });
            const $ = cheerio.load(html);
            $("script, style, nav, footer, noscript, iframe").remove();
            const title = $("title").text().trim() || $("h1").first().text().trim() || "Untitled";
            let content = $("body").text();
            content = content.replace(/\s+/g, " ").trim();
            if (content.length > 100) {
                pages.push({ url, title, content });
            }
            // Find internal links
            $("a[href]").each((_, el) => {
                const href = $(el).attr("href");
                if (!href)
                    return;
                let absUrl;
                try {
                    if (href.startsWith("/") && !href.startsWith("//")) {
                        absUrl = new URL(href, websiteUrl).href;
                    }
                    else if (href.startsWith("http")) {
                        absUrl = href;
                    }
                    else if (!href.startsWith("#") &&
                        !href.startsWith("mailto:") &&
                        !href.startsWith("tel:")) {
                        absUrl = new URL(href, url).href;
                    }
                    else {
                        return;
                    }
                    const linkHostname = new URL(absUrl).hostname;
                    if (linkHostname === baseHostname &&
                        !visited.has(absUrl) &&
                        !toVisit.includes(absUrl) &&
                        !absUrl.includes("#") &&
                        !absUrl.match(/\.(pdf|jpg|jpeg|png|gif|zip|doc|docx)$/i)) {
                        toVisit.push(absUrl);
                    }
                }
                catch { }
            });
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
        catch (err) {
            console.error(`Error scraping ${url}:`, err);
        }
    }
    return pages;
}
// Helper: Convert pages to document
function convertPagesToDocument(pages, websiteUrl) {
    const header = `Website Training Data\nSource: ${websiteUrl}\nScraped: ${new Date().toISOString()}\nTotal Pages: ${pages.length}\n\n${"=".repeat(80)}\n\n`;
    const content = pages
        .map((page) => {
        return `PAGE: ${page.title}\nURL: ${page.url}\n${"-".repeat(80)}\n${page.content}\n\n`;
    })
        .join("\n");
    return header + content;
}
// Get training history for an assistant
const getTrainingHistory = async (req, res) => {
    try {
        const assistant = await assistantModel_1.AssistantModel.findById(req.params.id);
        if (!assistant) {
            res.status(404).json({ error: "Assistant not found" });
            return;
        }
        const trainingHistory = assistant.trainingHistory || [];
        // Calculate summary statistics
        const summary = {
            totalSessions: trainingHistory.length,
            successfulSessions: trainingHistory.filter((t) => t.status === "completed").length,
            failedSessions: trainingHistory.filter((t) => t.status === "failed")
                .length,
            totalPagesScraped: trainingHistory.reduce((sum, t) => sum + t.pagesScraped, 0),
            totalUrlsFound: trainingHistory.reduce((sum, t) => sum + t.totalUrlsFound, 0),
            websitesTrained: [...new Set(trainingHistory.map((t) => t.websiteUrl))]
                .length,
            lastTraining: trainingHistory.length > 0
                ? trainingHistory[trainingHistory.length - 1]
                : null,
        };
        res.json({
            success: true,
            summary,
            trainingHistory: trainingHistory.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
        });
    }
    catch (err) {
        console.error("Get training history error:", err);
        res.status(500).json({
            error: "Failed to get training history",
            message: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};
exports.getTrainingHistory = getTrainingHistory;
// Thread Management Functions
const createThread = async (req, res) => {
    try {
        const { messages = [], metadata = {} } = req.body;
        const thread = await openai.beta.threads.create({
            messages,
            metadata,
        });
        res.json({ success: true, thread });
    }
    catch (err) {
        console.error("Create thread error:", err);
        res.status(500).json({
            error: "Failed to create thread",
            message: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};
exports.createThread = createThread;
const retrieveThread = async (req, res) => {
    try {
        const { threadId } = req.params;
        const thread = await openai.beta.threads.retrieve(threadId);
        res.json({ success: true, thread });
    }
    catch (err) {
        console.error("Retrieve thread error:", err);
        res.status(500).json({
            error: "Failed to retrieve thread",
            message: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};
exports.retrieveThread = retrieveThread;
const modifyThread = async (req, res) => {
    try {
        const { threadId } = req.params;
        const { metadata } = req.body;
        const thread = await openai.beta.threads.update(threadId, {
            metadata,
        });
        res.json({ success: true, thread });
    }
    catch (err) {
        console.error("Modify thread error:", err);
        res.status(500).json({
            error: "Failed to modify thread",
            message: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};
exports.modifyThread = modifyThread;
const deleteThread = async (req, res) => {
    try {
        const { threadId } = req.params;
        const deleted = await openai.beta.threads.delete(threadId);
        res.json({ success: true, deleted });
    }
    catch (err) {
        console.error("Delete thread error:", err);
        res.status(500).json({
            error: "Failed to delete thread",
            message: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};
exports.deleteThread = deleteThread;
const createMessage = async (req, res) => {
    try {
        const { threadId } = req.params;
        const { role, content, attachments = [], metadata = {} } = req.body;
        const message = await openai.beta.threads.messages.create(threadId, {
            role,
            content,
            attachments,
            metadata,
        });
        res.json({ success: true, message });
    }
    catch (err) {
        console.error("Create message error:", err);
        res.status(500).json({
            error: "Failed to create message",
            message: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};
exports.createMessage = createMessage;
const runThread = async (req, res) => {
    try {
        const { threadId } = req.params;
        const { assistantId, model, instructions, additional_instructions, metadata = {}, } = req.body;
        const run = await openai.beta.threads.runs.create(threadId, {
            assistant_id: assistantId,
            model,
            instructions,
            additional_instructions,
            metadata,
        });
        res.json({ success: true, run });
    }
    catch (err) {
        console.error("Run thread error:", err);
        res.status(500).json({
            error: "Failed to run thread",
            message: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};
exports.runThread = runThread;
const getThreadMessages = async (req, res) => {
    try {
        const { threadId } = req.params;
        const { limit = 20, order = "desc", after, before } = req.query;
        const messages = await openai.beta.threads.messages.list(threadId, {
            limit: parseInt(limit),
            order: order,
            after: after,
            before: before,
        });
        res.json({ success: true, messages: messages.data });
    }
    catch (err) {
        console.error("Get thread messages error:", err);
        res.status(500).json({
            error: "Failed to get thread messages",
            message: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};
exports.getThreadMessages = getThreadMessages;
const getRunStatus = async (req, res) => {
    try {
        const { threadId, runId } = req.params;
        const run = await openai.beta.threads.runs.retrieve(threadId, runId);
        res.json({ success: true, run });
    }
    catch (err) {
        console.error("Get run status error:", err);
        res.status(500).json({
            error: "Failed to get run status",
            message: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};
exports.getRunStatus = getRunStatus;
