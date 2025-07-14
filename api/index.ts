import { VercelRequest, VercelResponse } from '@vercel/node';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url || '', `https://${req.headers.host}`);
  const pathname = url.pathname;
  
  // Route: /api/auth/direct-redirect
  if (pathname === '/api/auth/direct-redirect') {
    return handleDirectRedirect(req, res);
  }
  
  // Route: /api/auth/debug-auth
  if (pathname === '/api/auth/debug-auth') {
    return handleDebugAuth(req, res);
  }
  
  // Route: /api/auth/safe-login
  if (pathname === '/api/auth/safe-login') {
    return handleSafeLogin(req, res);
  }
  
  // Route: /api/auth/login
  if (pathname === '/api/auth/login') {
    return handleLogin(req, res);
  }
  
  // Default API info
  return res.status(200).json({
    message: 'Okta Zero Trust AI Agent API',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      workflow: '/api/workflow',
      auth: '/api/auth',
      debug: '/api/debug'
    }
  });
}

function handleDirectRedirect(req: VercelRequest, res: VercelResponse) {
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

function handleDebugAuth(req: VercelRequest, res: VercelResponse) {
  const oktaDomain = process.env.OKTA_DOMAIN || 'fcxdemo.okta.com';
  const spaClientId = process.env.OKTA_SPA_CLIENT_ID || '0oat46o2xf1bddBxb697';
  
  // Check environment variables
  const envCheck = {
    OKTA_DOMAIN: process.env.OKTA_DOMAIN,
    OKTA_SPA_CLIENT_ID: process.env.OKTA_SPA_CLIENT_ID,
    hasOktaDomain: !!process.env.OKTA_DOMAIN,
    hasSpaClientId: !!process.env.OKTA_SPA_CLIENT_ID
  };
  
  // Test URL construction methods
  const method1 = `https://${oktaDomain}/oauth2/default/v1/authorize`;
  const method2 = 'https://' + oktaDomain + '/oauth2/default/v1/authorize';
  const method3 = ['https://', oktaDomain, '/oauth2/default/v1/authorize'].join('');
  
  // Test with actual parameters
  const testParams = new URLSearchParams({
    client_id: spaClientId,
    response_type: 'code',
    scope: 'openid profile email',
    redirect_uri: 'https://okta-secure-agent.vercel.app/',
    state: 'test-state',
    code_challenge: 'test-challenge',
    code_challenge_method: 'S256'
  });
  
  const fullUrl1 = method1 + '?' + testParams.toString();
  const fullUrl2 = method2 + '?' + testParams.toString();
  const fullUrl3 = method3 + '?' + testParams.toString();
  
  return res.status(200).json({
    environment: envCheck,
    urlConstructionMethods: {
      method1,
      method2, 
      method3
    },
    fullUrlsWithParams: {
      fullUrl1,
      fullUrl2,
      fullUrl3
    },
    validation: {
      method1Valid: method1.startsWith('https://') && method1.includes(oktaDomain),
      method2Valid: method2.startsWith('https://') && method2.includes(oktaDomain),
      method3Valid: method3.startsWith('https://') && method3.includes(oktaDomain),
      fullUrl1Valid: fullUrl1.startsWith('https://') && fullUrl1.includes(oktaDomain),
      fullUrl2Valid: fullUrl2.startsWith('https://') && fullUrl2.includes(oktaDomain),
      fullUrl3Valid: fullUrl3.startsWith('https://') && fullUrl3.includes(oktaDomain)
    },
    timestamp: new Date().toISOString(),
    requestMethod: req.method,
    host: req.headers.host
  });
}

function handleSafeLogin(req: VercelRequest, res: VercelResponse) {
  // Allow both GET and POST for testing
  if (req.method !== 'POST' && req.method !== 'GET') {
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
    
    // Determine redirect URI based on request
    const host = req.headers.host;
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const fullBaseUrl = `${protocol}://${host}`;
    
    // Triple-safe URL construction
    const baseAuthUrl = `https://${oktaDomain}/oauth2/default/v1/authorize`;
    
    const authParams = new URLSearchParams({
      client_id: spaClientId,
      response_type: 'code',
      scope: 'openid profile email',
      redirect_uri: `${fullBaseUrl}/`,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });
    
    const authUrl = `${baseAuthUrl}?${authParams.toString()}`;
    
    return res.status(200).json({
      authUrl: authUrl,
      codeVerifier: codeVerifier,
      state: state,
      debug: {
        oktaDomain,
        spaClientId,
        host,
        protocol,
        fullBaseUrl,
        baseAuthUrl,
        authUrlValid: authUrl.startsWith('https://') && authUrl.includes(oktaDomain)
      }
    });
    
  } catch (error: any) {
    console.error('Error generating auth URL:', error);
    return res.status(500).json({
      error: 'Failed to generate auth URL',
      message: error.message
    });
  }
}

function handleLogin(req: VercelRequest, res: VercelResponse) {
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
    
    // Determine redirect URI
    const host = req.headers.host;
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const redirectUri = `${protocol}://${host}/`;
    
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
    
    return res.status(200).json({
      authUrl: authUrl,
      codeVerifier: codeVerifier,
      state: state
    });
    
  } catch (error: any) {
    console.error('Error generating auth URL:', error);
    return res.status(500).json({
      error: 'Failed to generate auth URL',
      message: error.message
    });
  }
}