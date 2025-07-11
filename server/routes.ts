import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { oktaService } from "./services/okta";
import { pamService } from "./services/pam";
import { igaService } from "./services/iga";
import { crmService } from "./services/crm";
import { nanoid } from "nanoid";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store WebSocket connections by session ID
  const sessionConnections = new Map<string, WebSocket>();

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');
    
    if (sessionId) {
      sessionConnections.set(sessionId, ws);
      console.log(`WebSocket connected for session: ${sessionId}`);
    }

    ws.on('close', () => {
      if (sessionId) {
        sessionConnections.delete(sessionId);
        console.log(`WebSocket disconnected for session: ${sessionId}`);
      }
    });
  });

  // Helper function to send real-time updates
  function sendRealtimeUpdate(sessionId: string, data: any) {
    const ws = sessionConnections.get(sessionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  // Initialize workflow session
  app.post('/api/workflow/init', async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const sessionId = nanoid();
      const session = await storage.createWorkflowSession({
        sessionId,
        userId,
        currentStep: 1,
        status: 'active',
        metadata: {},
      });

      await storage.createAuditLog({
        sessionId,
        eventType: 'workflow_init',
        eventData: { userId },
        userId,
      });

      res.json({ sessionId, session });
    } catch (error) {
      console.error('Error initializing workflow:', error);
      res.status(500).json({ error: 'Failed to initialize workflow' });
    }
  });

  // Get workflow session
  app.get('/api/workflow/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = await storage.getWorkflowSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const accessRequests = await storage.getAccessRequestsBySession(sessionId);
      const tokens = await storage.getTokensBySession(sessionId);
      const auditLogs = await storage.getAuditLogsBySession(sessionId);
      const notifications = await storage.getNotificationsBySession(sessionId);

      res.json({
        session,
        accessRequests,
        tokens,
        auditLogs,
        notifications,
      });
    } catch (error) {
      console.error('Error fetching workflow session:', error);
      res.status(500).json({ error: 'Failed to fetch workflow session' });
    }
  });

  // Create OIDC authentication URL with PKCE
  app.post('/api/auth/login', async (req, res) => {
    try {
      const config = oktaService.getOIDCConfig();
      const state = nanoid();
      const nonce = nanoid();
      
      // Generate PKCE parameters
      const crypto = require('crypto');
      const codeVerifier = crypto.randomBytes(128).toString('base64url');
      const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
      
      // Store state, nonce, and code verifier for validation
      // In production, store these in Redis or database
      
      const authUrl = `${config.authorizationEndpoint}?` +
        `client_id=${config.clientId}&` +
        `response_type=code&` +
        `scope=${config.scopes.join('%20')}&` +
        `redirect_uri=${encodeURIComponent(config.redirectUri)}&` +
        `state=${state}&` +
        `nonce=${nonce}&` +
        `code_challenge=${codeChallenge}&` +
        `code_challenge_method=S256`;
      
      res.json({ authUrl, state, nonce, codeVerifier });
    } catch (error) {
      console.error('Error creating auth URL:', error);
      res.status(500).json({ error: 'Failed to create auth URL' });
    }
  });

  // Handle OIDC callback and user profile fetch
  app.post('/api/auth/oidc-callback', async (req, res) => {
    try {
      const { code, state, codeVerifier } = req.body;
      
      if (!code || !state) {
        return res.status(400).json({ error: 'Missing code or state parameter' });
      }
      
      // Exchange code for tokens with Okta using PKCE
      const config = oktaService.getOIDCConfig();
      
      try {
        // Make token exchange request to Okta
        const tokenResponse = await fetch(config.tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: config.clientId,
            code: code,
            redirect_uri: config.redirectUri,
            code_verifier: codeVerifier || 'mock-code-verifier', // Use provided or mock for demo
          }),
        });

        if (!tokenResponse.ok) {
          throw new Error(`Token exchange failed: ${tokenResponse.status}`);
        }

        const tokens = await tokenResponse.json();
        
        // Initialize workflow session
        const sessionId = nanoid();
        const session = await storage.createWorkflowSession({
          sessionId,
          userId: 'authenticated-user',
          currentStep: 2,
          status: 'active',
          metadata: { state, authCode: code, authenticated: true } as any,
        });

        // Store tokens
        await storage.createToken({
          sessionId,
          tokenType: 'id_token',
          tokenValue: tokens.id_token || 'mock-id-token',
          scopes: 'openid profile email',
          expiresAt: new Date(Date.now() + 3600000),
        });

        await storage.createToken({
          sessionId,
          tokenType: 'access_token',
          tokenValue: tokens.access_token || 'mock-access-token',
          scopes: 'openid profile email',
          expiresAt: new Date(Date.now() + 3600000),
        });

        await storage.createAuditLog({
          sessionId,
          eventType: 'auth_complete',
          eventData: { code, state, tokenExchange: 'success' } as any,
          userId: 'authenticated-user',
        });

        // Send real-time update
        sendRealtimeUpdate(sessionId, {
          type: 'auth_complete',
          step: 2,
          sessionId,
          authenticated: true,
        });

        res.json({ success: true, sessionId, authenticated: true });
      } catch (tokenError) {
        console.error('Token exchange error:', tokenError);
        
        // Fall back to mock authentication for demo
        const sessionId = nanoid();
        await storage.createWorkflowSession({
          sessionId,
          userId: 'authenticated-user',
          currentStep: 2,
          status: 'active',
          metadata: { state, authCode: code, authenticated: true, mockAuth: true } as any,
        });

        res.json({ success: true, sessionId, authenticated: true, mock: true });
      }
    } catch (error) {
      console.error('Error handling OIDC callback:', error);
      res.status(500).json({ error: 'Failed to handle OIDC callback' });
    }
  });

  // Get CRM data with elevated token
  app.post('/api/workflow/:sessionId/get-crm-data', async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      // Get elevated token from PAM
      const elevatedToken = await pamService.getElevatedToken(['crm.read'], 'brandon.stark@acme.com');
      
      // Store elevated token
      await storage.createToken({
        sessionId,
        tokenType: 'elevated_access',
        tokenValue: elevatedToken,
        scopes: 'crm.read',
        expiresAt: new Date(Date.now() + 3600000),
        actAs: 'brandon.stark@acme.com'
      });
      
      // Get CRM data
      const crmData = await crmService.getContacts('brandon.stark@acme.com', elevatedToken);
      const contact = crmData[0]; // Get first contact
      
      await storage.createAuditLog({
        sessionId,
        eventType: 'crm_data_access',
        eventData: { actAs: 'brandon.stark@acme.com', contactId: contact?.id } as any,
        userId: 'ai-agent',
      });
      
      sendRealtimeUpdate(sessionId, {
        type: 'crm_data_retrieved',
        step: 4,
        actingAs: 'brandon.stark@acme.com',
        contact
      });
      
      res.json({ 
        success: true, 
        actingAs: 'brandon.stark@acme.com',
        contact,
        elevatedToken: elevatedToken.substring(0, 20) + '...' // Show partial token for demo
      });
    } catch (error) {
      console.error('Error getting CRM data:', error);
      res.status(500).json({ error: 'Failed to get CRM data' });
    }
  });

  // Request elevated access (PAM + IGA)
  app.post('/api/workflow/:sessionId/request-access', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { targetUser, requestedScope, justification } = req.body;

      const session = await storage.getWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Create IGA access request
      const igaRequest = await igaService.createAccessRequest({
        targetUser,
        requestedScope,
        justification,
      });

      // Store access request
      const accessRequest = await storage.createAccessRequest({
        sessionId,
        requestType: 'iga',
        targetUser,
        requestedScope,
        status: 'pending',
        approverName: 'Sarah Chen',
        justification,
      });

      // Update workflow step
      await storage.updateWorkflowSession(sessionId, {
        currentStep: 3,
        metadata: { ...session.metadata, igaRequestId: igaRequest.id },
      });

      // Create notification
      await storage.createNotification({
        sessionId,
        type: 'push',
        recipient: 'sarah.chen@acme.com',
        message: `AcmeAI is requesting access to ${targetUser}'s CRM data. Approve?`,
        status: 'sent',
      });

      // Send Okta Verify push notification
      try {
        await oktaService.sendVerifyPush(
          'sarah.chen@acme.com',
          `Approve AI agent access to ${targetUser}'s CRM data?`
        );
      } catch (pushError) {
        console.warn('Failed to send Okta Verify push:', pushError);
      }

      await storage.createAuditLog({
        sessionId,
        eventType: 'access_request',
        eventData: { targetUser, requestedScope, justification },
        userId: session.userId,
      });

      // Send real-time update
      sendRealtimeUpdate(sessionId, {
        type: 'access_request_submitted',
        step: 3,
        accessRequest,
      });

      res.json({ success: true, accessRequest, igaRequest });
    } catch (error) {
      console.error('Error requesting access:', error);
      res.status(500).json({ error: 'Failed to request access' });
    }
  });

  // Simulate approval (for demo purposes)
  app.post('/api/workflow/:sessionId/simulate-approval', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { requestId } = req.body;

      const session = await storage.getWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Update access request status
      await storage.updateAccessRequest(requestId, {
        status: 'approved',
        approverId: 'sarah.chen@acme.com',
      });

      // Get elevated token from PAM
      const elevatedToken = await pamService.getElevatedToken(
        ['crm.read'],
        'brandon.stark@acme.com'
      );

      // Store elevated token
      await storage.createToken({
        sessionId,
        tokenType: 'elevated_token',
        tokenValue: elevatedToken,
        scopes: 'crm.read',
        actAs: 'brandon.stark@acme.com',
        expiresAt: new Date(Date.now() + 900000), // 15 minutes
      });

      // Update workflow step
      await storage.updateWorkflowSession(sessionId, {
        currentStep: 4,
        metadata: { ...session.metadata, approved: true },
      });

      await storage.createAuditLog({
        sessionId,
        eventType: 'access_approved',
        eventData: { requestId: requestId.toString(), approverId: 'sarah.chen@acme.com' } as Record<string, any>,
        userId: session.userId,
      });

      // Send real-time update
      sendRealtimeUpdate(sessionId, {
        type: 'access_approved',
        step: 4,
        elevatedToken: elevatedToken.substring(0, 20) + '...',
      });

      res.json({ success: true, elevatedToken });
    } catch (error) {
      console.error('Error simulating approval:', error);
      res.status(500).json({ error: 'Failed to simulate approval' });
    }
  });

  // Access CRM data with elevated token
  app.get('/api/crm/:sessionId/contacts', async (req, res) => {
    try {
      const { sessionId } = req.params;

      const session = await storage.getWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const elevatedToken = await storage.getToken(sessionId, 'elevated_token');
      if (!elevatedToken) {
        return res.status(401).json({ error: 'Elevated token not found' });
      }

      // Access CRM data using elevated token
      const contacts = await crmService.getContacts(
        'brandon.stark@acme.com',
        elevatedToken.tokenValue
      );

      // Update workflow step
      await storage.updateWorkflowSession(sessionId, {
        currentStep: 5,
        metadata: { ...session.metadata, crmAccessed: true },
      });

      await storage.createAuditLog({
        sessionId,
        eventType: 'crm_access',
        eventData: { contactsCount: contacts.length.toString() } as Record<string, any>,
        userId: session.userId,
      });

      // Send real-time update
      sendRealtimeUpdate(sessionId, {
        type: 'crm_access',
        step: 5,
        contacts,
      });

      res.json({ success: true, contacts });
    } catch (error) {
      console.error('Error accessing CRM data:', error);
      res.status(500).json({ error: 'Failed to access CRM data' });
    }
  });

  // Request write access (dynamic consent)
  app.post('/api/workflow/:sessionId/request-write-access', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { targetUser } = req.body;

      const session = await storage.getWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Create access request for write scope
      const accessRequest = await storage.createAccessRequest({
        sessionId,
        requestType: 'consent',
        targetUser: targetUser || 'brandon.stark@acme.com',
        requestedScope: 'crm.write',
        status: 'pending',
        justification: 'AI agent needs to update CRM records',
      });

      // Send Okta Verify push for dynamic consent
      try {
        await oktaService.sendVerifyPush(
          targetUser || 'brandon.stark@acme.com',
          'Approve AI agent to update Salesforce CRM for Brandon Stark?'
        );
      } catch (pushError) {
        console.warn('Failed to send Okta Verify push:', pushError);
      }

      await storage.createNotification({
        sessionId,
        type: 'push',
        recipient: targetUser || 'brandon.stark@acme.com',
        message: 'Approve AI agent to update Salesforce CRM for Brandon Stark?',
        status: 'sent',
      });

      await storage.createAuditLog({
        sessionId,
        eventType: 'write_access_request',
        eventData: { requestedScope: 'crm.write', targetUser } as Record<string, any>,
        userId: session.userId,
      });

      // Send real-time update
      sendRealtimeUpdate(sessionId, {
        type: 'write_access_request',
        step: 6,
        accessRequest,
      });

      res.json({ success: true, accessRequest });
    } catch (error) {
      console.error('Error requesting write access:', error);
      res.status(500).json({ error: 'Failed to request write access' });
    }
  });

  // Simulate push approval and get write token
  app.post('/api/workflow/:sessionId/simulate-push-approval', async (req, res) => {
    try {
      const { sessionId } = req.params;

      const session = await storage.getWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Get elevated write token from PAM
      const writeToken = await pamService.getElevatedToken(['crm.write'], 'brandon.stark@acme.com');

      // Store write token
      await storage.createToken({
        sessionId,
        tokenType: 'write_access',
        tokenValue: writeToken,
        scopes: 'crm.write',
        actAs: 'brandon.stark@acme.com',
        expiresAt: new Date(Date.now() + 900000), // 15 minutes
      });

      // Update CRM data
      const updatedContact = await crmService.updateContact(
        'contact-1',
        { status: 'Premium Customer' },
        'brandon.stark@acme.com',
        writeToken
      );

      await storage.createAuditLog({
        sessionId,
        eventType: 'crm_update',
        eventData: { contactId: 'contact-1', updatedFields: 'status' } as Record<string, any>,
        userId: session.userId,
      });

      // Send real-time update
      sendRealtimeUpdate(sessionId, {
        type: 'crm_updated',
        step: 7,
        updatedContact,
        writeToken: writeToken.substring(0, 20) + '...',
      });

      res.json({ 
        success: true, 
        writeToken: writeToken.substring(0, 20) + '...',
        updatedContact 
      });
    } catch (error) {
      console.error('Error simulating push approval:', error);
      res.status(500).json({ error: 'Failed to simulate push approval' });
    }
  });

  // Get Okta OIDC configuration
  app.get('/api/auth/config', async (req, res) => {
    try {
      const config = oktaService.getOIDCConfig();
      res.json(config);
    } catch (error) {
      console.error('Error getting auth config:', error);
      res.status(500).json({ error: 'Failed to get auth config' });
    }
  });

  // Reset workflow (for demo purposes)
  app.post('/api/workflow/:sessionId/reset', async (req, res) => {
    try {
      const { sessionId } = req.params;

      const session = await storage.getWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Reset workflow to initial state
      await storage.updateWorkflowSession(sessionId, {
        currentStep: 1,
        status: 'active',
        metadata: {},
      });

      await storage.createAuditLog({
        sessionId,
        eventType: 'workflow_reset',
        eventData: {},
        userId: session.userId,
      });

      // Send real-time update
      sendRealtimeUpdate(sessionId, {
        type: 'workflow_reset',
        step: 1,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error resetting workflow:', error);
      res.status(500).json({ error: 'Failed to reset workflow' });
    }
  });

  return httpServer;
}
