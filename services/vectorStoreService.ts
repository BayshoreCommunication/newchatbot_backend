import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import { IDocumentChunk } from "../models/unifiedScrapingModel";

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);

/**
 * Store document chunks in Pinecone
 */
export async function storeChunksInPinecone(
  chunks: IDocumentChunk[],
  companyName: string,
  userId?: string
) {
  try {
    console.log(
      `🌲 Storing ${chunks.length} chunks in Pinecone for ${companyName}...`
    );

    // Create LangChain documents
    const documents = chunks.map((chunk) => ({
      pageContent: chunk.content,
      metadata: {
        ...chunk.metadata,
        companyName: companyName, // Ensure company name is in metadata for filtering
        userId: userId || "system", // Store userId in metadata
      },
    }));

    // Initialize Embeddings
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "text-embedding-3-small",
      dimensions: 1024, // Match Pinecone index dimension
    });

    // Store in Pinecone
    // Using LangChain's PineconeStore for easy integration
    await PineconeStore.fromDocuments(documents, embeddings, {
      pineconeIndex: pineconeIndex as any,
      namespace: companyName.toLowerCase().replace(/\s+/g, "-"), // Use company name as namespace
    });

    console.log(`✅ Successfully stored ${chunks.length} chunks in Pinecone!`);
    return true;
  } catch (error: any) {
    console.error("❌ Error storing in Pinecone:", error);
    throw error;
  }
}
