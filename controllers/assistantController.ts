import axios from "axios";
import * as cheerio from "cheerio";
import { Request, Response } from "express";
import fs from "fs";
import OpenAI from "openai";
import path from "path";
import { AssistantModel } from "../models/assistantModel";

const openai = new OpenAI();

const createAssistant = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, instructions, tools = [] } = req.body;
    // Fixed model: gpt-4o-mini for cost optimization (90% savings vs gpt-4o)
    const fixedModel = "gpt-4o-mini";

    const assistant = await openai.beta.assistants.create({
      name,
      instructions,
      tools,
      model: fixedModel,
    });
    // Store in DB
    const dbAssistant = new AssistantModel({
      openaiId: assistant.id,
      name,
      instructions,
      tools,
      model: fixedModel,
      metadata: {
        openaiCreatedAt: assistant.created_at,
        openaiObject: assistant.object,
      },
    });
    await dbAssistant.save();
    res.json({ success: true, assistant: dbAssistant });
  } catch (err: any) {
    console.error("Create assistant error:", err);
    res.status(500).json({
      error: "Failed to create assistant",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

const listAssistants = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [assistants, total] = await Promise.all([
      AssistantModel.find().skip(skip).limit(limit).sort({ createdAt: -1 }),
      AssistantModel.countDocuments(),
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
  } catch (err: any) {
    console.error("List assistants error:", err);
    res.status(500).json({
      error: "Failed to fetch assistants",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

const retrieveAssistant = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const assistant = await AssistantModel.findById(req.params.id);
    if (!assistant) {
      res.status(404).json({ error: "Assistant not found" });
      return;
    }
    res.json({ success: true, assistant });
  } catch (err: any) {
    console.error("Retrieve assistant error:", err);
    res.status(500).json({
      error: "Failed to retrieve assistant",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

const modifyAssistant = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, instructions, tools } = req.body;
    const assistant = await AssistantModel.findById(req.params.id);

    if (!assistant) {
      res.status(404).json({ error: "Assistant not found" });
      return;
    }

    // Fixed model: gpt-4o-mini (model cannot be changed)
    const fixedModel = "gpt-4o-mini";

    // Update OpenAI assistant
    await openai.beta.assistants.update(assistant.openaiId, {
      name,
      instructions,
      tools,
      model: fixedModel,
    });

    // Update DB
    const updatedAssistant = await AssistantModel.findByIdAndUpdate(
      req.params.id,
      { name, instructions, tools, model: fixedModel },
      { new: true }
    );

    res.json({ success: true, assistant: updatedAssistant });
  } catch (err: any) {
    console.error("Modify assistant error:", err);
    res.status(500).json({
      error: "Failed to modify assistant",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

const deleteAssistant = async (req: Request, res: Response): Promise<void> => {
  try {
    const assistant = await AssistantModel.findById(req.params.id);

    if (!assistant) {
      res.status(404).json({ error: "Assistant not found" });
      return;
    }

    // Delete from OpenAI
    await openai.beta.assistants.delete(assistant.openaiId);

    // Delete from DB
    await AssistantModel.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "Assistant deleted successfully" });
  } catch (err: any) {
    console.error("Delete assistant error:", err);
    res.status(500).json({
      error: "Failed to delete assistant",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Upload file to assistant (using file_ids, no vector store)
const uploadFileToAssistant = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const assistantId = req.params.id;
    const assistant = await AssistantModel.findById(assistantId);

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
  } catch (err: any) {
    console.error("Upload file error:", err);
    res.status(500).json({
      error: "Failed to upload file",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// List files for an assistant
const listAssistantFiles = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const assistant = await AssistantModel.findById(req.params.id);

    if (!assistant) {
      res.status(404).json({ error: "Assistant not found" });
      return;
    }

    const fileIds = assistant.fileIds || [];
    const files = await Promise.all(
      fileIds.map(async (fileId) => {
        try {
          const file = await openai.files.retrieve(fileId);
          return file;
        } catch (err) {
          return null;
        }
      })
    );

    res.json({
      success: true,
      files: files.filter((f) => f !== null),
    });
  } catch (err: any) {
    console.error("List files error:", err);
    res.status(500).json({
      error: "Failed to list files",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Delete file from assistant
const deleteFileFromAssistant = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id: assistantId, fileId } = req.params;
    const assistant = await AssistantModel.findById(assistantId);

    if (!assistant) {
      res.status(404).json({ error: "Assistant not found" });
      return;
    }

    // Remove file from assistant in OpenAI
    const fileIds = Array.isArray(assistant.fileIds)
      ? assistant.fileIds.filter((id) => id !== fileId)
      : [];

    // Update assistant with remaining files
    const hasFileSearch =
      Array.isArray(assistant.tools) &&
      assistant.tools.some((tool: any) => tool.type === "file_search");
    if (hasFileSearch && fileIds.length > 0) {
      // For OpenAI Assistants, file_ids are managed at the assistant level
      await openai.beta.assistants.update(assistant.openaiId, {
        tools: assistant.tools as any, // Keep existing tools
      });
    } else if (hasFileSearch && fileIds.length === 0) {
      // Remove file_search tool if no files left
      const updatedTools = assistant.tools.filter(
        (tool: any) => tool.type !== "file_search"
      );
      await openai.beta.assistants.update(assistant.openaiId, {
        tools: updatedTools as any,
      });
    }

    // Delete file from OpenAI
    try {
      await openai.files.delete(fileId);
    } catch (err) {
      // File might already be deleted
    }

    // Update database
    await AssistantModel.findByIdAndUpdate(assistantId, {
      $pull: { fileIds: fileId },
    });

    res.json({ success: true, message: "File deleted successfully" });
  } catch (err: any) {
    console.error("Delete file error:", err);
    res.status(500).json({
      error: "Failed to delete file",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Train assistant from website (advanced scraping with history)
const trainFromWebsite = async (req: Request, res: Response): Promise<void> => {
  try {
    const assistantId = req.params.id;
    const { websiteUrl } = req.body;

    if (!websiteUrl) {
      res.status(400).json({ error: "Website URL is required" });
      return;
    }

    const assistant = await AssistantModel.findById(assistantId);
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
      const { scrapeWebsiteOptimized } = await import(
        "../services/webScraperService"
      );

      // Create a mock job for the scraper
      const mockJob = {
        progress: async (progress: number) => {
          // Progress tracking
        },
      };

      const scrapeResult = await scrapeWebsiteOptimized(
        websiteUrl,
        mockJob as any
      );

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
      const uploadsDir = path.join(__dirname, "../uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filename = `training_${trainingId}.txt`;
      const filepath = path.join(uploadsDir, filename);
      fs.writeFileSync(filepath, content, "utf-8");

      // Upload to OpenAI
      const file = await openai.files.create({
        file: fs.createReadStream(filepath),
        purpose: "assistants",
      });

      // Create or update vector store
      let vectorStoreId: string;

      if (assistant.vectorStoreIds && assistant.vectorStoreIds.length > 0) {
        // Use existing vector store and add the new file to it
        vectorStoreId = assistant.vectorStoreIds[0];
        console.log("Adding file to existing vector store:", vectorStoreId);
        await openai.vectorStores.files.create(vectorStoreId, {
          file_id: file.id,
        });
      } else {
        // Create new vector store with the file
        console.log("Creating new vector store");
        const vectorStore = await openai.vectorStores.create({
          name: `${assistant.name} Knowledge Base`,
          file_ids: [file.id],
        });
        vectorStoreId = vectorStore.id;
        console.log("Created vector store:", vectorStoreId);
      }

      // Update assistant in OpenAI (add file_id and file_search tool)
      // Clean tools array (remove MongoDB fields and ensure required fields)
      const cleanTools = (assistant.tools || [])
        .map((tool: any) => {
          // Deep clean to remove all MongoDB-specific fields recursively
          const cleaned = JSON.parse(
            JSON.stringify(tool, (key, value) => {
              // Remove MongoDB-specific fields
              if (
                key === "_id" ||
                key === "__v" ||
                key === "$__" ||
                key.startsWith("$")
              ) {
                return undefined;
              }
              return value;
            })
          );
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
      const hasFileSearch =
        Array.isArray(cleanTools) &&
        cleanTools.some((tool: any) => tool.type === "file_search");
      const updatedTools = hasFileSearch
        ? cleanTools
        : [...cleanTools, { type: "file_search" } as any];

      await openai.beta.assistants.update(assistant.openaiId, {
        tools: updatedTools,
      });

      const endTime = new Date();
      const duration = (
        (endTime.getTime() - startTime.getTime()) /
        1000
      ).toFixed(2);

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
        status: "completed" as const,
      };

      // Update database with file, vector store, and training history
      const updateData: any = {
        $push: {
          fileIds: file.id,
          trainingHistory: trainingSession,
        },
        tools: updatedTools,
      };

      // Add vector store ID if it's a new one
      if (!assistant.vectorStoreIds || assistant.vectorStoreIds.length === 0) {
        updateData.$push.vectorStoreIds = vectorStoreId;
      }

      const updatedAssistant = await AssistantModel.findByIdAndUpdate(
        assistantId,
        updateData,
        { new: true }
      );

      // Clean up temp file
      fs.unlinkSync(filepath);

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
    } catch (scrapeError: any) {
      const endTime = new Date();
      const duration = (
        (endTime.getTime() - startTime.getTime()) /
        1000
      ).toFixed(2);

      // Record failed training session
      const failedSession = {
        id: trainingId,
        websiteUrl,
        scrapingMethod: "recursive_crawl" as const,
        totalUrlsFound: 0,
        successfulScrapes: 0,
        failedScrapes: 1,
        pagesScraped: 0,
        duration: `${duration}s`,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        status: "failed" as const,
        error: scrapeError.message,
      };

      await AssistantModel.findByIdAndUpdate(assistantId, {
        $push: { trainingHistory: failedSession },
      });

      throw scrapeError;
    }
  } catch (err: any) {
    console.error("Train from website error:", err);
    res.status(500).json({
      error: "Failed to train from website",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Helper: Scrape website content
async function scrapeWebsiteContent(websiteUrl: string, maxPages: number = 30) {
  const visited = new Set<string>();
  const toVisit = [websiteUrl];
  const pages: Array<{ url: string; title: string; content: string }> = [];
  const baseHostname = new URL(websiteUrl).hostname;

  while (toVisit.length > 0 && visited.size < maxPages) {
    const url = toVisit.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);

    try {
      const { data: html } = await axios.get(url, {
        timeout: 10000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      const $ = cheerio.load(html);
      $("script, style, nav, footer, noscript, iframe").remove();

      const title =
        $("title").text().trim() || $("h1").first().text().trim() || "Untitled";
      let content = $("body").text();
      content = content.replace(/\s+/g, " ").trim();

      if (content.length > 100) {
        pages.push({ url, title, content });
      }

      // Find internal links
      $("a[href]").each((_: number, el: cheerio.Element) => {
        const href = $(el).attr("href");
        if (!href) return;

        let absUrl: string;
        try {
          if (href.startsWith("/") && !href.startsWith("//")) {
            absUrl = new URL(href, websiteUrl).href;
          } else if (href.startsWith("http")) {
            absUrl = href;
          } else if (
            !href.startsWith("#") &&
            !href.startsWith("mailto:") &&
            !href.startsWith("tel:")
          ) {
            absUrl = new URL(href, url).href;
          } else {
            return;
          }

          const linkHostname = new URL(absUrl).hostname;
          if (
            linkHostname === baseHostname &&
            !visited.has(absUrl) &&
            !toVisit.includes(absUrl) &&
            !absUrl.includes("#") &&
            !absUrl.match(/\.(pdf|jpg|jpeg|png|gif|zip|doc|docx)$/i)
          ) {
            toVisit.push(absUrl);
          }
        } catch {}
      });

      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      console.error(`Error scraping ${url}:`, err);
    }
  }

  return pages;
}

// Helper: Convert pages to document
function convertPagesToDocument(
  pages: Array<{ url: string; title: string; content: string }>,
  websiteUrl: string
): string {
  const header = `Website Training Data\nSource: ${websiteUrl}\nScraped: ${new Date().toISOString()}\nTotal Pages: ${
    pages.length
  }\n\n${"=".repeat(80)}\n\n`;

  const content = pages
    .map((page) => {
      return `PAGE: ${page.title}\nURL: ${page.url}\n${"-".repeat(80)}\n${
        page.content
      }\n\n`;
    })
    .join("\n");

  return header + content;
}

// Get training history for an assistant
const getTrainingHistory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const assistant = await AssistantModel.findById(req.params.id);

    if (!assistant) {
      res.status(404).json({ error: "Assistant not found" });
      return;
    }

    const trainingHistory = assistant.trainingHistory || [];

    // Calculate summary statistics
    const summary = {
      totalSessions: trainingHistory.length,
      successfulSessions: trainingHistory.filter(
        (t) => t.status === "completed"
      ).length,
      failedSessions: trainingHistory.filter((t) => t.status === "failed")
        .length,
      totalPagesScraped: trainingHistory.reduce(
        (sum, t) => sum + t.pagesScraped,
        0
      ),
      totalUrlsFound: trainingHistory.reduce(
        (sum, t) => sum + t.totalUrlsFound,
        0
      ),
      websitesTrained: [...new Set(trainingHistory.map((t) => t.websiteUrl))]
        .length,
      lastTraining:
        trainingHistory.length > 0
          ? trainingHistory[trainingHistory.length - 1]
          : null,
    };

    res.json({
      success: true,
      summary,
      trainingHistory: trainingHistory.sort(
        (a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      ),
    });
  } catch (err: any) {
    console.error("Get training history error:", err);
    res.status(500).json({
      error: "Failed to get training history",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Thread Management Functions
const createThread = async (req: Request, res: Response): Promise<void> => {
  try {
    const { messages = [], metadata = {} } = req.body;

    const thread = await openai.beta.threads.create({
      messages,
      metadata,
    });

    res.json({ success: true, thread });
  } catch (err: any) {
    console.error("Create thread error:", err);
    res.status(500).json({
      error: "Failed to create thread",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

const retrieveThread = async (req: Request, res: Response): Promise<void> => {
  try {
    const { threadId } = req.params;

    const thread = await openai.beta.threads.retrieve(threadId);

    res.json({ success: true, thread });
  } catch (err: any) {
    console.error("Retrieve thread error:", err);
    res.status(500).json({
      error: "Failed to retrieve thread",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

const modifyThread = async (req: Request, res: Response): Promise<void> => {
  try {
    const { threadId } = req.params;
    const { metadata } = req.body;

    const thread = await openai.beta.threads.update(threadId, {
      metadata,
    });

    res.json({ success: true, thread });
  } catch (err: any) {
    console.error("Modify thread error:", err);
    res.status(500).json({
      error: "Failed to modify thread",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

const deleteThread = async (req: Request, res: Response): Promise<void> => {
  try {
    const { threadId } = req.params;

    const deleted = await openai.beta.threads.delete(threadId);

    res.json({ success: true, deleted });
  } catch (err: any) {
    console.error("Delete thread error:", err);
    res.status(500).json({
      error: "Failed to delete thread",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

const createMessage = async (req: Request, res: Response): Promise<void> => {
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
  } catch (err: any) {
    console.error("Create message error:", err);
    res.status(500).json({
      error: "Failed to create message",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

const runThread = async (req: Request, res: Response): Promise<void> => {
  try {
    const { threadId } = req.params;
    const {
      assistantId,
      model,
      instructions,
      additional_instructions,
      metadata = {},
    } = req.body;

    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
      model,
      instructions,
      additional_instructions,
      metadata,
    });

    res.json({ success: true, run });
  } catch (err: any) {
    console.error("Run thread error:", err);
    res.status(500).json({
      error: "Failed to run thread",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

const getThreadMessages = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { threadId } = req.params;
    const { limit = 20, order = "desc", after, before } = req.query;

    const messages = await openai.beta.threads.messages.list(threadId, {
      limit: parseInt(limit as string),
      order: order as "asc" | "desc",
      after: after as string,
      before: before as string,
    });

    res.json({ success: true, messages: messages.data });
  } catch (err: any) {
    console.error("Get thread messages error:", err);
    res.status(500).json({
      error: "Failed to get thread messages",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

const getRunStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { threadId, runId } = req.params;

    const run = await openai.beta.threads.runs.retrieve(
      threadId as any,
      runId as any
    );

    res.json({ success: true, run });
  } catch (err: any) {
    console.error("Get run status error:", err);
    res.status(500).json({
      error: "Failed to get run status",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

export {
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
  uploadFileToAssistant,
};
