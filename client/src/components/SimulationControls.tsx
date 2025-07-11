import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, RotateCcw, Smartphone } from 'lucide-react';

interface SimulationControlsProps {
  onSimulateApproval: () => void;
  onRequestWriteAccess: () => void;
  onResetDemo: () => void;
  isSimulatingApproval: boolean;
  isRequestingWriteAccess: boolean;
  isResetting: boolean;
  currentStep: number;
}

export function SimulationControls({
  onSimulateApproval,
  onRequestWriteAccess,
  onResetDemo,
  isSimulatingApproval,
  isRequestingWriteAccess,
  isResetting,
  currentStep,
}: SimulationControlsProps) {
  return (
    <Card className="bg-white rounded-xl shadow-sm border border-neutral-100">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-neutral-900">
          Demo Simulation Controls
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Approval Simulation */}
          <div className="space-y-3">
            <h3 className="font-medium text-neutral-900">Approve Current Request</h3>
            <p className="text-sm text-neutral-600">
              Simulate Sarah Chen approving the access request
            </p>
            <Button
              onClick={onSimulateApproval}
              disabled={isSimulatingApproval || currentStep !== 3}
              className="w-full bg-success hover:bg-green-600 text-white"
            >
              {isSimulatingApproval ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Simulate Approval
                </>
              )}
            </Button>
          </div>

          {/* Additional Scope Request */}
          <div className="space-y-3">
            <h3 className="font-medium text-neutral-900">Request Write Access</h3>
            <p className="text-sm text-neutral-600">
              Trigger additional consent for crm.write scope
            </p>
            <Button
              onClick={onRequestWriteAccess}
              disabled={isRequestingWriteAccess || currentStep < 4}
              className="w-full bg-okta-blue hover:bg-okta-deep text-white"
            >
              {isRequestingWriteAccess ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Requesting...
                </>
              ) : (
                <>
                  <Smartphone className="w-4 h-4 mr-2" />
                  Request Write Scope
                </>
              )}
            </Button>
          </div>

          {/* Reset Demo */}
          <div className="space-y-3">
            <h3 className="font-medium text-neutral-900">Reset Workflow</h3>
            <p className="text-sm text-neutral-600">
              Reset the demo to initial state
            </p>
            <Button
              onClick={onResetDemo}
              disabled={isResetting}
              className="w-full bg-neutral-600 hover:bg-neutral-700 text-white"
            >
              {isResetting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Resetting...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset Demo
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Real Integration Note */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start space-x-3">
            <AlertCircle className="text-okta-blue mt-1 w-5 h-5" />
            <div>
              <h4 className="font-medium text-neutral-900 mb-1">
                Real Okta Integration Ready
              </h4>
              <p className="text-sm text-neutral-700">
                This demo is designed for seamless integration with live Okta APIs. Replace mock
                endpoints with actual Okta tenant URLs and client credentials to enable full
                functionality.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
