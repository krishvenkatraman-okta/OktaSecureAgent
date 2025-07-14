import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const oktaDomain = process.env.OKTA_DOMAIN || 'fcxdemo.okta.com';
  
  // Test different URL construction methods
  const method1 = `https://${oktaDomain}/oauth2/default/v1/authorize`;
  const method2 = 'https://' + oktaDomain + '/oauth2/default/v1/authorize';
  const method3 = ['https://', oktaDomain, '/oauth2/default/v1/authorize'].join('');
  
  // Test URL object construction
  let urlObjectTest = 'unknown';
  try {
    const urlObj = new URL(`https://${oktaDomain}/oauth2/default/v1/authorize`);
    urlObjectTest = urlObj.href;
  } catch (e) {
    urlObjectTest = 'error: ' + e.message;
  }
  
  // Test with manual redirect
  const testUrl = method1;
  
  if (req.query.redirect === 'true') {
    console.log('TEST: Redirecting to:', testUrl);
    
    // Return both response and headers for debugging
    res.writeHead(302, {
      'Location': testUrl,
      'Cache-Control': 'no-cache',
      'X-Debug-URL': testUrl
    });
    res.end();
    return;
  }
  
  return res.status(200).json({
    message: 'URL Construction Test',
    oktaDomain,
    methods: {
      method1,
      method2,
      method3,
      urlObjectTest
    },
    validation: {
      method1Valid: method1.startsWith('https://'),
      method2Valid: method2.startsWith('https://'),
      method3Valid: method3.startsWith('https://'),
      urlObjectValid: urlObjectTest.startsWith('https://')
    },
    testRedirect: `${req.url}?redirect=true`,
    environment: {
      OKTA_DOMAIN: process.env.OKTA_DOMAIN,
      host: req.headers.host
    }
  });
}