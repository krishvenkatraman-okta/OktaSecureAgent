import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Smartphone, Shield, Key, UserCheck } from 'lucide-react';

interface LiveNotificationsProps {
  notifications: any[];
  auditLogs: any[];
}

export function LiveNotifications({ notifications, auditLogs }: LiveNotificationsProps) {
  // Combine and sort notifications and audit logs by timestamp
  const allEvents = [
    ...notifications.map(n => ({ ...n, source: 'notification' })),
    ...auditLogs.map(a => ({ ...a, source: 'audit' }))
  ].sort((a, b) => new Date(b.createdAt || b.timestamp).getTime() - new Date(a.createdAt || a.timestamp).getTime());

  const getEventIcon = (event: any) => {
    if (event.source === 'notification') {
      return <Smartphone className="text-okta-blue mt-1 w-4 h-4" />;
    }
    
    // Audit log icons
    switch (event.eventType) {
      case 'access_approved':
        return <Shield className="text-success mt-1 w-4 h-4" />;
      case 'access_request':
        return <Key className="text-success mt-1 w-4 h-4" />;
      case 'auth_complete':
        return <UserCheck className="text-success mt-1 w-4 h-4" />;
      default:
        return <Shield className="text-neutral-600 mt-1 w-4 h-4" />;
    }
  };

  const getEventTitle = (event: any) => {
    if (event.source === 'notification') {
      return event.type === 'push' ? 'Push Notification Sent' : 'Notification';
    }
    
    // Audit log titles
    switch (event.eventType) {
      case 'access_approved':
        return 'Access Request Approved';
      case 'access_request':
        return 'IGA Request Submitted';
      case 'auth_complete':
        return 'User Authentication';
      case 'workflow_init':
        return 'Workflow Initialized';
      default:
        return event.eventType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getEventDescription = (event: any) => {
    if (event.source === 'notification') {
      return event.message;
    }
    
    // Audit log descriptions
    switch (event.eventType) {
      case 'access_approved':
        return 'Access request approved by governance manager';
      case 'access_request':
        return 'Automatic governance request created';
      case 'auth_complete':
        return 'OIDC flow completed successfully';
      case 'workflow_init':
        return 'New workflow session started';
      default:
        return 'System event recorded';
    }
  };

  const getEventBgColor = (event: any) => {
    if (event.source === 'notification') {
      return 'bg-blue-50 border-blue-200';
    }
    
    const isRecent = new Date().getTime() - new Date(event.createdAt || event.timestamp).getTime() < 5 * 60 * 1000;
    return isRecent ? 'bg-blue-50 border-blue-200' : 'bg-neutral-50';
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-neutral-100">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-neutral-900">
          Live Notifications
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {allEvents.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              <p>No notifications yet</p>
            </div>
          ) : (
            allEvents.slice(0, 5).map((event, index) => (
              <div key={index} className={`flex items-start space-x-3 p-3 rounded-lg border ${getEventBgColor(event)}`}>
                {getEventIcon(event)}
                <div className="flex-1">
                  <div className="text-sm font-medium text-neutral-900">
                    {getEventTitle(event)}
                  </div>
                  <div className="text-xs text-neutral-600 mt-1">
                    {getEventDescription(event)}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {formatTime(event.createdAt || event.timestamp)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
