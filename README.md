# AcmeAI - Zero Trust AI Agent Demo

A comprehensive AI agent application demonstrating secure, consent-based data access using Okta's Identity Governance and Administration (IGA) platform.

## Features

- **6-Stage Workflow**: Complete demonstration of zero-trust privileged access
- **Real Okta Integration**: OIDC authentication, PAM secret vault, IGA governance
- **Dynamic Consent**: Okta Verify push notifications for just-in-time permissions
- **Real-time Updates**: WebSocket-powered live workflow monitoring
- **Comprehensive Audit**: Complete audit trail and notifications system

## Deployment to Vercel

### Prerequisites

1. **Okta Tenant Setup**:
   - Domain: `fcxdemo.okta.com` (or your tenant)
   - SPA Client ID and secret for OIDC
   - Client Credentials app for service-to-service auth
   - API token for user management
   - PAM credentials for secret vault access

2. **Environment Variables**:
   ```
   OKTA_DOMAIN=fcxdemo.okta.com
   OKTA_SPA_CLIENT_ID=your_spa_client_id
   OKTA_CLIENT_CREDENTIALS_CLIENT_ID=your_cc_client_id
   OKTA_CLIENT_CREDENTIALS_CLIENT_SECRET=your_cc_secret
   OKTA_API_TOKEN=your_api_token
   PAM_API_KEY_ID=your_pam_key_id
   PAM_API_KEY_SECRET=your_pam_secret
   PAM_RESOURCE_GROUP_ID=your_resource_group_id
   PAM_PROJECT_ID=your_project_id
   PAM_SECRET_ID=your_secret_id
   ```

### Deploy Steps

1. **Connect to Vercel**:
   - Import this repository to Vercel
   - Choose the "Other" framework preset

2. **Configure Build Settings**:
   - Build Command: `vite build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Add Environment Variables**:
   - Go to Project Settings > Environment Variables
   - Add all the Okta and PAM credentials listed above

4. **Deploy**:
   - Click "Deploy" to build and deploy your application
   - Your app will be available at `https://your-project.vercel.app`

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Architecture

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express.js (for local dev)
- **UI**: shadcn/ui + Radix UI + Tailwind CSS
- **Authentication**: Okta OIDC + OAuth 2.0
- **Real-time**: WebSockets for live updates

## Security Features

- Zero-trust architecture with step-by-step verification
- Just-in-time privileged access management
- Dynamic consent with push notifications
- Comprehensive audit logging
- Token-based delegation with time bounds

## Demo Workflow

1. **User Authentication** - OIDC login with Okta
2. **Profile Retrieval** - Service account fetches user data
3. **Access Request** - AI agent requests elevated permissions
4. **Approval Simulation** - IGA workflow approval
5. **CRM Data Access** - Just-in-time access to external resources
6. **Dynamic Consent** - Real-time permission requests via push

This application demonstrates enterprise-grade security patterns for AI agents accessing sensitive data with proper governance and consent mechanisms.