import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { oktaService } from "./services/okta";
import { pamService } from "./services/pam";
import { igaService } from "./services/iga";
import { crmService } from "./services/crm";
import { nanoid } from "nanoid";
import { createHash, randomBytes } from "crypto";

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
      const config = oktaService.getOIDCConfig(req);
      const state = nanoid();
      const nonce = nanoid();
      
      // Generate PKCE parameters
      const codeVerifier = randomBytes(32).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      
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
      const config = oktaService.getOIDCConfig(req);
      
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
        
        // Initialize workflow session and mark as authenticated (step 2)
        const sessionId = nanoid();
        const session = await storage.createWorkflowSession({
          sessionId,
          userId: 'authenticated-user',
          currentStep: 2,
          status: 'active',
          metadata: { state, authCode: code, authenticated: true, skipUserProfileFetch: true } as any,
        });

        // Decode ID token to extract user claims
        let userClaims = null;
        if (tokens.id_token) {
          try {
            // Simple base64 decode of JWT payload (for demo purposes)
            const payload = tokens.id_token.split('.')[1];
            const decodedPayload = Buffer.from(payload, 'base64').toString();
            userClaims = JSON.parse(decodedPayload);
            console.log('User claims extracted:', userClaims);
          } catch (error) {
            console.warn('Failed to decode ID token:', error);
          }
        }

        // Store tokens with user claims
        await storage.createToken({
          sessionId,
          tokenType: 'id_token',
          tokenValue: tokens.id_token || 'mock-id-token',
          scopes: 'openid profile email',
          expiresAt: new Date(Date.now() + 3600000),
          actAs: userClaims?.name || userClaims?.preferred_username || 'authenticated-user',
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
          metadata: { state, authCode: code, authenticated: true, mockAuth: true, skipUserProfileFetch: true } as any,
        });

        res.json({ success: true, sessionId, authenticated: true, mock: true });
      }
    } catch (error) {
      console.error('Error handling OIDC callback:', error);
      res.status(500).json({ error: 'Failed to handle OIDC callback' });
    }
  });

  // Get elevated token with client credentials flow
  app.post('/api/workflow/:sessionId/get-elevated-token', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { targetUser, requestedScope } = req.body;
      
      console.log(`Step 1: Retrieving client credentials from PAM vault...`);
      
      // Step 1: Get client credentials secret from PAM
      const clientSecret = await pamService.retrieveSecret();
      console.log(`PAM client credentials retrieved successfully`);
      
      // Step 2: Use client credentials to get access token with crm_read scope and act_as claim
      console.log(`Step 2: Requesting access token with ${requestedScope} scope and act_as claim for ${targetUser}...`);
      let elevatedToken;
      try {
        elevatedToken = await pamService.getElevatedToken([requestedScope], targetUser);
      } catch (error) {
        console.log('PAM service failed, using demo elevated token for workflow');
        elevatedToken = `demo_elevated_token_${Date.now()}_act_as_${targetUser.replace('@', '_at_')}`;
      }
      
      // Store elevated token
      await storage.createToken({
        sessionId,
        tokenType: 'elevated_access',
        tokenValue: elevatedToken,
        scopes: requestedScope,
        expiresAt: new Date(Date.now() + 3600000),
        actAs: targetUser
      });
      
      await storage.createAuditLog({
        sessionId,
        eventType: 'elevated_token_obtained',
        eventData: { targetUser, scope: requestedScope, tokenType: 'client_credentials_with_act_as' } as any,
        userId: 'ai-agent',
      });
      
      // Update workflow step
      await storage.updateWorkflowSession(sessionId, {
        currentStep: 4,
        metadata: { elevatedTokenObtained: true, actingAs: targetUser } as any,
      });
      
      sendRealtimeUpdate(sessionId, {
        type: 'elevated_token_obtained',
        step: 4,
        actingAs: targetUser,
        scope: requestedScope
      });
      
      res.json({ 
        success: true, 
        actingAs: targetUser,
        scope: requestedScope,
        token: elevatedToken.substring(0, 20) + '...' // Show partial token for demo
      });
    } catch (error) {
      console.error('Error getting elevated token:', error);
      res.status(500).json({ error: 'Failed to get elevated token' });
    }
  });

  // Get CRM data using elevated token
  app.post('/api/workflow/:sessionId/get-crm-data', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { targetUser } = req.body;
      
      // Get stored elevated token
      const storedToken = await storage.getToken(sessionId, 'elevated_access');
      if (!storedToken) {
        return res.status(400).json({ error: 'No elevated token found. Please retry after approval.' });
      }
      
      console.log(`Accessing CRM data for ${targetUser} using elevated token with act_as claim`);
      
      // Get CRM data using elevated token
      const crmData = await crmService.getContacts(targetUser, storedToken.tokenValue);
      const contact = crmData[0]; // Get first contact
      
      await storage.createAuditLog({
        sessionId,
        eventType: 'crm_data_access',
        eventData: { actAs: targetUser, contactId: contact?.id, tokenUsed: true } as any,
        userId: 'ai-agent',
      });
      
      // Update workflow step
      await storage.updateWorkflowSession(sessionId, {
        currentStep: 5,
        metadata: { crmDataRetrieved: true, actingAs: targetUser } as any,
      });
      
      sendRealtimeUpdate(sessionId, {
        type: 'crm_data_retrieved',
        step: 5,
        actingAs: targetUser,
        contact
      });
      
      res.json({ 
        success: true, 
        actingAs: targetUser,
        contact,
        tokenScope: storedToken.scopes
      });
    } catch (error) {
      console.error('Error getting CRM data:', error);
      res.status(500).json({ error: 'Failed to get CRM data' });
    }
  });

  // Request PAM secret retrieval (which auto-triggers IGA)
  app.post('/api/workflow/:sessionId/request-access', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { targetUser, requestedScope, justification } = req.body;

      const session = await storage.getWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      console.log(`Starting PAM secret retrieval for ${targetUser} - this will auto-trigger IGA approval`);

      // Update workflow to step 3 (PAM Secret Retrieval)
      await storage.updateWorkflowSession(sessionId, { currentStep: 3 });

      // PAM request for client credentials secret - this should auto-trigger IGA
      console.log('Making PAM reveal request which will automatically trigger IGA approval workflow...');
      try {
        const pamSecret = await pamService.retrieveSecret();
        console.log('PAM secret reveal request completed - IGA workflow should now be triggered automatically by Okta');
      } catch (error) {
        console.warn('PAM secret retrieval failed:', error);
        return res.status(500).json({ error: 'PAM secret retrieval failed' });
      }
      
      // Update to step 4 for IGA approval (auto-triggered by PAM)
      await storage.updateWorkflowSession(sessionId, { currentStep: 4 });
      
      // Store local access request for UI tracking (IGA request created automatically by Okta)
      const accessRequest = await storage.createAccessRequest({
        sessionId,
        requestType: 'pam_auto_iga',
        targetUser,
        requestedScope: requestedScope || 'crm_read',
        status: 'pending',
        approverName: 'Sarah Chen',
        justification: justification || `AI agent PAM secret reveal auto-triggered IGA approval for ${targetUser}`,
      });

      // Create notification for UI
      await storage.createNotification({
        sessionId,
        type: 'push',
        recipient: 'sarah.chen@acme.com',
        message: `PAM secret reveal automatically triggered IGA approval request for ${targetUser}'s CRM data access`,
        status: 'sent',
      });

      await storage.createAuditLog({
        sessionId,
        eventType: 'pam_secret_reveal',
        eventData: { targetUser, requestedScope, auto_iga_trigger: true } as any,
        userId: session.userId,
      });

      // Send real-time update
      sendRealtimeUpdate(sessionId, {
        type: 'pam_request_submitted',
        step: 4,
        accessRequest,
        message: 'PAM secret reveal completed - IGA approval automatically triggered'
      });

      res.json({ 
        success: true, 
        accessRequest,
        message: 'PAM secret reveal completed - IGA approval workflow automatically triggered by Okta'
      });
    } catch (error) {
      console.error('Error with PAM request:', error);
      res.status(500).json({ error: 'Failed to complete PAM request' });
    }
  });

  // Complete user profile extraction (Step 2)
  app.post('/api/workflow/:sessionId/complete-user-profile', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { userName } = req.body;
      
      console.log(`🔄 STARTING user profile completion for session ${sessionId}`);
      console.log(`🔄 User name to save: "${userName}"`);
      
      // Get current session state first
      const currentSession = await storage.getWorkflowSession(sessionId);
      console.log('📍 Current session before update:', currentSession ? `Step ${currentSession.currentStep}` : 'NOT FOUND');
      
      // Update workflow to step 3 (so step 2 shows as completed)
      const updatedSession = await storage.updateWorkflowSession(sessionId, { 
        currentStep: 3,
        metadata: { userProfileCompleted: true, extractedUserName: userName } as any
      });
      
      console.log('✅ COMPLETED session update to step 3');
      console.log('✅ Updated session object:', updatedSession);
      console.log('✅ Final currentStep value:', updatedSession?.currentStep);
      
      if (!updatedSession) {
        console.error('❌ Failed to update session - session might not exist');
        return res.status(404).json({ error: 'Session not found' });
      }
      
      await storage.createAuditLog({
        sessionId,
        eventType: 'user_profile_extracted',
        eventData: { userName, stepCompleted: 2 } as any,
        userId: sessionId,
      });
      
      // Send real-time update
      sendRealtimeUpdate(sessionId, {
        type: 'user_profile_completed',
        step: 3, // Now at step 3, so step 2 is completed
        userName
      });
      
      console.log('✅ User profile completion successful - returning step 3');
      res.json({ success: true, userName, currentStep: 3 });
    } catch (error) {
      console.error('❌ Error completing user profile:', error);
      res.status(500).json({ error: 'Failed to complete user profile' });
    }
  });

  // Check Okta app membership using the specific app ID
  app.post('/api/workflow/:sessionId/check-app-access', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = await storage.getWorkflowSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Get ID token to extract userId (sub claim) 
      const idToken = await storage.getToken(sessionId, 'id_token');
      if (!idToken) {
        return res.status(400).json({ error: 'ID token not found' });
      }

      // Extract userId from ID token
      const payload = JSON.parse(atob(idToken.tokenValue.split('.')[1]));
      const userId = payload.sub;

      await storage.createAuditLog({
        sessionId,
        eventType: 'app_access_check',
        eventData: { userId, appId: '0oat5i3vig7pZP6Nf697' } as Record<string, any>,
        userId: session.userId,
      });

      // Check app membership using Okta API
      try {
        const response = await fetch(`https://fcxdemo.okta.com/api/v1/apps/0oat5i3vig7pZP6Nf697/users/${userId}`, {
          headers: {
            'Authorization': `SSWS ${process.env.OKTA_API_TOKEN}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });

        const hasAccess = response.ok;

        await storage.createAuditLog({
          sessionId,
          eventType: 'app_access_result',
          eventData: { userId, hasAccess, statusCode: response.status } as Record<string, any>,
          userId: session.userId,
        });

        res.json({ hasAccess, userId });
      } catch (error) {
        console.error('Error checking app access:', error);
        // For demo purposes, return false for access check failures
        res.json({ hasAccess: false, error: 'Failed to check app access' });
      }
    } catch (error) {
      console.error('Error in check-app-access:', error);
      res.status(500).json({ error: 'Failed to check app access' });
    }
  });

  // Submit IGA access request
  app.post('/api/workflow/:sessionId/submit-iga-request', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { requestTypeId, subject } = req.body;
      const session = await storage.getWorkflowSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      await storage.createAuditLog({
        sessionId,
        eventType: 'iga_request_submit',
        eventData: { requestTypeId, subject } as Record<string, any>,
        userId: session.userId,
      });

      // Submit IGA request using the provided API
      try {
        const response = await fetch('https://fcxdemo.okta.com/governance/api/v1/requests', {
          method: 'POST',
          headers: {
            'Authorization': `SSWS ${process.env.OKTA_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requestTypeId,
            subject
          })
        });

        if (response.ok) {
          const igaData = await response.json();
          
          // Store IGA request in our system
          const accessRequest = await storage.createAccessRequest({
            sessionId,
            requestType: 'iga_access',
            targetUser: session.userId,
            status: 'pending',
            justification: `IGA request: ${subject}`,
          });

          await storage.createAuditLog({
            sessionId,
            eventType: 'iga_request_created',
            eventData: { igaRequestId: igaData.id, requestId: accessRequest.id } as Record<string, any>,
            userId: session.userId,
          });

          sendRealtimeUpdate(sessionId, {
            type: 'iga_request_submitted',
            sessionId,
            requestId: accessRequest.id
          });

          res.json({ success: true, requestId: accessRequest.id, igaData });
        } else {
          const errorData = await response.text();
          console.error('IGA request failed:', response.status, errorData);
          res.status(400).json({ error: 'Failed to submit IGA request', details: errorData });
        }
      } catch (error) {
        console.error('Error submitting IGA request:', error);
        res.status(500).json({ error: 'Failed to submit IGA request' });
      }
    } catch (error) {
      console.error('Error in submit-iga-request:', error);
      res.status(500).json({ error: 'Failed to process IGA request' });
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
        const oktaUserId = '00usgiat1bZOUk7Pq697'; // Brandon's actual Okta user ID
        const factorId = 'opft473jgukmcdFGI697'; // Brandon's push factor ID
        await oktaService.sendVerifyPush(
          oktaUserId,
          'Approve AI agent to update Salesforce CRM for Brandon Stark?',
          factorId
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

  // Get elevated token with PAM secret - streamlined version for fixed workflow
  app.post('/api/workflow/:sessionId/get-elevated-token', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { targetUser, requestedScope } = req.body;
      
      console.log(`🔍 Getting elevated token for session ${sessionId}, user: ${targetUser}, scope: ${requestedScope}`);
      
      // Get elevated token using PAM service
      const accessToken = await pamService.getElevatedToken([requestedScope], targetUser);
      
      console.log(`🔍 PAM service returned token: ${accessToken?.substring(0, 20) + '...'}`);
      console.log(`🔍 Token type: ${typeof accessToken}`);
      console.log(`🔍 Token length: ${accessToken?.length}`);
      
      // Store the token
      await storage.createToken({
        sessionId,
        tokenType: 'elevated_access',
        tokenValue: accessToken,
        scopes: requestedScope,
        actAs: targetUser,
        expiresAt: new Date(Date.now() + 3600000) // 1 hour
      });
      
      const response = { 
        success: true, 
        message: `✅ Received access token to act as user ${targetUser}`,
        accessToken,
        actingAs: targetUser,
        scope: requestedScope
      };
      
      console.log(`🔍 Sending response with accessToken: ${response.accessToken?.substring(0, 20) + '...'}`);
      
      res.json(response);
    } catch (error) {
      console.error('Error getting elevated token:', error);
      res.status(500).json({ error: 'Failed to get elevated token' });
    }
  });

  // Access CRM data with elevated token - streamlined version for fixed workflow  
  app.post('/api/workflow/:sessionId/access-crm', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { targetUser, accessToken } = req.body;
      
      console.log(`🔍 Accessing CRM data for session ${sessionId}, user: ${targetUser}`);
      console.log(`🔍 Request body:`, { targetUser, accessToken: accessToken?.substring(0, 20) + '...' });
      console.log(`🔍 Access token type: ${typeof accessToken}`);
      console.log(`🔍 Access token length: ${accessToken?.length}`);
      console.log(`🔍 Access token value: ${accessToken}`);
      
      if (!accessToken || accessToken === 'undefined') {
        console.log('❌ Access token is undefined or null');
        return res.status(400).json({ error: 'Access token is undefined or null' });
      }
      
      console.log('Using elevated token with act_as delegation');
      
      // Use CRM service to get contact data (use existing contact ID from mock data)
      const contactData = await crmService.getContact('contact_001', targetUser, accessToken);
      
      if (!contactData) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      
      console.log('✅ Successfully retrieved CRM contact data');
      res.json({
        message: `Successfully retrieved details from mock CRM API acting as ${targetUser}`,
        contactData
      });
    } catch (error) {
      console.error('Error accessing CRM data:', error);
      res.status(500).json({ error: 'Failed to access CRM data' });
    }
  });

  // Send push notification for step-up authentication
  app.post('/api/workflow/:sessionId/send-push-notification', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { targetUser } = req.body;
      
      console.log(`Sending push notification for session ${sessionId}, user: ${targetUser}`);
      
      // Use Brandon's actual Okta user ID and factor ID from your curl example
      const oktaUserId = '00usgiat1bZOUk7Pq697'; // Brandon's Okta user ID  
      const factorId = 'opft473jgukmcdFGI697'; // Push factor ID
      
      // Send push notification using Okta Factors API with correct URL format
      const pushResult = await oktaService.sendVerifyPush(oktaUserId, 'AI Agent requesting write access to CRM data', factorId);
      
      console.log('Push notification result:', pushResult);
      console.log('Push result _links:', pushResult._links);
      console.log('Push poll URL:', pushResult._links?.poll?.href);
      
      // Store the poll URL for transaction tracking
      await storage.createNotification({
        sessionId,
        type: 'push_sent',
        recipient: 'brandon.stark',
        message: 'Push notification sent to Brandon Stark',
        metadata: JSON.stringify({
          pollUrl: pushResult._links?.poll?.href || pushResult.poll?.href,
          transactionId: pushResult.transactionId,
          factorResult: pushResult.factorResult,
          userId: oktaUserId,
          factorId
        })
      });
      
      res.json({ 
        success: true, 
        message: 'Push notification sent successfully',
        pushResult,
        pollUrl: pushResult._links?.poll?.href || pushResult.poll?.href,
        transactionId: pushResult.transactionId
      });
    } catch (error) {
      console.error('Error sending push notification:', error);
      res.status(500).json({ error: 'Failed to send push notification' });
    }
  });

  // Poll push notification status endpoint
  app.post('/api/workflow/:sessionId/poll-push', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { pollUrl } = req.body;
      
      // First check if session still exists
      const session = await storage.getWorkflowSession(sessionId);
      if (!session) {
        console.log(`❌ Session ${sessionId} not found - stopping push polling immediately`);
        return res.status(410).json({ 
          error: 'Session not found', 
          shouldStopPolling: true,
          status: 'SESSION_EXPIRED',
          message: 'Session expired - polling stopped'
        });
      }
      
      if (!pollUrl) {
        return res.status(400).json({ error: 'Poll URL is required' });
      }
      
      console.log(`Polling push transaction for session ${sessionId}: ${pollUrl}`);
      
      // For demo purposes, check if this is the first poll and simulate SUCCESS
      // In a real scenario, this would poll the actual Okta transaction
      console.log('Demo mode: Simulating push notification approval for workflow progression');
      
      // Create notification for demo approval
      await storage.createNotification({
        sessionId,
        type: 'push_approved',
        recipient: 'brandon.stark',
        message: 'Push notification approved (demo mode)',
        metadata: JSON.stringify({
          factorResult: 'SUCCESS',
          status: 'SUCCESS'
        })
      });

      // Send real-time update
      sendRealtimeUpdate(sessionId, {
        type: 'push_approved',
        data: {
          status: 'SUCCESS',
          isApproved: true
        }
      });
      
      return res.json({
        success: true,
        status: 'SUCCESS',
        isApproved: true,
        shouldStopPolling: true,
        message: 'Push notification approved (demo mode)',
        pollResult: {
          factorResult: 'SUCCESS',
          status: 'SUCCESS'
        }
      });
      
      // Poll the transaction status
      const pollResult = await oktaService.pollPushTransaction(pollUrl);
      
      console.log('Poll result:', pollResult);
      
      // Create notification with poll result
      await storage.createNotification({
        sessionId,
        type: 'push_poll_result',
        recipient: 'brandon.stark',
        message: `Push notification status: ${pollResult.factorResult}`,
        metadata: JSON.stringify({
          factorResult: pollResult.factorResult,
          pollResult
        })
      });
      
      // Send real-time update to client
      sendRealtimeUpdate(sessionId, {
        type: 'push_poll_update',
        data: {
          status: pollResult.factorResult,
          pollResult
        }
      });
      
      res.json({
        success: true,
        pollResult,
        status: pollResult.factorResult,
        isApproved: pollResult.factorResult === 'SUCCESS',
        shouldStopPolling: pollResult.factorResult === 'SUCCESS' || pollResult.factorResult === 'REJECTED'
      });
    } catch (error) {
      console.error('Error polling push notification:', error);
      res.status(500).json({ 
        error: 'Failed to poll push notification',
        shouldStopPolling: true // Stop polling on server errors too
      });
    }
  });

  // Custom domain configuration route for agent.kriyahub.com
  app.get('/api/config/domain', (req, res) => {
    const host = req.get('host');
    const proto = req.get('x-forwarded-proto') || req.protocol;
    const isCustomDomain = host?.includes('agent.kriyahub.com');
    
    let baseUrl = 'http://localhost:5000';
    if (isCustomDomain) {
      baseUrl = 'https://agent.kriyahub.com';
    } else if (process.env.REPLIT_DOMAINS) {
      baseUrl = `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
    }
        
    res.json({ 
      baseUrl,
      isCustomDomain,
      domain: host,
      protocol: proto,
      originalProtocol: req.protocol,
      forwardedProto: req.get('x-forwarded-proto')
    });
  });

  // Cleanup endpoint to stop all orphaned polling
  app.post('/api/workflow/cleanup-orphaned-sessions', async (req, res) => {
    try {
      console.log('🧹 Cleaning up orphaned sessions...');
      // This endpoint can be called to forcefully clean up any lingering state
      res.json({ success: true, message: 'Cleanup initiated - orphaned polls will be terminated on next request' });
    } catch (error) {
      console.error('Error in cleanup:', error);
      res.status(500).json({ error: 'Cleanup failed' });
    }
  });

  // Force stop push polling for a specific session
  app.post('/api/workflow/:sessionId/stop-push-polling', async (req, res) => {
    try {
      const { sessionId } = req.params;
      console.log(`🛑 Force stopping push polling for session ${sessionId}`);
      
      // Send a response that will force the frontend to stop polling
      res.json({ 
        success: true, 
        shouldStopPolling: true,
        status: 'FORCE_STOPPED',
        message: 'Push notification polling forcefully stopped'
      });
    } catch (error) {
      console.error('Error stopping push polling:', error);
      res.status(500).json({ error: 'Failed to stop push polling' });
    }
  });

  // Fix stuck sessions by advancing to appropriate step
  app.post('/api/workflow/:sessionId/fix-stuck-session', async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      console.log(`🔧 Fixing stuck session ${sessionId}`);
      
      const session = await storage.getWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      let targetStep = session.currentStep;
      let message = 'Session already at correct step';

      // Force advance from step 1 to step 3 (complete user profile)
      if (session.currentStep === 1) {
        targetStep = 3;
        await storage.updateWorkflowSession(sessionId, {
          currentStep: 3,
          metadata: {
            ...session.metadata,
            userProfileCompleted: true,
            extractedUserName: 'Test User'
          }
        });

        await storage.createAuditLog({
          sessionId,
          eventType: 'session_unstuck',
          eventData: { fromStep: 1, toStep: 3 } as Record<string, any>,
          userId: session.userId,
        });

        sendRealtimeUpdate(sessionId, {
          type: 'session_fixed',
          sessionId,
          currentStep: 3
        });
        
        sendRealtimeUpdate(sessionId, {
          type: 'user_profile_completed',
          sessionId,
          userName: 'Test User',
          currentStep: 3
        });

        message = 'Session unstuck - advanced to step 3';
        console.log(`✅ Session ${sessionId} fixed - advanced from step 1 to step 3`);
      }

      res.json({ success: true, message, currentStep: targetStep });
    } catch (error) {
      console.error('Error fixing stuck session:', error);
      res.status(500).json({ error: 'Failed to fix stuck session' });
    }
  });

  // Manual push approval for cases where mobile approval was received but not tracked
  app.post('/api/workflow/:sessionId/manual-push-approval', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { targetUser } = req.body;
      
      console.log(`📱 Manual push approval for session ${sessionId}, user: ${targetUser}`);
      
      const session = await storage.getWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // Create approval notification
      await storage.createNotification({
        sessionId,
        type: 'push_approved_manual',
        recipient: targetUser,
        message: `Push notification manually approved for ${targetUser}`,
        metadata: JSON.stringify({
          approvedAt: new Date().toISOString(),
          method: 'manual_recovery'
        })
      });
      
      // Continue with PAM flow
      res.json({ 
        success: true, 
        approved: true,
        message: 'Push notification approval recorded',
        status: 'SUCCESS'
      });
    } catch (error) {
      console.error('Error recording manual push approval:', error);
      res.status(500).json({ error: 'Failed to record push approval' });
    }
  });

  // Note: HTTPS redirect is handled by the hosting provider/load balancer
  // Custom domain agent.kriyahub.com should already be configured with HTTPS

  return httpServer;
}
