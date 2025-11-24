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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// Define tool subdocument schema to prevent auto _id generation
const ToolSchema = new mongoose_1.Schema({
    type: { type: String, required: true },
    function: {
        name: String,
        description: String,
        parameters: mongoose_1.Schema.Types.Mixed,
    },
}, { _id: false }); // Prevent MongoDB from adding _id to tool subdocuments
const AssistantSchema = new mongoose_1.Schema({
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
    metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
}, {
    timestamps: true,
});
exports.AssistantModel = mongoose_1.default.model("Assistant", AssistantSchema);
