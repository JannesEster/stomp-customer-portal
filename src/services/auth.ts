import type { Customer } from '../types';
import customers from '../mock/customers.json';

/**
 * Who is signed in. The portal only ever talks to this interface.
 * TokenAuthProvider treats the /p/<token> link as the login for now.
 * A fuller account login can replace it later. MockAuthProvider stays for local demos.
 */
export interface AuthProvider {
  getCurrentCustomer(): Promise<Customer | null>;
  signOut(): Promise<void>;
}

/**
 * Mock: always signs in a seeded customer. For demos, `?customer=<id>` in the
 * URL picks a different seeded customer from src/mock/customers.json.
 */
export class MockAuthProvider implements AuthProvider {
  private readonly customers = customers as Customer[];

  async getCurrentCustomer(): Promise<Customer | null> {
    const requested = new URLSearchParams(window.location.search).get('customer');
    return this.customers.find((c) => c.id === requested) ?? this.customers[0] ?? null;
  }

  async signOut(): Promise<void> {}

  listDemoCustomers(): Customer[] {
    return this.customers;
  }
}
