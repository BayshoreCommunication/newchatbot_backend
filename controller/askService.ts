import { Request, Response } from "express";

// Placeholder: implement scraping, caching, and OpenAI logic here

import axios from "axios";
import crypto from "crypto";
const cheerio = require("cheerio");
import { addMessageToHistory, getHistoryByOrg, ChatMessage } from "./chatHistory";

// Helper to generate a mock organization ID
function generateOrganizationId() {
  return "org-" + crypto.randomBytes(12).toString("hex");
}

// Caching logic
let cachedWebsiteContent: string | null = null;
let cachedTimestamp: number | null = null;
const CACHE_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

// Crawl all internal links and extract visible text from each page (home, about, contact, blog, all posts, etc.)
async function getWebsiteContent(): Promise<string> {
  const now = Date.now();
  if (
    cachedWebsiteContent &&
    cachedTimestamp &&
    now - cachedTimestamp < CACHE_DURATION_MS
  ) {
    return cachedWebsiteContent;
  }
  const baseUrl = "https://www.carterinjurylaw.com";
  const visited = new Set<string>();
  const toVisit = [baseUrl];
  let allText = "";
  let contactText = "";

  while (toVisit.length > 0 && visited.size < 30) {
    // Limit to 30 pages for safety
    const url = toVisit.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);
    try {
      const { data: html } = await axios.get(url);
      const $ = cheerio.load(html);
      // Remove script, style, nav, footer, and noscript tags
      $("script, style, nav, footer, noscript").remove();
      // Get visible text from body
      let text = $("body").text();
      text = text.replace(/\s+/g, " ").trim();
      allText += `\n--- Page: ${url} ---\n` + text;
      // If this is a contact page, save its text for address extraction
      if (/contact/i.test(url)) {
        contactText += text + "\n";
      }
      // Find internal links (including blog posts, about, contact, etc.)
      $("a[href]").each((_: number, el: cheerio.Element) => {
        const href = $(el).attr("href");
        if (
          href &&
          href.startsWith("/") &&
          !href.startsWith("//") &&
          !href.startsWith("/wp-") && // skip common static asset paths
          !href.includes("#") // skip anchor links
        ) {
          const absUrl = baseUrl + href.replace(/^(\/)+/, "/");
          if (!visited.has(absUrl) && !toVisit.includes(absUrl)) {
            toVisit.push(absUrl);
          }
        }
      });
    } catch (err) {
      // Ignore errors for individual pages
    }
  }
  // Save to cache
  cachedWebsiteContent = JSON.stringify({ allText, contactText });
  cachedTimestamp = Date.now();
  return cachedWebsiteContent;
}

// Helper to truncate website content to avoid exceeding token/length limits
function truncateContent(content: string, maxLength: number = 12000): string {
  if (content.length > maxLength) {
    return content.slice(0, maxLength) + "\n...[truncated]";
  }
  return content;
}

// Extract address/contact info from contact page text
function extractAddress(contactText: string): string {
  // Simple regex for US address (street, city, state, zip)
  const addressRegex = /(\d{2,5}[^\n,]+,? [^\n,]+,? [A-Z]{2} \d{5}(-\d{4})?)/;
  const match = contactText.match(addressRegex);
  if (match) return match[0];
  // Fallback: look for lines with "address" or "suite"
  const lines = contactText
    .split(/\n|\r/)
    .filter((l) =>
      /address|suite|drive|dr\.|blvd|road|rd\.|ave|avenue|street|st\./i.test(l)
    );
  return lines.length > 0 ? lines.join(" ") : "";
}

// Call OpenAI Chat Completions API (GPT-4o/4.5)
async function askOpenAIAssistant(
  apiKey: string,
  question: string,
  websiteContentRaw: string
): Promise<string> {
  // Parse cached content
  let allText = "";
  let contactText = "";
  try {
    const parsed = JSON.parse(websiteContentRaw);
    allText = parsed.allText || "";
    contactText = parsed.contactText || "";
  } catch {
    allText = websiteContentRaw;
    contactText = "";
  }
  // Extract address/contact info
  let addressInfo = extractAddress(contactText);
  if (addressInfo) {
    addressInfo = `Contact/Address Info (prioritized):\n${addressInfo}\n\n`;
  } else {
    addressInfo = "";
  }
  // Truncate website content to avoid hitting API limits (GPT-4o supports ~128k tokens, but keep safe)
  const safeContent = truncateContent(allText, 12000);
  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-5mini", // Use GPT-4o or gpt-4.5-turbo if available
      messages: [
        {
          role: "system",
          content: `You are an AI assistant. Use the following website content to answer user questions as accurately as possible.\n${addressInfo}Website Content:\n${safeContent}`,
        },
        {
          role: "user",
          content: question,
        },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data.choices?.[0]?.message?.content || "No answer returned.";
}

  let { apiKey, question, organizationId } = req.body;
  console.log("Received body:", req.body);
  if (!apiKey) {
    apiKey = process.env.OPENAI_API_KEY;
    console.log("Using API key from .env:", !!apiKey);
  } else {
    console.log("Using API key from request body");
  }
  if (!apiKey || !question) {
    console.log("Missing apiKey or question");
    return res.status(400).json({ error: "apiKey and question are required" });
  }

  // Use provided orgId or create new
  if (!organizationId) {
    organizationId = generateOrganizationId();
  }

  try {
    const websiteContent = await getWebsiteContent();
    // Store user message
    await addMessageToHistory(organizationId, {
      sender: "user",
      text: question,
      timestamp: Date.now(),
    });
    const answer = await askOpenAIAssistant(apiKey, question, websiteContent);
    // Store AI response
    await addMessageToHistory(organizationId, {
      sender: "ai",
      text: answer,
      timestamp: Date.now(),
    });
    const history = await getHistoryByOrg(organizationId);
    return res.json({
      organizationId,
      answer,
      history,
      cacheTimestamp: cachedTimestamp,
      cacheExpires: cachedTimestamp
        ? cachedTimestamp + CACHE_DURATION_MS
        : null,
    });
  } catch (error) {
    console.log("Error in handleAsk:", error);
    return res
      .status(500)
      .json({ error: (error as any).message || "Failed to process request." });
  }
}
