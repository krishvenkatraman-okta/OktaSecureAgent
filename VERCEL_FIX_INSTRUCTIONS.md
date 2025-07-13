# 🔧 VERCEL RUNTIME VERSION FIX

## Error Fixed
"Function Runtimes must have a valid version" - Fixed by specifying exact version number.

## ✅ CORRECTED VERCEL.JSON

Replace your `vercel.json` with this version:

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "client/dist",
  "functions": {
    "api/simple.ts": {
      "runtime": "@vercel/node@3.0.0"
    }
  },
  "routes": [
    {
      "src": "/api/simple",
      "dest": "/api/simple"
    },
    {
      "src": "/(.*)",
      "dest": "/client/dist/index.html"
    }
  ]
}
```

## Key Change
- Changed `"runtime": "@vercel/node"` to `"runtime": "@vercel/node@3.0.0"`
- Vercel requires explicit version numbers for function runtimes

## Files Needed in Your GitHub Repo

1. **vercel.json** (above)
2. **api/simple.ts**:
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

3. **package.json** - Add dependency:
```json
"@vercel/node": "^3.0.0"
```

## Deployment Steps
1. Update these files in your GitHub repo
2. Commit and push
3. Deploy should now work without runtime version errors

## Expected Result
- No runtime version errors
- `/api/simple` returns JSON response  
- `/` serves your React application

This fix addresses the specific Vercel runtime version requirement.