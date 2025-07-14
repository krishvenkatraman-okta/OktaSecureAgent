import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
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