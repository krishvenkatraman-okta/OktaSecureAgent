import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const oktaDomain = 'fcxdemo.okta.com';
  
  // Test different URL construction methods
  const method1 = `https://${oktaDomain}/oauth2/default/v1/authorize`;
  const method2 = 'https://' + oktaDomain + '/oauth2/default/v1/authorize';
  const method3 = ['https://', oktaDomain, '/oauth2/default/v1/authorize'].join('');
  
  return res.status(200).json({
    method1,
    method2,
    method3,
    domain: oktaDomain,
    validation: {
      method1StartsWithHttps: method1.startsWith('https://'),
      method2StartsWithHttps: method2.startsWith('https://'),
      method3StartsWithHttps: method3.startsWith('https://'),
    }
  });
}