import crypto from 'node:crypto';

export interface SessionData {
  sub: string;
  email?: string;
  name?: string;
  expiresAt: number;
  idToken: string;
  accessToken: string;
}

export class InMemorySessionStore {
  private readonly sessions = new Map<string, SessionData>();

  constructor(private readonly ttlMs: number) {}

  createSession(data: Omit<SessionData, 'expiresAt'>): string {
    const sessionId = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + this.ttlMs;
    this.sessions.set(sessionId, { ...data, expiresAt });
    return sessionId;
  }

  getSession(sessionId: string | undefined): SessionData | undefined {
    if (!sessionId) {
      return undefined;
    }
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }
    if (session.expiresAt < Date.now()) {
      this.sessions.delete(sessionId);
      return undefined;
    }
    return session;
  }

  destroySession(sessionId: string | undefined) {
    if (sessionId) {
      this.sessions.delete(sessionId);
    }
  }
}

