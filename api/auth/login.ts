import { VercelRequest, VercelResponse } from '@vercel/node';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const oktaDomain = process.env.OKTA_DOMAIN || 'fcxdemo.okta.com';
    const spaClientId = process.env.OKTA_SPA_CLIENT_ID || '0oat46o2xf1bddBxb697';
    
    // Generate PKCE parameters
    const codeVerifier = nanoid(64);
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    
    const state = nanoid(32);
    
    // Determine redirect URI based on environment
    const host = req.headers.host;
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const redirectUri = `${protocol}://${host}/`;
    
    const authUrl = new URL(`https://${oktaDomain}/oauth2/default/v1/authorize`);
    authUrl.searchParams.set('client_id', spaClientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    
    console.log('Generated auth URL:', authUrl.toString());
    console.log('Redirect URI:', redirectUri);
    
    return res.status(200).json({
      authUrl: authUrl.toString(),
      codeVerifier,
      state,
      redirectUri
    });
    
  } catch (error: any) {
    console.error('Error generating auth URL:', error);
    return res.status(500).json({
      error: 'Failed to generate auth URL',
      message: error.message
    });
  }
}