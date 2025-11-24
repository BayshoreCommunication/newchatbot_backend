"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addMessageToHistory = addMessageToHistory;
exports.getHistoryByThread = getHistoryByThread;
exports.getHistoryByOrg = getHistoryByOrg;
const chatMessageModel_1 = require("../model/chatMessageModel");
async function addMessageToHistory(threadId, message) {
    await chatMessageModel_1.ChatMessageModel.create({
        organizationId: "default", // Keep for backward compatibility, but we'll use threadId for queries
        threadId: threadId,
        sender: message.sender,
        text: message.text,
        timestamp: message.timestamp,
    });
}
async function getHistoryByThread(threadId) {
    const docs = await chatMessageModel_1.ChatMessageModel.find({ threadId: threadId })
        .sort({ timestamp: 1 })
        .lean();
    return docs.map((d) => ({
        sender: d.sender,
        text: d.text,
        timestamp: d.timestamp,
    }));
}
// Keep the old function for backward compatibility
async function getHistoryByOrg(orgId) {
    const docs = await chatMessageModel_1.ChatMessageModel.find({ organizationId: orgId })
        .sort({ timestamp: 1 })
        .lean();
    return docs.map((d) => ({
        sender: d.sender,
        text: d.text,
        timestamp: d.timestamp,
    }));
}
