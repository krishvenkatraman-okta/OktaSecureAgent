import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface WorkflowState {
  session: any;
  accessRequests: any[];
  tokens: any[];
  auditLogs: any[];
  notifications: any[];
}

export function useWorkflowState(sessionId: string) {
  const queryClient = useQueryClient();

  const workflowQuery = useQuery({
    queryKey: ['/api/workflow', sessionId],
    enabled: !!sessionId,
    refetchInterval: (data) => {
      // Poll faster when workflow is active (steps 2+), slower when idle (step 1)
      const currentStep = data?.session?.currentStep || 1;
      return currentStep > 1 ? 2000 : 5000; // 2s when active, 5s when idle
    },
    refetchIntervalInBackground: true,
    staleTime: 0, // Always consider data stale for immediate updates
    gcTime: 0, // Don't cache stale data
    retry: (failureCount, error: any) => {
      // If session not found (404), force page refresh to get new session
      if (error?.response?.status === 404 || error?.status === 404) {
        console.log('Session expired or not found - refreshing page for new session');
        setTimeout(() => window.location.reload(), 1000);
        return false;
      }
      return failureCount < 3;
    },
  });

  const initWorkflowMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest('POST', '/api/workflow/init', { userId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflow'] });
    },
  });

  const requestAccessMutation = useMutation({
    mutationFn: async (data: {
      targetUser: string;
      requestedScope: string;
      justification: string;
    }) => {
      const response = await apiRequest('POST', `/api/workflow/${sessionId}/request-access`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflow', sessionId] });
    },
  });

  const simulateApprovalMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const response = await apiRequest('POST', `/api/workflow/${sessionId}/simulate-approval`, { requestId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflow', sessionId] });
    },
  });

  const requestWriteAccessMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/workflow/${sessionId}/request-write-access`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflow', sessionId] });
    },
  });

  const resetWorkflowMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/workflow/${sessionId}/reset`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflow', sessionId] });
    },
  });

  const crmQuery = useQuery({
    queryKey: ['/api/crm', sessionId, 'contacts'],
    enabled: !!sessionId && workflowQuery.data?.session?.currentStep >= 4,
  });

  return {
    workflowState: workflowQuery.data as WorkflowState | undefined,
    isLoading: workflowQuery.isLoading,
    crmData: crmQuery.data,
    initWorkflow: initWorkflowMutation.mutate,
    requestAccess: requestAccessMutation.mutate,
    simulateApproval: simulateApprovalMutation.mutate,
    requestWriteAccess: requestWriteAccessMutation.mutate,
    resetWorkflow: resetWorkflowMutation.mutate,
    isInitializing: initWorkflowMutation.isPending,
    isRequestingAccess: requestAccessMutation.isPending,
    isSimulatingApproval: simulateApprovalMutation.isPending,
    isRequestingWriteAccess: requestWriteAccessMutation.isPending,
    isResetting: resetWorkflowMutation.isPending,
  };
}
