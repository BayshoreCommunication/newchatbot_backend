// Placeholder: implement scraping, caching, and OpenAI logic here

import axios from "axios";
import crypto from "crypto";
const cheerio = require("cheerio");

// Helper to generate a mock organization ID
export function generateOrganizationId() {
  return "org-" + crypto.randomBytes(12).toString("hex");
}

// Caching logic
let cachedWebsiteContent: string | null = null;
let cachedTimestamp: number | null = null;
const CACHE_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

// Crawl all internal links and extract visible text from each page (home, about, contact, blog, all posts, etc.)
export async function getWebsiteContent(): Promise<string> {
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
export async function askOpenAIAssistant(
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
      model: "gpt-4o", // Use GPT-4o or gpt-4.5-turbo if available
      messages: [
        {
          role: "system",
          content: `You are a helpful, friendly, and conversational human assistant. Answer questions simply and clearly, as if you are a real person, not an AI. Avoid technical jargon. Be warm, supportive, and natural. If appropriate, suggest a gentle follow-up question to keep the conversation going.\n${addressInfo}Website Content:\n${safeContent}`,
        },
        {
          role: "user",
          content: question,
        },
      ],
      max_tokens: 1024,
      temperature: 0.8,
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

// The handleAsk function has been removed from this service file.
