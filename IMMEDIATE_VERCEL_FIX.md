# 🚨 IMMEDIATE VERCEL FIX - Test Minimal Setup

## Strategy: Progressive Testing

The function is still crashing. Let's test with minimal setups first to identify the issue.

## Step 1: Test Simple API Function

Replace your `vercel.json` with this minimal config:

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "client/dist",
  "framework": null,
  "functions": {
    "api/*.ts": {
      "runtime": "@vercel/node@3.0.0"
    }
  }
}
```

## Step 2: Test Basic Handler

Create `api/simple.ts`:

```typescript
import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return res.json({ 
    message: 'Simple API test working',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url 
  });
}
```

## Step 3: Test Minimal Express

Create `api/minimal.ts`:

```typescript
import express from 'express';
import path from 'path';

const app = express();

app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'client/dist')));

app.get('/api/test', (req, res) => {
  res.json({ message: 'Minimal Express working', timestamp: new Date().toISOString() });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'client/dist/index.html'));
});

export default app;
```

## Deployment Test Process

1. **Deploy with simple handler first**:
   - Add `api/simple.ts` 
   - Test: `/api/simple` should return JSON

2. **If simple works, try minimal Express**:
   - Add `api/minimal.ts`
   - Test: `/api/test` and root `/` should work

3. **If minimal works, gradually add complexity**:
   - Add one route at a time
   - Test after each addition

## Expected Issues to Check

1. **Missing @vercel/node dependency**:
   ```bash
   npm install @vercel/node
   ```

2. **TypeScript compilation errors**
3. **Missing client/dist files**
4. **Environment variable issues**
5. **Import path problems**

## Quick Debug

Test URLs after deployment:
- `/api/simple` - Should return JSON
- `/api/minimal/api/test` - Should return JSON  
- `/` - Should serve React app

This progressive approach will identify exactly where the crash occurs.