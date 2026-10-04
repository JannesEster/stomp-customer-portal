import { findEffect, findFont, findTemplate, timingLabel, portalConfig } from '../config';
import { floorPixels, screenCount } from '../lib/dimensions';
import { holdingFor } from '../lib/design';
import { formatAud, formatDateTime, formatEventDate } from '../lib/format';
import { liveContentView } from '../lib/liveContent';
import type { Booking, DesignState, HoldingDesign, Phase } from '../types';
import { Accent, PHASES, phaseLabel } from './common';

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
  const holdingPhases: Phase[] = design.separatePostBridal ? ['pre', 'post'] : ['pre'];

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
        {!design.separatePostBridal && <p className="muted small">Same design before and after the bridal entrance.</p>}
        {holdingPhases.map((p) => (
          <HoldingSummary
            key={p}
            title={design.separatePostBridal ? phaseLabel(p) : undefined}
            h={holdingFor(design, p)}
          />
        ))}

        <h3>Invite and styling</h3>
        <ul>
          <li>{design.invite ? `Uploaded: ${design.invite.name}` : 'No invite or styling file'}</li>
          <li>{design.stylingNote.trim() ? `Note: ${design.stylingNote.trim()}` : 'No styling note'}</li>
        </ul>

        <h3>Floor reactions</h3>
        <ul>
          {PHASES.map((p) => {
            const names = design.reactions[p.id].map((id) => findEffect(id)?.name ?? id);
            return (
              <li key={p.id}>
                {p.label}: {names.length ? names.join(', ') : 'None'}
              </li>
            );
          })}
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

function HoldingSummary({ title, h }: { title?: string; h: HoldingDesign }) {
  return (
    <div className="summary-block">
      {title && <h4>{title}</h4>}
      <ul>
        <li>Template: {findTemplate(h.templateId).name}</li>
        <li>Names: {h.names || 'None'}</li>
        <li>Second line: {h.secondLine || 'None'}</li>
        <li>Font: {findFont(h.fontId).label}</li>
        <li>
          Colours: text <Swatch c={h.textColour} />, background <Swatch c={h.backgroundColour} />, accent{' '}
          <Swatch c={h.accentColour} />
        </li>
        <li>Photo: {h.photo.file ? h.photo.file.name : 'None'}</li>
      </ul>
    </div>
  );
}

function Swatch({ c }: { c: string }) {
  return (
    <span className="swatch" style={{ background: c }} title={c}>
      <span className="sr-only">{c}</span>
    </span>
  );
}
