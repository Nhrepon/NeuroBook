/**
 * TOTP two-factor auth — §15.2 R12.
 *
 * Optional per user, but required for ADMIN and SUPER_ADMIN: those roles can
 * post and reverse vouchers and close periods, so a leaked password on an
 * admin account is a books-integrity incident, not just a privacy one.
 */
import { authenticator, totp } from "@otplib/preset-default";

/** A base32 secret for enrollment, shown to the user as a QR code. */
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/**
 * A provisioning URI for the authenticator app (RFC 6238 otpauth format).
 */
export function provisioningUri(secret: string, email: string, issuer = "NeuroBook"): string {
  return authenticator.keyuri(email, issuer, secret);
}

/** Verify a 6-digit code against the secret. Allows the standard ±1 step skew. */
export function verifyTotp(secret: string, token: string): boolean {
  // totp.generate/verify carry the configured window; a small skew covers
  // clock drift between a phone and the server.
  return totp.verify({ secret, token });
}

/** Generate the current code (used only by tests). */
export function generateTotpToken(secret: string): string {
  return totp.generate(secret);
}
