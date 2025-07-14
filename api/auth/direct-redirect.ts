import { VercelRequest, VercelResponse } from '@vercel/node';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('Direct redirect handler called');
    
    const oktaDomain = (process.env.OKTA_DOMAIN || 'fcxdemo.okta.com').trim();
    const spaClientId = (process.env.OKTA_SPA_CLIENT_ID || '0oat46o2xf1bddBxb697').trim();
    
    console.log('Using Okta domain:', oktaDomain);
    console.log('Using SPA client ID:', spaClientId);
    
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
    
    console.log('Redirect URI:', redirectUri);
    
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
    
    // Build URL with explicit colon insertion to prevent character corruption
    const protocol = 'https';
    const separator = '://';
    const path = '/oauth2/default/v1/authorize';
    const query = '?' + authParams.toString();
    
    // Method 1: Explicit concatenation with colon
    const method1 = protocol + separator + oktaDomain + path + query;
    
    // Method 2: Array join with explicit colon
    const method2 = [protocol, separator, oktaDomain, path, query].join('');
    
    // Method 3: String replacement to force colon
    const method3 = `https://${oktaDomain}${path}${query}`;
    
    // Method 4: URL constructor approach
    let method4 = '';
    try {
      const urlObj = new URL(path + query, `https://${oktaDomain}`);
      method4 = urlObj.href;
    } catch (e) {
      method4 = method1; // fallback
    }
    
    console.log('Method 1 (explicit):', method1);
    console.log('Method 2 (array):', method2);
    console.log('Method 3 (template):', method3);
    console.log('Method 4 (URL obj):', method4);
    
    // Use the most explicit method
    let authUrl = method1;
    
    // Critical validation and colon fix
    if (!authUrl.includes('://')) {
      console.error('CRITICAL: Auth URL missing colon - Original:', authUrl);
      // Force fix the missing colon issue
      authUrl = authUrl.replace(/https\/\//, 'https://');
      console.log('Fixed URL with colon:', authUrl);
    }
    
    if (!authUrl.startsWith('https://')) {
      console.error('CRITICAL: Auth URL missing https:// - URL:', authUrl);
      // Force correct protocol
      authUrl = 'https://' + authUrl.replace(/^https?:?\/?\/?/, '');
      console.log('Force-fixed URL:', authUrl);
    }
    
    // Final validation
    if (!authUrl.includes('://')) {
      console.error('FATAL: Unable to fix colon issue - URL:', authUrl);
      throw new Error('Malformed auth URL - missing colon');
    }
    
    console.log('Final auth URL validation passed:', authUrl);
    console.log('URL includes https://:', authUrl.includes('https://'));
    console.log('URL includes domain:', authUrl.includes(oktaDomain));
    
    // Ensure the Location header gets the correct URL
    const locationHeader = authUrl;
    console.log('Final Location header:', locationHeader);
    console.log('Location header includes colon:', locationHeader.includes('://'));
    
    // Store PKCE verifier in cookie for later use (single setting)
    res.setHeader('Set-Cookie', `pkce_verifier=${codeVerifier}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`);
    
    // Use standard redirect method instead of writeHead
    console.log('Performing redirect to:', locationHeader);
    res.redirect(302, locationHeader);
    
  } catch (error: any) {
    console.error('Error in direct redirect:', error);
    res.status(500).json({
      error: 'Failed to redirect to Okta',
      message: error.message
    });
  }
}