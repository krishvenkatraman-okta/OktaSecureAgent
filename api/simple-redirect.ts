import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Ultra-simple redirect test
  const testUrl = 'https://fcxdemo.okta.com/oauth2/default/v1/authorize?client_id=0oat46o2xf1bddBxb697&response_type=code&scope=openid%20profile%20email&redirect_uri=https://okta-secure-agent.vercel.app/&state=test123&code_challenge=test&code_challenge_method=S256';
  
  res.redirect(302, testUrl);
}