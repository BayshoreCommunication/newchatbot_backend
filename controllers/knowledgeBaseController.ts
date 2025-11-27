import { Request, Response } from "express";
import { OpenAI } from "openai";
import { AssistantModel } from "../models/assistantModel";
import UnknownQuestion from "../models/UnknownQuestion";
import fs from "fs";
import path from "path";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Add new knowledge/answer to the knowledge base
 * This creates a new file with Q&A content and adds it to the vector store
 */
export const addKnowledgeToBase = async (req: Request, res: Response) => {
  try {
    const { assistantId, question, answer, unknownQuestionId } = req.body;

    if (!assistantId || !question || !answer) {
      return res.status(400).json({
        error: "assistantId, question, and answer are required",
      });
    }

    // Find assistant in database
    const assistant = await AssistantModel.findOne({ openaiId: assistantId });
    if (!assistant) {
      return res.status(404).json({ error: "Assistant not found" });
    }

    // Create Q&A content in a format that's easy for file_search
    const qaContent = `
QUESTION: ${question}
ANSWER: ${answer}

---
This information was added to the knowledge base on ${new Date().toISOString()}
`;

    // Create temporary file with the Q&A content
    // Use /tmp for serverless environments (Vercel, AWS Lambda, etc.)
    const tempDir = process.env.VERCEL ? "/tmp" : path.join(__dirname, "..", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const fileName = `qa_${timestamp}.txt`;
    const filePath = path.join(tempDir, fileName);

    fs.writeFileSync(filePath, qaContent, "utf-8");

    console.log(`📝 Created knowledge file: ${fileName}`);

    // Upload file to OpenAI
    const file = await openai.files.create({
      file: fs.createReadStream(filePath),
      purpose: "assistants",
    });

    console.log(`✅ Uploaded to OpenAI: ${file.id}`);

    // Add file to vector store
    if (assistant.vectorStoreIds && assistant.vectorStoreIds.length > 0) {
      const vectorStoreId = assistant.vectorStoreIds[0];

      await (openai as any).vectorStores.files.create(vectorStoreId, {
        file_id: file.id,
      });

      console.log(`✅ Added file to vector store: ${vectorStoreId}`);
    }

    // Update assistant's file list in database
    if (!assistant.fileIds) {
      assistant.fileIds = [];
    }
    assistant.fileIds.push(file.id);
    await assistant.save();

    // Mark unknown question as resolved if provided
    if (unknownQuestionId) {
      await UnknownQuestion.findByIdAndUpdate(unknownQuestionId, {
        resolved: true,
      });
      console.log(`✅ Marked unknown question as resolved: ${unknownQuestionId}`);
    }

    // Clean up temp file
    fs.unlinkSync(filePath);

    res.status(201).json({
      message: "Knowledge added successfully",
      data: {
        fileId: file.id,
        fileName: file.filename,
        question,
        answer,
        vectorStoreId: assistant.vectorStoreIds?.[0],
      },
    });
  } catch (error: any) {
    console.error("Error adding knowledge:", error);
    res.status(500).json({
      error: error.message || "Failed to add knowledge",
    });
  }
};

/**
 * Add multiple Q&A pairs in batch
 */
export const batchAddKnowledge = async (req: Request, res: Response) => {
  try {
    const { assistantId, qaList } = req.body;

    if (!assistantId || !Array.isArray(qaList) || qaList.length === 0) {
      return res.status(400).json({
        error: "assistantId and qaList (array of {question, answer}) are required",
      });
    }

    const assistant = await AssistantModel.findOne({ openaiId: assistantId });
    if (!assistant) {
      return res.status(404).json({ error: "Assistant not found" });
    }

    // Create combined Q&A content
    let combinedContent = `Carter Injury Law - Knowledge Base Update\nAdded: ${new Date().toISOString()}\n\n`;
    combinedContent += "=" .repeat(70) + "\n\n";

    qaList.forEach((qa: any, index: number) => {
      combinedContent += `Q${index + 1}: ${qa.question}\n`;
      combinedContent += `A${index + 1}: ${qa.answer}\n\n`;
      combinedContent += "-".repeat(70) + "\n\n";
    });

    // Create temporary file
    // Use /tmp for serverless environments (Vercel, AWS Lambda, etc.)
    const tempDir = process.env.VERCEL ? "/tmp" : path.join(__dirname, "..", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const fileName = `batch_qa_${timestamp}.txt`;
    const filePath = path.join(tempDir, fileName);

    fs.writeFileSync(filePath, combinedContent, "utf-8");

    console.log(`📝 Created batch knowledge file: ${fileName} with ${qaList.length} Q&A pairs`);

    // Upload to OpenAI
    const file = await openai.files.create({
      file: fs.createReadStream(filePath),
      purpose: "assistants",
    });

    console.log(`✅ Uploaded to OpenAI: ${file.id}`);

    // Add to vector store
    if (assistant.vectorStoreIds && assistant.vectorStoreIds.length > 0) {
      const vectorStoreId = assistant.vectorStoreIds[0];

      await (openai as any).vectorStores.files.create(vectorStoreId, {
        file_id: file.id,
      });

      console.log(`✅ Added file to vector store: ${vectorStoreId}`);
    }

    // Update assistant's file list
    if (!assistant.fileIds) {
      assistant.fileIds = [];
    }
    assistant.fileIds.push(file.id);
    await assistant.save();

    // Clean up temp file
    fs.unlinkSync(filePath);

    res.status(201).json({
      message: `Successfully added ${qaList.length} Q&A pairs to knowledge base`,
      data: {
        fileId: file.id,
        fileName: file.filename,
        qaCount: qaList.length,
        vectorStoreId: assistant.vectorStoreIds?.[0],
      },
    });
  } catch (error: any) {
    console.error("Error in batch add:", error);
    res.status(500).json({
      error: error.message || "Failed to add knowledge in batch",
    });
  }
};

/**
 * Re-scrape website and update knowledge base
 */
export const rescrapeWebsite = async (req: Request, res: Response) => {
  try {
    const { assistantId, websiteUrl } = req.body;

    if (!assistantId || !websiteUrl) {
      return res.status(400).json({
        error: "assistantId and websiteUrl are required",
      });
    }

    res.status(200).json({
      message: "Website re-scraping initiated",
      info: "Use the /api/scrape endpoint to scrape the website, then the training history will be updated automatically",
      websiteUrl,
    });
  } catch (error: any) {
    console.error("Error initiating rescrape:", error);
    res.status(500).json({
      error: error.message || "Failed to initiate rescrape",
    });
  }
};

/**
 * Get knowledge base statistics
 */
export const getKnowledgeBaseStats = async (req: Request, res: Response) => {
  try {
    const { assistantId } = req.params;

    const assistant = await AssistantModel.findOne({ openaiId: assistantId });
    if (!assistant) {
      return res.status(404).json({ error: "Assistant not found" });
    }

    const vectorStoreId = assistant.vectorStoreIds?.[0];
    let vectorStoreInfo = null;

    if (vectorStoreId) {
      const vectorStore = await (openai as any).vectorStores.retrieve(vectorStoreId);
      vectorStoreInfo = {
        id: vectorStore.id,
        name: vectorStore.name,
        fileCount: vectorStore.file_counts?.total || 0,
        status: vectorStore.status,
        createdAt: new Date(vectorStore.created_at * 1000).toISOString(),
      };
    }

    // Get unknown questions count
    const unresolvedCount = await UnknownQuestion.countDocuments({
      assistantId: assistant.openaiId,
      resolved: false,
    });

    const resolvedCount = await UnknownQuestion.countDocuments({
      assistantId: assistant.openaiId,
      resolved: true,
    });

    res.json({
      assistant: {
        id: assistant.openaiId,
        name: assistant.name,
        model: assistant.model,
        totalFiles: assistant.fileIds?.length || 0,
      },
      vectorStore: vectorStoreInfo,
      unknownQuestions: {
        unresolved: unresolvedCount,
        resolved: resolvedCount,
        total: unresolvedCount + resolvedCount,
      },
    });
  } catch (error: any) {
    console.error("Error getting stats:", error);
    res.status(500).json({
      error: error.message || "Failed to get knowledge base stats",
    });
  }
};
