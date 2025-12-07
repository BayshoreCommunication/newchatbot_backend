import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import axios from "axios";
import * as cheerio from "cheerio";
import { Request, Response } from "express";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import OpenAI from "openai";
import KnowledgeBase from "../models/knowledgeBaseModel";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);

// Enhanced system prompt for knowledge base extraction
const KNOWLEDGE_BASE_SYSTEM_PROMPT = `You are an expert AI assistant specialized in extracting and structuring company information for knowledge bases.

Your task is to analyze website content and extract the following information in a clear, structured JSON format:

{
  "companyOverview": "A comprehensive overview of the company (2-3 paragraphs)",
  "services": ["Service 1", "Service 2", ...],
  "products": ["Product 1", "Product 2", ...],
  "contactInfo": {
    "email": "contact@example.com",
    "phone": "+1234567890",
    "address": "Full address",
    "socialMedia": {
      "linkedin": "URL",
      "twitter": "URL",
      "facebook": "URL"
    }
  },
  "keyFeatures": ["Feature 1", "Feature 2", ...],
  "pricing": "Pricing information if available",
  "faqs": [
    {"question": "Q1?", "answer": "A1"},
    {"question": "Q2?", "answer": "A2"}
  ],
  "additionalInfo": {
    "mission": "Company mission",
    "values": ["Value 1", "Value 2"],
    "achievements": ["Achievement 1", "Achievement 2"],
    "teamSize": "Number of employees",
    "foundedYear": "Year",
    "industries": ["Industry 1", "Industry 2"]
  }
}

Instructions:
- Extract ONLY factual information present in the content
- Use null for missing information instead of guessing
- Be comprehensive but concise
- Organize information logically
- Focus on information useful for customer support and sales
- Return valid JSON only, no additional text`;

/**
 * Check if user has existing knowledge base
 * GET /api/web-search/check-knowledge-base
 */
