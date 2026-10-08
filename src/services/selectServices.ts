import { readPortalToken } from '../lib/portalToken';
import { MockAuthProvider, type AuthProvider } from './auth';
import { MockBookingSource, type BookingSource } from './bookings';
import { ApiBookingSource, PortalSession, TokenAuthProvider } from './portalSession';
import { LocalStorageProvider, type StorageProvider } from './storage';

export interface Services {
  auth: AuthProvider;
  bookings: BookingSource;
  storage: StorageProvider;
  /** Set on a /p/<token> link. Null for the seeded demo. */
  portal: PortalSession | null;
}

/**
 * `/p/<token>` loads that booking from the API.
 * Any other path keeps the seeded demo, including when AIRTABLE_TOKEN is unset and `npm run dev` is used.
 */
export function servicesForPath(pathname: string): Services {
  const storage = new LocalStorageProvider();
  const token = readPortalToken(pathname);
  if (token === null) {
    return { auth: new MockAuthProvider(), bookings: new MockBookingSource(), storage, portal: null };
  }
  const session = new PortalSession(token);
  return {
    auth: new TokenAuthProvider(session),
    bookings: new ApiBookingSource(session),
    storage,
    portal: session,
  };
}
