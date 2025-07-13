# Okta Zero Trust AI Agent - Deployment Guide

## Overview
This is a production-ready Zero Trust AI agent demonstrating Okta's IGA, PAM, and OIDC capabilities. The application follows an IGA-first approach with comprehensive security workflows.

## Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Okta OIDC + OAuth 2.0
- **UI**: shadcn/ui + Tailwind CSS
- **Real-time**: WebSockets

## Deployment Options

### 1. GitHub + Vercel Deployment

#### Prerequisites
- Node.js 18+ installed
- Vercel CLI (`npm i -g vercel`)
- GitHub account
- Okta tenant with configured applications

#### GitHub Setup
1. Create new repository on GitHub
2. Clone this repository
3. Push to your GitHub repository:
```bash
git init
git add .
git commit -m "Initial commit - Zero Trust AI Agent"
git remote add origin https://github.com/yourusername/okta-zero-trust-agent.git
git push -u origin main
```

#### Vercel Deployment
1. Install Vercel CLI: `npm install -g vercel`
2. Login to Vercel: `vercel login`
3. Deploy: `vercel`
4. Configure environment variables in Vercel dashboard

#### Required Environment Variables
Set these in your Vercel dashboard:

```env
# Okta Configuration
OKTA_DOMAIN=fcxdemo.okta.com
OKTA_SPA_CLIENT_ID=your_spa_client_id
OKTA_CLIENT_CREDENTIALS_CLIENT_ID=your_client_credentials_id
OKTA_API_TOKEN=your_api_token

# PAM Configuration
PAM_API_KEY_ID=your_pam_key_id
PAM_API_KEY_SECRET=your_pam_secret
PAM_RESOURCE_GROUP_ID=your_resource_group_id
PAM_PROJECT_ID=your_project_id
PAM_SECRET_ID=your_secret_id

# Application Configuration
SESSION_SECRET=your_session_secret
NODE_ENV=production
```

### 2. Build Configuration

#### Vercel Configuration (`vercel.json`)
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/node",
      "config": {
        "includeFiles": ["client/dist/**"]
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/server/index.js"
    },
    {
      "src": "/(.*)",
      "dest": "/server/index.js"
    }
  ]
}
```

#### Package.json Scripts
```json
{
  "scripts": {
    "dev": "tsx server/index.ts",
    "build": "npm run build:client && npm run build:server",
    "build:client": "vite build",
    "build:server": "esbuild server/index.ts --bundle --platform=node --target=node18 --outfile=dist/server.js",
    "start": "node dist/server.js",
    "vercel-build": "npm run build"
  }
}
```

### 3. Database Setup

#### Option A: Neon Database (Recommended)
1. Create account at https://neon.tech
2. Create new database
3. Add `DATABASE_URL` to environment variables
4. Run migrations: `npm run db:push`

#### Option B: In-Memory Storage (Demo)
The application includes in-memory storage for demonstration purposes. No database setup required.

### 4. Security Configuration

#### Okta Setup
1. **SPA Application**: For frontend authentication
2. **Service Application**: For client credentials flow
3. **API Token**: For user management
4. **PAM Vault**: For secret management
5. **IGA Configuration**: For access requests

#### CORS Configuration
Update allowed origins in `server/index.ts`:
```typescript
const corsOrigins = [
  'https://yourdomain.vercel.app',
  'https://your-custom-domain.com'
];
```

### 5. Production Optimizations

#### Performance
- Vite build optimization enabled
- Express.js compression middleware
- WebSocket connection pooling
- Efficient database queries

#### Security
- HTTPS enforcement
- CORS protection
- Session security
- Input validation
- API rate limiting

#### Monitoring
- Request/response logging
- Error tracking
- Performance metrics
- Audit trail

### 6. Custom Domain Setup

#### Vercel Custom Domain
1. Go to Vercel dashboard
2. Select your project
3. Go to Settings → Domains
4. Add your custom domain
5. Configure DNS records

#### Okta Redirect URI Update
Update redirect URIs in Okta applications:
- `https://yourdomain.vercel.app/callback`
- `https://your-custom-domain.com/callback`

### 7. Deployment Checklist

- [ ] Environment variables configured
- [ ] Okta applications set up
- [ ] Database connected (if using)
- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] CORS origins updated
- [ ] Redirect URIs updated
- [ ] Build process verified
- [ ] Health checks passing

### 8. Testing

#### Local Development
```bash
npm install
npm run dev
```

#### Production Build
```bash
npm run build
npm start
```

#### Health Check
- Visit `/api/health` for API status
- Check WebSocket connection
- Test authentication flow
- Verify all workflow steps

### 9. Troubleshooting

#### Common Issues
1. **Build Fails**: Check Node.js version (18+)
2. **Auth Errors**: Verify Okta configuration
3. **API Errors**: Check environment variables
4. **WebSocket Issues**: Verify server deployment

#### Debug Mode
Set `NODE_ENV=development` for detailed logging.

### 10. Support

For issues with this deployment:
1. Check environment variables
2. Verify Okta configuration
3. Review server logs
4. Test API endpoints individually

## Version Information
- **Version**: 1.0.0
- **Build Date**: 2025-07-13
- **Node.js**: 18+
- **Status**: Production Ready ✅

This deployment package contains the complete, tested, and production-ready Zero Trust AI agent application.