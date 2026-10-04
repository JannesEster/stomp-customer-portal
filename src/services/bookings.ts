import type { Booking, Customer } from '../types';
import bookings from '../mock/bookings.json';

/**
 * Where bookings come from. Whether this links to the Stomp Airtable base,
 * and which fields map to floor size, screens and extras, is an open question.
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
