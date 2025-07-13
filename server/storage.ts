import {
  workflowSessions,
  accessRequests,
  tokenStore,
  auditLogs,
  notifications,
  chatMessages,
  type WorkflowSession,
  type InsertWorkflowSession,
  type AccessRequest,
  type InsertAccessRequest,
  type TokenStore,
  type InsertToken,
  type AuditLog,
  type InsertAuditLog,
  type Notification,
  type InsertNotification,
  type ChatMessage,
  type InsertChatMessage
} from "@shared/schema";

export interface IStorage {
  // Workflow Sessions
  createWorkflowSession(session: InsertWorkflowSession): Promise<WorkflowSession>;
  getWorkflowSession(sessionId: string): Promise<WorkflowSession | undefined>;
  updateWorkflowSession(sessionId: string, updates: Partial<WorkflowSession>): Promise<WorkflowSession | undefined>;
  
  // Access Requests
  createAccessRequest(request: InsertAccessRequest): Promise<AccessRequest>;
  getAccessRequest(id: number): Promise<AccessRequest | undefined>;
  getAccessRequestsBySession(sessionId: string): Promise<AccessRequest[]>;
  updateAccessRequest(id: number, updates: Partial<AccessRequest>): Promise<AccessRequest | undefined>;
  
  // Token Store
  createToken(token: InsertToken): Promise<TokenStore>;
  getToken(sessionId: string, tokenType: string): Promise<TokenStore | undefined>;
  getTokensBySession(sessionId: string): Promise<TokenStore[]>;
  deleteToken(id: number): Promise<void>;
  
  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogsBySession(sessionId: string): Promise<AuditLog[]>;
  
  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsBySession(sessionId: string): Promise<Notification[]>;
  
  // Chat Messages
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessagesBySession(sessionId: string): Promise<ChatMessage[]>;
}

export class MemStorage implements IStorage {
  private workflowSessions: Map<string, WorkflowSession> = new Map();
  private accessRequests: Map<number, AccessRequest> = new Map();
  private tokenStore: Map<number, TokenStore> = new Map();
  private auditLogs: Map<number, AuditLog> = new Map();
  private notifications: Map<number, Notification> = new Map();
  private chatMessages: Map<number, ChatMessage> = new Map();
  
  private workflowSessionId = 1;
  private accessRequestId = 1;
  private tokenId = 1;
  private auditLogId = 1;
  private notificationId = 1;
  private chatMessageId = 1;

  async createWorkflowSession(session: InsertWorkflowSession): Promise<WorkflowSession> {
    const newSession: WorkflowSession = {
      ...session,
      id: this.workflowSessionId++,
      status: session.status || 'active',
      currentStep: session.currentStep || 1,
      metadata: session.metadata || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.workflowSessions.set(session.sessionId, newSession);
    return newSession;
  }

  async getWorkflowSession(sessionId: string): Promise<WorkflowSession | undefined> {
    return this.workflowSessions.get(sessionId);
  }

  async updateWorkflowSession(sessionId: string, updates: Partial<WorkflowSession>): Promise<WorkflowSession | undefined> {
    const session = this.workflowSessions.get(sessionId);
    if (!session) {
      console.error(`❌ Storage: Session ${sessionId} not found for update`);
      return undefined;
    }
    
    console.log(`🔄 Storage: Updating session ${sessionId} from step ${session.currentStep} to step ${updates.currentStep || session.currentStep}`);
    const updatedSession = { ...session, ...updates, updatedAt: new Date() };
    this.workflowSessions.set(sessionId, updatedSession);
    console.log(`✅ Storage: Session ${sessionId} updated successfully to step ${updatedSession.currentStep}`);
    return updatedSession;
  }

  async createAccessRequest(request: InsertAccessRequest): Promise<AccessRequest> {
    const newRequest: AccessRequest = {
      ...request,
      id: this.accessRequestId++,
      status: request.status || 'pending',
      targetUser: request.targetUser || null,
      requestedScope: request.requestedScope || null,
      approverId: request.approverId || null,
      approverName: request.approverName || null,
      justification: request.justification || null,
      expiresAt: request.expiresAt || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.accessRequests.set(newRequest.id, newRequest);
    return newRequest;
  }

  async getAccessRequest(id: number): Promise<AccessRequest | undefined> {
    return this.accessRequests.get(id);
  }

  async getAccessRequestsBySession(sessionId: string): Promise<AccessRequest[]> {
    return Array.from(this.accessRequests.values()).filter(req => req.sessionId === sessionId);
  }

  async updateAccessRequest(id: number, updates: Partial<AccessRequest>): Promise<AccessRequest | undefined> {
    const request = this.accessRequests.get(id);
    if (!request) return undefined;
    
    const updatedRequest = { ...request, ...updates, updatedAt: new Date() };
    this.accessRequests.set(id, updatedRequest);
    return updatedRequest;
  }

  async createToken(token: InsertToken): Promise<TokenStore> {
    const newToken: TokenStore = {
      ...token,
      id: this.tokenId++,
      scopes: token.scopes || null,
      actAs: token.actAs || null,
      expiresAt: token.expiresAt || null,
      createdAt: new Date(),
    };
    this.tokenStore.set(newToken.id, newToken);
    return newToken;
  }

  async getToken(sessionId: string, tokenType: string): Promise<TokenStore | undefined> {
    return Array.from(this.tokenStore.values()).find(
      token => token.sessionId === sessionId && token.tokenType === tokenType
    );
  }

  async getTokensBySession(sessionId: string): Promise<TokenStore[]> {
    return Array.from(this.tokenStore.values()).filter(token => token.sessionId === sessionId);
  }

  async deleteToken(id: number): Promise<void> {
    this.tokenStore.delete(id);
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const newLog: AuditLog = {
      ...log,
      id: this.auditLogId++,
      userId: log.userId || null,
      eventData: log.eventData || null,
      timestamp: new Date(),
    };
    this.auditLogs.set(newLog.id, newLog);
    return newLog;
  }

  async getAuditLogsBySession(sessionId: string): Promise<AuditLog[]> {
    return Array.from(this.auditLogs.values()).filter(log => log.sessionId === sessionId);
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const newNotification: Notification = {
      ...notification,
      id: this.notificationId++,
      status: notification.status || 'sent',
      metadata: notification.metadata || null,
      createdAt: new Date(),
    };
    this.notifications.set(newNotification.id, newNotification);
    return newNotification;
  }

  async getNotificationsBySession(sessionId: string): Promise<Notification[]> {
    return Array.from(this.notifications.values()).filter(notif => notif.sessionId === sessionId);
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const newMessage: ChatMessage = {
      ...message,
      id: this.chatMessageId++,
      createdAt: new Date(),
      messageAction: message.messageAction ?? null,
    };
    this.chatMessages.set(newMessage.id, newMessage);
    return newMessage;
  }

  async getChatMessagesBySession(sessionId: string): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values()).filter(msg => msg.sessionId === sessionId);
  }
}

export const storage = new MemStorage();
