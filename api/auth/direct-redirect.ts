import { VercelRequest, VercelResponse } from '@vercel/node';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

export default function handler(req: VercelRequest, res: VercelResponse) {
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
    
    // Determine redirect URI
    const host = req.headers.host;
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const redirectUri = `${protocol}://${host}/`;
    
    // Store PKCE for later retrieval
    // In production, you'd store this in a session or database
    
    // Direct server-side redirect instead of returning URL to frontend
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
    
    console.log('Direct redirect URL:', authUrl);
    
    // Store PKCE verifier in cookie for later use
    res.setHeader('Set-Cookie', `pkce_verifier=${codeVerifier}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`);
    
    // Direct 302 redirect instead of JavaScript redirect
    res.writeHead(302, {
      'Location': authUrl,
      'Cache-Control': 'no-cache'
    });
    res.end();
    
  } catch (error: any) {
    console.error('Error in direct redirect:', error);
    res.status(500).json({
      error: 'Failed to redirect to Okta',
      message: error.message
    });
  }
}