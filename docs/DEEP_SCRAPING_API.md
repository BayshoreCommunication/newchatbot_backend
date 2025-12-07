# 🚀 Deep Scraping API - LLM Knowledge Base Builder

## Overview
Complete deep web scraping system with **Puppeteer + Cheerio + LangChain** that converts search results into LLM-ready knowledge base documents with embeddings support.

---

## 🏗️ Architecture

```
Backend Structure:
├── models/
│   ├── dataScrapingModels.ts        # Search results storage
│   └── deepScrapingModels.ts        # Deep scraped content + chunks
├── services/
│   └── deepScrapingService.ts       # Puppeteer + Cheerio logic
├── controllers/
│   └── deepScrapingController.ts    # API business logic
└── routes/
    └── deepScraping.ts              # API endpoints
```

---

## 📊 Data Flow

```
1. User performs search → ScrapedData saved (with URLs)
        ↓
2. Trigger deep scrape → Puppeteer launches browser
        ↓
3. For each URL:
   - Navigate to page
   - Extract HTML content
   - Parse with Cheerio
   - Extract: headings, paragraphs, links, images, metadata
   - Convert to Markdown (better for LLMs)
        ↓
4. Chunk content with LangChain Text Splitter
   - 1000 chars per chunk
   - 200 chars overlap
        ↓
5. Save to MongoDB:
   - Full content
   - Structured data
   - LLM-ready chunks with metadata
        ↓
6. Export as JSON for vector database
```

---

## 📡 API Endpoints

### Base URL: `http://localhost:8000/api/deep-scraping`

---

### 1. **Deep Scrape from Search Result**

Automatically scrape all URLs from a previous search.

**Endpoint:** `POST /api/deep-scraping/scrape/:id`

**URL Parameters:**
- `:id` - The `_id` from your search result (`POST /api/scraping/search`)

**Request Body:**
```json
{
  "maxUrls": 5  // Optional: limit URLs to scrape (default: 5)
}
```

**Example Request:**
```bash
curl -X POST http://localhost:8000/api/deep-scraping/scrape/6930013fc0ffe31386ed9fb9 \
  -H "Content-Type: application/json" \
  -d '{"maxUrls": 5}'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Deep scraping completed: 5 succeeded, 0 failed",
  "data": {
    "totalUrls": 5,
    "successCount": 5,
    "failCount": 0,
    "results": [
      {
        "success": true,
        "url": "https://www.carterinjurylaw.com/",
        "pageTitle": "Carter Injury Law: Experienced Personal Injury Attorney in Tampa",
        "totalChunks": 12,
        "_id": "6930123abc456789def01234"
      }
    ]
  }
}
```

---

### 2. **Deep Scrape Single URL**

Scrape a specific URL manually.

**Endpoint:** `POST /api/deep-scraping/scrape-url`

**Request Body:**
```json
{
  "url": "https://www.carterinjurylaw.com/",
  "scrapedDataId": "6930013fc0ffe31386ed9fb9",
  "companyName": "Carter Injury Law"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "URL scraped successfully",
  "data": {
    "success": true,
    "url": "https://www.carterinjurylaw.com/",
    "pageTitle": "Carter Injury Law: Experienced Personal Injury Attorney in Tampa",
    "totalChunks": 12,
    "_id": "6930123abc456789def01234"
  }
}
```

---

### 3. **Get Deep Scraped Content by Company**

Get all deep scraped documents for a company.

**Endpoint:** `GET /api/deep-scraping/company/:companyName`

**Example:**
```
GET http://localhost:8000/api/deep-scraping/company/Carter Injury Law
```

**Response (200 OK):**
```json
{
  "success": true,
  "total": 5,
  "data": [
    {
      "_id": "6930123abc456789def01234",
      "url": "https://www.carterinjurylaw.com/",
      "companyName": "Carter Injury Law",
      "pageTitle": "Carter Injury Law: Experienced Personal Injury Attorney in Tampa",
      "headings": [
        "Expert Personal Injury Representation",
        "Our Practice Areas",
        "Why Choose Carter Injury Law"
      ],
      "paragraphs": [
        "Carter Injury Law provides experienced legal representation...",
        "We handle auto accidents, slip and falls, medical malpractice..."
      ],
      "links": [
        { "text": "Contact Us", "href": "/contact" },
        { "text": "About Our Team", "href": "/team" }
      ],
      "images": [
        { "alt": "Tampa Law Office", "src": "/images/office.jpg" }
      ],
      "meta": {
        "description": "Need expert legal help after an accident?...",
        "keywords": "personal injury, Tampa, lawyer, attorney",
        "author": "Carter Injury Law"
      },
      "totalChunks": 12,
      "status": "completed",
      "scrapedAt": "2025-12-03T10:30:00.000Z",
      "processedAt": "2025-12-03T10:31:30.000Z"
    }
  ]
}
```