export const checkKnowledgeBase = async (req: any, res: Response) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User authentication required",
      });
    }

    const knowledgeBase = await KnowledgeBase.findOne({
      userId,
      status: "active",
    });

    if (!knowledgeBase) {
      return res.status(200).json({
        success: true,
        hasKnowledgeBase: false,
        message: "No knowledge base found",
      });
    }

    // Calculate quality percentage
    const qualityScore = knowledgeBase.metadata?.quality || "low";
    const qualityPercentage =
      knowledgeBase.metadata?.qualityPercentage ||
      (qualityScore === "high" ? 85 : qualityScore === "medium" ? 55 : 25);

    return res.status(200).json({
      success: true,
      hasKnowledgeBase: true,
      knowledgeBase: {
        id: knowledgeBase._id,
        companyName: knowledgeBase.companyName,
        sources: knowledgeBase.sources,
        totalSources: knowledgeBase.sources?.length || 0,
        quality: qualityScore,
        qualityPercentage,
        createdAt: knowledgeBase.createdAt,
        updatedAt: knowledgeBase.updatedAt,
        vectorStoreId: knowledgeBase.vectorStoreId,
        status: knowledgeBase.status,
        version: knowledgeBase.metadata?.version || 1,
        updateHistory: knowledgeBase.metadata?.updateHistory || [],
      },
    });
  } catch (error: unknown) {
    console.error("❌ Check knowledge base error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
};

/**
 * Build comprehensive knowledge base for AI Assistant
 * This is the main endpoint for collecting and structuring company information
 */
export const buildKnowledgeBase = async (req: any, res: Response) => {
  try {
    const { companyName, website, additionalUrls, model } = req.body;
    const userId = req.user?._id || req.user?.id; // Get userId from JWT

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User authentication required",
      });
    }

    if (!companyName) {
      return res.status(400).json({
        success: false,
        error: "Company name is required",
      });
    }

    const selectedModel =
      model && ["gpt-5", "gpt-4o", "gpt-4o-mini"].includes(model)
        ? model
        : "gpt-5";

    console.log(
      `🚀 Building knowledge base for ${companyName} (User: ${userId})`
    );

    // Initialize knowledge base document
    let knowledgeBase = await KnowledgeBase.findOne({
      userId,
      status: "active",
    });

    if (!knowledgeBase) {
      knowledgeBase = new KnowledgeBase({
        userId,
        companyName,
        sources: [],
        structuredData: {},
        rawContent: "",
        status: "processing",
        metadata: {
          totalSources: 0,
          lastUpdated: new Date(),
          version: 1,
          model: selectedModel,
          quality: "medium",
        },
      });
    } else {
      knowledgeBase.status = "processing";
      knowledgeBase.metadata.version += 1;
    }

    await knowledgeBase.save();

    const sources = [];
    let combinedContent = "";

    // Step 1: Scrape primary website
    if (website) {
      try {
        console.log(`📄 Scraping primary website: ${website}`);
        const websiteContent = await scrapeWebsite(website);
        sources.push({
          type: "website" as const,
          url: website,
          content: websiteContent,
          processedAt: new Date(),
        });
        combinedContent += `\n\n=== PRIMARY WEBSITE (${website}) ===\n${websiteContent}`;
      } catch (error: any) {
        console.error(`Failed to scrape ${website}:`, error.message);
      }
    }

    // Step 2: Scrape additional URLs
    if (additionalUrls && Array.isArray(additionalUrls)) {
      for (const url of additionalUrls.slice(0, 5)) {
        // Limit to 5 additional URLs
        try {
          console.log(`📄 Scraping additional URL: ${url}`);
          const content = await scrapeWebsite(url);
          sources.push({
            type: "website" as const,
            url,
            content,
            processedAt: new Date(),
          });
          combinedContent += `\n\n=== ADDITIONAL SOURCE (${url}) ===\n${content}`;
        } catch (error: any) {
          console.error(`Failed to scrape ${url}:`, error.message);
        }
      }
    }

    // Step 3: Perform web search for additional context
    try {
      console.log(`🔍 Performing web search for: ${companyName}`);
      const searchQuery = `Comprehensive information about ${companyName} company including services, products, contact information, reviews, and company details`;

      const searchResponse = await client.chat.completions.create({
        model: selectedModel,
        messages: [
          {
            role: "system",
            content: `You are a research assistant. Search and compile comprehensive, factual information about the company. Include services, products, contact details, social media, company background, and any relevant business information.`,
          },
          {
            role: "user",
            content: searchQuery,
          },
        ],
      });

      const webSearchResults = searchResponse.choices[0].message.content || "";
      sources.push({
        type: "web_search" as const,
        searchQuery,
        content: webSearchResults,
        processedAt: new Date(),
      });
      combinedContent += `\n\n=== WEB SEARCH RESULTS ===\n${webSearchResults}`;
    } catch (error: any) {
      console.error("Web search failed:", error.message);
    }

    if (sources.length === 0) {
      throw new Error("Failed to collect any information sources");
    }

    // Step 4: Structure the data with OpenAI
    console.log(`🧠 Processing and structuring data with ${selectedModel}...`);

    const structuringResponse = await client.chat.completions.create({
      model: selectedModel,
      messages: [
        {
          role: "system",
          content: KNOWLEDGE_BASE_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Company: ${companyName}\n\nCollected Information:\n${combinedContent.substring(
            0,
            50000
          )}\n\nExtract and structure all relevant information in JSON format.`,
        },
      ],
      response_format: { type: "json_object" },
    });

    let structuredData = {};
    try {
      const responseContent =
        structuringResponse.choices[0].message.content || "{}";
      structuredData = JSON.parse(responseContent);
    } catch (error) {
      console.error("Failed to parse structured data, using raw response");
      structuredData = {
        companyOverview: structuringResponse.choices[0].message.content || "",
      };
    }

    // Merge with existing structured data for updates (cumulative approach)
    const previousStructuredData = knowledgeBase.structuredData || {};
    if (knowledgeBase.metadata.version > 1) {
      console.log("📚 Merging with existing knowledge base data...");
      structuredData = {
        companyOverview:
          (structuredData as any).companyOverview ||
          previousStructuredData.companyOverview,
        services: [
          ...new Set([
            ...(previousStructuredData.services || []),
            ...((structuredData as any).services || []),
          ]),
        ],
        products: [
          ...new Set([
            ...(previousStructuredData.products || []),
            ...((structuredData as any).products || []),
          ]),
        ],
        contactInfo: {
          ...(previousStructuredData.contactInfo || {}),
          ...((structuredData as any).contactInfo || {}),
        },
        keyFeatures: [
          ...new Set([
            ...(previousStructuredData.keyFeatures || []),
            ...((structuredData as any).keyFeatures || []),
          ]),
        ],
        pricing:
          (structuredData as any).pricing || previousStructuredData.pricing,
        faqs: [
          ...(previousStructuredData.faqs || []),
          ...((structuredData as any).faqs || []),
        ],
        additionalInfo: {
          ...(previousStructuredData.additionalInfo || {}),
          ...((structuredData as any).additionalInfo || {}),
        },
      };
    }

    // Step 5: Calculate quality score with improvement consideration
    const newQuality = calculateQualityScore(
      structuredData,
      sources.length,
      knowledgeBase.metadata.version > 1 ? previousStructuredData : undefined
    );
    const newQualityPercentage = calculateQualityPercentage(newQuality);

    // For updates, ensure quality doesn't decrease (can only improve or stay same)
    const previousQuality = knowledgeBase.metadata?.quality;
    const previousQualityPercentage =
      knowledgeBase.metadata?.qualityPercentage || 0;

    let quality = newQuality;
    let qualityPercentage = newQualityPercentage;

    // If this is an update (version > 1), ensure quality doesn't decrease
    if (
      knowledgeBase.metadata.version > 1 &&
      previousQualityPercentage > newQualityPercentage
    ) {
      quality = previousQuality || newQuality;
      qualityPercentage = previousQualityPercentage;
      console.log(
        `📊 Quality maintained at ${quality} (${qualityPercentage}%) - preventing quality decrease`
      );
    } else if (
      knowledgeBase.metadata.version > 1 &&
      newQualityPercentage > previousQualityPercentage
    ) {
      console.log(
        `📈 Quality improved from ${previousQuality} (${previousQualityPercentage}%) to ${quality} (${qualityPercentage}%)`
      );
    } else {
      console.log(`📊 Quality score: ${quality} (${qualityPercentage}%)`);
    }

    // Step 6: Store in Pinecone Vector Database
    console.log(`🌲 Storing knowledge base in Pinecone vector database...`);
    let vectorStoreId = null;
    try {
      vectorStoreId = await storeKnowledgeBaseInPinecone(
        combinedContent,
        structuredData,
        companyName,
        userId.toString()
      );
      console.log(`✅ Vector storage successful: ${vectorStoreId}`);
    } catch (error: any) {
      console.error("⚠️ Vector storage failed:", error.message);
      // Continue even if vector storage fails
    }

    // Step 7: Update knowledge base in MongoDB with history tracking
    const previousVersion = knowledgeBase.metadata.version;
    const previousSources = knowledgeBase.sources?.length || 0;

    knowledgeBase.sources = sources;
    knowledgeBase.structuredData = structuredData;
    knowledgeBase.rawContent = combinedContent;
    knowledgeBase.vectorStoreId = vectorStoreId || undefined;
    knowledgeBase.status = "active";

    // Track update history
    const updateHistory = knowledgeBase.metadata.updateHistory || [];
    const changes =
      previousVersion === 1
        ? "Initial knowledge base creation"
        : `Updated from v${previousVersion}: Sources ${previousSources}→${sources.length}, Quality ${previousQuality}→${quality}`;

    updateHistory.push({
      version: previousVersion,
      updatedAt: new Date(),
      totalSources: sources.length,
      quality,
      qualityPercentage,
      changes,
    });

    knowledgeBase.metadata = {
      totalSources: sources.length,
      lastUpdated: new Date(),
      version: knowledgeBase.metadata.version,
      model: selectedModel,
      tokenCount: Math.ceil(combinedContent.length / 4),
      quality,
      qualityPercentage,
      updateHistory,
    };

    await knowledgeBase.save();

    console.log(
      `✅ Knowledge base built successfully for ${companyName} (ID: ${knowledgeBase._id})`
    );

    return res.status(200).json({
      success: true,
      message: "Knowledge base built and ready for AI assistant",
      knowledgeBase: {
        id: knowledgeBase._id,
        companyName,
        totalSources: sources.length,
        quality,
        qualityPercentage: calculateQualityPercentage(quality),
        vectorStoreId: vectorStoreId,
        structuredData,
        metadata: knowledgeBase.metadata,
      },
    });
  } catch (error: any) {
    console.error("❌ Error building knowledge base:", error);

    // Update knowledge base status to failed if it exists
    if (req.user?._id || req.user?.id) {
      await KnowledgeBase.findOneAndUpdate(
        { userId: req.user._id || req.user.id, status: "processing" },
        { status: "failed" }
      );
    }

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to build knowledge base",
    });
  }
};

/**
 * Get knowledge base for a user
 */
export const getKnowledgeBase = async (req: any, res: Response) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User authentication required",
      });
    }

    const knowledgeBase = await KnowledgeBase.findOne({
      userId,
      status: "active",
    });

    if (!knowledgeBase) {
      return res.status(404).json({
        success: false,
        error: "Knowledge base not found for this user",
      });
    }

    return res.status(200).json({
      success: true,
      data: knowledgeBase,
    });
  } catch (error: any) {
    console.error("❌ Error fetching knowledge base:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch knowledge base",
    });
  }
};

/**
 * Update knowledge base with new information
 */
export const updateKnowledgeBase = async (req: Request, res: Response) => {
  try {
    const { assistantId } = req.params;
    const { additionalInfo, sources, website, additionalUrls } = req.body;

    const knowledgeBase = await KnowledgeBase.findOne({
      assistantId,
      status: "active",
    });

    if (!knowledgeBase) {
      return res.status(404).json({
        success: false,
        error: "Knowledge base not found",
      });
    }

    let needsReindex = false;
    let updatedContent = knowledgeBase.rawContent;

    // Add new sources from scraping
    if (website || (additionalUrls && Array.isArray(additionalUrls))) {
      needsReindex = true;
      console.log("📄 Scraping new URLs for update...");

      if (website) {
        try {
          const content = await scrapeWebsite(website);
          knowledgeBase.sources.push({
            type: "website" as const,
            url: website,
            content,
            processedAt: new Date(),
          });
          updatedContent += `\n\n=== UPDATED SOURCE (${website}) ===\n${content}`;
        } catch (error: any) {
          console.error(`Failed to scrape ${website}:`, error.message);
        }
      }

      if (additionalUrls && Array.isArray(additionalUrls)) {
        for (const url of additionalUrls.slice(0, 5)) {
          try {
            const content = await scrapeWebsite(url);
            knowledgeBase.sources.push({
              type: "website" as const,
              url,
              content,
              processedAt: new Date(),
            });
            updatedContent += `\n\n=== UPDATED SOURCE (${url}) ===\n${content}`;
          } catch (error: any) {
            console.error(`Failed to scrape ${url}:`, error.message);
          }
        }
      }
    }

    // Add manual sources
    if (sources && Array.isArray(sources)) {
      needsReindex = true;
      knowledgeBase.sources.push(...sources);
      sources.forEach((source: any) => {
        updatedContent += `\n\n=== MANUAL SOURCE ===\n${source.content}`;
      });
    }

    // Update additional info
    if (additionalInfo) {
      knowledgeBase.structuredData.additionalInfo = {
        ...knowledgeBase.structuredData.additionalInfo,
        ...additionalInfo,
      };
    }

    knowledgeBase.metadata.totalSources = knowledgeBase.sources.length;
    knowledgeBase.metadata.lastUpdated = new Date();
    knowledgeBase.metadata.version += 1;

    // Re-index in Pinecone if content changed
    if (needsReindex) {
      console.log("🌲 Re-indexing in Pinecone after update...");
      try {
        // Delete old namespace
        const namespace = `kb_${assistantId}`
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, "_");
        await deletePineconeNamespace(namespace);

        // Re-create with updated content
        knowledgeBase.rawContent = updatedContent;
        const vectorStoreId = await storeKnowledgeBaseInPinecone(
          updatedContent,
          knowledgeBase.structuredData,
          knowledgeBase.companyName,
          assistantId
        );
        knowledgeBase.vectorStoreId = vectorStoreId;
        console.log("✅ Pinecone re-indexed successfully");
      } catch (error: any) {
        console.error("⚠️ Pinecone re-indexing failed:", error.message);
      }
    }

    await knowledgeBase.save();

    return res.status(200).json({
      success: true,
      data: knowledgeBase,
      message: needsReindex
        ? "Knowledge base and vector store updated successfully"
        : "Knowledge base metadata updated successfully",
    });
  } catch (error: any) {
    console.error("❌ Error updating knowledge base:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to update knowledge base",
    });
  }
};

/**
 * Delete knowledge base
 */
export const deleteKnowledgeBase = async (req: Request, res: Response) => {
  try {
    const { assistantId } = req.params;

    const knowledgeBase = await KnowledgeBase.findOne({ assistantId });

    if (!knowledgeBase) {
      return res.status(404).json({
        success: false,
        error: "Knowledge base not found",
      });
    }

    // Delete from Pinecone first
    console.log("🌲 Deleting from Pinecone...");
    try {
      const namespace = `kb_${assistantId}`
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "_");
      await deletePineconeNamespace(namespace);
      console.log("✅ Pinecone namespace deleted successfully");
    } catch (error: any) {
      console.error("⚠️ Pinecone deletion failed:", error.message);
      // Continue with MongoDB deletion even if Pinecone fails
    }

    // Archive in MongoDB
    const result = await KnowledgeBase.findOneAndUpdate(
      { assistantId },
      { status: "archived" },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Knowledge base and vector store deleted successfully",
      data: {
        assistantId,
        archivedAt: new Date(),
      },
    });
  } catch (error: any) {
    console.error("❌ Error deleting knowledge base:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to delete knowledge base",
    });
  }
};

/**
 * Calculate quality score based on completeness
 * Takes into account both current and accumulated data
 */
function calculateQualityScore(
  structuredData: any,
  sourceCount: number,
  previousData?: any
): "high" | "medium" | "low" {
  let score = 0;

  // Merge with previous data if it exists (cumulative approach)
  const mergedData = previousData
    ? {
        companyOverview:
          structuredData.companyOverview || previousData.companyOverview,
        services: [
          ...(previousData.services || []),
          ...(structuredData.services || []),
        ],
        products: [
          ...(previousData.products || []),
          ...(structuredData.products || []),
        ],
        contactInfo: {
          ...(previousData.contactInfo || {}),
          ...(structuredData.contactInfo || {}),
        },
        keyFeatures: [
          ...(previousData.keyFeatures || []),
          ...(structuredData.keyFeatures || []),
        ],
        faqs: [...(previousData.faqs || []), ...(structuredData.faqs || [])],
        additionalInfo: {
          ...(previousData.additionalInfo || {}),
          ...(structuredData.additionalInfo || {}),
        },
      }
    : structuredData;

  // Check completeness based on merged data
  if (mergedData.companyOverview) score += 20;
  if (mergedData.services?.length > 0) score += 15;
  if (mergedData.products?.length > 0) score += 15;
  if (mergedData.contactInfo?.email) score += 10;
  if (mergedData.contactInfo?.phone) score += 10;
  if (mergedData.keyFeatures?.length > 0) score += 10;
  if (mergedData.faqs?.length > 0) score += 10;
  if (mergedData.additionalInfo) score += 10;

  // Bonus for multiple sources (cumulative)
  if (sourceCount >= 5) score += 15; // More sources = better bonus
  else if (sourceCount >= 3) score += 10;
  else if (sourceCount >= 2) score += 5;

  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/**
 * Helper function to scrape website content
 */
async function scrapeWebsite(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);

    // Remove script, style, and other non-content elements
    $("script, style, nav, footer, header, iframe").remove();

    // Extract main content
    const content = $("body").text().trim().replace(/\s+/g, " ");

    return content;
  } catch (error: any) {
    console.error(`Error scraping ${url}:`, error.message);
    throw new Error(`Failed to scrape website: ${error.message}`);
  }
}

/**
 * Store knowledge base in Pinecone Vector Database
 */
async function storeKnowledgeBaseInPinecone(
  rawContent: string,
  structuredData: any,
  companyName: string,
  userId: string
): Promise<string> {
  try {
    // Create a comprehensive document combining raw and structured data
    const fullDocument = `
COMPANY: ${companyName}
USER ID: ${userId}

=== STRUCTURED INFORMATION ===
Company Overview: ${structuredData.companyOverview || "N/A"}

Services: ${structuredData.services?.join(", ") || "N/A"}

Products: ${structuredData.products?.join(", ") || "N/A"}

Contact Information:
- Email: ${structuredData.contactInfo?.email || "N/A"}
- Phone: ${structuredData.contactInfo?.phone || "N/A"}
- Address: ${structuredData.contactInfo?.address || "N/A"}
- Social Media: ${JSON.stringify(structuredData.contactInfo?.socialMedia || {})}

Key Features: ${structuredData.keyFeatures?.join(", ") || "N/A"}

Pricing: ${structuredData.pricing || "N/A"}

FAQs: ${
      structuredData.faqs
        ?.map((faq: any) => `Q: ${faq.question}\nA: ${faq.answer}`)
        .join("\n\n") || "N/A"
    }

Additional Information: ${JSON.stringify(structuredData.additionalInfo || {})}

=== RAW CONTENT ===
${rawContent}
    `.trim();

    // Split into chunks for better retrieval
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ["\n\n", "\n", " ", ""],
    });

    const chunks = await textSplitter.createDocuments([fullDocument]);

    // Add metadata to each chunk
    const documentsWithMetadata = chunks.map((chunk, index) => ({
      pageContent: chunk.pageContent,
      metadata: {
        companyName,
        userId,
        chunkIndex: index,
        totalChunks: chunks.length,
        timestamp: new Date().toISOString(),
        dataType: "knowledge_base",
        contactEmail: structuredData.contactInfo?.email || null,
        contactPhone: structuredData.contactInfo?.phone || null,
        services: structuredData.services?.join(", ") || null,
        products: structuredData.products?.join(", ") || null,
      },
    }));

    // Initialize embeddings
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "text-embedding-3-small", // Cost-effective and high quality
      dimensions: 1024, // Match Pinecone index dimension
    });

    // Create namespace for this user's knowledge base
    const namespace = `kb_${userId}`.toLowerCase().replace(/[^a-z0-9_-]/g, "_");

    // Store in Pinecone
    await PineconeStore.fromDocuments(documentsWithMetadata, embeddings, {
      pineconeIndex: pineconeIndex as any,
      namespace,
    });

    console.log(
      `✅ Stored ${chunks.length} chunks in Pinecone namespace: ${namespace}`
    );
    return namespace;
  } catch (error: any) {
    console.error("❌ Error storing in Pinecone:", error);
    throw error;
  }
}

/**
 * Query knowledge base from Pinecone
 */
export async function queryKnowledgeBase(req: any, res: Response) {
  try {
    const userId = req.user?._id || req.user?.id;
    const { query, topK = 5 } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User authentication required",
      });
    }

    if (!query) {
      return res.status(400).json({
        success: false,
        error: "Query is required",
      });
    }

    const namespace = `kb_${userId}`.toLowerCase().replace(/[^a-z0-9_-]/g, "_");

    // Initialize embeddings
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "text-embedding-3-small",
      dimensions: 1024, // Match Pinecone index dimension
    });

    // Initialize Pinecone store
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: pineconeIndex as any,
      namespace,
    });

    // Search for relevant information
    const results = await vectorStore.similaritySearchWithScore(query, topK);

    // Format results
    const formattedResults = results.map(([doc, score]) => ({
      content: doc.pageContent,
      metadata: doc.metadata,
      relevanceScore: score,
    }));

    return res.status(200).json({
      success: true,
      data: {
        query,
        results: formattedResults,
        resultsFound: formattedResults.length,
      },
      message: "Knowledge base queried successfully",
    });
  } catch (error: any) {
    console.error("❌ Error querying knowledge base:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to query knowledge base",
    });
  }
}

/**
 * Calculate quality percentage from quality enum
 */
function calculateQualityPercentage(
  quality: "high" | "medium" | "low"
): number {
  switch (quality) {
    case "high":
      return 85; // 70-100 score range
    case "medium":
      return 55; // 40-69 score range
    case "low":
      return 25; // 0-39 score range
    default:
      return 0;
  }
}

/**
 * Delete Pinecone namespace
 */
async function deletePineconeNamespace(namespace: string): Promise<void> {
  try {
    console.log(`🗑️ Deleting Pinecone namespace: ${namespace}`);

    // Delete all vectors in the namespace
    await pineconeIndex.namespace(namespace).deleteAll();

    console.log(`✅ Namespace ${namespace} deleted successfully`);
  } catch (error: any) {
    console.error(`❌ Error deleting namespace ${namespace}:`, error);
    throw error;
  }
}
