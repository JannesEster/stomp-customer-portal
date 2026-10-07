import { randomBytes } from 'node:crypto';

/** 32 bytes is 256 bits, above the 128 bit minimum. */
export const PORTAL_TOKEN_BYTES = 32;

/** Crypto-strong URL-safe token. base64url, no padding. */
export function generatePortalToken(): string {
  return randomBytes(PORTAL_TOKEN_BYTES).toString('base64url');
}
