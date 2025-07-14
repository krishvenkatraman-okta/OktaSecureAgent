import { VercelRequest, VercelResponse } from '@vercel/node';
import { nanoid } from 'nanoid';
import { sessionStorage } from '../shared/session-storage';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Initializing workflow session...');
    
    // Check required environment variables
    if (!process.env.OKTA_DOMAIN || !process.env.OKTA_SPA_CLIENT_ID) {
      console.error('Missing required environment variables');
      return res.status(500).json({ 
        error: 'Missing configuration',
        message: 'Required Okta environment variables not configured'
      });
    }

    const sessionId = nanoid();
    const session = {
      sessionId,
      currentStep: 1,
      status: 'initialized',
      createdAt: new Date().toISOString(),
      userId: null,
      isAuthenticated: false
    };

    sessionStorage.set(sessionId, session);
    
    console.log('Workflow session created:', sessionId);
    
    return res.status(200).json({
      sessionId,
      session,
      message: 'Workflow session initialized successfully'
    });
    
  } catch (error: any) {
    console.error('Error initializing workflow:', error);
    return res.status(500).json({
      error: 'Initialization failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}