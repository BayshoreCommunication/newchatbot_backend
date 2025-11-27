# 🚀 Vercel Deployment Guide

## ✅ What We Fixed

The build error you got:
```
sh: line 1: /vercel/path0/node_modules/.bin/tsc: Permission denied
Error: Command "npm run build" exited with 126
```

**Cause**: `npx tsc` has permission issues on Vercel

**Solution**: Changed build script from `npx tsc` to `tsc` and moved TypeScript to dependencies

---

## 📝 Changes Made

### **1. Updated package.json**

**Build Script Fixed:**
```json
{
  "scripts": {
    "build": "tsc",           // Changed from "npx tsc"
    "vercel-build": "tsc"     // Added for Vercel
  }
}
```

**Moved TypeScript to dependencies:**
```json
{
  "dependencies": {
    "typescript": "^5.2.2",
    "@types/node": "^20.8.10",
    "@types/express": "^4.17.21",
    // ... all other @types packages
  }
}
```

**Why?** Vercel installs only `dependencies` during build, not `devDependencies`.

---

### **2. Created vercel.json**

```json
{
  "version": 2,
  "builds": [
    {
      "src": "index.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "index.ts"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

This tells Vercel:
- Build `index.ts` using Node.js
- Route all requests to `index.ts`
- Set production environment

---

## 🔧 Deploy to Vercel

### **Step 1: Install Vercel CLI (Optional)**

```bash
npm install -g vercel
```

### **Step 2: Login to Vercel**

```bash
vercel login
```

### **Step 3: Deploy from Local**

```bash
cd chatbot_backend
vercel
```

Follow prompts:
- Set up and deploy? **Y**
- Which scope? Choose your account
- Link to existing project? **N** (first time)
- Project name? `chatbot-backend` (or your choice)
- Directory? `./` (current directory)

### **Step 4: Deploy from GitHub**

1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "Fixed Vercel build configuration"
   git push origin main
   ```

2. Go to [vercel.com](https://vercel.com)
3. Click **Add New Project**
4. Import your GitHub repository
5. Vercel will auto-detect settings
6. Click **Deploy**

---

## 🔐 Environment Variables

**IMPORTANT:** Add these in Vercel Dashboard:

1. Go to your project → **Settings** → **Environment Variables**
2. Add each variable:

```
OPENAI_API_KEY=sk-...
MONGODB_URI=mongodb+srv://...
REDIS_URL=redis://...
PORT=8000
NODE_ENV=production
```

**Or via CLI:**
```bash
vercel env add OPENAI_API_KEY
vercel env add MONGODB_URI
vercel env add REDIS_URL
```

---

## ⚠️ Important Notes

### **1. Build Output**

After successful build, you should see:
```
✓ Compiled successfully
✓ TypeScript compilation complete
✓ Deployment ready
```

### **2. Function Timeout**

Vercel serverless functions timeout after:
- **Hobby plan**: 10 seconds
- **Pro plan**: 60 seconds

If your chatbot queries take longer, consider:
- Using Vercel Pro
- Or deploying to a long-running server (Railway, Render, DigitalOcean)

### **3. File System**

Vercel is **serverless** - the file system is **read-only**.

**Issue in your code:**
```typescript
// This WON'T work on Vercel:
const tempDir = path.join(__dirname, "..", "temp");
fs.writeFileSync(filePath, qaContent, "utf-8");
```

**Solution**: Use `/tmp` directory (Vercel provides this):
```typescript
// Use /tmp instead
const tempDir = "/tmp";
const filePath = path.join(tempDir, fileName);
fs.writeFileSync(filePath, qaContent, "utf-8");
```

Let me fix this for you...

---

## 🔄 Alternative: Deploy to Railway/Render

If you need:
- Long-running processes
- File system access
- Background jobs
- WebSocket support

Consider these alternatives:

### **Railway.app**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy
railway up
```

### **Render.com**
1. Connect GitHub repo
2. Select "Web Service"
3. Build command: `npm run build`
4. Start command: `npm start`

---

## ✅ Final Checklist

Before deploying:

- [ ] Environment variables added to Vercel
- [ ] MongoDB accessible from internet (whitelist Vercel IPs: `0.0.0.0/0`)
- [ ] Redis accessible from internet
- [ ] OpenAI API key is valid
- [ ] File paths use `/tmp` instead of local directories
- [ ] TypeScript compiles locally: `npm run build`
- [ ] Build succeeds: `dist/` folder created

---

## 🐛 Troubleshooting

### **Build fails with "Module not found"**
**Fix**: Make sure all dependencies are in `dependencies`, not `devDependencies`

### **Runtime error: "Cannot find module"**
**Fix**: Check `tsconfig.json` includes all necessary files:
```json
{
  "include": ["**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### **API doesn't respond**
**Fix**:
1. Check Vercel logs: Project → **Deployments** → Click deployment → **Logs**
2. Verify environment variables are set
3. Check MongoDB connection string allows Vercel IPs

### **Timeout errors**
**Fix**:
- Reduce `max_completion_tokens` in OpenAI calls
- Upgrade to Vercel Pro for 60s timeout
- Or use Railway/Render for unlimited timeout

---

## 📊 Monitor Your Deployment

**Vercel Dashboard:**
- Real-time logs
- Function invocation count
- Error tracking
- Performance metrics

**View logs:**
```bash
vercel logs
```

---

## 🎯 Next Steps

1. **Fix file system usage** (use `/tmp` for temp files)
2. **Test deployment** with Postman
3. **Monitor logs** for errors
4. **Set up custom domain** (optional)

Your deployment should now work! 🚀
