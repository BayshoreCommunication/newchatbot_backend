import { Router } from "express";
import {
  handleAsk,
  handleCreateThread,
  handleGetHistory,
} from "../controller/chatController";

export const askRouter = Router();

// Ask the assistant (creates thread if none provided)
askRouter.post("/", handleAsk);

// Get chat history by thread ID
askRouter.get("/history/:threadId", handleGetHistory);

// Create a new thread
askRouter.post("/thread", handleCreateThread);
