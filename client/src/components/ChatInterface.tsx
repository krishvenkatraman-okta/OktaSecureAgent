import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Bot, User, Send } from 'lucide-react';

interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  message: string;
  timestamp: Date;
  action?: string;
}

interface ChatInterfaceProps {
  sessionId: string;
  onTriggerAuth: () => void;
  onRequestAccess?: (targetUser: string) => void;
  isAuthenticated?: boolean;
  currentStep?: number;
}

export function ChatInterface({ sessionId, onTriggerAuth, onRequestAccess, isAuthenticated = false, currentStep = 1 }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasGroupAccess, setHasGroupAccess] = useState(false);
  const [crmData, setCrmData] = useState<any>(null);
  const [actingAsUser, setActingAsUser] = useState<string>('');
  const [pendingAccessRequest, setPendingAccessRequest] = useState<any>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Initialize welcome message and auto-check app access after authentication
  useEffect(() => {
    if (isAuthenticated) {
      // Extract name from ID token for personalized welcome and update step 2
      fetch(`/api/workflow/${sessionId}/tokens`)
        .then(res => res.json())
        .then(tokens => {
          const idToken = tokens.find((t: any) => t.tokenType === 'id_token');
          let userName = 'User';
          
          if (idToken) {
            try {
              const payload = JSON.parse(atob(idToken.tokenValue.split('.')[1]));
              console.log('User claims extracted:', payload);
              
              // Extract name from claims - capitalize first letters
              if (payload.name) {
                userName = payload.name.split(' ').map((n: string) => 
                  n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()
                ).join(' ');
              }
            } catch (error) {
              console.log('Could not decode ID token for name extraction');
            }
          }
          
          // Update backend that step 2 is complete with the extracted user name
          console.log('🔄 Calling complete-user-profile API for session:', sessionId);
          console.log('🔄 User name extracted:', userName);
          
          fetch(`/api/workflow/${sessionId}/complete-user-profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userName })
          }).then(response => {
            console.log('✅ Complete-user-profile response status:', response.status);
            if (response.ok) {
              return response.json();
            }
            throw new Error(`Failed to complete user profile: ${response.status}`);
          }).then(data => {
            console.log('✅ Step 2 completion API successful:', data);
            console.log('✅ Backend confirmed currentStep update to:', data.currentStep);
            
            // Force immediate hard reload to refresh all state
            console.log('🔄 Forcing HARD page reload to refresh state...');
            window.location.reload(true);
          }).catch(err => {
            console.error('❌ Failed to complete step 2:', err);
            console.log('❌ Will reload anyway to check current state...');
            // Still reload to try to get the updated state
            setTimeout(() => {
              console.log('🔄 Error case - forcing HARD reload...');
              window.location.reload(true);
            }, 100);
          });
          
          setMessages([{
            id: '1',
            type: 'bot',
            message: `Welcome ${userName}! You've been successfully authenticated via Okta OIDC. I'll now automatically check your CRM app access...`,
            timestamp: new Date(),
          }]);
          
          // Automatically check app access after authentication
          setTimeout(() => {
            checkAppAccess();
          }, 2000);
        })
        .catch(error => {
          console.error('Error fetching tokens:', error);
          setMessages([{
            id: '1',
            type: 'bot',
            message: `Welcome! You've been successfully authenticated via Okta OIDC. I'll now automatically check your CRM app access...`,
            timestamp: new Date(),
          }]);
          
          // Still proceed with app access check even if name extraction fails
          setTimeout(() => {
            checkAppAccess();
          }, 2000);
        });
    } else {
      setMessages([{
        id: '1',
        type: 'bot',
        message: 'Hello! I\'m your AI agent. I can help you access CRM data securely. Just ask me to "get CRM data" and I\'ll handle the authentication and authorization process.',
        timestamp: new Date(),
      }]);
    }
  }, [isAuthenticated, currentStep, sessionId]);

  // Cleanup polling on component unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const pollPushNotification = async (pollUrl: string, targetUser: string) => {
    console.log('🔄 STARTING PUSH NOTIFICATION POLLING for:', targetUser);
    let attempts = 0;
    const maxAttempts = 20; // Poll for up to 2 minutes (every 6 seconds)
    
    const poll = async () => {
      try {
        attempts++;
        console.log(`Polling attempt ${attempts}/${maxAttempts}:`, pollUrl);
        
        const response = await fetch(`/api/workflow/${sessionId}/poll-push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pollUrl }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Poll response:', data);
          
          // Check if we should stop polling (session expired, success, etc.)
          if (data.shouldStopPolling || data.status === 'SESSION_EXPIRED') {
            console.log('Server indicated to stop polling - clearing intervals');
            if (interval) clearInterval(interval);
            if (pollingInterval) clearInterval(pollingInterval);
            setPollingInterval(null);
            
            if (data.status === 'SESSION_EXPIRED') {
              const errorMessage: ChatMessage = {
                id: nanoid(),
                type: 'bot',
                message: `⚠️ Session expired. Please refresh the page to start a new session.`,
                timestamp: new Date(),
              };
              setMessages(prev => [...prev, errorMessage]);
            }
            return true; // Stop polling
          }
          
          if (data.status === 'SUCCESS' || data.isApproved === true) {
            // CRITICAL: Stop all polling immediately
            console.log('SUCCESS detected - stopping all polling NOW');
            
            // Clear BOTH intervals - the local one and the state one
            if (interval) {
              clearInterval(interval);
              console.log('Local interval cleared');
            }
            if (pollingInterval) {
              clearInterval(pollingInterval);
              console.log('State interval cleared');
            }
            setPollingInterval(null);
            
            const approvedMessage: ChatMessage = {
              id: nanoid(),
              type: 'bot',
              message: `✅ Push approval received from Brandon! Moving to PAM to retrieve client credentials with act_as claims...`,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, approvedMessage]);
            
            // Immediately continue with PAM and CRM access
            handlePamAndCrmAccess(targetUser);
            return true; // Signal success to stop outer polling
            
          } else if (data.status === 'REJECTED') {
            // Push was denied
            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
            }
            
            const deniedMessage: ChatMessage = {
              id: nanoid(),
              type: 'bot',
              message: `❌ ${targetUser} denied your access request. You cannot access their CRM data.`,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, deniedMessage]);
            
          } else if (data.status === 'WAITING' && attempts >= maxAttempts) {
            // Timeout after max attempts
            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
            }
            
            const timeoutMessage: ChatMessage = {
              id: nanoid(),
              type: 'bot',
              message: `⏰ Push notification timed out. ${targetUser} did not respond within the time limit.`,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, timeoutMessage]);
          } else if (data.status === 'WAITING') {
            // Still waiting, continue polling
            console.log(`Still waiting for ${targetUser} to respond... (attempt ${attempts}/${maxAttempts})`);
          }
        }
      } catch (error) {
        console.error('Error polling push notification:', error);
        
        // Stop polling on 404/410 (session not found) or after max attempts
        if (error.response?.status === 404 || error.response?.status === 410 || attempts >= maxAttempts) {
          console.log('Stopping polling due to session not found, error, or max attempts reached');
          if (interval) clearInterval(interval);
          if (pollingInterval) clearInterval(pollingInterval);
          setPollingInterval(null);
          
          const errorMessage: ChatMessage = {
            id: nanoid(),
            type: 'bot',
            message: (error.response?.status === 404 || error.response?.status === 410) ? 
              `⚠️ Session expired. Please refresh the page.` :
              `❌ Error polling push notification: ${error.message}`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, errorMessage]);
          return true; // Stop polling
        }
      }
    };
    
    // Start polling every 6 seconds
    console.log('🔄 Setting up push polling interval for:', targetUser);
    const interval = setInterval(async () => {
      const result = await poll();
      if (result === true) {
        // SUCCESS detected, immediately clear BOTH intervals
        console.log('Outer polling detected success - clearing both intervals');
        clearInterval(interval);
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
        setPollingInterval(null);
        return; // Exit immediately
      }
    }, 6000);
    
    setPollingInterval(interval);
    
    // Safety timeout to stop polling after 2 minutes max
    setTimeout(() => {
      if (interval) {
        console.log('Safety timeout - stopping polling after 2 minutes');
        clearInterval(interval);
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
        setPollingInterval(null);
      }
    }, 120000);
    
    // Initial poll
    poll();
  };

  const handlePamAndCrmAccess = async (targetUser: string) => {
    try {
      // Add message about PAM secret vault request
      const pamMessage: ChatMessage = {
        id: nanoid(),
        type: 'bot',
        message: `🔐 Requesting client credentials from PAM secret vault with act_as claims for ${targetUser}...`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, pamMessage]);
      
      // Step 1: Get PAM credentials with act_as claims
      const pamResponse = await fetch(`/api/workflow/${sessionId}/get-elevated-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          targetUser,
          requestedScope: 'crm_read'
        }),
      });
      
      if (pamResponse.ok) {
        const pamData = await pamResponse.json();
        
        const pamSuccessMessage: ChatMessage = {
          id: nanoid(),
          type: 'bot',
          message: `✅ PAM secret vault credentials retrieved successfully! Client credentials with act_as claims obtained. Now accessing CRM data with delegated permissions...`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, pamSuccessMessage]);
        
        // Step 2: Access CRM data using the elevated token
        const crmResponse = await fetch(`/api/workflow/${sessionId}/access-crm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            targetUser,
            accessToken: pamData.accessToken
          }),
        });
        
        if (crmResponse.ok) {
          const crmData = await crmResponse.json();
          setCrmData(crmData);
          
          const successMessage: ChatMessage = {
            id: nanoid(),
            type: 'bot',
            message: `🎉 Success! Retrieved CRM data for ${targetUser}:\n\n📋 **Contact Information:**\n• Name: ${crmData.firstName} ${crmData.lastName}\n• Email: ${crmData.email}\n• Company: ${crmData.company}\n• Phone: ${crmData.phone || 'Not provided'}\n• Status: ${crmData.status}\n• Owner: ${crmData.owner}`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, successMessage]);
        } else {
          throw new Error('Failed to access CRM data');
        }
      } else {
        throw new Error('Failed to get PAM credentials');
      }
    } catch (error) {
      console.error('Error in PAM/CRM flow:', error);
      const errorMessage: ChatMessage = {
        id: nanoid(),
        type: 'bot',
        message: `❌ Error accessing CRM data: ${error.message}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const checkAppAccess = async () => {
    if (hasGroupAccess) return; // Don't check again if already have access
    
    const checkingMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'bot',
      message: 'Checking your Okta app membership for CRM access...',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, checkingMessage]);
    
    try {
      const response = await fetch(`/api/workflow/${sessionId}/check-app-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.hasAccess) {
          setHasGroupAccess(true);
          const successMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: 'bot',
            message: `✅ Great! You have CRM app access. Please specify which user's data you need (e.g., "brandon.stark@acme.com").`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, successMessage]);
        } else {
          // No access - trigger IGA request automatically
          const deniedMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: 'bot',
            message: `❌ You don't have CRM app access. Submitting an Identity Governance (IGA) request for access approval...`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, deniedMessage]);
          
          // Submit IGA request automatically
          setTimeout(() => {
            submitIGARequest();
          }, 1000);
        }
      } else {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          message: `❌ Failed to check app access. Please try saying "get CRM data" to retry.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('App access check error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        message: `❌ Error checking app access. Please try saying "get CRM data" to retry.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const submitIGARequest = async () => {
    try {
      const igaResponse = await fetch(`/api/workflow/${sessionId}/submit-iga-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestTypeId: '6871edc88d85367555d34e8a',
          subject: 'CRM Application Access Request'
        }),
      });
      
      if (igaResponse.ok) {
        const igaData = await igaResponse.json();
        const pendingMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          message: `📋 IGA access request submitted successfully! Request ID: ${igaData.requestId}\n\nWaiting for manager approval... This would normally take some time, but for the demo you can click the button below to simulate approval.`,
          timestamp: new Date(),
          action: 'pending_iga_approval'
        };
        setMessages(prev => [...prev, pendingMessage]);
        setPendingAccessRequest(igaData);
      } else {
        const errorData = await igaResponse.json();
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          message: `❌ Failed to submit IGA request: ${errorData.error}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('IGA request error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        message: `❌ Error submitting IGA request. Please try again.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      message: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsProcessing(true);

    // Process user input based on current state
    setTimeout(async () => {
      const lowerInput = currentInput.toLowerCase();
      
      if (!isAuthenticated && (lowerInput.includes('crm') || lowerInput.includes('customer') || lowerInput.includes('data'))) {
        // Trigger authentication flow
        const botMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          message: 'I need to authenticate you with Okta to access CRM data securely. I\'ll redirect you to Okta for login.',
          timestamp: new Date(),
          action: 'auth'
        };
        
        setMessages(prev => [...prev, botMessage]);
        
        // Trigger Okta authentication immediately
        setTimeout(() => {
          onTriggerAuth();
        }, 500);
        
      } else if (isAuthenticated && (lowerInput.includes('get') && lowerInput.includes('crm')) && !hasGroupAccess) {
        // Step 1: Check Okta app membership first
        const botMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          message: 'Checking your Okta app membership for CRM access...',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
        
        try {
          const response = await fetch(`/api/workflow/${sessionId}/check-app-access`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.hasAccess) {
              setHasGroupAccess(true);
              const successMessage: ChatMessage = {
                id: (Date.now() + 2).toString(),
                type: 'bot',
                message: `✅ Great! You have CRM app access. Please specify which user's data you need (e.g., "brandon.stark@acme.com").`,
                timestamp: new Date(),
              };
              setMessages(prev => [...prev, successMessage]);
            } else {
              // No access - trigger IGA request
              const deniedMessage: ChatMessage = {
                id: (Date.now() + 2).toString(),
                type: 'bot',
                message: `❌ You don't have CRM app access. Submitting an Identity Governance (IGA) request for access approval...`,
                timestamp: new Date(),
              };
              setMessages(prev => [...prev, deniedMessage]);
              
              // Submit IGA request automatically
              try {
                const igaResponse = await fetch(`/api/workflow/${sessionId}/submit-iga-request`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    requestTypeId: '6871edc88d85367555d34e8a',
                    subject: 'CRM Application Access Request'
                  }),
                });
                
                if (igaResponse.ok) {
                  const igaData = await igaResponse.json();
                  const pendingMessage: ChatMessage = {
                    id: (Date.now() + 3).toString(),
                    type: 'bot',
                    message: `📋 IGA access request submitted successfully! Request ID: ${igaData.requestId}\n\nWaiting for manager approval... This would normally take some time, but for the demo you can click the button below to simulate approval.`,
                    timestamp: new Date(),
                    action: 'pending_iga_approval'
                  };
                  setMessages(prev => [...prev, pendingMessage]);
                  setPendingAccessRequest(igaData);
                } else {
                  const errorData = await igaResponse.json();
                  const errorMessage: ChatMessage = {
                    id: (Date.now() + 3).toString(),
                    type: 'bot',
                    message: `❌ Failed to submit IGA request: ${errorData.error}`,
                    timestamp: new Date(),
                  };
                  setMessages(prev => [...prev, errorMessage]);
                }
              } catch (error) {
                console.error('IGA request error:', error);
                const errorMessage: ChatMessage = {
                  id: (Date.now() + 3).toString(),
                  type: 'bot',
                  message: `❌ Error submitting IGA request. Please try again.`,
                  timestamp: new Date(),
                };
                setMessages(prev => [...prev, errorMessage]);
              }
            }
          } else {
            const errorMessage: ChatMessage = {
              id: (Date.now() + 2).toString(),
              type: 'bot',
              message: `❌ Failed to check app access. Please try again.`,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
          }
        } catch (error) {
          console.error('App access check error:', error);
          const errorMessage: ChatMessage = {
            id: (Date.now() + 2).toString(),
            type: 'bot',
            message: `❌ Error checking app access. Please try again.`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, errorMessage]);
        }
        
      } else if (lowerInput.includes('next') && pendingAccessRequest) {
        // Simulate manager approval and re-check access
        const botMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          message: `✅ Great! Manager has approved your IGA request. Re-checking your CRM app access...`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
        
        // Simulate access granted and proceed to user data request
        setTimeout(async () => {
          setHasGroupAccess(true);
          const successMessage: ChatMessage = {
            id: (Date.now() + 2).toString(),
            type: 'bot',
            message: `🎉 Perfect! You now have CRM app access. Please specify which user's data you need (e.g., "brandon.stark@acme.com").`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, successMessage]);
        }, 1000);
        
      } else if (hasGroupAccess && lowerInput.includes('@')) {
        // User specified target email - send push notification
        const targetUser = currentInput.trim();
        const botMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          message: `Sending push notification to ${targetUser} for consent to access their CRM data...`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
        
        try {
          const response = await fetch(`/api/workflow/${sessionId}/send-push-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUser }),
          });
          
          if (response.ok) {
            const data = await response.json();
            const pushMessage: ChatMessage = {
              id: (Date.now() + 2).toString(),
              type: 'bot',
              message: `📱 Push notification sent to ${targetUser}! Polling for response...\n\nTransaction ID: ${data.transactionId}`,
              timestamp: new Date(),
              action: 'pending_push_approval'
            };
            setMessages(prev => [...prev, pushMessage]);
            setActingAsUser(targetUser);
            
            // Start polling if poll URL is available
            if (data.pollUrl) {
              pollPushNotification(data.pollUrl, targetUser);
            }
          } else {
            const errorMessage: ChatMessage = {
              id: (Date.now() + 2).toString(),
              type: 'bot',
              message: `❌ Failed to send push notification. Please try again.`,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
          }
        } catch (error) {
          console.error('Push notification error:', error);
          const errorMessage: ChatMessage = {
            id: (Date.now() + 2).toString(),
            type: 'bot',
            message: `❌ Error sending push notification: ${error.message}`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, errorMessage]);
        }
        
      } else if (lowerInput.includes('simulate') && lowerInput.includes('push') && lowerInput.includes('approval')) {
        // Simulate push approval - get PAM credentials and CRM data
        const botMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          message: `✅ Push notification approved! Now getting PAM client credentials with act_as claims and accessing CRM data...`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
        
        try {
          // Step 1: Get PAM credentials with act_as claims
          const pamResponse = await fetch(`/api/workflow/${sessionId}/get-elevated-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              targetUser: actingAsUser,
              requestedScope: 'crm_read'
            }),
          });
          
          if (pamResponse.ok) {
            const pamData = await pamResponse.json();
            
            // Step 2: Access CRM data using the elevated token
            const crmResponse = await fetch(`/api/workflow/${sessionId}/access-crm`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                targetUser: actingAsUser,
                accessToken: pamData.accessToken
              }),
            });
            
            if (crmResponse.ok) {
              const crmData = await crmResponse.json();
              setCrmData(crmData);
              
              const successMessage: ChatMessage = {
                id: (Date.now() + 2).toString(),
                type: 'bot',
                message: `🎉 Successfully retrieved CRM data for ${actingAsUser}!\n\n**Contact Information:**\n- Name: ${crmData.firstName} ${crmData.lastName}\n- Email: ${crmData.email}\n- Company: ${crmData.company}\n- Phone: ${crmData.phone || 'N/A'}\n- Status: ${crmData.status}\n\nThe Zero Trust workflow is complete! All access was properly authorized through IGA approval and user consent.`,
                timestamp: new Date(),
              };
              setMessages(prev => [...prev, successMessage]);
            } else {
              const errorMessage: ChatMessage = {
                id: (Date.now() + 2).toString(),
                type: 'bot',
                message: `❌ Failed to retrieve CRM data. Please check the access token.`,
                timestamp: new Date(),
              };
              setMessages(prev => [...prev, errorMessage]);
            }
          } else {
            const errorMessage: ChatMessage = {
              id: (Date.now() + 2).toString(),
              type: 'bot',
              message: `❌ Failed to get PAM credentials. Please try again.`,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
          }
        } catch (error) {
          console.error('PAM/CRM access error:', error);
          const errorMessage: ChatMessage = {
            id: (Date.now() + 2).toString(),
            type: 'bot',
            message: `❌ Error accessing CRM data: ${error.message}`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, errorMessage]);
        }
        
      } else if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
        const botMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          message: isAuthenticated ? 
            'Hi! Just ask me to "get CRM data" and I\'ll check your app permissions.' : 
            'Hi there! I can help you securely access CRM customer data. Just ask me to "get CRM data" when you\'re ready.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
        
      } else {
        const botMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          message: isAuthenticated ?
            'Please ask me to "get CRM data" to start the workflow, or provide a user email like "brandon.stark@acme.com" if you already have access.' :
            'I can help you access CRM data securely. Try asking me to "get CRM data" and I\'ll guide you through the Zero Trust authentication process.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
      }
      
      setIsProcessing(false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Agent Chat
          <Badge variant="outline">Zero Trust Security</Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.type === 'bot' && (
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-blue-600" />
                </div>
              )}
              
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm">{message.message}</p>
                {message.action === 'auth' && (
                  <Badge variant="secondary" className="mt-2">
                    Authentication Required
                  </Badge>
                )}
                {message.action === 'pending_iga_approval' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => setInput('next')}
                  >
                    Next (After Manager Approval)
                  </Button>
                )}
                {message.action === 'pending_push_approval' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => setInput('simulate push approval')}
                  >
                    Simulate Push Approval
                  </Button>
                )}
              </div>
              
              {message.type === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-gray-600" />
                </div>
              )}
            </div>
          ))}
          
          {isProcessing && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Bot className="h-4 w-4 text-blue-600" />
              </div>
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Input */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me to get CRM data..."
            className="flex-1"
            disabled={isProcessing}
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={!input.trim() || isProcessing}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}