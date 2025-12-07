import mongoose, { Document, Schema } from "mongoose";

/**
 * Interface for Knowledge Base Document
 */
export interface IKnowledgeBase extends Document {
  userId: mongoose.Types.ObjectId;
  companyName: string;
  sources: {
    type: "website" | "web_search" | "manual" | "document";
    url?: string;
    searchQuery?: string;
    content: string;
    processedAt: Date;
  }[];
  structuredData: {
    companyOverview?: string;
    services?: string[];
    products?: string[];
    contactInfo?: {
      email?: string;
      phone?: string;
      address?: string;
      socialMedia?: Record<string, string>;
    };
    keyFeatures?: string[];
    pricing?: string;
    faqs?: Array<{ question: string; answer: string }>;
    additionalInfo?: Record<string, any>;
  };
  rawContent?: string;
  vectorStoreId?: string;
  fileIds?: string[];
  metadata: {
    totalSources: number;
    lastUpdated: Date;
    version: number;
    model: string;
    tokenCount?: number;
    quality: "high" | "medium" | "low";
    qualityPercentage?: number;
    updateHistory?: Array<{
      version: number;
      updatedAt: Date;
      totalSources: number;
      quality: "high" | "medium" | "low";
      qualityPercentage: number;
      changes: string;
    }>;
  };
  status: "active" | "processing" | "failed" | "archived";
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeBaseSchema: Schema = new Schema<IKnowledgeBase>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    companyName: {
      type: String,
      required: true,
      index: true,
    },
    sources: [
      {
        type: {
          type: String,
          enum: ["website", "web_search", "manual", "document"],
          required: true,
        },
        url: String,
        searchQuery: String,
        content: {
          type: String,
          required: true,
        },
        processedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    structuredData: {
      companyOverview: String,
      services: [String],
      products: [String],
      contactInfo: {
        email: String,
        phone: String,
        address: String,
        socialMedia: Schema.Types.Mixed,
      },
      keyFeatures: [String],
      pricing: String,
      faqs: [
        {
          question: String,
          answer: String,
        },
      ],
      additionalInfo: Schema.Types.Mixed,
    },
    rawContent: {
      type: String,
      required: false,
      default: "",
    },
    vectorStoreId: String,
    fileIds: [String],
    metadata: {
      totalSources: {
        type: Number,
        default: 0,
      },
      lastUpdated: {
        type: Date,
        default: Date.now,
      },
      version: {
        type: Number,
        default: 1,
      },
      model: {
        type: String,
        default: "gpt-5",
      },
      tokenCount: Number,
      quality: {
        type: String,
        enum: ["high", "medium", "low"],
        default: "medium",
      },
      qualityPercentage: {
        type: Number,
        default: 0,
      },
      updateHistory: [
        {
          version: Number,
          updatedAt: Date,
          totalSources: Number,
          quality: {
            type: String,
            enum: ["high", "medium", "low"],
          },
          qualityPercentage: Number,
          changes: String,
        },
      ],
    },
    status: {
      type: String,
      enum: ["active", "processing", "failed", "archived"],
      default: "processing",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
KnowledgeBaseSchema.index({ userId: 1, status: 1 });
KnowledgeBaseSchema.index({ companyName: "text" });
KnowledgeBaseSchema.index({ "metadata.lastUpdated": -1 });

export default mongoose.model<IKnowledgeBase>(
  "KnowledgeBase",
  KnowledgeBaseSchema
);
