import puppeteer, { Browser, Page } from "puppeteer";
import * as cheerio from "cheerio";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { IDocumentChunk } from "../models/unifiedScrapingModel";
import { storeChunksInPinecone } from "./vectorStoreService";

// Initialize Turndown for HTML to Markdown conversion
const TurndownService = require("turndown");
const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

// Initialize Text Splitter for chunking
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ["\n\n", "\n", ". ", " ", ""],
});

/**
 * Deep scrape a single URL using Puppeteer
 */
export async function deepScrapeUrl(url: string, scrapedDataId: string, companyName: string, userId?: string): Promise<any> {
  let browser: Browser | null = null;

  try {
    console.log(`🌐 Starting deep scrape for: ${url}`);

    // Launch Puppeteer browser
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page: Page = await browser.newPage();

    // Set user agent to avoid bot detection
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Navigate to URL
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for content to load
    await page.waitForSelector("body", { timeout: 10000 });

    // Get full HTML content
    const htmlContent = await page.content();

    // Extract page title
    const pageTitle = await page.title();

    // Load HTML into Cheerio for parsing
    const $ = cheerio.load(htmlContent);

    // Remove unwanted elements
    $("script, style, nav, footer, aside, iframe, noscript").remove();

    // Extract structured data
    const headings = $("h1, h2, h3, h4, h5, h6")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((text) => text.length > 0);

    const paragraphs = $("p")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((text) => text.length > 20); // Filter out short paragraphs

    const links = $("a")
      .map((_, el) => ({
        text: $(el).text().trim(),
        href: $(el).attr("href") || "",
      }))
      .get()
      .filter((link) => link.text.length > 0 && link.href.length > 0)
      .slice(0, 50); // Limit to 50 links

    const images = $("img")
      .map((_, el) => ({
        alt: $(el).attr("alt") || "",
        src: $(el).attr("src") || "",
      }))
      .get()
      .filter((img) => img.src.length > 0)
      .slice(0, 20); // Limit to 20 images

    // Extract metadata
    const meta = {
      description: $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content"),
      keywords: $('meta[name="keywords"]').attr("content"),
      author: $('meta[name="author"]').attr("content"),
      publishedDate: $('meta[property="article:published_time"]').attr("content")
        ? new Date($('meta[property="article:published_time"]').attr("content")!)
        : undefined,
      lastModified: $('meta[property="article:modified_time"]').attr("content")
        ? new Date($('meta[property="article:modified_time"]').attr("content")!)
        : undefined,
    };

    // Extract main text content (cleaned)
    const textContent = $("body").text().replace(/\s+/g, " ").trim();

    // Convert HTML to Markdown for better LLM processing
    const markdownContent = turndownService.turndown($("body").html() || "");

    // Split content into chunks for LLM
    const contentForChunking = `# ${pageTitle}\n\n${markdownContent}`;
    const chunkTexts = await textSplitter.splitText(contentForChunking);

    const chunks: IDocumentChunk[] = chunkTexts.map((chunk, index) => ({
      content: chunk,
      metadata: {
        source: url,
        chunkIndex: index,
        totalChunks: chunkTexts.length,
        pageTitle: pageTitle,
        companyName: companyName,
        scrapedDate: new Date(),
      },
    }));

    console.log(`✅ Deep scrape completed for: ${url}`);
    console.log(`📄 Generated ${chunks.length} chunks for LLM`);

    // --- AUTO-STORE IN PINECONE ---
    if (process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX && chunks.length > 0) {
      try {
        await storeChunksInPinecone(chunks, companyName, userId);
        console.log(`✅ Automatically stored ${chunks.length} chunks in Pinecone for ${url}`);
      } catch (pineconeError) {
        console.error(`⚠️ Failed to auto-store in Pinecone for ${url}:`, pineconeError);
      }
    }
    // ------------------------------

    return {
      success: true,
      url,
      pageTitle,
      totalChunks: chunks.length,
      data: {
        htmlContent: htmlContent.substring(0, 50000), // Limit HTML storage to 50KB
        textContent: textContent.substring(0, 20000), // Limit text storage to 20KB
        markdownContent,
        headings,
        paragraphs: paragraphs.slice(0, 100), // Limit paragraphs
        links,
        images,
        meta,
        chunks,
      },
    };
  } catch (error: any) {
    console.error(`❌ Deep scrape failed for ${url}:`, error.message);

    return {
      success: false,
      url,
      pageTitle: "",
      error: error.message,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Deep scrape multiple URLs in sequence
 */
export async function deepScrapeUrls(urls: string[], scrapedDataId: string, companyName: string, userId?: string): Promise<any[]> {
  const results = [];

  for (const url of urls) {
    const result = await deepScrapeUrl(url, scrapedDataId, companyName, userId);
    results.push(result);

    // Add delay between requests to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return results;
}

/**
 * Get deep scraped content by company name
 * Note: This function is deprecated. Use UnifiedScrapingModel directly in controllers.
 */
export async function getDeepScrapedByCompany(companyName: string) {
  const { UnifiedScrapingModel } = require("../models/unifiedScrapingModel");
  return await UnifiedScrapingModel.find({ companyName, status: "completed" })
    .sort({ createdAt: -1 })
    .select("-deepScrapedPages.htmlContent -deepScrapedPages.textContent -deepScrapedPages.markdownContent");
}

/**
 * Get all chunks for a company (ready for vector embedding)
 * Note: This function is deprecated. Use UnifiedScrapingModel directly in controllers.
 */
export async function getChunksForCompany(companyName: string): Promise<IDocumentChunk[]> {
  const { UnifiedScrapingModel } = require("../models/unifiedScrapingModel");
  const documents = await UnifiedScrapingModel.find({ companyName, status: "completed" })
    .select("deepScrapedPages.chunks");

  const allChunks: IDocumentChunk[] = [];
  documents.forEach((doc) => {
    if (doc.deepScrapedPages) {
      doc.deepScrapedPages.forEach((page: any) => {
        if (page.chunks) {
          allChunks.push(...page.chunks);
        }
      });
    }
  });

  return allChunks;
}

/**
 * Export chunks as JSON file for vector database
 */
export function exportChunksToJSON(chunks: IDocumentChunk[]): string {
  return JSON.stringify(
    {
      documents: chunks.map((chunk) => ({
        pageContent: chunk.content,
        metadata: chunk.metadata,
      })),
      totalDocuments: chunks.length,
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
}
