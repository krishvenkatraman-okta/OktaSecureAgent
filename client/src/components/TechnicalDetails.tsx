import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TechnicalDetailsProps {
  tokens: any[];
  sessionId: string;
}

export function TechnicalDetails({ tokens, sessionId }: TechnicalDetailsProps) {
  const clientConfig = {
    spaClient: '0oat46o2xf1bddBxb697',
    ccClient: '0oat4agvajRwbJlbU697',
    pamKeyId: 'c0e75418-05f5-4c0b...',
  };

  const scopes = [
    { name: 'openid', status: 'active', type: 'basic' },
    { name: 'profile', status: 'active', type: 'basic' },
    { name: 'okta.users.read', status: 'active', type: 'elevated' },
    { name: 'crm.read', status: 'pending', type: 'elevated' },
    { name: 'crm.write', status: 'inactive', type: 'elevated' },
  ];

  const getTokenStatus = (tokenType: string) => {
    const token = tokens.find(t => t.tokenType === tokenType);
    if (!token) return 'Not issued';
    
    const isExpired = new Date(token.expiresAt) < new Date();
    return isExpired ? 'Expired' : 'Valid';
  };

  const getTokenExpiry = (tokenType: string) => {
    const token = tokens.find(t => t.tokenType === tokenType);
    if (!token) return 'N/A';
    
    const expiryDate = new Date(token.expiresAt);
    const now = new Date();
    const minutesLeft = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60));
    
    if (minutesLeft < 0) return 'Expired';
    if (minutesLeft < 60) return `${minutesLeft} min remaining`;
    return `${Math.floor(minutesLeft / 60)} hours remaining`;
  };

  const getScopeBadgeColor = (scope: any) => {
    if (scope.status === 'active') {
      return scope.type === 'basic' ? 'bg-okta-light text-okta-deep' : 'bg-amber-100 text-amber-800';
    }
    if (scope.status === 'pending') {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-red-100 text-red-800 opacity-50';
  };

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-neutral-100">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-neutral-900">
          Technical Details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Client Configurations */}
          <div>
            <h4 className="font-medium text-neutral-900 mb-2">Okta Client Setup</h4>
            <div className="bg-neutral-50 rounded-lg p-3 font-mono text-xs space-y-1">
              <div>
                <span className="text-neutral-600">SPA Client:</span>
                <span className="text-okta-blue ml-2">{clientConfig.spaClient}</span>
              </div>
              <div>
                <span className="text-neutral-600">CC Client:</span>
                <span className="text-okta-blue ml-2">{clientConfig.ccClient}</span>
              </div>
              <div>
                <span className="text-neutral-600">PAM Key ID:</span>
                <span className="text-okta-blue ml-2">{clientConfig.pamKeyId}</span>
              </div>
            </div>
          </div>

          {/* Security Scopes */}
          <div>
            <h4 className="font-medium text-neutral-900 mb-2">Required Scopes</h4>
            <div className="flex flex-wrap gap-2">
              {scopes.map((scope) => (
                <Badge key={scope.name} className={getScopeBadgeColor(scope)}>
                  {scope.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Token Information */}
          <div>
            <h4 className="font-medium text-neutral-900 mb-2">Token Status</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-600">ID Token:</span>
                <span className={getTokenStatus('id_token') === 'Valid' ? 'text-success' : 'text-warning'}>
                  {getTokenStatus('id_token')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Act on behalf of access token:</span>
                <span className={getTokenStatus('access_token') === 'Valid' ? 'text-success' : 'text-warning'}>
                  {getTokenStatus('access_token')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Elevated Token:</span>
                <span className={getTokenStatus('elevated_token') === 'Valid' ? 'text-success' : 'text-warning'}>
                  {getTokenStatus('elevated_token')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Expires:</span>
                <span className="text-neutral-900">
                  {getTokenExpiry('elevated_token')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
