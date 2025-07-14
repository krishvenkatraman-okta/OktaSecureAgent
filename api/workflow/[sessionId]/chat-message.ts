import { VercelRequest, VercelResponse } from '@vercel/node';

// Simple in-memory storage for chat messages
const chatMessages = new Map();

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { sessionId } = req.query;
  
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Session ID required' });
  }

  if (req.method === 'POST') {
    // Add a new chat message
    const { messageType, messageText, messageAction } = req.body;
    
    if (!messageType || !messageText) {
      return res.status(400).json({ error: 'messageType and messageText are required' });
    }

    const message = {
      id: Date.now(),
      sessionId,
      messageType,
      messageText,
      messageAction: messageAction || null,
      createdAt: new Date().toISOString()
    };

    const existingMessages = chatMessages.get(sessionId) || [];
    existingMessages.push(message);
    chatMessages.set(sessionId, existingMessages);

    return res.status(200).json({ success: true, message });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}