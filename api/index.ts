import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // For Vercel serverless functions, redirect root API calls to main app
  return res.redirect(301, '/');
}