import { VercelRequest, VercelResponse } from '@vercel/node';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

export default function handler(req: VercelRequest, res: VercelResponse) {
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
    
    // Determine redirect URI
    const host = req.headers.host;
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const redirectUri = `${protocol}://${host}/`;
    
    // Build auth URL with explicit colon to prevent corruption
    const authUrl = 'https://' + oktaDomain + '/oauth2/default/v1/authorize?' + new URLSearchParams({
      client_id: spaClientId,
      response_type: 'code',
      scope: 'openid profile email',
      redirect_uri: redirectUri,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    }).toString();
    
    // Set cookie for PKCE verifier
    res.setHeader('Set-Cookie', `pkce_verifier=${codeVerifier}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`);
    
    // Simple redirect
    res.redirect(302, authUrl);
    
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to redirect to Okta',
      message: error.message
    });
  }
}