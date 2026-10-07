/** Minimum accepted token length. 22 base64url characters is 128 bits. */
export const MIN_PORTAL_TOKEN_LENGTH = 22;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22,128}$/;

/** URL-safe token shape. Short, empty, and punctuation-bearing values are rejected. */
export function isValidPortalToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

/**
 * Escape a value for an Airtable single-quoted formula string.
 * Airtable uses backslash escapes. Callers still reject unsafe tokens before a request.
 */
export function escapeAirtableString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const FIELD_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 %./'()-]{0,80}$/;

export function isSafeAirtableFieldName(name: string): boolean {
  return FIELD_NAME_PATTERN.test(name) && !name.includes('{') && !name.includes('}');
}

/** `{Field name}` for filterByFormula. Throws if the name could break out of the braces. */
export function formulaField(name: string): string {
  if (!isSafeAirtableFieldName(name)) {
    throw new Error('Unsafe Airtable field name');
  }
  return `{${name}}`;
}

/** Equality filter for one portal token. The value is escaped even though tokens are also validated. */
export function portalTokenFormula(token: string, fieldName: string): string {
  return `${formulaField(fieldName)} = '${escapeAirtableString(token)}'`;
}

/** Bookings whose portal token field is empty. */
export function blankTokenFormula(fieldName: string): string {
  return `${formulaField(fieldName)} = BLANK()`;
}

/** Token from a `/p/<token>` path, including a GitHub Pages subfolder. Null when the path is not a portal link. */
export function readPortalToken(pathname: string): string | null {
  const match = pathname.match(/\/p\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Build `/p/<token>` from PUBLIC_BASE_URL.
 * Returns null when the base is missing or not a plain http(s) URL.
 */
export function buildPortalUrl(base: string | null | undefined, token: string): string | null {
  if (!base || !isValidPortalToken(token)) return null;
  const trimmed = base.trim().replace(/\/$/, '');
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?(?:\/[A-Za-z0-9._~/-]+)?$/i.test(trimmed)) {
    if (!/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(trimmed)) return null;
  }
  return `${trimmed}/p/${token}`;
}
