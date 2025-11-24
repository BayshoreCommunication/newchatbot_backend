import { ChatMessageModel } from "../model/chatMessageModel";

export type ChatMessage = {
  sender: "user" | "ai";
  text: string;
  timestamp: number;
};

export async function addMessageToHistory(
  threadId: string,
  message: ChatMessage
) {
  await ChatMessageModel.create({
    organizationId: "default", // Keep for backward compatibility, but we'll use threadId for queries
    threadId: threadId,
    sender: message.sender,
    text: message.text,
    timestamp: message.timestamp,
  });
}

export async function getHistoryByThread(
  threadId: string
): Promise<ChatMessage[]> {
  const docs = await ChatMessageModel.find({ threadId: threadId })
    .sort({ timestamp: 1 })
    .lean();
  return docs.map((d) => ({
    sender: d.sender,
    text: d.text,
    timestamp: d.timestamp,
  }));
}

// Keep the old function for backward compatibility
export async function getHistoryByOrg(orgId: string): Promise<ChatMessage[]> {
  const docs = await ChatMessageModel.find({ organizationId: orgId })
    .sort({ timestamp: 1 })
    .lean();
  return docs.map((d) => ({
    sender: d.sender,
    text: d.text,
    timestamp: d.timestamp,
  }));
}
