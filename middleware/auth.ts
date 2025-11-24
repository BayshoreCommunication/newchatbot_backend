import { Request, Response, NextFunction } from "express";

/**
 * Simple API key authentication middleware
 * Add your API key to .env as API_KEY=your_secret_key
 */
export const authenticateApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const apiKey = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");

  // If no API_KEY is set in environment, skip authentication (development mode)
  if (!process.env.API_KEY) {
    console.warn("Warning: API_KEY not set in environment variables. Authentication disabled.");
    next();
    return;
  }

  if (!apiKey) {
    res.status(401).json({ error: "API key is required" });
    return;
  }

  if (apiKey !== process.env.API_KEY) {
    res.status(403).json({ error: "Invalid API key" });
    return;
  }

  next();
};

/**
 * Optional authentication - only validates if API key is provided
 */
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const apiKey = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");

  if (apiKey && process.env.API_KEY && apiKey !== process.env.API_KEY) {
    res.status(403).json({ error: "Invalid API key" });
    return;
  }

  next();
};
