import axios, { AxiosRequestConfig } from "axios";
import Bull, { Job, Queue } from "bull";
import * as cheerio from "cheerio";
import { URL } from "url";
import * as xml2js from "xml2js";

// Configure Redis connection
const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
};

// Create job queue
export const scrapeQueue: Queue = new Bull("web-scraper", {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

// Interface for scrape result with metadata
export interface ScrapeResult {
  data: Record<string, string>;
  metadata: {
    totalUrlsFound: number;
    successfulScrapes: number;
    failedScrapes: number;
    scrapingMethod: "sitemap" | "recursive_crawl";
    startTime: string;
    endTime: string;
    duration: string; // in seconds
    startUrl: string;
    baseDomain: string;
    sitemapUrls?: number; // Number of URLs found in sitemap
  };
}

// Process jobs
scrapeQueue.process("scrape-website", async (job: Job) => {
  const { url } = job.data;
  return await scrapeWebsiteOptimized(url, job);
});

/**
 * Simple concurrency limiter
 */
class ConcurrencyLimiter {
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(private limit: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    while (this.running >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }

    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

/**
 * Get job status and progress
 */
export async function getJobStatus(jobId: string) {
  const job = await scrapeQueue.getJob(jobId);
  if (!job) {
    throw new Error("Job not found");
  }

  const state = await job.getState();
  const progress = job.progress();
  const reason = job.failedReason;

  return {
    jobId: job.id,
    state,
    progress,
    ...(reason && { error: reason }),
    ...(state === "completed" && { result: job.returnvalue }),
  };
}

/**
 * Optimized scraping with progress tracking and concurrency control
 */
export async function scrapeWebsiteOptimized(
  startUrl: string,
  job: Job
): Promise<ScrapeResult> {
  const startTime = new Date();
  const result: Record<string, string> = {};
  const baseDomain = new URL(startUrl).hostname;

  let successfulScrapes = 0;
  let failedScrapes = 0;
  let scrapingMethod: "sitemap" | "recursive_crawl" = "recursive_crawl";

  // Concurrency limit - scrape 10 pages at a time for better performance
  const limiter = new ConcurrencyLimiter(10);

  // Axios config with reasonable timeouts
  const axiosConfig: AxiosRequestConfig = {
    timeout: 30000,
    maxRedirects: 5,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; WebScraper/1.0)",
    },
  };

  // Try sitemap first
  const sitemapUrls = await fetchSitemapUrls(startUrl, axiosConfig);

  if (sitemapUrls.length > 0) {
    scrapingMethod = "sitemap";
    await job.progress(5);

    const stats = await scrapeBatch(
      sitemapUrls,
      result,
      limiter,
      axiosConfig,
      job
    );
    successfulScrapes = stats.successful;
    failedScrapes = stats.failed;
  } else {
    // Fallback: recursive crawl with limits
    scrapingMethod = "recursive_crawl";
    await job.progress(5);

    const stats = await recursiveCrawl(
      startUrl,
      baseDomain,
      result,
      limiter,
      axiosConfig,
      job
    );
    successfulScrapes = stats.successful;
    failedScrapes = stats.failed;
  }

  const endTime = new Date();
  const duration = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(
    2
  );

  const scrapeResult: ScrapeResult = {
    data: result,
    metadata: {
      totalUrlsFound: successfulScrapes + failedScrapes,
      successfulScrapes,
      failedScrapes,
      scrapingMethod,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: `${duration}s`,
      startUrl,
      baseDomain,
      ...(scrapingMethod === "sitemap" && { sitemapUrls: sitemapUrls.length }),
    },
  };

  return scrapeResult;
}

/**
 * Fetch URLs from sitemap.xml (with sitemap index support)
 */
async function fetchSitemapUrls(
  startUrl: string,
  axiosConfig: AxiosRequestConfig
): Promise<string[]> {
  const sitemapUrls: string[] = [];

  try {
    const sitemapUrl = new URL("/sitemap.xml", startUrl).href;

    const resp = await axios.get(sitemapUrl, axiosConfig);

    if (resp.status === 200 && resp.data) {
      const parsed = await xml2js.parseStringPromise(resp.data);

      // Regular sitemap
      if (parsed.urlset?.url) {
        sitemapUrls.push(
          ...parsed.urlset.url.map((u: any) => u.loc?.[0]).filter(Boolean)
        );
      }

      // Sitemap index
      if (parsed.sitemapindex?.sitemap) {
        const subSitemaps = parsed.sitemapindex.sitemap
          .map((sm: any) => sm.loc?.[0])
          .filter(Boolean);

        // Fetch subsitemaps with concurrency control
        const subLimiter = new ConcurrencyLimiter(5);
        const subResults = await Promise.allSettled(
          subSitemaps.map((smUrl: string) =>
            subLimiter.run(async () => {
              const subResp = await axios.get(smUrl, axiosConfig);
              const subParsed = await xml2js.parseStringPromise(subResp.data);
              const urls =
                subParsed.urlset?.url
                  ?.map((u: any) => u.loc?.[0])
                  .filter(Boolean) || [];
              return urls;
            })
          )
        );

        subResults.forEach((result) => {
          if (result.status === "fulfilled") {
            sitemapUrls.push(...result.value);
          }
        });
      }
    }
  } catch (error) {
    // Sitemap not available or failed to fetch
  }

  return [...new Set(sitemapUrls)];
}

/**
 * Scrape multiple URLs in batches with progress tracking
 */
async function scrapeBatch(
  urls: string[],
  result: Record<string, string>,
  limiter: ConcurrencyLimiter,
  axiosConfig: AxiosRequestConfig,
  job: Job
): Promise<{ successful: number; failed: number }> {
  const total = urls.length;
  let completed = 0;
  let successful = 0;
  let failed = 0;

  const promises = urls.map((url) =>
    limiter.run(async () => {
      try {
        const text = await scrapePage(url, axiosConfig);
        result[url] = text;
        successful++;
      } catch (error) {
        console.error(`Failed to scrape ${url}:`, error);
        failed++;
      }

      completed++;
      if (completed % 10 === 0 || completed === total) {
        const progress = Math.floor((completed / total) * 95) + 5;
        await job.progress(progress);
      }
    })
  );

  await Promise.all(promises);

  return { successful, failed };
}

/**
 * Recursive crawl with progress tracking
 */
async function recursiveCrawl(
  startUrl: string,
  baseDomain: string,
  result: Record<string, string>,
  limiter: ConcurrencyLimiter,
  axiosConfig: AxiosRequestConfig,
  job: Job,
  maxPages: number = 1000
): Promise<{ successful: number; failed: number }> {
  const visited = new Set<string>();
  const toVisit: string[] = [startUrl];
  let processed = 0;
  let successful = 0;
  let failed = 0;

  while (toVisit.length > 0 && processed < maxPages) {
    const batch = toVisit.splice(0, 10);

    const promises = batch.map((url) =>
      limiter.run(async () => {
        if (visited.has(url)) return [];

        visited.add(url);
        processed++;

        try {
          const { text, links } = await scrapePageWithLinks(
            url,
            baseDomain,
            axiosConfig
          );
          result[url] = text;
          successful++;

          const progress = Math.min(
            95,
            Math.floor((processed / maxPages) * 90) + 5
          );
          await job.progress(progress);

          if (processed % 10 === 0) {
            // Progress tracking
          }

          return links.filter(
            (link) => !visited.has(link) && !toVisit.includes(link)
          );
        } catch (error) {
          console.error(`Failed to crawl ${url}:`, error);
          failed++;
          return [];
        }
      })
    );

    const newLinksArrays = await Promise.all(promises);
    const newLinks = newLinksArrays.flat();
    toVisit.push(...newLinks);

    if (newLinks.length > 0) {
      // Found new links to crawl
    }
  }

  return { successful, failed };
}

/**
 * Scrape a single page and extract text
 */
async function scrapePage(
  url: string,
  axiosConfig: AxiosRequestConfig
): Promise<string> {
  const response = await axios.get(url, axiosConfig);
  const $ = cheerio.load(response.data);

  $("script, style, nav, footer, header").remove();

  return $("body").text().replace(/\s+/g, " ").trim();
}

/**
 * Scrape page and extract links
 */
async function scrapePageWithLinks(
  url: string,
  baseDomain: string,
  axiosConfig: AxiosRequestConfig
): Promise<{ text: string; links: string[] }> {
  const response = await axios.get(url, axiosConfig);
  const $ = cheerio.load(response.data);

  $("script, style, nav, footer, header").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();

  const links: string[] = [];
  $("a[href]").each((_, el) => {
    let link = $(el).attr("href");
    if (!link || /^(mailto:|tel:|javascript:|#)/i.test(link)) return;

    try {
      const absoluteUrl = new URL(link, url).href;
      if (new URL(absoluteUrl).hostname === baseDomain) {
        links.push(absoluteUrl);
      }
    } catch {}
  });

  return { text, links: [...new Set(links)] };
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  await scrapeQueue.close();
});
