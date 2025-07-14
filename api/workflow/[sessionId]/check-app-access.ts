import { VercelRequest, VercelResponse } from '@vercel/node';
import { sessionStorage } from '../../shared/session-storage';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionId = req.query.sessionId as string;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  try {
    // Get session from storage
    const session = sessionStorage.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Simulate app access check
    const oktaDomain = process.env.OKTA_DOMAIN || 'fcxdemo.okta.com';
    const appId = '0oat5i3vig7pZP6Nf697'; // CRM app ID
    
    console.log('Checking app access for session:', sessionId);
    console.log('App ID:', appId);
    
    // For demo purposes, simulate denied access to trigger IGA workflow
    const hasAccess = false; // This will trigger the IGA request flow
    
    // Update session with access check result
    const updatedSession = {
      ...session,
      appAccessChecked: true,
      hasAppAccess: hasAccess,
      appId: appId,
      currentStep: hasAccess ? 4 : 2 // Skip to PAM if access granted, otherwise go to IGA
    };
    
    sessionStorage.set(sessionId, updatedSession);
    
    return res.status(200).json({
      session: updatedSession,
      hasAccess,
      appId,
      message: hasAccess ? 'App access granted' : 'App access denied - IGA request required'
    });
    
  } catch (error: any) {
    console.error('Error checking app access:', error);
    return res.status(500).json({
      error: 'Failed to check app access',
      message: error.message
    });
  }
}