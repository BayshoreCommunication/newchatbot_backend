import dotenv from "dotenv";
dotenv.config();

import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ASSISTANT_ID = "asst_dTLkYWbqQ8TzwhIBFw3YokcC";

async function attachVectorStore() {
  try {
    console.log("Checking current assistant configuration...");

    // Get current assistant
    const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
    console.log("Current vector stores:", assistant.tool_resources?.file_search?.vector_store_ids);

    // List all vector stores
    console.log("\nListing available vector stores...");
    const vectorStores = await openai.beta.vector_stores.list({ limit: 20 });
    console.log(`Found ${vectorStores.data.length} vector store(s):`);

    vectorStores.data.forEach((vs: OpenAI.Beta.VectorStore, index: number) => {
      console.log(`\n${index + 1}. Vector Store:`);
      console.log(`   ID: ${vs.id}`);
      console.log(`   Name: ${vs.name}`);
      console.log(`   File Count: ${vs.file_counts?.total || 0}`);
      console.log(`   Status: ${vs.status}`);
    });

    // If vector stores exist, attach the first one with files
    const vectorStoreWithFiles = vectorStores.data.find(
      (vs: OpenAI.Beta.VectorStore) => vs.file_counts && vs.file_counts.total > 0
    );

    if (vectorStoreWithFiles) {
      console.log(`\n✅ Attaching vector store: ${vectorStoreWithFiles.id}`);
      console.log(`   Name: ${vectorStoreWithFiles.name}`);
      console.log(`   Files: ${vectorStoreWithFiles.file_counts?.total}`);

      // Update assistant with vector store
      await openai.beta.assistants.update(ASSISTANT_ID, {
        tool_resources: {
          file_search: {
            vector_store_ids: [vectorStoreWithFiles.id],
          },
        },
      });

      console.log("\n🎉 Successfully attached vector store to assistant!");
      console.log("The AI can now search these files when answering questions.");
    } else {
      console.log("\n⚠️  No vector stores with files found!");
      console.log("You need to create a vector store and upload files first.");
      console.log("\nTo create a vector store:");
      console.log("1. Use the web scraper to scrape carterinjurylaw.com");
      console.log("2. Or manually upload files via OpenAI dashboard");
    }

  } catch (error: any) {
    console.error("Error:", error.message);
    if (error.response) {
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

attachVectorStore();
