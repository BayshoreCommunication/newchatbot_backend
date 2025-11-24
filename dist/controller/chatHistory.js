"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addMessageToHistory = addMessageToHistory;
exports.getHistoryByOrg = getHistoryByOrg;
const chatMessageModel_1 = require("../model/chatMessageModel");
// Store a message in MongoDB
async function addMessageToHistory(orgId, message) {
    await chatMessageModel_1.ChatMessageModel.create({
        organizationId: orgId,
        sender: message.sender,
        text: message.text,
        timestamp: message.timestamp,
    });
}
// Get all messages for an organization from MongoDB, sorted by timestamp
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
