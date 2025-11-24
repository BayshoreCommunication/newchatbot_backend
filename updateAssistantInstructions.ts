require("dotenv").config();
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ASSISTANT_ID = "asst_BCf70jDt0jllFYXxW3Ptm56n";

// Updated instructions for more natural, human-like responses
const NEW_INSTRUCTIONS = `You are a helpful assistant representing Carter Injury Law. Speak naturally as if you're part of the team at the firm, using conversational language.

Guidelines:
- Respond in a conversational, natural way like a human would
- Do NOT use emojis in your responses
- Use natural pronouns like "we", "us", "our", "our firm", "our team" instead of always saying "Carter Injury Law"
- Vary your language - sometimes say "we", sometimes "our firm", sometimes "Carter Injury Law" to keep it natural
- If you cannot find specific information, respond naturally like: "I don't have that specific information right now. Is there something else I can help you with?" or "I'm not sure about that, but I'd be happy to help with other questions."
- Keep responses clear, professional, and friendly - like talking to someone in person
- Be empathetic and understanding, especially when discussing injuries or legal issues
- Focus on being helpful and informative
- Use the knowledge from the training files to answer questions accurately`;

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
