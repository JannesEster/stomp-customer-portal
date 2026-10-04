import { findEffect, findStyle, timingLabel, portalConfig } from '../config';
import { floorPixels, screenCount } from '../lib/dimensions';
import { formatAud, formatDateTime, formatEventDate } from '../lib/format';
import { liveContentView } from '../lib/liveContent';
import { formatStyleDate } from '../lib/liveText';
import { INVITE_STYLE_ID, LAYOUT_LABELS, TYPOGRAPHY_LABELS } from '../lib/inviteStyle';
import type { Booking, DesignState, GeneratedStyle, HoldingDesign } from '../types';
import { Accent } from './common';

export function SummaryDialog({
  booking,
  design,
  onClose,
}: {
  booking: Booking;
  design: DesignState;
  onClose: () => void;
}) {
  const px = floorPixels(booking.floor.widthM, booking.floor.lengthM);
  const screens = screenCount(booking.screensBooked);
  const live = liveContentView(booking, design.liveContentRequested);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="summary-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="summary-title">
          Your design <Accent>summary</Accent>
        </h2>
        {design.status === 'submitted' && design.submittedAt ? (
          <p className="note">Submitted to Stomp on {formatDateTime(design.submittedAt)}.</p>
        ) : (
          <p className="note">This is still a draft. Stomp hasn't received it yet.</p>
        )}

        <h3>Booking</h3>
        <ul>
          <li>{booking.coupleNames}</li>
          <li>{formatEventDate(booking.eventDate)}, {booking.venue}</li>
          <li>
            Floor {booking.floor.widthM}m x {booking.floor.lengthM}m ({px.width} x {px.height} px)
          </li>
          <li>{screens === 0 ? 'No portrait screens' : `${screens} portrait screen${screens > 1 ? 's' : ''}`}</li>
        </ul>

        <h3>Holding screen</h3>
        <HoldingSummary h={design.designs.holding} eventDate={booking.eventDate} inviteStyle={design.inviteStyle} />
        <ul>
          <li>
            Floor reactions:{' '}
            {design.reactions.length
              ? design.reactions.map((id) => findEffect(id)?.name ?? id).join(', ')
              : 'None'}
          </li>
        </ul>

        <h3>After the bridal entrance</h3>
        {design.afterMode === 'same' ? (
          <p>The holding screen stays on until dancing time.</p>
        ) : (
          <HoldingSummary h={design.designs.after} eventDate={booking.eventDate} inviteStyle={design.inviteStyle} />
        )}

        <h3>Dancing time</h3>
        {design.dancingMode === 'blank' ? (
          <p>Blank floor with assorted reactions.</p>
        ) : design.dancingMode === 'videos' ? (
          <p>Colourful videos.</p>
        ) : (
          <HoldingSummary h={design.designs.dancing} eventDate={booking.eventDate} inviteStyle={design.inviteStyle} />
        )}

        <h3>Invite and styling</h3>
        <ul>
          <li>{design.invite ? `Uploaded: ${design.invite.name}` : 'No invite or styling file'}</li>
          {design.inviteNamesColour && (
            <li>
              Names colour from the invite:{' '}
              <span className="swatch small" style={{ background: design.inviteNamesColour }} title={design.inviteNamesColour}>
                <span className="sr-only">{design.inviteNamesColour}</span>
              </span>
            </li>
          )}
          {design.invitePalette.length > 0 && (
            <li>
              Invite colours:{' '}
              {design.invitePalette.map((c) => (
                <span key={c} className="swatch small" style={{ background: c }} title={c}>
                  <span className="sr-only">{c}</span>
                </span>
              ))}
            </li>
          )}
          <li>{design.stylingNote.trim() ? `Note: ${design.stylingNote.trim()}` : 'No styling note'}</li>
        </ul>

        {screens > 0 && (
          <>
            <h3>Photos and videos</h3>
            <ul>
              {portalConfig.timings.map((t) => {
                const group = design.media.filter((m) => m.timing === t.id);
                return (
                  <li key={t.id}>
                    {timingLabel(t.id)}: {group.length ? group.map((m) => m.file.name).join(', ') : 'None'}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <h3>Live content</h3>
        <p>
          {live.included
            ? 'Live event streaming is included in your booking.'
            : live.checked
              ? `You've asked to add live event streaming (${formatAud(live.priceAud)} extra). Stomp will confirm with you.`
              : 'Not added.'}
        </p>

        <div className="row end">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function HoldingSummary({
  h,
  eventDate,
  inviteStyle,
}: {
  h: HoldingDesign;
  eventDate: string;
  inviteStyle: GeneratedStyle | null;
}) {
  const style = findStyle(h.styleId);
  const generated = h.styleId === INVITE_STYLE_ID ? inviteStyle : null;
  const styleName = generated
    ? `From your invite (${TYPOGRAPHY_LABELS[generated.typography]}, ${LAYOUT_LABELS[generated.layout]})`
    : (style?.name ?? 'Not chosen yet');
  return (
    <ul>
      <li>Style: {styleName}</li>
      {generated && (
        <li>
          Generated colours:{' '}
          {[generated.background, generated.text, generated.accent].map((c, i) => (
            <span key={i} className="swatch small" style={{ background: c }} title={c}>
              <span className="sr-only">{c}</span>
            </span>
          ))}
        </li>
      )}
      <li>Names: {h.names || 'None'}</li>
      {(style?.live.date || generated) && (
        <li>
          Date, from your booking:{' '}
          {style?.live.date ? formatStyleDate(eventDate, style.live.date.format) : formatEventDate(eventDate)}
        </li>
      )}
      <li>Photo or video: {h.media ? h.media.name : 'None'}</li>
    </ul>
  );
}
