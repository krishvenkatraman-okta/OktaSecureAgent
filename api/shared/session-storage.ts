// Global session storage for Vercel serverless functions
// In production, this should be replaced with Redis or a database

class SessionStorage {
  private static instance: SessionStorage;
  private sessions: Map<string, any> = new Map();

  static getInstance(): SessionStorage {
    if (!SessionStorage.instance) {
      SessionStorage.instance = new SessionStorage();
    }
    return SessionStorage.instance;
  }

  set(sessionId: string, session: any): void {
    this.sessions.set(sessionId, session);
  }

  get(sessionId: string): any {
    return this.sessions.get(sessionId);
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  clear(): void {
    this.sessions.clear();
  }

  size(): number {
    return this.sessions.size;
  }
}

export const sessionStorage = SessionStorage.getInstance();