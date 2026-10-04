import { createContext, useContext, type ReactNode } from 'react';
import { MockAuthProvider, type AuthProvider } from './auth';
import { MockBookingSource, type BookingSource } from './bookings';
import { LocalStorageProvider, type StorageProvider } from './storage';

export interface Services {
  auth: AuthProvider;
  bookings: BookingSource;
  storage: StorageProvider;
}

/** Swap any of these for a real implementation once the open questions are decided. */
export const defaultServices: Services = {
  auth: new MockAuthProvider(),
  bookings: new MockBookingSource(),
  storage: new LocalStorageProvider(),
};

const ServicesContext = createContext<Services>(defaultServices);

export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  return useContext(ServicesContext);
}
