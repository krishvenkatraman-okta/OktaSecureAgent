import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingAccessRequest, setPendingAccessRequest] = useState<any>(null);
  const [crmData, setCrmData] = useState<any>(null);
  const [actingAsUser, setActingAsUser] = useState<string>('');

  // Initialize messages based on authentication state
  React.useEffect(() => {
    if (isAuthenticated && currentStep >= 2) {
      // Fetch user profile to get the name for welcome message from ID token claims
      fetch(`/api/workflow/${sessionId}`)
        .then(res => res.json())
        .then(data => {
          const idToken = data.tokens?.find((t: any) => t.tokenType === 'id_token');
          // Extract name from ID token claims - check multiple possible claim names
          let userName = 'User';
          if (idToken?.tokenValue) {
            try {
              // Decode the JWT payload to get claims
              const payload = JSON.parse(atob(idToken.tokenValue.split('.')[1]));
              userName = payload.name || payload.given_name || payload.preferred_username || payload.sub || 'User';
            } catch (e) {
              console.log('Could not decode ID token for name extraction');
            }
          }
          
          setMessages([{
            id: '1',
            type: 'bot',
            message: `Welcome ${userName}! You've been successfully authenticated via Okta OIDC. I can help you access CRM data securely. Which user would you like to retrieve data for? (e.g., brandon.stark@acme.com)`,
            timestamp: new Date(),
          }]);
        })
        .catch(() => {
          // Fallback message if user profile fetch fails
          setMessages([{
            id: '1',
            type: 'bot',
            message: 'Welcome! You\'ve been successfully authenticated. I can help you access CRM data securely. Which user would you like to retrieve data for? (e.g., brandon.stark@acme.com)',
            timestamp: new Date(),
          }]);
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
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

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
        
      } else if (isAuthenticated && lowerInput.includes('@')) {
        // User provided email - request PAM secret retrieval which will auto-trigger IGA
        const email = currentInput.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0] || currentInput;
        
        const botMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          message: `I need to retrieve client credentials from PAM vault to access CRM data for ${email}. Making PAM reveal request which will automatically trigger IGA approval workflow...`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
        
        if (onRequestAccess) {
          onRequestAccess(email);
          
          setTimeout(() => {
            const approvalMessage: ChatMessage = {
              id: (Date.now() + 2).toString(),
              type: 'bot',
              message: `✅ PAM secret reveal request submitted. This automatically created an IGA approval request through Okta's system. The request is now pending approval. You can simulate approval using the controls on the right.`,
              timestamp: new Date(),
              action: 'pending_approval'
            };
            setMessages(prev => [...prev, approvalMessage]);
          }, 1000);
        }
        
      } else if (lowerInput.includes('retry') && pendingAccessRequest) {
        // Auto-proceed after approval - get client credentials and CRM data
        const processingMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          message: `Access approved! Now using PAM secret to get client credentials and retrieve CRM data for ${pendingAccessRequest.targetUser}...`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, processingMessage]);
        
        try {
          // Step 1: Get client credentials from PAM and obtain access token
          const tokenResponse = await fetch(`/api/workflow/${sessionId}/get-elevated-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              targetUser: pendingAccessRequest.targetUser,
              requestedScope: 'crm_read'
            }),
          });
          
          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            
            // Step 2: Automatically fetch CRM data using the access token
            const crmResponse = await fetch(`/api/workflow/${sessionId}/access-crm`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                targetUser: pendingAccessRequest.targetUser,
                accessToken: tokenData.accessToken
              }),
            });
            
            if (crmResponse.ok) {
              const crmData = await crmResponse.json();
              setCrmData(crmData);
              setActingAsUser(pendingAccessRequest.targetUser);
              
              const successMessage: ChatMessage = {
                id: (Date.now() + 2).toString(),
                type: 'bot',
                message: `✅ Successfully retrieved CRM data for ${pendingAccessRequest.targetUser}!\n\n**Contact Information:**\n- Name: ${crmData.firstName} ${crmData.lastName}\n- Email: ${crmData.email}\n- Company: ${crmData.company}\n- Phone: ${crmData.phone || 'N/A'}\n- Status: ${crmData.status}\n\nWould you like to update this contact's information? (This would require elevated write access and step-up authentication)`,
                timestamp: new Date(),
              };
              setMessages(prev => [...prev, successMessage]);
            } else {
              const errorMessage: ChatMessage = {
                id: (Date.now() + 2).toString(),
                type: 'bot',
                message: `❌ Failed to retrieve CRM data. Please check the access token and try again.`,
                timestamp: new Date(),
              };
              setMessages(prev => [...prev, errorMessage]);
            }
          }
        } catch (error) {
          console.error('Retry failed:', error);
          const errorMessage: ChatMessage = {
            id: (Date.now() + 4).toString(),
            type: 'bot',
            message: 'Sorry, I encountered an error while obtaining the elevated token. Please try again.',
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, errorMessage]);
        }
        
      } else if (crmData && (lowerInput.includes('update') || lowerInput.includes('modify') || lowerInput.includes('change') || lowerInput.includes('yes'))) {
        // User wants to update data - trigger step-up authentication with push notification
        const botMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          message: `To update CRM data for ${actingAsUser}, I need elevated write permissions. I'm sending a push notification to ${actingAsUser} for step-up authentication consent...`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
        
        // Send push notification for step-up authentication
        try {
          const response = await fetch(`/api/workflow/${sessionId}/send-push-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUser: actingAsUser }),
          });

          if (response.ok) {
            const pushData = await response.json();
            const successMessage: ChatMessage = {
              id: (Date.now() + 2).toString(),
              type: 'bot',
              message: `✅ Push notification sent to ${actingAsUser}! Please check your Okta Verify app and approve the request to enable write access to CRM data.`,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, successMessage]);
            
            // Add follow-up instructions
            setTimeout(() => {
              const followUpMessage: ChatMessage = {
                id: (Date.now() + 3).toString(),
                type: 'bot',
                message: `Once you approve the push notification, I'll be able to update the CRM data with write permissions. The write access token will be automatically retrieved upon approval.`,
                timestamp: new Date(),
              };
              setMessages(prev => [...prev, followUpMessage]);
            }, 2000);
          } else {
            const errorMessage: ChatMessage = {
              id: (Date.now() + 2).toString(),
              type: 'bot',
              message: `❌ Failed to send push notification. Please try again or contact your administrator.`,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
          }
        } catch (error) {
          console.error('Error sending push notification:', error);
          const errorMessage: ChatMessage = {
            id: (Date.now() + 2).toString(),
            type: 'bot',
            message: `❌ Error sending push notification: ${error.message}`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, errorMessage]);
        }
        
      } else if (lowerInput.includes('approve') || lowerInput.includes('approved')) {
        // User indicates they approved the push - get write access
        const botMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          message: `Great! Push notification approved. Now obtaining elevated write access token and updating CRM data...`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
        
        // Simulate write access approval and CRM update
        try {
          const writeResponse = await fetch(`/api/workflow/${sessionId}/simulate-push-approval`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (writeResponse.ok) {
            const writeData = await writeResponse.json();
            const successMessage: ChatMessage = {
              id: (Date.now() + 2).toString(),
              type: 'bot',
              message: `✅ Write access approved! I've successfully updated ${actingAsUser}'s CRM record with elevated permissions.\n\nUpdated contact status to: Premium Customer\nWrite token used: ${writeData.writeToken}\n\nThe Zero Trust workflow is now complete!`,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, successMessage]);
          } else {
            const errorMessage: ChatMessage = {
              id: (Date.now() + 2).toString(),
              type: 'bot',
              message: `❌ Failed to obtain write access. Please try again.`,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
          }
        } catch (error) {
          console.error('Write access approval failed:', error);
          const errorMessage: ChatMessage = {
            id: (Date.now() + 2).toString(),
            type: 'bot',
            message: `❌ Error during write access approval: ${error.message}`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, errorMessage]);
        }
        
      } else if (lowerInput.includes('simulate') && lowerInput.includes('push')) {
        // Simulate push approval and get write access
        try {
          const response = await fetch(`/api/workflow/${sessionId}/simulate-push-approval`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (response.ok) {
            const data = await response.json();
            const botMessage: ChatMessage = {
              id: (Date.now() + 1).toString(),
              type: 'bot',
              message: `Excellent! Push notification approved. I now have write access with elevated token: ${data.writeToken}\\n\\nI've successfully updated ${actingAsUser}'s CRM record in Salesforce. The contact status has been changed to "Premium Customer".\\n\\nIs there anything else you need help with?`,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, botMessage]);
          }
        } catch (error) {
          console.error('Push approval simulation failed:', error);
        }
        
      } else if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
        const botMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          message: isAuthenticated ? 
            'Hi! Which user would you like to retrieve CRM data for?' : 
            'Hi there! I can help you securely access CRM customer data. Just ask me to "get CRM data" when you\'re ready.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
        
      } else {
        const botMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          message: isAuthenticated ?
            'Please provide the email address of the user whose CRM data you need (e.g., brandon.stark@acme.com)' :
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
                {message.action === 'pending_approval' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => setInput('retry after approval')}
                  >
                    Retry After Approval
                  </Button>
                )}
                {message.action === 'request_write' && (
                  <Badge variant="outline" className="mt-2">
                    Requesting Write Access
                  </Badge>
                )}
                {message.action === 'pending_push' && (
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