import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    message: 'Zero Trust AI Agent - Simple Test',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url
  });
}