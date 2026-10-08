import { extrasConfig } from '../config';
import { SupplierFields } from '../design/SupplierFields';
import { Accent } from '../design/common';
import { useDesignState } from '../hooks/useDesignState';
import { floorPixels, screenCount } from '../lib/dimensions';
import { formatEventDate, formatMetres } from '../lib/format';
import type { Booking } from '../types';

export function MyBookingsTab({ booking }: { booking: Booking }) {
  const { design, update } = useDesignState(booking);
  const px = booking.floor ? floorPixels(booking.floor.widthM, booking.floor.lengthM) : null;
  const screens = screenCount(booking.screensBooked);
  const extras = booking.extras.map((id) => extrasConfig.extras.find((e) => e.id === id)?.name ?? id);

  return (
    <section className="card">
      <h2>
        Your <Accent>booking</Accent>
      </h2>
      <dl className="details">
        <dt>Couple</dt>
        <dd>{booking.coupleNames}</dd>
        <dt>Event date</dt>
        <dd>{formatEventDate(booking.eventDate) || 'Not listed yet'}</dd>
        <dt>Venue</dt>
        <dd>{booking.venue || 'Not listed yet'}</dd>
        {booking.address ? (
          <>
            <dt>Address</dt>
            <dd>{booking.address}</dd>
          </>
        ) : null}
        {booking.packageName ? (
          <>
            <dt>Package</dt>
            <dd>{booking.packageName}</dd>
          </>
        ) : null}
        <dt>Dance floor</dt>
        <dd>
          {booking.floor && px ? (
            <>
              {formatMetres(booking.floor.widthM)} x {formatMetres(booking.floor.lengthM)} ({px.tilesX} x {px.tilesY}{' '}
              tiles)
            </>
          ) : booking.floorSqm != null ? (
            <>{booking.floorSqm} sqm. Width and length are not listed yet.</>
          ) : (
            <>Not listed yet.</>
          )}
        </dd>
        <dt>Portrait screens</dt>
        <dd>{booking.screensBooked == null ? 'Not listed yet' : screens === 0 ? 'None' : screens}</dd>
        <dt>Extras</dt>
        <dd>{extras.length ? extras.join(', ') : 'None'}</dd>
      </dl>
      <p className="muted small">
        Need to change your floor size or screens? Get in touch with Stomp and we'll update your booking.
      </p>
      {design ? <SupplierFields design={design} update={update} /> : <p className="muted small">Loading the people on the day…</p>}
    </section>
  );
}
