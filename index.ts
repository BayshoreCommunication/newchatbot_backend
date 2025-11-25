require("dotenv").config();
const express = require("express");
const { askRouter } = require("./routes/ask");
const scrapeRouter = require("./routes/scrape").default;
const { connectMongo } = require("./config/db");
const assistantRouter = require("./routes/assistantRoutes").default;
const unknownQuestionRouter = require("./routes/unknownQuestionRoutes").default;
const leadRouter = require("./routes/leadRoutes").default;

const cors = require("cors");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

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
