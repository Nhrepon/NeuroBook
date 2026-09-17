/**
 * Revocable sessions — §15.2 R13.
 *
 * Refresh tokens are server-side rows, so logout, a credential change, or an
 * admin action can invalidate a session immediately. Access tokens stay
 * short-lived (15 min) because they cannot be revoked once issued.
 */
import { and, eq, isNull, lt } from "drizzle-orm";
import { hashToken } from "@neurobook/shared";
import { sessions } from "../schema/index.js";
import type { Database } from "../client.js";

export interface SessionRow {
  id: string;
  userId: string;
  tenantId: string | null;
  refreshTokenHash: string;
  expiresAt: Date;
}

/**
 * Persist a session. The refresh token is stored only as a hash.
 */
export async function createSession(
  db: Database,
  params: {
    id: string;
    userId: string;
    tenantId: string;
    refreshToken: string;
    expiresAt: Date;
    userAgent?: string;
    ip?: string;
  },
): Promise<void> {
  await db.insert(sessions).values({
    id: params.id,
    userId: params.userId,
    tenantId: params.tenantId,
    refreshTokenHash: await hashToken(params.refreshToken),
    userAgent: params.userAgent,
    ip: params.ip,
    expiresAt: params.expiresAt,
  });
}

/**
 * Look up a session by its raw refresh token.
 *
 * Returns null when the token is unknown, already revoked, or expired — all
 * three are "re-authenticate".
 */
export async function findSession(
  db: Database,
  refreshToken: string,
): Promise<SessionRow | null> {
  const rows = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.refreshTokenHash, await hashToken(refreshToken)),
        isNull(sessions.revokedAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt < new Date()) return null;
  return {
    id: row.id,
    userId: row.userId,
    tenantId: row.tenantId,
    refreshTokenHash: row.refreshTokenHash,
    expiresAt: row.expiresAt,
  };
}

/** Revoke one session (logout). */
export async function revokeSession(db: Database, sessionId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
}

/**
 * Revoke every session for a user — used on credential change (R13), so a
 * compromised password cannot keep an old session alive.
 */
export async function revokeAllSessions(db: Database, userId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

/** Garbage-collect expired sessions. */
export async function purgeExpiredSessions(db: Database): Promise<number> {
  const result = await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  return result.rowCount ?? 0;
}
