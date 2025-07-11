import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, User, CheckCircle } from 'lucide-react';

interface CurrentRequestProps {
  accessRequests: any[];
  currentStep: number;
}

export function CurrentRequest({ accessRequests, currentStep }: CurrentRequestProps) {
  const pendingRequest = accessRequests.find(req => req.status === 'pending');
  
  if (!pendingRequest && currentStep < 3) {
    return null;
  }

  const approvers = [
    {
      name: 'Sarah Chen',
      title: 'Data Governance Manager',
      status: pendingRequest?.status === 'pending' ? 'pending' : 'approved',
    },
    {
      name: 'Michael Torres',
      title: 'Security Admin',
      status: 'queued',
    },
  ];

  const getApprovalIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-6 h-6 text-success" />;
      case 'pending':
        return <Clock className="w-6 h-6 text-warning animate-pulse" />;
      default:
        return <User className="w-6 h-6 text-neutral-600" />;
    }
  };

  const getApprovalBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-success text-white">Approved</Badge>;
      case 'pending':
        return <Badge className="bg-warning text-white">Pending</Badge>;
      default:
        return <Badge className="bg-neutral-200 text-neutral-600">Queued</Badge>;
    }
  };

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-neutral-100">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-neutral-900">
          Current Access Request
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Request Summary */}
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="text-warning mt-1 w-5 h-5" />
              <div className="flex-1">
                <h3 className="font-medium text-neutral-900 mb-2">Elevated Access Required</h3>
                <p className="text-sm text-neutral-700 mb-3">
                  AcmeAI is requesting access to CRM data for{' '}
                  <strong>{pendingRequest?.targetUser || 'brandon.stark@acme.com'}</strong> to
                  generate a summary report.
                </p>
                
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Request Type:</span>
                    <span className="font-medium">Delegated Access</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Scope:</span>
                    <span className="font-medium">{pendingRequest?.requestedScope || 'crm.read'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Duration:</span>
                    <span className="font-medium">15 minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Justification:</span>
                    <span className="font-medium">
                      {pendingRequest?.justification || 'Customer support inquiry'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Approval Progress */}
          <div className="space-y-3">
            <h4 className="font-medium text-neutral-900">Approval Chain</h4>
            
            {approvers.map((approver, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-neutral-50 rounded-lg">
                <div className="flex-shrink-0">
                  {getApprovalIcon(approver.status)}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm text-neutral-900">{approver.name}</div>
                  <div className="text-xs text-neutral-600">{approver.title}</div>
                </div>
                {getApprovalBadge(approver.status)}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
