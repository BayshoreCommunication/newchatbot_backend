require('dotenv').config();
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ASSISTANT_ID = 'asst_dTLkYWbqQ8TzwhIBFw3YokcC';

async function testFileSearch() {
  console.log('Testing file_search with a direct question...\n');

  // Create a thread
  const thread = await openai.beta.threads.create();
  console.log('Created thread:', thread.id);

  // Add a message that SHOULD trigger file_search
  await openai.beta.threads.messages.create(thread.id, {
    role: 'user',
    content: "What's your email address?"
  });

  console.log('Sent question: "What\'s your email address?"');

  // Run the assistant
  const run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: ASSISTANT_ID,
  });

  console.log('Created run:', run.id);
  console.log('Waiting for completion...\n');

  // Wait for completion
  let runStatus = await openai.beta.threads.runs.retrieve(run.id, { thread_id: thread.id });
  while (runStatus.status !== 'completed' && runStatus.status !== 'failed') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    runStatus = await openai.beta.threads.runs.retrieve(run.id, { thread_id: thread.id });
    console.log('Status:', runStatus.status);
  }

  if (runStatus.status === 'failed') {
    console.error('Run failed:', runStatus.last_error);
    return;
  }

  // Get the response
  const messages = await openai.beta.threads.messages.list(thread.id);
  const response = messages.data[0];
  const content = response.content[0];

  if (content.type === 'text') {
    console.log('\n✅ Response:', content.text.value);
    console.log('\n📚 Citations:', content.text.annotations.length);

    if (content.text.annotations.length > 0) {
      console.log('\n✅✅✅ FILE SEARCH WAS USED! ✅✅✅');
      content.text.annotations.forEach((annotation, i) => {
        console.log(`\nCitation ${i + 1}:`);
        console.log('Type:', annotation.type);
        if (annotation.file_citation) {
          console.log('File ID:', annotation.file_citation.file_id);
          console.log('Quote preview:', annotation.file_citation.quote?.substring(0, 100));
        }
      });
    } else {
      console.log('\n⚠️⚠️⚠️ NO FILE SEARCH USED ⚠️⚠️⚠️');
      console.log('The AI answered from instructions only');
    }
  }
}

testFileSearch().catch(console.error);
