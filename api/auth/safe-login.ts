import { VercelRequest, VercelResponse } from '@vercel/node';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const oktaDomain = (process.env.OKTA_DOMAIN || 'fcxdemo.okta.com').trim();
    const spaClientId = (process.env.OKTA_SPA_CLIENT_ID || '0oat46o2xf1bddBxb697').trim();
    
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
    
    // Safe URL construction using string concatenation
    const authParams = new URLSearchParams({
      client_id: spaClientId,
      response_type: 'code',
      scope: 'openid profile email',
      redirect_uri: redirectUri,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });
    
    const authUrl = `https://${oktaDomain}/oauth2/default/v1/authorize?${authParams.toString()}`;
    
    console.log('Safe auth URL generated:', authUrl);
    console.log('oktaDomain check:', oktaDomain);
    console.log('Protocol check:', protocol);
    console.log('Host check:', host);
    
    // Additional validation
    if (!authUrl.startsWith('https://')) {
      console.error('ERROR: Auth URL does not start with https://');
      throw new Error('Invalid URL format generated');
    }
    
    return res.status(200).json({
      authUrl,
      codeVerifier,
      state,
      redirectUri,
      debug: {
        oktaDomain,
        host,
        protocol
      }
    });
    
  } catch (error: any) {
    console.error('Error generating safe auth URL:', error);
    return res.status(500).json({
      error: 'Failed to generate auth URL',
      message: error.message
    });
  }
}