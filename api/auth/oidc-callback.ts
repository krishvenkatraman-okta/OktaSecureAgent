import { VercelRequest, VercelResponse } from '@vercel/node';
import { nanoid } from 'nanoid';
import crypto from 'crypto';
import { sessionStorage } from '../shared/session-storage';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, state, codeVerifier } = req.body;

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    // Create a new session for the authenticated user
    const sessionId = nanoid();
    
    // For demo purposes, we'll simulate successful authentication
    // In a real app, you'd exchange the code for tokens here
    
    console.log('OIDC Callback - Code:', code?.substring(0, 20) + '...');
    console.log('OIDC Callback - State:', state);
    console.log('OIDC Callback - SessionId:', sessionId);

    // Create authenticated session directly
    const authenticatedSession = {
      sessionId,
      currentStep: 1,
      status: 'authenticated',
      createdAt: new Date().toISOString(),
      userId: 'okta-user',
      isAuthenticated: true,
      authCode: code,
      authState: state
    };

    sessionStorage.set(sessionId, authenticatedSession);
    
    console.log('Created authenticated session:', sessionId);

    res.status(200).json({
      success: true,
      sessionId,
      authenticated: true,
      message: 'Authentication successful'
    });

  } catch (error: any) {
    console.error('OIDC callback error:', error);
    res.status(500).json({
      error: 'Authentication callback failed',
      message: error.message
    });
  }
}