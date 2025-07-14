import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  return res.status(200).json({
    message: 'Minimal Vercel API Working',
    environment: {
      hasOktaDomain: !!process.env.OKTA_DOMAIN,
      hasApiToken: !!process.env.OKTA_API_TOKEN,
      hasSpaClientId: !!process.env.OKTA_SPA_CLIENT_ID,
      nodeEnv: process.env.NODE_ENV || 'production'
    },
    timestamp: new Date().toISOString()
  });
}