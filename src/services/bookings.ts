import type { Booking, Customer } from '../types';
import bookings from '../mock/bookings.json';

/**
 * Where bookings come from. The portal only ever talks to this interface.
 * ApiBookingSource loads the one booking for a /p/<token> link.
 * MockBookingSource stays for local demos and tests.
 */
export interface BookingSource {
  getBookingsForCustomer(customer: Customer): Promise<Booking[]>;
}

/** Mock: reads seeded bookings from src/mock/bookings.json. */
export class MockBookingSource implements BookingSource {
  async getBookingsForCustomer(customer: Customer): Promise<Booking[]> {
    return (bookings as Booking[]).filter((b) => customer.bookingIds.includes(b.id));
  }
}
