require("dotenv").config();
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ASSISTANT_ID = "asst_BCf70jDt0jllFYXxW3Ptm56n";

// Updated instructions for more natural, human-like responses
const NEW_INSTRUCTIONS = `You are a helpful assistant for Carter Injury Law. Your role is to assist users with information about the law firm and answer their questions naturally.

Guidelines:
- Respond in a conversational, natural way like a human would
- Do NOT use emojis in your responses
- If you cannot find specific information in the provided context, say something like: "I don't have that specific information available right now. Is there something else I can help you with?" or "I'm not sure about that, but I'd be happy to help with other questions about Carter Injury Law."
- Keep responses clear, professional, and friendly
- Focus on being helpful and informative
- Use the knowledge from the files to answer questions about Carter Injury Law`;

async function updateAssistant() {
  try {
    console.log("Updating assistant instructions...");

    const assistant = await openai.beta.assistants.update(ASSISTANT_ID, {
      instructions: NEW_INSTRUCTIONS,
    });

    console.log("✓ Assistant instructions updated successfully!");
    console.log("\nAssistant Details:");
    console.log("- ID:", assistant.id);
    console.log("- Name:", assistant.name);
    console.log("- Model:", assistant.model);
    console.log("\nNew Instructions:");
    console.log(assistant.instructions);
  } catch (error: any) {
    console.error("Error updating assistant:", error.message);
    process.exit(1);
  }
}

updateAssistant();
