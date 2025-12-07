import compression from "compression";
import cors from "cors";
import { config } from "dotenv";
import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import session from "express-session";
import mongoose from "mongoose";
import passport from "passport";
import configurePassport from "./config/passport";
import subscriptionRoutes from "./routes/subscriptionRoutes";
import { initializeCronJobs } from "./services/cronScheduler";

config();

// Import routes
import authCheckRoutes from "./routes/authCheckRoutes";
import authRoutes from "./routes/authRoutes";
import llmWebSearchRoutes from "./routes/llmModelWebsearchRoute";
import unifiedScrapingRoutes from "./routes/unifiedScraping";
import userRoutes from "./routes/userRoutes";
const { askRouter } = require("./routes/ask");
const scrapeRouter = require("./routes/scrape").default;
const { connectMongo } = require("./config/db");
const assistantRouter = require("./routes/assistantRoutes").default;
const unknownQuestionRouter = require("./routes/unknownQuestionRoutes").default;
const leadRouter = require("./routes/leadRoutes").default;
const knowledgeBaseRouter = require("./routes/knowledgeBaseRoutes").default;

const app = express();

// Rate Limiting
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

// Middleware
app.use(cors());
app.use(compression());
app.use(
  express.json({
    limit: "10mb",
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(limiter);

// Session Middleware for Passport
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey", // It's important to use an environment variable for this
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // Use secure cookies in production
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

// Passport Middleware
configurePassport();
app.use(passport.initialize());
app.use(passport.session());

// Welcome endpoint
app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Welcome to AI Chatbot Backend API",
    version: "1.0.0",
    status: "online",
    documentation: "https://testchatbot-backend-r5hb.vercel.app",
    timestamp: new Date().toISOString(),
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
      mongodb:
        mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
        total:
          Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + " MB",
      },
    },
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
  };

  const statusCode = healthStatus.services.mongodb === "connected" ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/auth-check", authCheckRoutes);
app.use("/api", userRoutes);
app.use("/ask", chatLimiter, askRouter);
app.use("/api", scrapeRouter);
app.use("/api", assistantRouter);
app.use("/api", unknownQuestionRouter);
app.use("/api", leadRouter);
app.use("/api", knowledgeBaseRouter);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/unified-scraping", unifiedScrapingRoutes);
app.use("/api/web-search", llmWebSearchRoutes);

// Connect to MongoDB
connectMongo();

// Initialize cron jobs and email service
initializeCronJobs();

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
