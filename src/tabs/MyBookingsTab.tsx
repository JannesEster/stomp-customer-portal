import { extrasConfig } from '../config';
import { floorPixels, screenCount } from '../lib/dimensions';
import { formatEventDate, formatMetres } from '../lib/format';
import { Accent } from '../design/common';
import type { Booking } from '../types';

export function MyBookingsTab({ booking }: { booking: Booking }) {
  const px = floorPixels(booking.floor.widthM, booking.floor.lengthM);
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
        <dd>{formatEventDate(booking.eventDate)}</dd>
        <dt>Venue</dt>
        <dd>{booking.venue}</dd>
        <dt>Dance floor</dt>
        <dd>
          {formatMetres(booking.floor.widthM)} x {formatMetres(booking.floor.lengthM)} ({px.tilesX} x {px.tilesY}{' '}
          tiles)
        </dd>
        <dt>Portrait screens</dt>
        <dd>{screens === 0 ? 'None' : screens}</dd>
        <dt>Extras</dt>
        <dd>{extras.length ? extras.join(', ') : 'None'}</dd>
      </dl>
      <p className="muted small">
        Need to change your floor size or screens? Get in touch with Stomp and we'll update your booking.
      </p>
    </section>
  );
}
