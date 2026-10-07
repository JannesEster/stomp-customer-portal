import { describe, expect, it } from 'vitest';
import { portalTokenWriteKey, PortalConfigError, readPortalConfig } from './portalConfig';

describe('portal config', () => {
  it('uses the Stomp defaults when env is empty', () => {
    const config = readPortalConfig({});
    expect(config.airtableToken).toBeNull();
    expect(config.baseId).toBe('appwMfJFb7rLDqJ30');
    expect(config.bookingsTable).toBe('Bookings');
    expect(config.leadsTable).toBe('Leads');
    expect(config.venuesTable).toBe('Venues');
    expect(config.tokenFieldName).toBe('Portal token');
    expect(config.tokenFieldId).toBeNull();
    expect(config.fields.floorSqm).toBe('Floor sqm');
    expect(config.fields.leadAddOns).toBe('Add-ons');
    expect(config.port).toBe(3000);
  });

  it('accepts a field id for writes and keeps the name for formulas', () => {
    const config = readPortalConfig({ PORTAL_TOKEN_FIELD_ID: 'fldBr9O48s8nRuxrm' });
    expect(config.tokenFieldName).toBe('Portal token');
    expect(portalTokenWriteKey(config)).toBe('fldBr9O48s8nRuxrm');
  });

  it('rejects an unsafe field name', () => {
    expect(() => readPortalConfig({ PORTAL_TOKEN_FIELD: 'Portal} token' })).toThrow(PortalConfigError);
    expect(() => readPortalConfig({ PUBLIC_BASE_URL: 'javascript:alert(1)' })).toThrow(PortalConfigError);
  });
});
