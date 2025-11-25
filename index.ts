import { config } from "dotenv";
import express, { Request, Response } from "express";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";

config();

const { askRouter } = require("./routes/ask");
const scrapeRouter = require("./routes/scrape").default;
const { connectMongo } = require("./config/db");
const assistantRouter = require("./routes/assistantRoutes").default;
const unknownQuestionRouter = require("./routes/unknownQuestionRoutes").default;
const leadRouter = require("./routes/leadRoutes").default;

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  message: "Too many chat requests, please slow down.",
});

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(limiter);

// Welcome endpoint
app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Welcome to AI Chatbot Backend API",
    version: "1.0.0",
    status: "online",
    endpoints: {
      chat: {
        sendMessage: "POST /ask",
        getHistory: "GET /ask/history/:threadId",
        createThread: "POST /ask/thread"
      },
      assistants: {
        create: "POST /api/assistant",
        list: "GET /api/assistant",
        retrieve: "GET /api/assistant/:id",
        update: "PUT /api/assistant/:id",
        delete: "DELETE /api/assistant/:id",
        trainWebsite: "POST /api/assistant/:id/train-website"
      },
      leads: {
        create: "POST /api/leads",
        list: "GET /api/leads",
        retrieve: "GET /api/leads/:id",
        update: "PUT /api/leads/:id",
        delete: "DELETE /api/leads/:id",
        markContacted: "PATCH /api/leads/:id/contact"
      },
      unknownQuestions: {
        list: "GET /api/unknown-questions",
        resolve: "PATCH /api/unknown-questions/:id/resolve",
        delete: "DELETE /api/unknown-questions/:id"
      },
      scraping: {
        startJob: "POST /api/scrape",
        checkStatus: "GET /api/status/:jobId",
        getResult: "GET /api/result/:jobId"
      },
      health: "GET /health"
    },
    documentation: "https://github.com/your-repo/chatbot-backend",
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get("/health", async (req: Request, res: Response) => {
  const healthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      api: "operational",
      mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + " MB"
      }
    },
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development"
  };

  const statusCode = healthStatus.services.mongodb === "connected" ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

app.use("/ask", chatLimiter, askRouter);
app.use("/api", scrapeRouter);
app.use("/api", assistantRouter);
app.use("/api", unknownQuestionRouter);
app.use("/api", leadRouter);

// Connect to MongoDB
connectMongo();

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
