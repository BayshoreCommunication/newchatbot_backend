import mongoose, { Document, Schema } from "mongoose";

// Define tool subdocument schema to prevent auto _id generation
const ToolSchema = new Schema(
  {
    type: { type: String, required: true },
    function: {
      name: String,
      description: String,
      parameters: Schema.Types.Mixed,
    },
  },
  { _id: false }
); // Prevent MongoDB from adding _id to tool subdocuments

export interface ITool {
  type: string;
  function?: {
    name: string;
    description?: string;
    parameters?: Record<string, any>;
  };
}

export interface ITrainingSession {
  id: string;
  websiteUrl: string;
  scrapingMethod: "sitemap" | "recursive_crawl";
  totalUrlsFound: number;
  successfulScrapes: number;
  failedScrapes: number;
  pagesScraped: number;
  duration: string;
  startTime: string;
  endTime: string;
  fileId?: string;
  sitemapUrls?: number;
  status: "completed" | "failed";
  error?: string;
}

export interface IAssistant extends Omit<Document, "model"> {
  openaiId: string;
  name: string;
  instructions: string;
  tools: ITool[];
  model: string;
  fileIds?: string[];
  vectorStoreIds?: string[];
  trainingHistory?: ITrainingSession[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const AssistantSchema: Schema = new Schema(
  {
    openaiId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    instructions: { type: String, required: true },
    tools: {
      type: [ToolSchema],
      required: true,
      default: [],
    },
    model: { type: String, required: true },
    fileIds: { type: [String], default: [] },
    vectorStoreIds: { type: [String], default: [] },
    trainingHistory: {
      type: [
        {
          id: { type: String, required: true },
          websiteUrl: { type: String, required: true },
          scrapingMethod: {
            type: String,
            enum: ["sitemap", "recursive_crawl"],
            required: true,
          },
          totalUrlsFound: { type: Number, required: true },
          successfulScrapes: { type: Number, required: true },
          failedScrapes: { type: Number, required: true },
          pagesScraped: { type: Number, required: true },
          duration: { type: String, required: true },
          startTime: { type: String, required: true },
          endTime: { type: String, required: true },
          fileId: String,
          sitemapUrls: Number,
          status: {
            type: String,
            enum: ["completed", "failed"],
            required: true,
          },
          error: String,
        },
      ],
      default: [],
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

export const AssistantModel = mongoose.model<IAssistant>(
  "Assistant",
  AssistantSchema
);
