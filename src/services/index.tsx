import { createContext, useContext, type ReactNode } from 'react';
import { servicesForPath, type Services } from './selectServices';

export type { Services };
export { servicesForPath };

/** Token links use the API. Every other path keeps the seeded demo. */
export const defaultServices: Services = servicesForPath(
  typeof window === 'undefined' ? '/' : window.location.pathname,
);

const ServicesContext = createContext<Services>(defaultServices);

export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  return useContext(ServicesContext);
}
