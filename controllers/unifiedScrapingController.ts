import { Request, Response } from "express";
import { UnifiedScrapingModel } from "../models/unifiedScrapingModel";
import {
  deepScrapeUrls,
  getChunksForCompany,
} from "../services/deepScrapingService";

// Import search functions from dataScrapingController
const API_KEY =
  process.env.GOOGLE_API_KEY || "AIzaSyDPOfChEDX7uY6ZVU8uJAIaYe55627l0gk";
const CX_ID = process.env.GOOGLE_CX_ID || "1243afd78b9d44365";

interface ISearchResult {
  title: string;
  link: string;
  snippet: string;
  metadata?: any;
}

// Helper function to map Google API response
function mapToSearchResult(item: any): ISearchResult {
  const pagemap = item.pagemap || {};
  const metatags = pagemap.metatags?.[0] || {};
  const cseImage = pagemap.cse_image?.[0] || {};

  return {
    title: item.title,
    link: item.link,
    snippet: item.snippet,
    metadata: {
      image: metatags["og:image"] || cseImage.src,
      description: metatags["og:description"] || item.snippet,
      siteName: metatags["og:site_name"],
      author: metatags["author"] || metatags["article:author"],
      publishedTime: metatags["article:published_time"],
      type: metatags["og:type"],
      favicon: undefined,
    },
  };
}

// 1. Web Search
async function searchGoogleApi(query: string): Promise<ISearchResult[]> {
  const exactQuery = `"${query}" -Mario -Kimmel -Bertoldo -directory -yellowpages`;
  const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CX_ID}&q=${encodeURIComponent(
    exactQuery
  )}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.items) return [];

    const filteredItems = data.items.filter((item: any) => {
      const title = item.title.toLowerCase();
      const snippet = item.snippet.toLowerCase();
      const q = query.toLowerCase();
      return title.includes(q) || snippet.includes(q);
    });

    return filteredItems.map((item: any) => mapToSearchResult(item));
  } catch (error) {
    console.error("Web search failed:", error);
    return [];
  }
}

// 2. Social Media Search
async function searchSocialMedia(
  companyName: string
): Promise<ISearchResult[]> {
  const socialQuery = `intitle:"${companyName}" (site:linkedin.com/company OR site:facebook.com OR site:instagram.com OR site:twitter.com OR site:youtube.com)`;
  const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CX_ID}&q=${encodeURIComponent(
    socialQuery
  )}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.items) return [];

    const filteredSocials = data.items.filter((item: any) => {
      const title = item.title.toLowerCase();
      const link = item.link.toLowerCase();
      const company = companyName.toLowerCase();
      const isProfile =
        !link.includes("/posts/") &&
        !link.includes("/status/") &&
        !link.includes("/groups/");
      const hasName = title.includes(company);
      return isProfile && hasName;
    });

    return filteredSocials.map((item: any) => mapToSearchResult(item));
  } catch (error) {
    console.error("Social search failed:", error);
    return [];
  }
}

/**
 * 🚀 UNIFIED ENDPOINT: Search + Deep Scrape + LLM-Ready Data
 * POST /api/unified-scraping/process
 * Body: { "companyName": "Carter Injury Law", "maxUrls": 10 }
 */
