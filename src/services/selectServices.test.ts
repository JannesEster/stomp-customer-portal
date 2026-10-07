import { describe, expect, it } from 'vitest';
import { MockAuthProvider } from './auth';
import { MockBookingSource } from './bookings';
import { TokenAuthProvider } from './portalSession';
import { servicesForPath } from './selectServices';

describe('servicesForPath', () => {
  it('keeps the mock portal off the token path', () => {
    const demo = servicesForPath('/');
    expect(demo.auth).toBeInstanceOf(MockAuthProvider);
    expect(demo.bookings).toBeInstanceOf(MockBookingSource);

    const portal = servicesForPath('/p/not-a-real-token');
    expect(portal.auth).toBeInstanceOf(TokenAuthProvider);
    expect(portal.auth).not.toBeInstanceOf(MockAuthProvider);
    expect(portal.bookings).not.toBeInstanceOf(MockBookingSource);
  });
});
