# AI Assistant Chatbot Backend

This backend is a TypeScript API that allows users to interact with an AI assistant powered by the OpenAI Assistant API. The assistant learns from a fixed website (https://www.carterinjurylaw.com), scrapes and caches its content, and answers user questions based on the website data. Users provide their OpenAI API key for personalized access.

## Features

- Scrapes and caches content from https://www.carterinjurylaw.com
- Integrates with OpenAI Assistant API
- Answers user questions based on website data
- TypeScript, Node.js, and Express.js backend

## Setup

1. Install dependencies: `npm install`
2. Set up environment variables (see `.env.example`)
3. Start the server: `npm run dev`

## API Endpoints (to be implemented)

- `POST /ask` — Ask a question, provide OpenAI API key

## Notes

- Website URL is fixed and scraping is automatic
- Cached data is used for efficiency
- Extendable for other websites or features
