import { describe, expect, it } from 'vitest';
import { bookingsMissingTokens, runPortalTokens } from './tokenBatch';
import { isValidPortalToken } from './portalToken';

const EXISTING = 'C'.repeat(43);
const GENERATED = 'D'.repeat(43);

describe('portal token generator', () => {
  it('skips bookings that already have a token', () => {
    const missing = bookingsMissingTokens(
      [
        { id: 'recFAKEBOOK000001', fields: {} },
        { id: 'recFAKELEAD000001', fields: { 'Portal token': EXISTING } },
        { id: 'recFAKEVENUE00001', fields: { 'Portal token': '   ' } },
        { id: 'recFAKEBOOK000002' },
      ],
      'Portal token',
    );
    expect(missing.map((row) => row.id)).toEqual(['recFAKEBOOK000001', 'recFAKEVENUE00001', 'recFAKEBOOK000002']);
  });

  it('dry run lists ids and does not write', async () => {
    const lines: string[] = [];
    const result = await runPortalTokens({
      write: false,
      records: [{ id: 'recFAKEBOOK000001', fields: { 'Portal link': 'https://evil.example/p/nope' } }],
      fieldName: 'Portal token',
      fieldKey: 'Portal token',
      log: (line) => lines.push(line),
      writeTokens: async () => {
        throw new Error('dry run must not write');
      },
    });
    expect(result.written).toBe(0);
    expect(lines.join('\n')).toContain('recFAKEBOOK000001');
    expect(lines.join('\n')).toContain('No records were changed');
    expect(lines.join('\n')).not.toContain('evil.example');
  });

  it('writes only the portal token field', async () => {
    const patches: { id: string; fields: Record<string, string> }[] = [];
    const result = await runPortalTokens({
      write: true,
      records: [
        { id: 'recFAKEBOOK000001', fields: { 'Portal token': '   ', 'Portal link': 'https://evil.example/p/nope' } },
        { id: 'recFAKELEAD000001', fields: { 'Portal token': EXISTING, 'Important notes': 'keep' } },
      ],
      fieldName: 'Portal token',
      fieldKey: 'fldBr9O48s8nRuxrm',
      generateToken: () => GENERATED,
      log: () => {},
      writeTokens: async (next) => {
        patches.push(...next);
      },
    });
    expect(result.written).toBe(1);
    expect(patches).toEqual([{ id: 'recFAKEBOOK000001', fields: { fldBr9O48s8nRuxrm: GENERATED } }]);
    expect(isValidPortalToken(GENERATED)).toBe(true);
    const json = JSON.stringify(patches);
    expect(json).not.toContain('Portal link');
    expect(json).not.toContain('Important notes');
    expect(json).not.toContain('evil.example');
  });
});
