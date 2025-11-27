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
const knowledgeBaseRouter = require("./routes/knowledgeBaseRoutes").default;

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
    documentation: "https://testchatbot-backend-r5hb.vercel.app",
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
app.use("/api", knowledgeBaseRouter);

// Connect to MongoDB
connectMongo();

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
