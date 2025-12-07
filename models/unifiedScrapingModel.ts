import mongoose, { Schema, Document } from "mongoose";

// Interface for Search Result Metadata
export interface ISearchResultMetadata {
  image?: string;
  description?: string;
  siteName?: string;
  author?: string;
  publishedTime?: string;
  type?: string;
  favicon?: string;
}

// Interface for Search Result
export interface ISearchResult {
  title: string;
  link: string;
  snippet: string;
  metadata?: ISearchResultMetadata;
}

// Interface for Document Chunk (for vector embeddings)
export interface IDocumentChunk {
  content: string;
  metadata: {
    source: string;
    chunkIndex: number;
    totalChunks: number;
    pageTitle: string;
    companyName: string;
    scrapedDate: Date;
  };
}

// Interface for Deep Scraped Page Content
export interface IDeepScrapedPage {
  url: string;
  pageTitle: string;

  // Raw Content
  htmlContent: string;
  textContent: string;
  markdownContent: string;

  // Structured Data
  headings: string[];
  paragraphs: string[];
  links: Array<{ text: string; href: string }>;
  images: Array<{ alt: string; src: string }>;

  // Metadata
  meta: {
    description?: string;
    keywords?: string;
    author?: string;
    publishedDate?: Date;
    lastModified?: Date;
  };

  // LLM-Ready Document Chunks
  chunks: IDocumentChunk[];
  totalChunks: number;

  // Processing Status
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;

  // Timestamps
  scrapedAt: Date;
  processedAt?: Date;
}

// Main Unified Scraping Model Interface
export interface IUnifiedScrapingModel extends Document {
  // User Reference - REQUIRED for all scraping data
  userId: mongoose.Types.ObjectId;

  // Company and Query Information
  companyName: string;
  query: string;

  // Initial Search Results (from dataScrapingModel)
  searchResults: {
    webResults: ISearchResult[];
    socialResults: ISearchResult[];
    totalResults: number;
  };

  // Deep Scraped Content (from deepScrapingModel)
  deepScrapedPages: IDeepScrapedPage[];

  // Overall Status
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;

  // Processing Statistics
  stats: {
    totalSearchResults: number;
    totalPagesScraped: number;
    totalChunksGenerated: number;
    completedPages: number;
    failedPages: number;
  };

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// Document Chunk Schema
const DocumentChunkSchema = new Schema({
  content: { type: String, required: true },
  metadata: {
    source: String,
    chunkIndex: Number,
    totalChunks: Number,
    pageTitle: String,
    companyName: String,
    scrapedDate: Date,
  },
}, { _id: false });

// Search Result Metadata Schema
const SearchResultMetadataSchema = new Schema({
  image: String,
  description: String,
  siteName: String,
  author: String,
  publishedTime: String,
  type: String,
  favicon: String,
}, { _id: false });

// Search Result Schema
const SearchResultSchema = new Schema({
  title: { type: String, required: true },
  link: { type: String, required: true },
  snippet: { type: String, required: true },
  metadata: SearchResultMetadataSchema,
}, { _id: false });

// Deep Scraped Page Schema
const DeepScrapedPageSchema = new Schema({
  url: {
    type: String,
    required: true,
  },
  pageTitle: String,

  // Raw Content
  htmlContent: String,
  textContent: String,
  markdownContent: String,

  // Structured Data
  headings: [String],
  paragraphs: [String],
  links: [{
    text: String,
    href: String,
  }],
  images: [{
    alt: String,
    src: String,
  }],

  // Metadata
  meta: {
    description: String,
    keywords: String,
    author: String,
    publishedDate: Date,
    lastModified: Date,
  },

  // LLM-Ready Document Chunks
  chunks: [DocumentChunkSchema],
  totalChunks: {
    type: Number,
    default: 0
  },

  // Processing Status
  status: {
    type: String,
    enum: ["pending", "processing", "completed", "failed"],
    default: "pending",
  },
  error: String,

  // Timestamps
  scrapedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: Date,
}, { _id: true, timestamps: true });

// Unified Scraping Model Schema
const UnifiedScrapingSchema = new Schema<IUnifiedScrapingModel>(
  {
    // User Reference - REQUIRED and INDEXED
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    // Company and Query Information
    companyName: {
      type: String,
      required: true,
      index: true
    },
    query: {
      type: String,
      required: true,
      index: true
    },

    // Search Results
    searchResults: {
      webResults: [SearchResultSchema],
      socialResults: [SearchResultSchema],
      totalResults: {
        type: Number,
        default: 0
      }
    },

    // Deep Scraped Pages
    deepScrapedPages: [DeepScrapedPageSchema],

    // Overall Status
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true
    },
    error: String,

    // Processing Statistics
    stats: {
      totalSearchResults: {
        type: Number,
        default: 0
      },
      totalPagesScraped: {
        type: Number,
        default: 0
      },
      totalChunksGenerated: {
        type: Number,
        default: 0
      },
      completedPages: {
        type: Number,
        default: 0
      },
      failedPages: {
        type: Number,
        default: 0
      }
    },

    // Timestamps
    completedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Compound Indexes for Better Query Performance
UnifiedScrapingSchema.index({ userId: 1, createdAt: -1 }); // Get all scraping data for a user, sorted by date
UnifiedScrapingSchema.index({ userId: 1, companyName: 1 }); // Get scraping data for a user by company
UnifiedScrapingSchema.index({ userId: 1, status: 1 }); // Get scraping data for a user by status
UnifiedScrapingSchema.index({ companyName: 1, createdAt: -1 }); // Get all scraping data for a company
UnifiedScrapingSchema.index({ query: 1, createdAt: -1 }); // Get scraping data by query

// Pre-save middleware to calculate stats
UnifiedScrapingSchema.pre('save', function(next) {
  if (this.isModified('deepScrapedPages') || this.isModified('searchResults')) {
    this.stats.totalSearchResults =
      (this.searchResults.webResults?.length || 0) +
      (this.searchResults.socialResults?.length || 0);

    this.stats.totalPagesScraped = this.deepScrapedPages?.length || 0;

    this.stats.completedPages = this.deepScrapedPages?.filter(
      page => page.status === 'completed'
    ).length || 0;

    this.stats.failedPages = this.deepScrapedPages?.filter(
      page => page.status === 'failed'
    ).length || 0;

    this.stats.totalChunksGenerated = this.deepScrapedPages?.reduce(
      (total, page) => total + (page.totalChunks || 0),
      0
    ) || 0;
  }

  // Update completedAt timestamp when status changes to completed
  if (this.isModified('status') && this.status === 'completed') {
    this.completedAt = new Date();
  }

  next();
});

export const UnifiedScrapingModel = mongoose.model<IUnifiedScrapingModel>(
  "UnifiedScraping",
  UnifiedScrapingSchema
);