---

### 4. **Get LLM-Ready Chunks**

Get all text chunks ready for embedding and vector database.

**Endpoint:** `GET /api/deep-scraping/chunks/:companyName`

**Example:**
```
GET http://localhost:8000/api/deep-scraping/chunks/Carter Injury Law
```

**Response (200 OK):**
```json
{
  "success": true,
  "totalChunks": 48,
  "data": [
    {
      "content": "# Carter Injury Law: Experienced Personal Injury Attorney in Tampa\n\nCarter Injury Law provides experienced legal representation for individuals injured in auto accidents, slip and falls, medical malpractice, and more...",
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
      "content": "## Our Practice Areas\n\nWe handle a wide range of personal injury cases including:\n- Auto accidents and car crashes\n- Slip and fall injuries\n- Medical malpractice\n- Wrongful death claims...",
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
}
```

---

### 5. **Export Knowledge Base (Download JSON)**

Download all chunks as a JSON file ready for vector database ingestion.

**Endpoint:** `GET /api/deep-scraping/export/:companyName`

**Example:**
```
GET http://localhost:8000/api/deep-scraping/export/Carter Injury Law
```

**Response:** File download with name `Carter_Injury_Law_knowledge_base.json`

**File Content:**
```json
{
  "documents": [
    {
      "pageContent": "# Carter Injury Law: Experienced Personal Injury Attorney in Tampa\n\nCarter Injury Law provides...",
      "metadata": {
        "source": "https://www.carterinjurylaw.com/",
        "chunkIndex": 0,
        "totalChunks": 12,
        "pageTitle": "Carter Injury Law: Experienced Personal Injury Attorney in Tampa",
        "companyName": "Carter Injury Law",
        "scrapedDate": "2025-12-03T10:30:00.000Z"
      }
    }
  ],
  "totalDocuments": 48,
  "exportedAt": "2025-12-03T11:00:00.000Z"
}
```

---

### 6. **Get Single Document by ID**

Retrieve full details of a specific deep scraped document.

**Endpoint:** `GET /api/deep-scraping/:id`

**Example:**
```
GET http://localhost:8000/api/deep-scraping/6930123abc456789def01234
```

---

### 7. **Delete Deep Scraped Document**

Remove a document from the database.

**Endpoint:** `DELETE /api/deep-scraping/:id`

