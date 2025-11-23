import { Router } from "express";
import { handleAsk, handleGetHistory } from "../controller/chatController";

export const askRouter = Router();

askRouter.post("/", handleAsk);
askRouter.get("/history/:orgId", handleGetHistory);
