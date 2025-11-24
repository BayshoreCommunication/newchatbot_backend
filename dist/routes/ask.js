"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.askRouter = void 0;
const express_1 = require("express");
const chatController_1 = require("../controller/chatController");
exports.askRouter = (0, express_1.Router)();
// Ask the assistant (creates thread if none provided)
exports.askRouter.post("/", chatController_1.handleAsk);
// Get chat history by thread ID
exports.askRouter.get("/history/:threadId", chatController_1.handleGetHistory);
