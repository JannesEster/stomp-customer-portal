import { DESIGN_VERSION } from '../lib/design';
import { isValidPortalToken } from '../lib/portalToken';
import type { Booking, Customer, DesignState } from '../types';
import type { AuthProvider } from './auth';
import type { BookingSource } from './bookings';

export interface PortalPayload {
  customer: Customer;
  booking: Booking;
  savedAnswers: DesignState | null;
  lastSavedAt: string | null;
}

/**
 * One fetch for a /p/<token> link, shared by auth and bookings.
 * The token in the URL is the login until a real account system exists.
 */
export class PortalSession {
  problem: 'invalid' | 'missing' | 'unavailable' | 'failed' | null = null;
  private pending: Promise<PortalPayload | null> | null = null;

  constructor(readonly token: string) {}

  load(): Promise<PortalPayload | null> {
    if (!this.pending) this.pending = this.fetchOnce();
    return this.pending;
  }

  private async fetchOnce(): Promise<PortalPayload | null> {
    if (!isValidPortalToken(this.token)) {
      this.problem = 'invalid';
      return null;
    }
    let response: Response;
    try {
      response = await fetch(`/api/portal/${encodeURIComponent(this.token)}`, {
        headers: { Accept: 'application/json' },
      });
    } catch {
      this.problem = 'failed';
      return null;
    }
    if (response.status === 400 || response.status === 404) {
      this.problem = 'missing';
      return null;
    }
    if (response.status === 503) {
      this.problem = 'unavailable';
      return null;
    }
    if (!response.ok) {
      this.problem = 'failed';
      return null;
    }
    const body = (await response.json()) as Partial<PortalPayload> & { savedAnswers?: unknown; lastSavedAt?: unknown };
    if (!isPayload(body)) {
      this.problem = 'failed';
      return null;
    }
    return {
      customer: body.customer,
      booking: body.booking,
      savedAnswers: readSavedDesign(body.savedAnswers),
      lastSavedAt: typeof body.lastSavedAt === 'string' ? body.lastSavedAt : null,
    };
  }
}

export class TokenAuthProvider implements AuthProvider {
  constructor(private session: PortalSession) {}

  async getCurrentCustomer(): Promise<Customer | null> {
    const data = await this.session.load();
    return data?.customer ?? null;
  }

  async signOut(): Promise<void> {
    window.location.assign('/');
  }

  problemMessage(): string | null {
    switch (this.session.problem) {
      case 'invalid':
      case 'missing':
        return "This link doesn't match a booking. Check the link Stomp sent you, or get in touch.";
      case 'unavailable':
      case 'failed':
        return "We couldn't load your booking just now. Please try again in a moment.";
      default:
        return null;
    }
  }
}

export class ApiBookingSource implements BookingSource {
  constructor(private session: PortalSession) {}

  async getBookingsForCustomer(customer: Customer): Promise<Booking[]> {
    const data = await this.session.load();
    if (!data) return [];
    if (customer.bookingIds.length && !customer.bookingIds.includes(data.booking.id)) return [];
    return [data.booking];
  }
}

function isPayload(
  value: Partial<PortalPayload>,
): value is PortalPayload & { savedAnswers?: unknown; lastSavedAt?: unknown } {
  const booking = value.booking;
  const customer = value.customer;
  return !!booking && !!customer && typeof booking.id === 'string' && typeof customer.name === 'string' && Array.isArray(booking.extras);
}

function readSavedDesign(value: unknown): DesignState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if ((value as DesignState).version !== DESIGN_VERSION) return null;
  return value as DesignState;
}
