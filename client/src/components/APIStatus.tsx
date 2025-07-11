import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertCircle, Circle } from 'lucide-react';

interface APIStatusProps {
  currentStep: number;
  tokens: any[];
}

export function APIStatus({ currentStep, tokens }: APIStatusProps) {
  const apis = [
    {
      name: 'Okta OIDC',
      endpoint: '/.well-known/openid_configuration',
      status: currentStep >= 1 ? 'connected' : 'disconnected',
      details: {
        token: tokens.find(t => t.tokenType === 'id_token') ? 'Valid' : 'Invalid',
        scopes: 'openid, profile',
      },
    },
    {
      name: 'Okta IGA API',
      endpoint: '/api/iga/governance/api/v1/requests',
      status: currentStep === 3 ? 'requesting' : currentStep > 3 ? 'connected' : 'disconnected',
      details: {
        method: 'POST',
        status: currentStep >= 3 ? 'Awaiting approval' : 'Not requested',
      },
    },
    {
      name: 'PAM Secret Vault',
      endpoint: '/secrets/resource_groups/7b3e9a80-8253.../secret/27ab37e0-3fee...',
      status: currentStep === 3 ? 'pending' : currentStep > 3 ? 'connected' : 'disconnected',
      details: {
        resourceGroup: '7b3e9a80-8253...',
        secretId: '27ab37e0-3fee...',
        status: currentStep >= 3 ? 'Awaiting IGA approval' : 'Not requested',
      },
    },
    {
      name: 'Salesforce CRM',
      endpoint: '/api/crm/contacts',
      status: currentStep >= 5 ? 'connected' : 'waiting',
      details: {
        mockApi: '/api/crm/contacts',
        delegation: 'act_as=brandon.stark@acme.com',
        status: currentStep >= 5 ? 'Active' : 'Pending access token',
      },
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'requesting':
      case 'pending':
        return <Clock className="w-4 h-4 text-warning animate-pulse" />;
      case 'disconnected':
      case 'waiting':
        return <Circle className="w-4 h-4 text-neutral-300" />;
      default:
        return <AlertCircle className="w-4 h-4 text-error" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-success text-white">Connected</Badge>;
      case 'requesting':
        return <Badge className="bg-warning text-white">Requesting</Badge>;
      case 'pending':
        return <Badge className="bg-warning text-white">Pending</Badge>;
      case 'disconnected':
      case 'waiting':
        return <Badge className="bg-neutral-100 text-neutral-600">Waiting</Badge>;
      default:
        return <Badge className="bg-error text-white">Error</Badge>;
    }
  };

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-neutral-100">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-neutral-900">
          Live API Integration Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {apis.map((api) => (
            <div key={api.name} className="p-4 border border-neutral-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-neutral-900">{api.name}</h3>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(api.status)}
                  {getStatusBadge(api.status)}
                </div>
              </div>
              <div className="space-y-1 text-xs text-neutral-600">
                <div>
                  <span className="font-medium">Endpoint:</span>
                  <code className="bg-neutral-100 px-1 rounded ml-1 text-xs">
                    {api.endpoint}
                  </code>
                </div>
                {Object.entries(api.details).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="capitalize">{key}:</span>
                    <span className={
                      key === 'token' && value === 'Valid' ? 'text-success' :
                      key === 'method' ? 'text-okta-blue' :
                      ''
                    }>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
