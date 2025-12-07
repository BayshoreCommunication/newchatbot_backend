# 🚀 Unified Scraping API - One-Click LLM Knowledge Base

## Overview

**Single endpoint that does EVERYTHING:**
1. ✅ Searches Google for company
2. ✅ Gets URLs (web + social media)
3. ✅ Deep scrapes all pages with Puppeteer
4. ✅ Returns LLM-ready chunks

**No multiple requests needed!**

---

## 🎯 Main Endpoint

### **Process Company for LLM**

**ONE REQUEST** - Does all steps automatically!

**Endpoint:** `POST /api/unified-scraping/process`

**Request Body:**
```json
{
  "companyName": "Carter Injury Law",
  "maxUrls": 10
}
```

**Parameters:**
- `companyName` (required): Company name to search
- `maxUrls` (optional): Max URLs to deep scrape (default: 10)

---

## 📋 Example Usage

### Using cURL:

```bash
curl -X POST http://localhost:8000/api/unified-scraping/process \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Carter Injury Law",
    "maxUrls": 10
  }'
```

### Using Postman:

1. **Method:** POST
2. **URL:** `http://localhost:8000/api/unified-scraping/process`
3. **Headers:** `Content-Type: application/json`
4. **Body (raw JSON):**
```json
{
  "companyName": "Carter Injury Law",
  "maxUrls": 10
}
```

---

## ✅ Complete Response Example

```json
{
  "success": true,
  "message": "Company data processed successfully for LLM",
  "data": {
    "companyName": "Carter Injury Law",

    "searchResults": {
      "totalUrls": 19,
      "webUrls": 10,
      "socialUrls": 9,
      "urls": [
        {
          "title": "Carter Injury Law: Experienced Personal Injury Attorney in Tampa",
          "url": "https://www.carterinjurylaw.com/",
          "snippet": "Carter Injury Law, your diligent personal injury attorney..."
        },
        {
          "title": "Carter Injury Law | Tampa FL",
          "url": "https://www.facebook.com/CarterInjuryLaw/",
          "snippet": "At Carter Injury Law, we believe that every case matters..."
        }
      ]
    },

    "deepScraping": {
      "totalScraped": 10,
      "successCount": 9,
      "failCount": 1,
      "scrapedUrls": [
        {
          "url": "https://www.carterinjurylaw.com/",
          "success": true,
          "pageTitle": "Carter Injury Law: Experienced Personal Injury Attorney in Tampa",
          "totalChunks": 12,
          "error": null
        },
        {
          "url": "https://www.facebook.com/CarterInjuryLaw/",
          "success": true,
          "pageTitle": "Carter Injury Law | Tampa FL",
          "totalChunks": 8,
          "error": null
        }
      ]
    },

    "knowledgeBase": {
      "totalChunks": 87,
      "ready": true,
      "chunks": [
        {
          "content": "# Carter Injury Law: Experienced Personal Injury Attorney in Tampa\n\nCarter Injury Law provides experienced legal representation for individuals injured in auto accidents, slip and falls, medical malpractice...",
          "metadata": {
            "source": "https://www.carterinjurylaw.com/",
            "chunkIndex": 0,
            "totalChunks": 12,
            "pageTitle": "Carter Injury Law: Experienced Personal Injury Attorney in Tampa",
            "companyName": "Carter Injury Law",
            "scrapedDate": "2025-12-03T10:30:00.000Z"
          }
        },
        {
          "content": "## Our Practice Areas\n\nWe handle a wide range of personal injury cases including:\n- Auto accidents and car crashes\n- Slip and fall injuries\n- Medical malpractice...",
          "metadata": {
            "source": "https://www.carterinjurylaw.com/",
            "chunkIndex": 1,
            "totalChunks": 12,
            "pageTitle": "Carter Injury Law: Experienced Personal Injury Attorney in Tampa",
            "companyName": "Carter Injury Law",
            "scrapedDate": "2025-12-03T10:30:00.000Z"
          }
        }
      ]
    },

    "ids": {
      "searchResultId": "6930013fc0ffe31386ed9fb9"
    }
  }
}
```

---

## 📊 Response Structure

### `searchResults`
- Lists all URLs found in Google search
- Shows web URLs vs social media URLs
- Includes title, URL, and snippet for each

### `deepScraping`
- Shows which URLs were scraped
- Success/fail count for each URL
- Page titles and chunk counts
- Error messages (if any)

### `knowledgeBase`
- **THIS IS WHAT YOU NEED FOR LLM!**
- `totalChunks`: Total number of text chunks
- `ready`: Boolean - is data ready for LLM?
- `chunks`: Array of LLM-ready document chunks
  - Each chunk is 1000 characters
  - 200 character overlap between chunks
  - Includes metadata (source URL, page title, company name)

---

## 🤖 Using with LLM/RAG

### Option 1: Direct Use (Simple)

