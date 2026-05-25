// Session lifecycle: create -> validate (many times) -> revoke. Sessions live
// in an InMemoryStore keyed by session id. `validateSession` is the hot path
// the app would call on every request, so it short-circuits on the cheap
// checks (existence, revocation) before the more expensive expiry compare.
//
// Only the happy path of createSession is tested. Validation + revocation
// branches are deliberate `tested diff` targets.

import { InMemoryStore } from '../db/inMemoryStore.js';
import { addDays, isExpired, now } from '../util/clock.js';
import { generateToken, verifyToken } from './tokens.js';

const DEFAULT_TTL_DAYS = 7;

export class SessionExpiredError extends Error {
  constructor(sessionId: string) {
    super(`session expired: ${sessionId}`);
    this.name = 'SessionExpiredError';
  }
}

export class SessionRevokedError extends Error {
  constructor(sessionId: string) {
    super(`session revoked: ${sessionId}`);
    this.name = 'SessionRevokedError';
  }
}

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`session not found: ${sessionId}`);
    this.name = 'SessionNotFoundError';
  }
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  revokedAt: number | null;
}

const sessions = new InMemoryStore<Session>();
let counter = 0;

function nextSessionId(): string {
  counter += 1;
  return `sess_${counter.toString(36)}_${now().toString(36)}`;
}

export function _resetSessions(): void {
  sessions.clear();
  counter = 0;
}

export interface CreateSessionInput {
  userId: string;
  ttlDays?: number;
}

export async function createSession(input: CreateSessionInput): Promise<Session> {
  const ttl = input.ttlDays ?? DEFAULT_TTL_DAYS;
  const createdAt = now();
  const id = nextSessionId();
  const token = generateToken({ sid: id, uid: input.userId, iat: createdAt });
  const session: Session = {
    id,
    userId: input.userId,
    token,
    createdAt,
    expiresAt: addDays(createdAt, ttl),
    revokedAt: null,
  };
  sessions.set(id, session);
  return session;
}

export async function validateSession(token: string): Promise<Session> {
  const payload = verifyToken<{ sid: string; uid: string; iat: number }>(token);
  const session = sessions.get(payload.sid);
  if (!session) {
    throw new SessionNotFoundError(payload.sid);
  }
  if (session.revokedAt !== null) {
    throw new SessionRevokedError(session.id);
  }
  if (isExpired(session.expiresAt)) {
    throw new SessionExpiredError(session.id);
  }
  return session;
}

export async function revokeSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new SessionNotFoundError(sessionId);
  }
  session.revokedAt = now();
}
