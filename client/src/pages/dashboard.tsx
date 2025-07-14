import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useWorkflowState } from '@/hooks/useWorkflowState';
import { WorkflowTimeline } from '@/components/WorkflowTimeline';
import { APIStatus } from '@/components/APIStatus';
import { CurrentRequest } from '@/components/CurrentRequest';
import { LiveNotifications } from '@/components/LiveNotifications';
import { TechnicalDetails } from '@/components/TechnicalDetails';
import { ChatInterface } from '@/components/ChatInterface';
import { SimulationControls } from '@/components/SimulationControls';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, User, Circle, UserCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Initialize workflow session without authentication
  useEffect(() => {
    let mounted = true;
    
    if (isInitialized) return; // Prevent re-initialization
    
    const initializeWorkflow = async () => {
      try {
        // First check if we're returning from Okta callback
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        
        if (code && state) {
          // Handle Okta callback
          const codeVerifier = sessionStorage.getItem('pkce_code_verifier');
          const response = await fetch('/api/auth/oidc-callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, state, codeVerifier }),
          });
          
          if (response.ok && mounted) {
            const data = await response.json();
            setSessionId(data.sessionId);
            setIsInitialized(true);
            setIsAuthenticated(true);
            
            // Fetch the updated workflow state to get current step
            const workflowResponse = await fetch(`/api/workflow/${data.sessionId}`);
            if (workflowResponse.ok) {
              const workflowData = await workflowResponse.json();
              setCurrentStep(workflowData.session.currentStep);
            }
            
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
          } else if (!response.ok) {
            throw new Error('Authentication failed');
          }
        } else {
          // Initialize workflow session without authentication
          const response = await fetch('/api/workflow/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: 'chatbot-user' }),
          });
          
          if (response.ok && mounted) {
            const data = await response.json();
            setSessionId(data.sessionId);
            setIsInitialized(true);
          } else if (!response.ok) {
            throw new Error('Failed to initialize workflow');
          }
        }
      } catch (error) {
        if (mounted) {
          console.error('Failed to initialize workflow:', error);
        }
      }
    };

    initializeWorkflow();
    
    return () => {
      mounted = false;
    };
  }, []); // Empty dependency array to run only once

  // Trigger Okta authentication when requested by chatbot
  const triggerAuthentication = async () => {
    try {
      console.log('Triggering authentication...');
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Auth URL received:', data.authUrl);
        
        // Store PKCE code verifier for token exchange
        if (data.codeVerifier) {
          sessionStorage.setItem('pkce_code_verifier', data.codeVerifier);
        }
        
        toast({
          title: 'Redirecting to Okta',
          description: 'Opening Okta authentication...',
        });
        
        // Redirect to Okta for authentication
        window.location.href = data.authUrl;
      } else {
        const errorData = await response.text();
        console.error('Auth response error:', errorData);
        throw new Error(`Failed to get auth URL: ${response.status}`);
      }
    } catch (error) {
      console.error('Authentication trigger failed:', error);
      toast({
        title: 'Authentication Failed',
        description: `Could not start Okta authentication: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  // Disable useWorkflowState to prevent refresh loops
  const workflowState = null;
  const isLoading = false;
  const requestAccess = () => {};
  const simulateApproval = () => {};
  const requestWriteAccess = () => {};
  const resetWorkflow = () => {};
  const isRequestingAccess = false;
  const isSimulatingApproval = false;
  const isRequestingWriteAccess = false;
  const isResetting = false;

  const { isConnected, lastMessage } = useWebSocket(sessionId);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      const { type, ...data } = lastMessage;
      
      switch (type) {
        case 'auth_complete':
          toast({
            title: 'Authentication Complete',
            description: 'User profile fetched successfully',
          });
          break;
        case 'access_request_submitted':
          toast({
            title: 'Access Request Submitted',
            description: 'IGA request created and awaiting approval',
          });
          break;
        case 'access_approved':
          toast({
            title: 'Access Approved',
            description: 'Elevated token issued with 15-minute expiry',
          });
          break;
        case 'crm_access':
          toast({
            title: 'CRM Access Granted',
            description: `Retrieved ${data.contacts?.length || 0} contacts`,
          });
          break;
        case 'write_access_request':
          toast({
            title: 'Write Access Requested',
            description: 'Okta Verify push sent for dynamic consent',
          });
          break;
        case 'workflow_reset':
          toast({
            title: 'Workflow Reset',
            description: 'Demo has been reset to initial state',
          });
          break;
      }
    }
  }, [lastMessage, toast]);

  const handleRequestAccess = (targetUser = 'brandon.stark@acme.com') => {
    requestAccess({
      targetUser,
      requestedScope: 'crm.read',
      justification: `AI agent needs to access CRM data for ${targetUser}`,
    });
  };

  const handleSimulateApproval = () => {
    const pendingRequest = workflowState?.accessRequests.find(req => req.status === 'pending');
    if (pendingRequest) {
      simulateApproval(pendingRequest.id);
    }
  };

  const handleRequestWriteAccess = () => {
    requestWriteAccess();
  };

  const handleResetDemo = () => {
    resetWorkflow();
  };

  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-okta-blue mx-auto mb-4"></div>
          <p className="text-neutral-600">Initializing AcmeAI Agent...</p>
        </div>
      </div>
    );
  }

  const workflowCurrentStep = workflowState?.session?.currentStep || 1;
  const accessRequests = workflowState?.accessRequests || [];
  const tokens = workflowState?.tokens || [];
  const auditLogs = workflowState?.auditLogs || [];
  const notifications = workflowState?.notifications || [];

  return (
    <div className="min-h-screen bg-neutral-50 font-inter">
      {/* Header */}
      <header className="bg-white border-b border-neutral-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Bot className="w-8 h-8 text-okta-blue" />
                <h1 className="text-xl font-semibold text-neutral-900">AcmeAI Agent</h1>
              </div>
              <div className="hidden md:flex items-center space-x-2 text-sm text-neutral-600">
                <Badge className="bg-okta-light text-okta-deep">DEMO</Badge>
                <span>Okta IGA Secure Access</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Circle className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-error'}`} />
                <span className="text-sm text-neutral-600">
                  {isConnected ? 'Connected to Okta' : 'Disconnected'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <UserCircle className="w-5 h-5 text-neutral-600" />
                <span className="text-sm font-medium text-neutral-900">AI Agent Service</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Main Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Chat Interface */}
          <div>
            <ChatInterface 
              sessionId={sessionId} 
              onTriggerAuth={triggerAuthentication}
              onRequestAccess={handleRequestAccess}
              isAuthenticated={isAuthenticated}
              currentStep={workflowCurrentStep}
            />
          </div>
          
          {/* Right Column: Workflow Status */}
          <div className="space-y-6">
            <WorkflowTimeline
              currentStep={workflowCurrentStep}
              sessionId={sessionId}
              userId={workflowState?.session?.userId}
            />
            
            <APIStatus currentStep={workflowCurrentStep} tokens={tokens} />
            
            {/* Show "Request Access" button when ready */}
            {workflowCurrentStep === 2 && (
              <Card className="bg-white rounded-xl shadow-sm border border-neutral-100">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <h3 className="text-lg font-medium text-neutral-900 mb-2">
                      Ready to Request Elevated Access
                    </h3>
                    <p className="text-sm text-neutral-600 mb-4">
                      Click below to request access to Brandon Stark's CRM data
                    </p>
                    <Button
                      onClick={handleRequestAccess}
                      disabled={isRequestingAccess}
                      className="bg-okta-blue hover:bg-okta-deep text-white"
                    >
                      {isRequestingAccess ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Requesting Access...
                        </>
                      ) : (
                        'Request CRM Access'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Status Panel */}
          <div className="space-y-6">
            <CurrentRequest accessRequests={accessRequests} currentStep={workflowCurrentStep} />
            <LiveNotifications notifications={notifications} auditLogs={auditLogs} />
            <TechnicalDetails tokens={tokens} sessionId={sessionId} />
          </div>
        </div>

        {/* Simulation Controls */}
        <div className="mt-8">
          <SimulationControls
            onSimulateApproval={handleSimulateApproval}
            onRequestWriteAccess={handleRequestWriteAccess}
            onResetDemo={handleResetDemo}
            isSimulatingApproval={isSimulatingApproval}
            isRequestingWriteAccess={isRequestingWriteAccess}
            isResetting={isResetting}
            currentStep={workflowCurrentStep}
          />
        </div>
      </div>
    </div>
  );
}
