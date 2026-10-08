import { findEffect, findScreenStyle, findStyle, timingLabel } from '../config';
import { floorPixels, screenCount } from '../lib/dimensions';
import { mediaFor, timingFor } from '../lib/design';
import { formatAud, formatDateTime, formatEventDate, formatTime } from '../lib/format';
import { liveContentView } from '../lib/liveContent';
import { formatStyleDate } from '../lib/liveText';
import { generatedFor, LAYOUT_LABELS, TYPOGRAPHY_LABELS } from '../lib/inviteStyle';
import type { Booking, DesignState, HoldingDesign } from '../types';
import { Accent, PHASES } from './common';
import { SCREEN_KIND_LABELS } from './ScreenSteps';

export function SummaryDialog({
  booking,
  design,
  onClose,
}: {
  booking: Booking;
  design: DesignState;
  onClose: () => void;
}) {
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
          <p className="note">
            Submitted to Stomp on {formatDateTime(design.submittedAt)}.
            {design.submittedWithoutTimes && <span className="time-tag">Times not included</span>}
          </p>
        ) : (
          <p className="note">This is still a draft. Stomp hasn't received it yet.</p>
        )}

        <DesignSummary booking={booking} design={design} />

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

/** Everything but live content, which the review step shows with its checkbox instead. */
export function DesignSummary({ booking, design }: { booking: Booking; design: DesignState }) {
  const px = booking.floor ? floorPixels(booking.floor.widthM, booking.floor.lengthM) : null;
  const screens = screenCount(booking.screensBooked);
  const screenStyle = findScreenStyle(design.screens.styleId);

  return (
    <div className="summary">
      <div className="summary-group">
        <h3>Booking</h3>
        <ul>
          <li>{booking.coupleNames}</li>
          <li>
            {formatEventDate(booking.eventDate) || 'Date not listed yet'}
            {booking.venue ? `, ${booking.venue}` : ''}
          </li>
          <li>
            Bridal entrance: {design.entranceTime ? formatTime(design.entranceTime) : 'Not set'}
            {design.submittedWithoutTimes && !design.entranceTime && <span className="time-tag">Times not included</span>}
          </li>
          <li>
            Dancing starts: {design.dancingStarts ? formatTime(design.dancingStarts) : 'Not set'}
            {design.submittedWithoutTimes && !design.dancingStarts && <span className="time-tag">Times not included</span>}
          </li>
          <li>
            {booking.floor && px
              ? `Floor ${booking.floor.widthM}m x ${booking.floor.lengthM}m (${px.width} x ${px.height} px)`
              : booking.floorSqm != null
                ? `Floor ${booking.floorSqm} sqm. Width and length are not listed yet.`
                : 'Floor size is not listed yet.'}
          </li>
          <li>
            {booking.screensBooked == null
              ? 'Portrait screens are not listed yet'
              : screens === 0
                ? 'No portrait screens'
                : `${screens} portrait screen${screens > 1 ? 's' : ''}`}
          </li>
        </ul>
      </div>

      <div className="summary-group">
        <h3>People on the day</h3>
        <ul>
          <li>Wedding planner: {(design.weddingPlanner ?? '').trim() || 'Not added yet'}</li>
          <li>Photographer: {(design.photographer ?? '').trim() || 'Not added yet'}</li>
          <li>Videographer: {(design.videographer ?? '').trim() || 'Not added yet'}</li>
          <li>DJ: {(design.dj ?? '').trim() || 'Not added yet'}</li>
          <li>Other: {(design.otherSuppliers ?? '').trim() || 'Not added yet'}</li>
        </ul>
      </div>

      <div className="summary-group">
        <h3>Holding screen</h3>
        <HoldingSummary h={design.designs.holding} eventDate={booking.eventDate} design={design} />
        <ul>
          <li>
            Floor reactions:{' '}
            {design.reactions.length
              ? design.reactions.map((id) => findEffect(id)?.name ?? id).join(', ')
              : 'None'}
          </li>
        </ul>
      </div>

      <div className="summary-group">
        <h3>After the bridal entrance</h3>
        {design.afterMode === 'same' ? (
          <p>The holding screen stays on until dancing time.</p>
        ) : (
          <HoldingSummary h={design.designs.after} eventDate={booking.eventDate} design={design} />
        )}
        {design.reactions.length > 0 ? (
          <p>The reactions from before the entrance carry on.</p>
        ) : (
          <ul>
            <li>
              Floor reactions:{' '}
              {design.afterReactions.length
                ? design.afterReactions.map((id) => findEffect(id)?.name ?? id).join(', ')
                : 'None'}
            </li>
          </ul>
        )}
      </div>

      <div className="summary-group">
        <h3>Dancing time</h3>
        {design.dancingMode === 'blank' ? (
          <p>Blank floor with assorted reactions.</p>
        ) : design.dancingMode === 'videos' ? (
          <p>Assorted colourful videos.</p>
        ) : (
          <p>
            A different design.{' '}
            {(design.dancingNote ?? '').trim() || 'No note yet.'}
          </p>
        )}
      </div>

      <div className="summary-group">
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
      </div>

      {screens > 0 && (
        <>
          <div className="summary-group">
            <h3>Screens</h3>
            <ul>
              <li>
                Screen design:{' '}
                {screenStyle ? `${screenStyle.name} (${SCREEN_KIND_LABELS[screenStyle.kind]})` : 'Not chosen yet'}
              </li>
              <li>Screen wording: {(design.screens.note ?? '').trim() || 'No note yet.'}</li>
              {PHASES.map((p) => (
                <li key={p.id}>
                  {timingLabel(timingFor(p.id))}:{' '}
                  {design.screens.modes[p.id] === 'photos' ? 'Your photos and videos' : 'Your screen design'}
                </li>
              ))}
            </ul>
          </div>

          <div className="summary-group">
            <h3>Photos and videos</h3>
            <ul>
              {PHASES.map((p) => {
                const group = mediaFor(design, p.id);
                return (
                  <li key={p.id}>
                    {timingLabel(timingFor(p.id))}: {group.length ? group.map((m) => m.file.name).join(', ') : 'None'}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function HoldingSummary({
  h,
  eventDate,
  design,
}: {
  h: HoldingDesign;
  eventDate: string;
  design: DesignState;
}) {
  const style = findStyle(h.styleId);
  const generated = generatedFor(design, h.styleId);
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
