"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAsk = handleAsk;
exports.handleGetHistory = handleGetHistory;
const openai_1 = require("openai");
const assistantModel_1 = require("../model/assistantModel");
const chatService_1 = require("../services/chatService");
const openai = new openai_1.OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
async function handleAsk(req, res) {
    const { assistantId, message, threadId, organizationId } = req.body;
    console.error("handleAsk received:", {
        assistantId,
        message,
        threadId,
        organizationId,
    });
    if (!assistantId || !message) {
        return res.status(400).json({
            error: "assistantId and message are required",
        });
    }
    try {
        // Ensure threadId is properly handled - convert undefined/null/empty string to null
        let currentThreadId = null;
        if (threadId &&
            typeof threadId === "string" &&
            threadId.trim() !== "" &&
            threadId !== "null" &&
            threadId !== "undefined") {
            currentThreadId = threadId;
        }
        // Validate existing thread if provided
        if (currentThreadId) {
            try {
                // Check if the thread exists and is accessible
                await openai.beta.threads.retrieve(currentThreadId);
                console.error("Using existing thread:", currentThreadId);
            }
            catch (threadError) {
                console.warn("Thread validation failed:", threadError.message, "- Creating new thread");
                currentThreadId = null; // Reset to create new thread
            }
        }
        console.error("After processing, currentThreadId:", currentThreadId);
        // Check if assistant needs model update for file_search compatibility
        const assistant = await assistantModel_1.AssistantModel.findOne({ openaiId: assistantId });
        if (assistant &&
            assistant.model === "gpt-4" &&
            assistant.tools.some((tool) => tool.type === "file_search")) {
            try {
                await openai.beta.assistants.update(assistantId, { model: "gpt-4o" });
                assistant.model = "gpt-4o";
                await assistant.save();
            }
            catch (updateError) {
                // Log error but continue - model update is not critical
            }
        }
        // Create a new thread if none provided
        if (!currentThreadId) {
            console.error("Creating new thread...");
            const thread = await openai.beta.threads.create();
            console.error("Thread creation result:", JSON.stringify(thread, null, 2));
            console.error("Thread ID:", thread.id, "Type:", typeof thread.id);
            if (!thread.id) {
                throw new Error("Failed to create thread: no thread ID returned");
            }
            if (typeof thread.id !== "string") {
                throw new Error("Thread ID is not a string: " + thread.id);
            }
            currentThreadId = thread.id;
            console.error("Set currentThreadId to:", currentThreadId, "Type:", typeof currentThreadId);
        }
        // Ensure currentThreadId is valid
        console.error("Final currentThreadId check:", currentThreadId, typeof currentThreadId);
        if (!currentThreadId || typeof currentThreadId !== "string") {
            throw new Error("Invalid thread ID after creation: " + currentThreadId);
        }
        // Save threadId before any OpenAI calls that might modify it
        const savedThreadId = currentThreadId;
        console.error("savedThreadId set to:", savedThreadId);
        // Add the user message to the thread
        await openai.beta.threads.messages.create(savedThreadId, {
            role: "user",
            content: message,
        });
        // Run the assistant
        const run = await openai.beta.threads.runs.create(savedThreadId, {
            assistant_id: assistantId,
        });
        // Validate run ID
        console.error("Run object:", JSON.stringify(run, null, 2));
        if (!run.id) {
            throw new Error("Failed to create run: no run ID returned");
        }
        if (run.id.startsWith("thread_")) {
            throw new Error("Run creation returned thread ID instead of run ID: " + run.id);
        }
        if (!run.id.startsWith("run_")) {
            throw new Error("Invalid run ID format: " + run.id);
        }
        // Wait for the run to complete (simple polling - in production, use webhooks)
        const threadIdCopy = String(savedThreadId);
        const runIdCopy = String(run.id);
        console.error("About to retrieve run status - threadIdCopy:", threadIdCopy, "runIdCopy:", runIdCopy);
        let runStatus = await openai.beta.threads.runs.retrieve(threadIdCopy, runIdCopy);
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds timeout
        while (runStatus.status !== "completed" &&
            runStatus.status !== "failed" &&
            attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            runStatus = await openai.beta.threads.runs.retrieve(threadIdCopy, runIdCopy);
            attempts++;
        }
        if (runStatus.status === "failed") {
            return res.status(500).json({
                error: "Assistant run failed",
                details: runStatus.last_error,
            });
        }
        if (runStatus.status !== "completed") {
            return res.status(500).json({
                error: "Assistant run timed out",
            });
        }
        // Get the assistant's response
        const messages = await openai.beta.threads.messages.list(savedThreadId, {
            limit: 1,
            order: "desc",
        });
        const assistantMessage = messages.data[0];
        const responseContent = assistantMessage.content[0];
        let answer = "";
        if (responseContent.type === "text") {
            answer = responseContent.text.value;
        }
        // Store in history if organizationId provided
        if (organizationId) {
            await (0, chatService_1.addMessageToHistory)(savedThreadId, {
                sender: "user",
                text: message,
                timestamp: Date.now(),
            });
            await (0, chatService_1.addMessageToHistory)(savedThreadId, {
                sender: "ai",
                text: answer,
                timestamp: Date.now(),
            });
        }
        res.json({
            threadId: savedThreadId,
            runId: run.id,
            answer,
            organizationId,
        });
    }
    catch (error) {
        console.error("Ask error:", error);
        return res.status(500).json({
            error: error.message || "Failed to process request.",
        });
    }
}
async function handleGetHistory(req, res) {
    const threadId = req.params.threadId;
    if (!threadId)
        return res.status(400).json({ error: "threadId required" });
    const history = await (0, chatService_1.getHistoryByThread)(threadId);
    res.json({ threadId, history });
}
