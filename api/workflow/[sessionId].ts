import { VercelRequest, VercelResponse } from '@vercel/node';

// Simple in-memory storage for Vercel
const sessions = new Map();

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { sessionId } = req.query;
  
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Session ID required' });
  }

  if (req.method === 'GET') {
    // Get session data
    const session = sessions.get(sessionId) || {
      sessionId,
      currentStep: 1,
      status: 'not_found',
      createdAt: new Date().toISOString(),
      userId: null,
      isAuthenticated: false
    };

    return res.status(200).json({ session });
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    // Update session data
    const existing = sessions.get(sessionId);
    if (!existing) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const updates = req.body;
    const updatedSession = { ...existing, ...updates };
    sessions.set(sessionId, updatedSession);

    return res.status(200).json({ session: updatedSession });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}