**Example:**
```
DELETE http://localhost:8000/api/deep-scraping/6930123abc456789def01234
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

---

## 🧪 Complete Testing Workflow

### Step 1: Search Company Data
```bash
POST http://localhost:8000/api/scraping/search
Body: { "query": "Carter Injury Law" }
```
✅ Copy the `_id` from response (e.g., `6930013fc0ffe31386ed9fb9`)

### Step 2: Deep Scrape All URLs
```bash
POST http://localhost:8000/api/deep-scraping/scrape/6930013fc0ffe31386ed9fb9
Body: { "maxUrls": 5 }
```
⏳ Wait 10-30 seconds (scraping takes time)

### Step 3: Get Processed Content
```bash
GET http://localhost:8000/api/deep-scraping/company/Carter Injury Law
```
✅ View all scraped pages with structured data

### Step 4: Get LLM Chunks
```bash
GET http://localhost:8000/api/deep-scraping/chunks/Carter Injury Law
```
✅ View all text chunks ready for embeddings

### Step 5: Export Knowledge Base
```bash
GET http://localhost:8000/api/deep-scraping/export/Carter Injury Law
```
✅ Download JSON file for vector database

---

## 🗄️ Database Schema

### DeepScrapedContent Model

```typescript
{
  scrapedDataId: ObjectId;        // Link to original search
  url: string;                    // Page URL
  companyName: string;            // Company name (indexed)
  pageTitle: string;              // Page title

  // Raw Content
  htmlContent: string;            // Full HTML (limited to 50KB)
  textContent: string;            // Cleaned text (limited to 20KB)
  markdownContent: string;        // Markdown version (full)

  // Structured Data
  headings: string[];             // All H1-H6 tags
  paragraphs: string[];           // All <p> tags
  links: Array<{                  // All <a> tags (max 50)
    text: string;
    href: string;
  }>;
  images: Array<{                 // All <img> tags (max 20)
    alt: string;
    src: string;
  }>;

  // Metadata
  meta: {
    description?: string;
    keywords?: string;
    author?: string;
    publishedDate?: Date;
    lastModified?: Date;
  };

  // LLM-Ready Chunks
  chunks: Array<{
    content: string;              // Chunk text
    metadata: {
      source: string;
      chunkIndex: number;
      totalChunks: number;
      pageTitle: string;
      companyName: string;
      scrapedDate: Date;
    };
  }>;
  totalChunks: number;

  // Status
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;

  // Timestamps
  scrapedAt: Date;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 🎯 Features

✅ **Puppeteer Headless Browser**: Real browser rendering for JavaScript-heavy sites
✅ **Cheerio Parsing**: Fast HTML extraction
✅ **Markdown Conversion**: Better format for LLMs
✅ **Smart Chunking**: LangChain text splitter with overlap
✅ **Metadata Extraction**: Open Graph, Twitter Cards, Schema.org
✅ **Content Cleaning**: Removes scripts, styles, navigation
✅ **Structured Data**: Headings, paragraphs, links, images
✅ **MongoDB Storage**: Persistent storage with indexes
✅ **Export to JSON**: Direct integration with vector databases
✅ **Error Handling**: Failed URLs logged with error messages
✅ **Rate Limiting**: 2-second delay between requests

---

## 🔧 Environment Variables

Add to `.env`:

```env
# Existing variables...
GOOGLE_API_KEY=AIzaSyDPOfChEDX7uY6ZVU8uJAIaYe55627l0gk
GOOGLE_CX_ID=1243afd78b9d44365
MONGODB_URI=mongodb://localhost:27017/chatbot
PORT=8000

# Optional for OpenAI embeddings (future use)
OPENAI_API_KEY=sk-...
```

---

## 📦 Required Packages

Install dependencies:
```bash
cd backend
npm install
```

New packages added:
- `puppeteer` - Headless Chrome automation
- `langchain` - Text splitting and document processing
- `@langchain/openai` - OpenAI embeddings (optional)
- `@langchain/community` - Community tools
- `turndown` - HTML to Markdown converter
- `pdf-parse` - PDF processing (future use)

---

## 🚀 Usage Examples

### Using cURL

```bash
# 1. Search company
curl -X POST http://localhost:8000/api/scraping/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Carter Injury Law"}'

# 2. Deep scrape (use ID from step 1)
curl -X POST http://localhost:8000/api/deep-scraping/scrape/YOUR_ID_HERE \
  -H "Content-Type: application/json" \
  -d '{"maxUrls": 5}'

# 3. Get chunks
curl http://localhost:8000/api/deep-scraping/chunks/Carter%20Injury%20Law

# 4. Export knowledge base
curl http://localhost:8000/api/deep-scraping/export/Carter%20Injury%20Law \
  --output knowledge_base.json
```

### Using Postman

Import collection or create requests manually following the endpoints above.

---

## 🤖 Next Steps: LLM Integration

### Option 1: OpenAI Embeddings + Pinecone

```typescript
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";

// Get chunks
const chunks = await getChunksForCompany("Carter Injury Law");

// Create embeddings
const embeddings = new OpenAIEmbeddings();

// Store in Pinecone
const pinecone = new Pinecone();
const index = pinecone.Index("company-knowledge");

await PineconeStore.fromDocuments(chunks, embeddings, {
  pineconeIndex: index,
  namespace: "carter-injury-law",
});
```

### Option 2: Local Vector Store (Chroma)

```typescript
import { Chroma } from "@langchain/community/vectorstores/chroma";

const vectorStore = await Chroma.fromDocuments(
  chunks,
  embeddings,
  { collectionName: "carter_injury_law" }
);
```

### Option 3: Use Exported JSON

The exported JSON can be uploaded to:
- Pinecone
- Weaviate
- Qdrant
- Milvus
- Any vector database supporting JSON import

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Puppeteer install fails | Run `npm install --unsafe-perm` |
| Browser won't launch | Install Chrome/Chromium manually |
| Timeout errors | Increase timeout in service (line 48) |
| Memory issues | Limit `maxUrls` to 3-5 |
| Empty chunks | Check if page requires JavaScript |

---

## ✅ Success Checklist

- [ ] Backend server running
- [ ] MongoDB connected
- [ ] Puppeteer installed successfully
- [ ] Can perform basic search
- [ ] Can trigger deep scrape
- [ ] Chunks generated successfully
- [ ] Can export knowledge base JSON

---

## 🎉 You're Ready!

Your system now:
1. ✅ Searches Google for company data
2. ✅ Deep scrapes all URLs with Puppeteer
3. ✅ Extracts structured content with Cheerio
4. ✅ Converts to Markdown for LLMs
5. ✅ Chunks text with LangChain
6. ✅ Stores in MongoDB
7. ✅ Exports for vector databases

**Next:** Integrate with OpenAI embeddings or your preferred vector database!

---

**Need help?** Check `/docs/POSTMAN_TESTING_GUIDE.md` for basic API testing.
