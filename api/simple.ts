import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return res.json({ 
    message: 'Zero Trust AI Agent API Working',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    status: 'OK'
  });
}