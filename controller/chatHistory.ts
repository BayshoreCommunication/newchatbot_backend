import { ChatMessageModel } from "../model/chatMessageModel";

export type ChatMessage = {
  sender: "user" | "ai";
  text: string;
  timestamp: number;
};

// Store a message in MongoDB
export async function addMessageToHistory(orgId: string, message: ChatMessage) {
  await ChatMessageModel.create({
    organizationId: orgId,
    sender: message.sender,
    text: message.text,
    timestamp: message.timestamp,
  });
}

// Get all messages for an organization from MongoDB, sorted by timestamp
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
