import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return res.json({ 
    message: 'Simple API test working',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url 
  });
}