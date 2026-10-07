import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { generatePortalToken, PORTAL_TOKEN_BYTES } from './portalTokenGenerate';
import {
  blankTokenFormula,
  buildPortalUrl,
  escapeAirtableString,
  isValidPortalToken,
  portalTokenFormula,
  readPortalToken,
} from './portalToken';

const TOKEN = 'A'.repeat(43);

describe('portal tokens', () => {
  it('accepts a long URL-safe token and rejects short or hostile ones', () => {
    expect(isValidPortalToken(TOKEN)).toBe(true);
    expect(isValidPortalToken('a'.repeat(22))).toBe(true);
    expect(isValidPortalToken('a'.repeat(21))).toBe(false);
    expect(isValidPortalToken('')).toBe(false);
    expect(isValidPortalToken("aaaaaaaaaaaaaaaaaaaaaa' OR TRUE()")).toBe(false);
    expect(isValidPortalToken('bad token with spaces!!!!!!')).toBe(false);
    expect(isValidPortalToken(`${'a'.repeat(130)}`)).toBe(false);
  });

  it('escapes quotes and backslashes inside an Airtable formula string', () => {
    expect(escapeAirtableString("a'b\\c")).toBe("a\\'b\\\\c");
    expect(portalTokenFormula("x' OR TRUE()", 'Portal token')).toBe("{Portal token} = 'x\\' OR TRUE()'");
    expect(portalTokenFormula(TOKEN, 'Portal token')).toBe(`{Portal token} = '${TOKEN}'`);
  });

  it('refuses a field name that could break out of the formula', () => {
    expect(() => portalTokenFormula(TOKEN, 'Portal} token')).toThrow(/unsafe/i);
    expect(() => blankTokenFormula('Name} = BLANK() OR {Portal token')).toThrow(/unsafe/i);
  });

  it('builds a blank check and a public portal URL', () => {
    expect(blankTokenFormula('Portal token')).toBe('{Portal token} = BLANK()');
    expect(buildPortalUrl('https://stomp-customer-portal.onrender.com/', TOKEN)).toBe(
      `https://stomp-customer-portal.onrender.com/p/${TOKEN}`,
    );
    expect(buildPortalUrl('http://localhost:3000', TOKEN)).toBe(`http://localhost:3000/p/${TOKEN}`);
    expect(buildPortalUrl(null, TOKEN)).toBeNull();
    expect(buildPortalUrl('javascript:alert(1)', TOKEN)).toBeNull();
  });

  it('reads the token from a portal path and ignores ordinary paths', () => {
    expect(readPortalToken('/')).toBeNull();
    expect(readPortalToken('/p/abc')).toBe('abc');
    expect(readPortalToken('/stomp-customer-portal/p/abc/')).toBe('abc');
    expect(readPortalToken('/p/abc/extra')).toBeNull();
  });

  it('generates 256 bit URL-safe tokens', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 50; i += 1) tokens.add(generatePortalToken());
    expect(tokens.size).toBe(50);
    for (const token of tokens) {
      expect(isValidPortalToken(token)).toBe(true);
      expect(Buffer.from(token, 'base64url')).toHaveLength(PORTAL_TOKEN_BYTES);
    }
  });
});