```javascript
// Get response from API
const response = await fetch('http://localhost:8000/api/unified-scraping/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ companyName: 'Carter Injury Law', maxUrls: 10 })
});

const data = await response.json();

// Use chunks directly with OpenAI
const chunks = data.data.knowledgeBase.chunks;

// Combine all chunks into context
const context = chunks.map(chunk => chunk.content).join('\n\n');

// Send to OpenAI
const openaiResponse = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [
    { role: "system", content: `You are a helpful assistant. Use this knowledge base:\n\n${context}` },
    { role: "user", content: "What services does Carter Injury Law provide?" }
  ]
});
```

### Option 2: Vector Database (Advanced)

```javascript
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";

// Get chunks from API
const response = await fetch('...');
const { chunks } = response.data.knowledgeBase;

// Create embeddings
const embeddings = new OpenAIEmbeddings();

// Store in Pinecone
await PineconeStore.fromDocuments(
  chunks.map(chunk => ({
    pageContent: chunk.content,
    metadata: chunk.metadata
  })),
  embeddings,
  { pineconeIndex: index, namespace: "carter-injury-law" }
);
```

---

## ⏱️ Processing Time

- **Google Search:** ~2-3 seconds
- **Deep Scraping (10 URLs):** ~20-30 seconds
  - ~2-3 seconds per URL
- **Total:** ~25-35 seconds

**Note:** This is a long-running request! Make sure your client timeout is set to at least 60 seconds.

---

## 🎯 Quick Lookup Endpoint

If you already processed a company and just want the chunks:

**Endpoint:** `GET /api/unified-scraping/chunks/:companyName`

**Example:**
```bash
curl http://localhost:8000/api/unified-scraping/chunks/Carter%20Injury%20Law
```

**Response:**
```json
{
  "success": true,
  "companyName": "Carter Injury Law",
  "totalChunks": 87,
  "chunks": [...]
}
```

---

## 🚨 Error Responses

### 400 - Bad Request
```json
{
  "success": false,
  "message": "companyName is required"
}
```

### 404 - Not Found
```json
{
  "success": false,
  "message": "No search results found for this company"
}
```

### 500 - Server Error
```json
{
  "success": false,
  "message": "Failed to process company data",
  "error": "Detailed error message"
}
```

---

## 🔧 Configuration

### Adjust Max URLs

```json
{
  "companyName": "Carter Injury Law",
  "maxUrls": 5  // Faster processing (5-15 seconds)
}
```

```json
{
  "companyName": "Carter Injury Law",
  "maxUrls": 20  // More data (40-60 seconds)
}
```

---

## 📝 Complete Testing Workflow

### Step 1: Process Company Data
```bash
POST http://localhost:8000/api/unified-scraping/process
Body: { "companyName": "Carter Injury Law", "maxUrls": 10 }
```
⏳ Wait 25-35 seconds

### Step 2: Use LLM Chunks
```javascript
// Extract chunks from response
const chunks = response.data.knowledgeBase.chunks;

// Send to your LLM
// OR store in vector database
// OR use for RAG system
```

### Step 3: Quick Lookup (Optional)
```bash
GET http://localhost:8000/api/unified-scraping/chunks/Carter Injury Law
```
✅ Instant response with cached chunks

---

## 💡 Use Cases

### 1. Chatbot Knowledge Base
```javascript
// Process company once
const data = await processCompany("Carter Injury Law");

// Use chunks in chatbot
app.post('/chat', async (req, res) => {
  const context = data.knowledgeBase.chunks.map(c => c.content).join('\n\n');
  const answer = await openai.chat(...);
  res.json({ answer });
});
```

### 2. Company Research
```javascript
// Get comprehensive company data in one call
const data = await processCompany("Tesla");

console.log(`Found ${data.searchResults.totalUrls} URLs`);
console.log(`Scraped ${data.deepScraping.successCount} pages`);
console.log(`Generated ${data.knowledgeBase.totalChunks} chunks`);
```

### 3. Competitive Analysis
```javascript
// Process multiple companies
const companies = ["Carter Injury Law", "Morgan & Morgan", "Smith Law Firm"];

for (const company of companies) {
  const data = await processCompany(company);
  // Compare data...
}
```

---

## ✅ Checklist

- [ ] Backend server running on port 8000
- [ ] MongoDB connected
- [ ] Puppeteer installed
- [ ] Test with Postman: `POST /api/unified-scraping/process`
- [ ] Get LLM-ready chunks in response
- [ ] Use chunks with your LLM!

---

## 🎉 You're Ready!

**One API call gives you:**
- ✅ Google search results
- ✅ Deep scraped content
- ✅ LLM-ready knowledge base chunks
- ✅ Ready for OpenAI, Claude, or any LLM
- ✅ Ready for vector databases (Pinecone, Chroma, etc.)

**Start now:**
```bash
POST http://localhost:8000/api/unified-scraping/process
Body: { "companyName": "Your Company Name" }
```

Happy building! 🚀
