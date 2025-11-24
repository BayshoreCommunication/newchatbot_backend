import dotenv from "dotenv";
dotenv.config();

import { OpenAI } from "openai";
import mongoose from "mongoose";
import { AssistantModel } from "../model/assistantModel";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function migrateAssistantToVectorStore() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log("Connected to MongoDB");

    // Find assistant with files but no vector store
    const assistant = await AssistantModel.findOne({
      fileIds: { $exists: true, $ne: [] },
      $or: [
        { vectorStoreIds: { $exists: false } },
        { vectorStoreIds: [] },
      ],
    });

    if (!assistant) {
      console.log("No assistants need migration");
      process.exit(0);
    }

    console.log(`Migrating assistant: ${assistant.name} (${assistant.openaiId})`);
    console.log(`Files: ${assistant.fileIds?.length || 0}`);

    if (!assistant.fileIds || assistant.fileIds.length === 0) {
      console.log("No files to migrate");
      process.exit(0);
    }

    // Create vector store with existing files
    const vectorStore = await openai.vectorStores.create({
      name: `${assistant.name} Knowledge Base`,
      file_ids: assistant.fileIds,
    });

    console.log(`Created vector store: ${vectorStore.id}`);

    // Update assistant in database
    assistant.vectorStoreIds = [vectorStore.id];
    await assistant.save();

    console.log("✅ Migration complete!");
    console.log(`Vector store ID: ${vectorStore.id}`);
    console.log(`Files attached: ${assistant.fileIds.length}`);

    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrateAssistantToVectorStore();