export const processCompanyForLLM = async (req: Request, res: Response) => {
  try {
    const { companyName, maxUrls = 10 } = req.body;
    const userId = (req as any).user?.id; // Get userId from auth middleware

    if (
      !companyName ||
      typeof companyName !== "string" ||
      !companyName.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "companyName is required",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    console.log(
      `\n🔍 Step 1: Searching Google for "${companyName}" (User: ${userId})...`
    );

    // STEP 1: Search Google (Web + Social)
    const [webResults, socialResults] = await Promise.all([
      searchGoogleApi(companyName),
      searchSocialMedia(companyName),
    ]);

    const allResults = [...webResults, ...socialResults];
    console.log(`✅ Found ${allResults.length} URLs total`);

    if (allResults.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No search results found for this company",
      });
    }

    // Create unified scraping document
    const unifiedScraping = new UnifiedScrapingModel({
      userId: userId,
      companyName: companyName,
      query: companyName,
      searchResults: {
        webResults,
        socialResults,
        totalResults: allResults.length,
      },
      deepScrapedPages: [],
      status: "processing",
    });
    await unifiedScraping.save();

    // STEP 2: Collect URLs (limit to maxUrls)
    const urlsToScrape = allResults.slice(0, maxUrls).map((r) => r.link);
    console.log(`\n🌐 Step 2: Deep scraping ${urlsToScrape.length} URLs...`);

    // STEP 3: Deep Scrape all URLs
    const deepScrapeResults = await deepScrapeUrls(
      urlsToScrape,
      unifiedScraping._id.toString(),
      companyName,
      userId
    );

    // STEP 4: Update unified document with deep scraped pages
    const deepScrapedPages = deepScrapeResults
      .filter((r) => r.success && r.data)
      .map((r) => ({
        url: r.url,
        pageTitle: r.pageTitle || "",
        htmlContent: r.data?.htmlContent || "",
        textContent: r.data?.textContent || "",
        markdownContent: r.data?.markdownContent || "",
        headings: r.data?.headings || [],
        paragraphs: r.data?.paragraphs || [],
        links: r.data?.links || [],
        images: r.data?.images || [],
        meta: r.data?.meta || {},
        chunks: r.data?.chunks || [],
        totalChunks: r.totalChunks || 0,
        status: "completed" as const,
        scrapedAt: new Date(),
        processedAt: new Date(),
      }));

    // Add failed pages too
    const failedPages = deepScrapeResults
      .filter((r) => !r.success)
      .map((r) => ({
        url: r.url,
        pageTitle: r.pageTitle || "",
        htmlContent: "",
        textContent: "",
        markdownContent: "",
        headings: [],
        paragraphs: [],
        links: [],
        images: [],
        meta: {},
        chunks: [],
        totalChunks: 0,
        status: "failed" as const,
        error: r.error,
        scrapedAt: new Date(),
      }));

    unifiedScraping.deepScrapedPages = [...deepScrapedPages, ...failedPages];
    unifiedScraping.status = "completed";
    await unifiedScraping.save();

    const successCount = deepScrapeResults.filter((r) => r.success).length;
    const failCount = deepScrapeResults.filter((r) => !r.success).length;

    console.log(
      `✅ Deep scraping completed: ${successCount} succeeded, ${failCount} failed`
    );

    // Calculate quality score based on data completeness
    const totalChunks = unifiedScraping.stats.totalChunksGenerated;
    let quality: "high" | "medium" | "low" = "low";
    let qualityPercentage = 25;

    if (successCount >= 3 && totalChunks >= 50) {
      quality = "high";
      qualityPercentage = 85;
    } else if (successCount >= 2 && totalChunks >= 20) {
      quality = "medium";
      qualityPercentage = 55;
    }

    console.log(
      `📊 Quality assessment: ${quality.toUpperCase()} (${qualityPercentage}%) - ${successCount} sources, ${totalChunks} chunks`
    );

    // STEP 5: Return comprehensive response
    return res.status(200).json({
      success: true,
      message: `Company data processed successfully for LLM`,
      data: {
        _id: unifiedScraping._id,
        userId: unifiedScraping.userId,
        companyName: unifiedScraping.companyName,

        // Search Results Summary
        searchResults: {
          totalUrls: allResults.length,
          webUrls: webResults.length,
          socialUrls: socialResults.length,
          urls: allResults.map((r) => ({
            title: r.title,
            url: r.link,
            snippet: r.snippet,
          })),
        },

        // Deep Scraping Summary
        deepScraping: {
          totalScraped: urlsToScrape.length,
          successCount,
          failCount,
          scrapedUrls: deepScrapeResults.map((r) => ({
            url: r.url,
            success: r.success,
            pageTitle: r.pageTitle || null,
            totalChunks: r.totalChunks || 0,
            error: r.error || null,
          })),
        },

        // Statistics
        stats: unifiedScraping.stats,

        // LLM-Ready Knowledge Base
        knowledgeBase: {
          totalChunks: unifiedScraping.stats.totalChunksGenerated,
          ready: unifiedScraping.stats.totalChunksGenerated > 0,
          quality,
          qualityPercentage,
          chunks: unifiedScraping.deepScrapedPages
            .filter((page) => page.status === "completed")
            .flatMap((page) => page.chunks),
        },
      },
    });
  } catch (error: any) {
    console.error("❌ Unified processing error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process company data",
      error: error.message,
    });
  }
};

/**
 * Get all scraping data for a user
 * GET /api/unified-scraping/user
 */
export const getUserScrapingData = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { limit = 20, page = 1, status, companyName } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const skip = (Number(page) - 1) * Number(limit);
    const query: any = { userId };

    if (status) {
      query.status = status;
    }

    if (companyName) {
      query.companyName = new RegExp(companyName as string, "i");
    }

    const data = await UnifiedScrapingModel.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skip)
      .select(
        "-deepScrapedPages.htmlContent -deepScrapedPages.textContent -deepScrapedPages.markdownContent"
      );

    const total = await UnifiedScrapingModel.countDocuments(query);

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error("Get user scraping data error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get scraping data",
      error: error.message,
    });
  }
};

