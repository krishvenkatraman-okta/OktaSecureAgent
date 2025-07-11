import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const workflowSessions = pgTable("workflow_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  userId: text("user_id").notNull(),
  currentStep: integer("current_step").notNull().default(1),
  status: text("status").notNull().default("active"), // active, completed, failed
  metadata: json("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const accessRequests = pgTable("access_requests", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  requestType: text("request_type").notNull(), // pam, iga, consent
  targetUser: text("target_user"), // e.g., brandon.stark@acme.com
  requestedScope: text("requested_scope"), // e.g., crm.read, crm.write
  status: text("status").notNull().default("pending"), // pending, approved, denied
  approverId: text("approver_id"),
  approverName: text("approver_name"),
  justification: text("justification"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tokenStore = pgTable("token_store", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  tokenType: text("token_type").notNull(), // id_token, access_token, elevated_token
  tokenValue: text("token_value").notNull(),
  scopes: text("scopes"),
  actAs: text("act_as"), // delegation user
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  eventType: text("event_type").notNull(), // auth, request, approval, access
  eventData: json("event_data").$type<Record<string, any>>().default({}),
  userId: text("user_id"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  type: text("type").notNull(), // push, email, webhook
  recipient: text("recipient").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("sent"), // sent, delivered, failed
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertWorkflowSessionSchema = createInsertSchema(workflowSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAccessRequestSchema = createInsertSchema(accessRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTokenSchema = createInsertSchema(tokenStore).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

// Types
export type WorkflowSession = typeof workflowSessions.$inferSelect;
export type InsertWorkflowSession = z.infer<typeof insertWorkflowSessionSchema>;

export type AccessRequest = typeof accessRequests.$inferSelect;
export type InsertAccessRequest = z.infer<typeof insertAccessRequestSchema>;

export type TokenStore = typeof tokenStore.$inferSelect;
export type InsertToken = z.infer<typeof insertTokenSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
