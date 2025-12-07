# ⚡ Quick Start - LLM-Ready Knowledge Base in ONE Request!

## 🎯 What You Get

**ONE API call** that:
✅ Searches Google automatically
✅ Scrapes up to 10 webpages
✅ Returns LLM-ready knowledge base chunks
✅ Ready for OpenAI, Claude, RAG systems

---

## 🚀 Usage

### Single Request:

```bash
POST http://localhost:8000/api/unified-scraping/process
Content-Type: application/json

{
  "companyName": "Carter Injury Law",
  "maxUrls": 10
}
```

### Response:

```json
{
  "success": true,
  "data": {
    "companyName": "Carter Injury Law",

    "searchResults": {
      "totalUrls": 19,
      "urls": [...]  // Google search results
    },

    "deepScraping": {
      "totalScraped": 10,
      "successCount": 9,
      "scrapedUrls": [...]  // Which URLs were scraped
    },

    "knowledgeBase": {
      "totalChunks": 87,
      "ready": true,
      "chunks": [  // 👈 USE THIS FOR LLM!
        {
          "content": "# Carter Injury Law: Experienced Personal Injury Attorney...",
          "metadata": {
            "source": "https://www.carterinjurylaw.com/",
            "pageTitle": "Carter Injury Law",
            "companyName": "Carter Injury Law"
          }
        }
      ]
    }
  }
}
```

---

## ⏱️ Time

- **Processing:** 25-35 seconds
- **Make sure your timeout is 60+ seconds!**

---

## 💡 Use with LLM

### Direct Context Injection:

```javascript
const res = await fetch('http://localhost:8000/api/unified-scraping/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ companyName: 'Carter Injury Law' })
});

const { chunks } = (await res.json()).data.knowledgeBase;

// Combine all chunks
const context = chunks.map(c => c.content).join('\n\n');

// Use with OpenAI
const completion = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [
    { role: "system", content: `Knowledge Base:\n\n${context}` },
    { role: "user", content: "What does Carter Injury Law do?" }
  ]
});
```

---

## 📚 Full Documentation

- **[UNIFIED_SCRAPING_API.md](./UNIFIED_SCRAPING_API.md)** - Complete API docs
- **[DEEP_SCRAPING_API.md](./DEEP_SCRAPING_API.md)** - Technical details
- **[POSTMAN_TESTING_GUIDE.md](./POSTMAN_TESTING_GUIDE.md)** - Testing guide

---

## ✅ That's It!

**One endpoint. One request. LLM-ready data.** 🚀

```bash
POST http://localhost:8000/api/unified-scraping/process
Body: { "companyName": "Your Company Name" }
```
