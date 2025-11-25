import { Request, Response } from "express";
import UnknownQuestion from "../models/UnknownQuestion";

// Save unknown question
export const saveUnknownQuestion = async (req: Request, res: Response) => {
  try {
    const { question, threadId, userMessage, assistantResponse } = req.body;

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    const unknownQuestion = new UnknownQuestion({
      question,
      threadId,
      userMessage,
      assistantResponse,
    });

    await unknownQuestion.save();

    res.status(201).json({
      message: "Unknown question saved successfully",
      data: unknownQuestion,
    });
  } catch (error: any) {
    console.error("Error saving unknown question:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get all unknown questions
export const getUnknownQuestions = async (req: Request, res: Response) => {
  try {
    const { resolved, assistantId, limit = 50, page = 1 } = req.query;

    const filter: any = {};
    if (resolved !== undefined) {
      filter.resolved = resolved === "true";
    }
    if (assistantId) {
      filter.assistantId = assistantId;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const questions = await UnknownQuestion.find(filter)
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await UnknownQuestion.countDocuments(filter);

    res.json({
      data: questions,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error("Error fetching unknown questions:", error);
    res.status(500).json({ error: error.message });
  }
};

// Mark question as resolved
export const markAsResolved = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const question = await UnknownQuestion.findByIdAndUpdate(
      id,
      { resolved: true },
      { new: true }
    );

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    res.json({
      message: "Question marked as resolved",
      data: question,
    });
  } catch (error: any) {
    console.error("Error marking question as resolved:", error);
    res.status(500).json({ error: error.message });
  }
};

// Delete unknown question
export const deleteUnknownQuestion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const question = await UnknownQuestion.findByIdAndDelete(id);

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    res.json({
      message: "Question deleted successfully",
      data: question,
    });
  } catch (error: any) {
    console.error("Error deleting question:", error);
    res.status(500).json({ error: error.message });
  }
};
