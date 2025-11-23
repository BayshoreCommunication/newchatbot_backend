require("dotenv").config();
const express = require("express");
const { askRouter } = require("./routes/ask");
const { connectMongo } = require("./config/db");

// CORS middleware to allow all origins
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/ask", askRouter);

// Connect to MongoDB
connectMongo();

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
