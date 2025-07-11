import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, User, Shield, Key, Database } from 'lucide-react';

interface WorkflowTimelineProps {
  currentStep: number;
  sessionId: string;
  userId?: string;
}

export function WorkflowTimeline({ currentStep, sessionId, userId }: WorkflowTimelineProps) {
  const steps = [
    {
      id: 1,
      title: 'User Authentication (OIDC)',
      description: 'User authenticated via Okta OpenID Connect flow',
      icon: User,
      details: {
        clientId: '0oat46o2xf1bddBxb697',
        scopes: 'openid, profile, email',
      },
    },
    {
      id: 2,
      title: 'Welcome User Profile',
      description: 'Extract user claims from ID token and display welcome message',
      icon: User,
      details: {
        claims: 'name, email, preferred_username',
        tokenType: 'ID Token',
      },
    },
    {
      id: 3,
      title: 'PAM Secret Retrieval',
      description: 'Retrieve client credentials from PAM vault for elevated access',
      icon: Shield,
      details: {
        pamSecret: 'OKTA_CLIENT_CREDENTIALS_CLIENT_SECRET',
        pamClientId: '0oat4agvajRwbJlbU697',
        resourceGroup: 'crm-access-rg',
      },
    },
    {
      id: 4,
      title: 'IGA Access Request + User Profile',
      description: 'Submit IGA approval request for crm_read scope and fetch user profile',
      icon: Key,
      details: {
        requestedScope: 'crm_read',
        userProfileScope: 'okta.users.read',
        approver: 'Sarah Chen',
      },
    },
    {
      id: 5,
      title: 'CRM Data Access',
      description: 'Access Salesforce CRM API with delegated permissions',
      icon: Database,
      details: {
        endpoint: '/crm/contacts',
        delegation: 'act_as claim',
      },
    },
  ];

  const getStepStatus = (stepId: number) => {
    if (stepId < currentStep) return 'completed';
    if (stepId === currentStep) return 'current';
    return 'pending';
  };

  const getStepIcon = (step: any, status: string) => {
    const Icon = step.icon;
    
    if (status === 'completed') {
      return <CheckCircle className="w-5 h-5 text-white" />;
    }
    
    if (status === 'current') {
      return <Clock className="w-5 h-5 text-white animate-pulse" />;
    }
    
    return <span className="text-neutral-600 text-xs font-bold">{step.id}</span>;
  };

  const getStepColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success';
      case 'current':
        return 'bg-warning animate-pulse-slow';
      default:
        return 'bg-neutral-100 border-2 border-neutral-300';
    }
  };

  const getStepBadge = (status: string, stepId: number) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-success text-white">COMPLETED</Badge>;
      case 'current':
        if (stepId === 4) {
          return <Badge className="bg-warning text-white">PENDING APPROVAL</Badge>;
        } else {
          return <Badge className="bg-warning text-white">IN PROGRESS</Badge>;
        }
      default:
        return <Badge className="bg-neutral-100 text-neutral-600">WAITING</Badge>;
    }
  };

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-neutral-100">
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-neutral-900">
            Authentication & Access Workflow
          </CardTitle>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-neutral-600">Session ID:</span>
            <code className="text-xs bg-neutral-100 px-2 py-1 rounded font-mono">
              {sessionId}
            </code>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {steps.map((step) => {
            const status = getStepStatus(step.id);
            const isActive = status !== 'pending';
            
            return (
              <div key={step.id} className={`flex items-start space-x-4 ${!isActive ? 'opacity-50' : ''}`}>
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getStepColor(status)}`}>
                    {getStepIcon(step, status)}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-medium text-neutral-900">{step.title}</h3>
                    {getStepBadge(status, step.id)}
                  </div>
                  <p className="text-sm text-neutral-600 mb-2">{step.description}</p>
                  {Object.keys(step.details).length > 0 && (
                    <div className={`p-3 rounded-lg ${
                      status === 'current' 
                        ? 'bg-amber-50 border border-amber-200' 
                        : 'bg-neutral-50'
                    }`}>
                      <div className="grid grid-cols-1 gap-2 text-xs">
                        {Object.entries(step.details).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="font-medium capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}:
                            </span>
                            <span className={key.includes('Id') ? 'text-okta-blue font-mono' : ''}>
                              {value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
