# 🔧 VERCEL SERVERLESS SIMPLE FIX

## Solution: Remove Function Runtime Configuration

The issue is that Vercel auto-detects TypeScript files in `api/` folder. The runtime configuration is causing the error.

## ✅ MINIMAL WORKING CONFIGURATION

### **vercel.json** (Simplified)
```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist/public"
}
```

### **api/simple.ts** (Auto-detected by Vercel)
```typescript
import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return res.json({ 
    message: 'Zero Trust AI Agent API Working',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    status: 'OK'
  });
}
```

### **package.json** (Add dependency)
```json
{
  "engines": {
    "node": "18.x"
  },
  "dependencies": {
    "@vercel/node": "^3.0.0"
  }
}
```

## How This Works
1. **Auto-detection**: Vercel automatically detects `.ts` files in `api/` folder
2. **No Runtime Config**: Removes the problematic runtime specification
3. **Standard Build**: Uses default Node.js runtime (latest stable)
4. **Static Files**: Serves React app from `dist/public`

## Expected Behavior
- **Homepage**: `/` → Serves React app from `dist/public/index.html`
- **API**: `/api/simple` → Executes TypeScript function automatically
- **Build**: Uses `npm run build` to create both frontend and backend

## Deploy Instructions
1. Replace `vercel.json` with the minimal version above
2. Ensure `api/simple.ts` exists in your GitHub repo
3. Update `package.json` with engines and dependency
4. Deploy - Vercel will auto-configure function runtime

This approach relies on Vercel's built-in auto-detection rather than explicit runtime configuration, which should eliminate the version error.