/**
 * Get single scraping data by ID (with full details)
 * GET /api/unified-scraping/:id
 */
export const getScrapingDataById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const data = await UnifiedScrapingModel.findOne({ _id: id, userId });

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Scraping data not found or access denied",
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("Get scraping data by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get scraping data",
      error: error.message,
    });
  }
};

/**
 * Get LLM-ready chunks for a specific scraping session
 * GET /api/unified-scraping/:id/chunks
 */
export const getScrapingChunks = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const data = await UnifiedScrapingModel.findOne(
      { _id: id, userId },
      { "deepScrapedPages.chunks": 1, companyName: 1, stats: 1 }
    );

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Scraping data not found or access denied",
      });
    }

    const chunks = data.deepScrapedPages
      .filter((page) => page.status === "completed")
      .flatMap((page) => page.chunks);

    return res.status(200).json({
      success: true,
      companyName: data.companyName,
      totalChunks: chunks.length,
      chunks,
    });
  } catch (error: any) {
    console.error("Get chunks error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get chunks",
      error: error.message,
    });
  }
};

/**
 * Get all chunks for a company (across all user's scraping sessions)
 * GET /api/unified-scraping/company/:companyName/chunks
 */
export const getCompanyChunksByUser = async (req: Request, res: Response) => {
  try {
    const { companyName } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const data = await UnifiedScrapingModel.find(
      {
        userId,
        companyName: new RegExp(companyName, "i"),
        status: "completed",
      },
      { "deepScrapedPages.chunks": 1, companyName: 1, createdAt: 1 }
    ).sort({ createdAt: -1 });

    if (data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No data found for this company. Please process it first.",
      });
    }

    // Get most recent scraping data
    const latestData = data[0];
    const chunks = latestData.deepScrapedPages
      .filter((page) => page.status === "completed")
      .flatMap((page) => page.chunks);

    return res.status(200).json({
      success: true,
      companyName: latestData.companyName,
      totalChunks: chunks.length,
      totalSessions: data.length,
      latestSession: latestData.createdAt,
      chunks,
    });
  } catch (error: any) {
    console.error("Get company chunks error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get chunks",
      error: error.message,
    });
  }
};

/**
 * Delete scraping data by ID
 * DELETE /api/unified-scraping/:id
 */
export const deleteScrapingData = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const data = await UnifiedScrapingModel.findOneAndDelete({
      _id: id,
      userId,
    });

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Scraping data not found or access denied",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Scraping data deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete scraping data error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete scraping data",
      error: error.message,
    });
  }
};

/**
 * Get user's scraping statistics
 * GET /api/unified-scraping/user/stats
 */
export const getUserScrapingStats = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const totalSessions = await UnifiedScrapingModel.countDocuments({ userId });
    const completedSessions = await UnifiedScrapingModel.countDocuments({
      userId,
      status: "completed",
    });
    const processingSessions = await UnifiedScrapingModel.countDocuments({
      userId,
      status: "processing",
    });
    const failedSessions = await UnifiedScrapingModel.countDocuments({
      userId,
      status: "failed",
    });

    // Get aggregate statistics
    const aggregateStats = await UnifiedScrapingModel.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: null,
          totalSearchResults: { $sum: "$stats.totalSearchResults" },
          totalPagesScraped: { $sum: "$stats.totalPagesScraped" },
          totalChunksGenerated: { $sum: "$stats.totalChunksGenerated" },
          totalCompletedPages: { $sum: "$stats.completedPages" },
          totalFailedPages: { $sum: "$stats.failedPages" },
        },
      },
    ]);

    const stats = aggregateStats[0] || {
      totalSearchResults: 0,
      totalPagesScraped: 0,
      totalChunksGenerated: 0,
      totalCompletedPages: 0,
      totalFailedPages: 0,
    };

    // Get list of unique companies
    const companies = await UnifiedScrapingModel.distinct("companyName", {
      userId,
    });

    return res.status(200).json({
      success: true,
      stats: {
        sessions: {
          total: totalSessions,
          completed: completedSessions,
          processing: processingSessions,
          failed: failedSessions,
        },
        companies: {
          total: companies.length,
          list: companies,
        },
        data: {
          totalSearchResults: stats.totalSearchResults,
          totalPagesScraped: stats.totalPagesScraped,
          totalChunksGenerated: stats.totalChunksGenerated,
          totalCompletedPages: stats.totalCompletedPages,
          totalFailedPages: stats.totalFailedPages,
        },
      },
    });
  } catch (error: any) {
    console.error("Get user stats error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get user statistics",
      error: error.message,
    });
  }
};
