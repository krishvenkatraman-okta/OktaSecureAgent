# Okta AI Agent Zero Trust Demo

## Overview

This is a full-stack web application that demonstrates an AI agent implementing Zero Trust security principles using Okta's identity and access management platform. The application showcases a workflow where an AI agent must obtain elevated permissions through Privileged Access Management (PAM), Identity Governance and Administration (IGA), and Just-in-Time (JIT) access controls to access external resources on behalf of users.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Technology Stack
- **Frontend**: React 18 with TypeScript, Vite for build tooling
- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **UI Framework**: shadcn/ui with Radix UI components and Tailwind CSS
- **Authentication**: Okta OpenID Connect (OIDC) and OAuth 2.0
- **Real-time Communication**: WebSockets for live updates
- **State Management**: TanStack Query for API state management

### Application Structure
The application follows a monorepo structure with clear separation of concerns:
- `client/` - React frontend application
- `server/` - Express.js backend API
- `shared/` - Shared TypeScript schemas and types

## Key Components

### Frontend Architecture
- **React Router**: Using Wouter for lightweight routing
- **Component System**: Modern React with hooks and functional components
- **UI Components**: Comprehensive shadcn/ui component library
- **Styling**: Tailwind CSS with custom Okta brand colors
- **State Management**: TanStack Query for server state, React hooks for local state

### Backend Architecture
- **REST API**: Express.js with TypeScript
- **WebSocket Server**: Real-time updates for workflow progress
- **Service Layer**: Modular services for different integrations
- **Storage Layer**: Abstracted storage interface with in-memory implementation

### Database Schema
The application uses Drizzle ORM with PostgreSQL, featuring these main tables:
- `workflow_sessions` - Tracks user workflow sessions
- `access_requests` - Manages PAM/IGA access requests
- `token_store` - Stores OAuth tokens and delegation information
- `audit_logs` - Comprehensive audit trail
- `notifications` - System notifications and alerts

## Data Flow

### Workflow Process
1. **User Authentication**: OIDC flow with Okta for initial user authentication
2. **Profile Retrieval**: Client credentials flow to fetch user profile data
3. **Access Request**: AI agent requests elevated permissions through PAM/IGA
4. **Approval Process**: Simulated approval workflow with real-time updates
5. **Token Elevation**: Just-in-time access tokens with delegation claims
6. **Resource Access**: AI agent accesses external resources (mock CRM) on behalf of users

### Real-time Updates
- WebSocket connections provide live updates on workflow progress
- Notifications are pushed to the frontend as access requests are processed
- Audit logs are created for all security-relevant events

## External Dependencies

### Okta Integration
- **OpenID Connect**: User authentication with SPA client
- **Client Credentials**: Service-to-service authentication
- **Privileged Access Management**: Secret vault for sensitive credentials
- **Identity Governance**: Access request and approval workflows

### Third-party Services
- **Mock CRM API**: Simulated Salesforce integration for demonstration
- **WebSocket Support**: Real-time communication between client and server
- **Neon Database**: PostgreSQL hosting (configured but not required for demo)

### Development Tools
- **Vite**: Fast development server and build tool
- **TypeScript**: Type safety across the entire application
- **ESLint/Prettier**: Code quality and formatting
- **Drizzle Kit**: Database migrations and schema management

## Deployment Strategy

### Environment Configuration
The application supports multiple deployment environments:
- **Development**: Local development with hot reload
- **Production**: Optimized build with static asset serving

### Build Process
- Frontend builds to `dist/public` for static serving
- Backend builds to `dist/` with ESM modules
- Database migrations handled through Drizzle Kit

### Security Considerations
- All sensitive configuration through environment variables
- Token validation and secure storage
- Audit logging for all security events
- CORS and security headers configured

### Scalability Features
- Modular service architecture allows for easy scaling
- Database abstraction supports different storage backends
- WebSocket connections can be scaled horizontally
- Stateless API design supports load balancing

The application demonstrates enterprise-grade security patterns while maintaining a clean, maintainable codebase suitable for educational and demonstration purposes.