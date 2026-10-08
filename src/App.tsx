import { useEffect, useState } from 'react';
import { useServices } from './services';
import { MockAuthProvider } from './services/auth';
import { TokenAuthProvider } from './services/portalSession';
import { MyBookingsTab } from './tabs/MyBookingsTab';
import { NotesTab } from './tabs/NotesTab';
import { DesignTab } from './tabs/DesignTab';
import { Accent } from './design/common';
import { fromRoot } from './config';
import { formatEventDate } from './lib/format';
import type { Booking, Customer } from './types';

const TABS = [
  { id: 'bookings', label: 'My Bookings' },
  { id: 'notes', label: 'Notes/Details' },
  { id: 'design', label: 'Design' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function tabFromHash(): TabId {
  const h = window.location.hash.slice(1);
  return TABS.some((t) => t.id === h) ? (h as TabId) : 'design';
}

export function App() {
  const { auth, bookings } = useServices();
  const [tab, setTab] = useState<TabId>(tabFromHash);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    (async () => {
      const c = await auth.getCurrentCustomer();
      setCustomer(c);
      if (c) setBooking((await bookings.getBookingsForCustomer(c))[0] ?? null);
      setLoading(false);
    })();
  }, [auth, bookings]);

  const selectTab = (id: TabId) => {
    window.location.hash = id;
    setTab(id);
  };

  return (
    <div className="app">
      <header className="app-header">
        <span className="header-label">Customer portal</span>
        <img
          className="logo"
          src={fromRoot('/brand/stomp-sphere-logo-white.svg')}
          alt="Stomp Sphere"
          width={200}
          height={38}
        />
        <span className="signed-in">{customer ? `Hi ${customer.name}` : ''}</span>
      </header>

      {booking && (
        <section className="hero">
          <h1>
            {booking.coupleNames ? (
              <>
                Plan your night,
                <br />
                <Accent>{booking.coupleNames}!</Accent>
              </>
            ) : (
              'Plan your night'
            )}
          </h1>
          <p>
            {formatEventDate(booking.eventDate) || 'Date not listed yet'}
            {booking.venue ? ` at ${booking.venue}` : ''}
          </p>
        </section>
      )}

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'tab active' : 'tab'}
            onClick={() => selectTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {loading ? (
          <p className="muted">Loading your booking…</p>
        ) : !booking ? (
          <p className="muted">
            {auth instanceof TokenAuthProvider
              ? (auth.problemMessage() ?? "We couldn't find a booking for your account. Please get in touch with Stomp.")
              : "We couldn't find a booking for your account. Please get in touch with Stomp."}
          </p>
        ) : tab === 'bookings' ? (
          <MyBookingsTab booking={booking} />
        ) : tab === 'notes' ? (
          <NotesTab booking={booking} />
        ) : (
          <DesignTab booking={booking} />
        )}
      </main>

      <p className="muted small portal-pending">
        {auth instanceof TokenAuthProvider
          ? 'Your design choices are saved for Stomp. Photos and videos stay in this browser.'
          : 'Designs and files are saved in this browser only. Where they are stored is pending Jannes\'s decision.'}
      </p>
      {auth instanceof MockAuthProvider && <DemoSwitcher auth={auth} current={customer} />}
    </div>
  );
}

function DemoSwitcher({ auth, current }: { auth: MockAuthProvider; current: Customer | null }) {
  const choose = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('customer', id);
    window.location.href = url.toString();
  };
  return (
    <footer className="demo-switcher">
      <label>
        Demo booking{' '}
        <select value={current?.id ?? ''} onChange={(e) => choose(e.target.value)}>
          {auth.listDemoCustomers().map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <span className="muted">Seed data only. Nothing leaves this browser.</span>
    </footer>
  );
}
