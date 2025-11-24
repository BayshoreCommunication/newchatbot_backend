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
exports.scrapeQueue = void 0;
exports.getJobStatus = getJobStatus;
exports.scrapeWebsiteOptimized = scrapeWebsiteOptimized;
const axios_1 = __importDefault(require("axios"));
const bull_1 = __importDefault(require("bull"));
const cheerio = __importStar(require("cheerio"));
const url_1 = require("url");
const xml2js = __importStar(require("xml2js"));
// Configure Redis connection
const redisConfig = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
};
// Create job queue
exports.scrapeQueue = new bull_1.default("web-scraper", {
    redis: redisConfig,
    defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
    },
});
// Process jobs
exports.scrapeQueue.process("scrape-website", async (job) => {
    const { url } = job.data;
    return await scrapeWebsiteOptimized(url, job);
});
/**
 * Simple concurrency limiter
 */
class ConcurrencyLimiter {
    constructor(limit) {
        this.limit = limit;
        this.running = 0;
        this.queue = [];
    }
    async run(fn) {
        while (this.running >= this.limit) {
            await new Promise((resolve) => this.queue.push(resolve));
        }
        this.running++;
        try {
            return await fn();
        }
        finally {
            this.running--;
            const next = this.queue.shift();
            if (next)
                next();
        }
    }
}
/**
 * Get job status and progress
 */
async function getJobStatus(jobId) {
    const job = await exports.scrapeQueue.getJob(jobId);
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
async function scrapeWebsiteOptimized(startUrl, job) {
    const startTime = new Date();
    const result = {};
    const baseDomain = new url_1.URL(startUrl).hostname;
    let successfulScrapes = 0;
    let failedScrapes = 0;
    let scrapingMethod = "recursive_crawl";
    // Concurrency limit - scrape 5 pages at a time
    const limiter = new ConcurrencyLimiter(5);
    // Axios config with reasonable timeouts
    const axiosConfig = {
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
        const stats = await scrapeBatch(sitemapUrls, result, limiter, axiosConfig, job);
        successfulScrapes = stats.successful;
        failedScrapes = stats.failed;
    }
    else {
        // Fallback: recursive crawl with limits
        scrapingMethod = "recursive_crawl";
        await job.progress(5);
        const stats = await recursiveCrawl(startUrl, baseDomain, result, limiter, axiosConfig, job);
        successfulScrapes = stats.successful;
        failedScrapes = stats.failed;
    }
    const endTime = new Date();
    const duration = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(2);
    const scrapeResult = {
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
async function fetchSitemapUrls(startUrl, axiosConfig) {
    const sitemapUrls = [];
    try {
        const sitemapUrl = new url_1.URL("/sitemap.xml", startUrl).href;
        const resp = await axios_1.default.get(sitemapUrl, axiosConfig);
        if (resp.status === 200 && resp.data) {
            const parsed = await xml2js.parseStringPromise(resp.data);
            // Regular sitemap
            if (parsed.urlset?.url) {
                sitemapUrls.push(...parsed.urlset.url.map((u) => u.loc?.[0]).filter(Boolean));
            }
            // Sitemap index
            if (parsed.sitemapindex?.sitemap) {
                const subSitemaps = parsed.sitemapindex.sitemap
                    .map((sm) => sm.loc?.[0])
                    .filter(Boolean);
                // Fetch subsitemaps with concurrency control
                const subLimiter = new ConcurrencyLimiter(3);
                const subResults = await Promise.allSettled(subSitemaps.map((smUrl) => subLimiter.run(async () => {
                    const subResp = await axios_1.default.get(smUrl, axiosConfig);
                    const subParsed = await xml2js.parseStringPromise(subResp.data);
                    const urls = subParsed.urlset?.url
                        ?.map((u) => u.loc?.[0])
                        .filter(Boolean) || [];
                    return urls;
                })));
                subResults.forEach((result) => {
                    if (result.status === "fulfilled") {
                        sitemapUrls.push(...result.value);
                    }
                });
            }
        }
    }
    catch (error) {
        // Sitemap not available or failed to fetch
    }
    return [...new Set(sitemapUrls)];
}
/**
 * Scrape multiple URLs in batches with progress tracking
 */
async function scrapeBatch(urls, result, limiter, axiosConfig, job) {
    const total = urls.length;
    let completed = 0;
    let successful = 0;
    let failed = 0;
    const promises = urls.map((url) => limiter.run(async () => {
        try {
            const text = await scrapePage(url, axiosConfig);
            result[url] = text;
            successful++;
        }
        catch (error) {
            console.error(`Failed to scrape ${url}:`, error);
            failed++;
        }
        completed++;
        if (completed % 10 === 0 || completed === total) {
            const progress = Math.floor((completed / total) * 95) + 5;
            await job.progress(progress);
        }
    }));
    await Promise.all(promises);
    return { successful, failed };
}
/**
 * Recursive crawl with progress tracking
 */
async function recursiveCrawl(startUrl, baseDomain, result, limiter, axiosConfig, job, maxPages = 1000) {
    const visited = new Set();
    const toVisit = [startUrl];
    let processed = 0;
    let successful = 0;
    let failed = 0;
    while (toVisit.length > 0 && processed < maxPages) {
        const batch = toVisit.splice(0, 10);
        const promises = batch.map((url) => limiter.run(async () => {
            if (visited.has(url))
                return [];
            visited.add(url);
            processed++;
            try {
                const { text, links } = await scrapePageWithLinks(url, baseDomain, axiosConfig);
                result[url] = text;
                successful++;
                const progress = Math.min(95, Math.floor((processed / maxPages) * 90) + 5);
                await job.progress(progress);
                if (processed % 10 === 0) {
                    // Progress tracking
                }
                return links.filter((link) => !visited.has(link) && !toVisit.includes(link));
            }
            catch (error) {
                console.error(`Failed to crawl ${url}:`, error);
                failed++;
                return [];
            }
        }));
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
async function scrapePage(url, axiosConfig) {
    const response = await axios_1.default.get(url, axiosConfig);
    const $ = cheerio.load(response.data);
    $("script, style, nav, footer, header").remove();
    return $("body").text().replace(/\s+/g, " ").trim();
}
/**
 * Scrape page and extract links
 */
async function scrapePageWithLinks(url, baseDomain, axiosConfig) {
    const response = await axios_1.default.get(url, axiosConfig);
    const $ = cheerio.load(response.data);
    $("script, style, nav, footer, header").remove();
    const text = $("body").text().replace(/\s+/g, " ").trim();
    const links = [];
    $("a[href]").each((_, el) => {
        let link = $(el).attr("href");
        if (!link || /^(mailto:|tel:|javascript:|#)/i.test(link))
            return;
        try {
            const absoluteUrl = new url_1.URL(link, url).href;
            if (new url_1.URL(absoluteUrl).hostname === baseDomain) {
                links.push(absoluteUrl);
            }
        }
        catch { }
    });
    return { text, links: [...new Set(links)] };
}
// Graceful shutdown
process.on("SIGTERM", async () => {
    await exports.scrapeQueue.close();
});
