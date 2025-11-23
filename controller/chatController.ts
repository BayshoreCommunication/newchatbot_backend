import { Request, Response } from "express";
import {
  askOpenAIAssistant,
  generateOrganizationId,
  getWebsiteContent,
} from "../services/askService";
import { addMessageToHistory, getHistoryByOrg } from "../services/chatService";

export async function handleAsk(req: Request, res: Response) {
  let { apiKey, question, organizationId } = req.body;
  if (!apiKey) {
    apiKey = process.env.OPENAI_API_KEY;
  }
  if (!apiKey || !question) {
    return res.status(400).json({ error: "apiKey and question are required" });
  }
  if (!organizationId) {
    organizationId = generateOrganizationId();
  }
  try {
    const websiteContent = await getWebsiteContent();
    await addMessageToHistory(organizationId, {
      sender: "user",
      text: question,
      timestamp: Date.now(),
    });
    const answer = await askOpenAIAssistant(apiKey, question, websiteContent);
    await addMessageToHistory(organizationId, {
      sender: "ai",
      text: answer,
      timestamp: Date.now(),
    });
    const history = await getHistoryByOrg(organizationId);
    return res.json({
      organizationId,
      answer,
      history,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: (error as any).message || "Failed to process request." });
  }
}

export async function handleGetHistory(req: Request, res: Response) {
  const orgId = req.params.orgId;
  if (!orgId) return res.status(400).json({ error: "orgId required" });
  const history = await getHistoryByOrg(orgId);
  res.json({ orgId, history });
}
