"use server";

/**
 * Login — §15.2 R11/R13.
 *
 * 1. Verify credentials (Argon2id against the stored hash).
 * 2. Sign RS256 access + refresh tokens. The refresh token goes in a HttpOnly cookie
 *    for automatic browser replay. The access token goes in the response body; the
 *    client puts it in Authorization on subsequent fetches.
 * 3. Store the hashed refresh token in sessions for revocation (R13).
 * 4. Redirect on success. No Next.js Router needed, just a plain redirect.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  type NeuroBookClaims,
} from "@neurobook/shared";
import { createDb } from "@/db/client.js";
import { ULID } from "@/db/ulid.js";
import { verifyToken } from "@neurobook/shared";

const REFRESH_COOKIE = "nb-refresh";

export async function loginAction(input: {
  email: string;
  password: string;
}): Promise<
  { ok: true; accessToken: string; tenantId: string; role: string }
  | { ok: false; error: string }
> {
  const db = createDb();

  const rows = await db.execute(sql`
    SELECT u.id, u.password_hash, ut.tenant_id, ut.role
      FROM users u
      JOIN user_tenants ut ON ut.user_id = u.id
     WHERE u.email = ${input.email}
       AND ut.is_default = true
     LIMIT 1
  `);
  const user = rows.rows[0] as {
    id: string;
    password_hash: string;
    tenant_id: string;
    role: string;
  } | undefined;

  if (!user || !(await verifyPassword(input.password, user.password_hash))) {
    return { ok: false, error: "Invalid email or password." };
  }

  const sessionId = ULID();

  const [accessToken, rawRefresh] = await Promise.all([
    signAccessToken({
      userId: user.id,
      tenantId: user.tenant_id,
      role: user.role,
      sessionId,
    }),
    signRefreshToken({
      userId: user.id,
      tenantId: user.tenant_id,
      role: user.role,
      sessionId,
    }),
  ]);

  // Store hashed refresh token for revocation (§15.2 R13).
  await db.execute(sql`
    INSERT INTO sessions (id, user_id, tenant_id, refresh_token_hash, expires_at)
    VALUES (
      ${sessionId},
      ${user.id},
      ${user.tenant_id},
      ${await hashToken(rawRefresh)},
      now() + interval '30 days'
    )
  `);

  // HttpOnly cookie: browser replays it automatically; server reads and verifies.
  const cs = await cookies();
  cs.set(REFRESH_COOKIE, rawRefresh, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60,
  });

  return { ok: true, accessToken, tenantId: user.tenant_id, role: user.role };
}

export async function logoutAction() {
  const raw = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (raw) {
    const claims = await verifyToken(raw, "refresh");
    if (claims && claims.sid) {
      createDb().execute(sql`DELETE FROM sessions WHERE id = ${claims.sid}`);
    }
  }
  (await cookies()).delete(REFRESH_COOKIE);
  redirect("/login");
}
