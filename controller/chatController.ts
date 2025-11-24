import { Request, Response } from "express";
import { OpenAI } from "openai";
import { AssistantModel } from "../model/assistantModel";
import {
  addMessageToHistory,
  getHistoryByThread,
} from "../services/chatService";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function handleAsk(req: Request, res: Response) {
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
    let currentThreadId: string | null = null;
    if (
      threadId &&
      typeof threadId === "string" &&
      threadId.trim() !== "" &&
      threadId !== "null" &&
      threadId !== "undefined"
    ) {
      currentThreadId = threadId;
    }

    // Validate existing thread if provided
    if (currentThreadId) {
      try {
        // Check if the thread exists and is accessible
        await openai.beta.threads.retrieve(currentThreadId);
        console.error("Using existing thread:", currentThreadId);
      } catch (threadError: any) {
        console.warn(
          "Thread validation failed:",
          threadError.message,
          "- Creating new thread"
        );
        currentThreadId = null; // Reset to create new thread
      }
    }
    console.error("After processing, currentThreadId:", currentThreadId);

    // Check if assistant needs model update for file_search compatibility
    const assistant = await AssistantModel.findOne({ openaiId: assistantId });
    console.error("Assistant from DB:", JSON.stringify(assistant, null, 2));
    if (
      assistant &&
      assistant.model === "gpt-4" &&
      assistant.tools.some((tool: any) => tool.type === "file_search")
    ) {
      try {
        await openai.beta.assistants.update(assistantId, { model: "gpt-4o" });
        assistant.model = "gpt-4o" as any;
        await assistant.save();
      } catch (updateError) {
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
      console.error(
        "Set currentThreadId to:",
        currentThreadId,
        "Type:",
        typeof currentThreadId
      );
    }

    // Ensure currentThreadId is valid
    console.error(
      "Final currentThreadId check:",
      currentThreadId,
      typeof currentThreadId
    );
    if (!currentThreadId || typeof currentThreadId !== "string") {
      throw new Error("Invalid thread ID after creation: " + currentThreadId);
    }

    // Save threadId before any OpenAI calls that might modify it
    const savedThreadId = currentThreadId;
    console.error("savedThreadId set to:", savedThreadId);

    // Check for active runs and cancel them
    try {
      const runs = await openai.beta.threads.runs.list(savedThreadId, {
        limit: 1,
      });

      if (runs.data.length > 0) {
        const lastRun = runs.data[0];
        if (lastRun.status === "in_progress" || lastRun.status === "queued") {
          console.error(`Cancelling active run: ${lastRun.id} (status: ${lastRun.status})`);
          await openai.beta.threads.runs.cancel(lastRun.id, {
            thread_id: savedThreadId,
          });
          // Wait a moment for cancellation to process
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    } catch (cancelError) {
      console.error("Error checking/cancelling runs:", cancelError);
      // Continue anyway
    }

    // Add the user message to the thread
    await openai.beta.threads.messages.create(savedThreadId, {
      role: "user",
      content: message,
    });

    // Run the assistant with vector store if available
    const runParams: any = {
      assistant_id: assistantId,
    };

    // Attach vector store to the run if the assistant has one
    console.error("Checking vector stores - assistant exists:", !!assistant);
    console.error("Vector store IDs:", assistant?.vectorStoreIds);
    if (assistant && assistant.vectorStoreIds && assistant.vectorStoreIds.length > 0) {
      console.error("Attaching vector stores:", assistant.vectorStoreIds);
      runParams.tool_resources = {
        file_search: {
          vector_store_ids: assistant.vectorStoreIds,
        },
      };
    } else {
      console.error("No vector stores found or assistant not loaded from DB");
    }

    const run = await openai.beta.threads.runs.create(savedThreadId, runParams);

    // Validate run ID
    console.error("Run object:", JSON.stringify(run, null, 2));
    if (!run.id) {
      throw new Error("Failed to create run: no run ID returned");
    }
    if (run.id.startsWith("thread_")) {
      throw new Error(
        "Run creation returned thread ID instead of run ID: " + run.id
      );
    }
    if (!run.id.startsWith("run_")) {
      throw new Error("Invalid run ID format: " + run.id);
    }

    // Wait for the run to complete (simple polling - in production, use webhooks)
    const threadIdCopy = String(savedThreadId);
    const runIdCopy = String(run.id);
    console.error(
      "About to retrieve run status - threadIdCopy:",
      threadIdCopy,
      "runIdCopy:",
      runIdCopy
    );
    let runStatus = await openai.beta.threads.runs.retrieve(
      run.id,
      { thread_id: savedThreadId }
    );
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds timeout (increased for vector search)

    while (
      runStatus.status !== "completed" &&
      runStatus.status !== "failed" &&
      runStatus.status !== "expired" &&
      runStatus.status !== "cancelled" &&
      attempts < maxAttempts
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(
        run.id,
        { thread_id: savedThreadId }
      );
      console.error(`Run status: ${runStatus.status} (attempt ${attempts + 1}/${maxAttempts})`);
      attempts++;
    }

    if (runStatus.status === "failed") {
      console.error("Run failed with error:", runStatus.last_error);
      return res.status(500).json({
        error: "Assistant run failed",
        details: runStatus.last_error,
      });
    }

    if (runStatus.status === "expired") {
      return res.status(500).json({
        error: "Assistant run expired",
      });
    }

    if (runStatus.status === "cancelled") {
      return res.status(500).json({
        error: "Assistant run was cancelled",
      });
    }

    if (runStatus.status !== "completed") {
      console.error(`Run timed out with status: ${runStatus.status}`);
      return res.status(500).json({
        error: "Assistant run timed out",
        status: runStatus.status,
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

      // Remove citation markers like 【93:0†source】
      answer = answer.replace(/【[^】]*】/g, "");

      // Clean up extra spaces but preserve newlines
      answer = answer.replace(/ {2,}/g, " "); // Replace multiple spaces with single space
      answer = answer.trim();
    }

    // Store in history if organizationId provided
    if (organizationId) {
      await addMessageToHistory(savedThreadId, {
        sender: "user",
        text: message,
        timestamp: Date.now(),
      });
      await addMessageToHistory(savedThreadId, {
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
  } catch (error: any) {
    console.error("Ask error:", error);
    return res.status(500).json({
      error: error.message || "Failed to process request.",
    });
  }
}

export async function handleGetHistory(req: Request, res: Response) {
  const threadId = req.params.threadId;
  if (!threadId) return res.status(400).json({ error: "threadId required" });
  const history = await getHistoryByThread(threadId);
  res.json({ threadId, history });
}

export async function handleCreateThread(req: Request, res: Response) {
  try {
    const thread = await openai.beta.threads.create();
    if (!thread.id) {
      throw new Error("Failed to create thread: no thread ID returned");
    }
    res.json({ threadId: thread.id });
  } catch (error: any) {
    console.error("Create thread error:", error);
    return res.status(500).json({
      error: error.message || "Failed to create thread.",
    });
  }
}
