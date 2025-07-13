import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const config = {
      hasOktaDomain: !!process.env.OKTA_DOMAIN,
      oktaDomain: process.env.OKTA_DOMAIN?.substring(0, 10) + '...',
      hasSpaClientId: !!process.env.OKTA_SPA_CLIENT_ID,
      hasApiToken: !!process.env.OKTA_API_TOKEN,
      hasClientCredentialsId: !!process.env.OKTA_CLIENT_CREDENTIALS_CLIENT_ID,
      hasSessionSecret: !!process.env.SESSION_SECRET,
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      vercelRegion: process.env.VERCEL_REGION,
      status: 'API Working'
    };
    
    console.log('Debug endpoint called:', config);
    
    return res.status(200).json({
      message: 'Zero Trust AI Agent Debug Info',
      config,
      allEnvVarsPresent: config.hasOktaDomain && config.hasSpaClientId && config.hasApiToken && config.hasClientCredentialsId && config.hasSessionSecret
    });
  } catch (error: any) {
    console.error('Debug endpoint error:', error);
    return res.status(500).json({
      error: 'Debug endpoint failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}