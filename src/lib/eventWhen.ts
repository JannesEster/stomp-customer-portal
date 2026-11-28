/** Days from today in Perth until the event date. Negative when the date has passed. */
export function daysUntilEvent(isoDate: string, now = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Perth',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const event = Date.parse(`${isoDate}T00:00:00Z`);
  const start = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(event) || Number.isNaN(start)) return null;
  return Math.round((event - start) / 86_400_000);
}

export function countdownLabel(isoDate: string, now = new Date()): string | null {
  const days = daysUntilEvent(isoDate, now);
  if (days == null) return null;
  if (days < 0) return 'This event date has passed';
  if (days === 1) return '1 day to go';
  return `${days} days to go`;
}

/** All day calendar file for the booking. Null when the date is missing. */
export function eventCalendar(booking: {
  id: string;
  coupleNames: string;
  eventDate: string;
  venue: string;
  address?: string | null;
}): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.eventDate)) return null;
  const stamp = booking.eventDate.replace(/-/g, '');
  const end = nextDate(booking.eventDate);
  const where = [booking.venue, booking.address].filter(Boolean).join(', ');
  const summary = booking.coupleNames
    ? `Stomp Sphere, ${booking.coupleNames}`
    : 'Stomp Sphere event';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Stomp Sphere//Event portal//EN',
    'BEGIN:VEVENT',
    `UID:${booking.id}@stompsphere.com.au`,
    `DTSTAMP:${stamp}T000000Z`,
    `DTSTART;VALUE=DATE:${stamp}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escapeIcs(summary)}`,
    where ? `LOCATION:${escapeIcs(where)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

function nextDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function escapeIcs(value: string): string {
  return value.replace(/[\\;,]/g, (char) => `\\${char}`).replace(/\r?\n/g, ' ');
}
