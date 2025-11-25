import { NextFunction, Request, Response } from "express";

// Fixed model for cost optimization - no longer user-selectable
const FIXED_MODEL = "gpt-4o-mini";

export const validateCreateAssistant = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { name, instructions } = req.body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Valid name is required" });
    return;
  }

  if (
    !instructions ||
    typeof instructions !== "string" ||
    instructions.trim().length === 0
  ) {
    res.status(400).json({ error: "Valid instructions are required" });
    return;
  }

  // Model is no longer accepted from user - automatically set to gpt-4o-mini
  if (req.body.model) {
    res.status(400).json({
      error: `Model cannot be specified. All assistants use ${FIXED_MODEL} for cost optimization.`,
    });
    return;
  }

  if (req.body.tools && !Array.isArray(req.body.tools)) {
    res.status(400).json({ error: "Tools must be an array" });
    return;
  }

  next();
};

export const validateUpdateAssistant = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { name, instructions, tools } = req.body;

  if (
    name !== undefined &&
    (typeof name !== "string" || name.trim().length === 0)
  ) {
    res.status(400).json({ error: "Name must be a non-empty string" });
    return;
  }

  if (
    instructions !== undefined &&
    (typeof instructions !== "string" || instructions.trim().length === 0)
  ) {
    res.status(400).json({ error: "Instructions must be a non-empty string" });
    return;
  }

  // Model cannot be changed - locked to gpt-4o-mini
  if (req.body.model) {
    res.status(400).json({
      error: `Model cannot be changed. All assistants are locked to ${FIXED_MODEL} for cost optimization.`,
    });
    return;
  }

  if (tools !== undefined && !Array.isArray(tools)) {
    res.status(400).json({ error: "Tools must be an array" });
    return;
  }

  next();
};

export const validateIdParam = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { id } = req.params;

  if (!id || id.length !== 24) {
    res.status(400).json({ error: "Valid MongoDB ID is required" });
    return;
  }

  next();
};
