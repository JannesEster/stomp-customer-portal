import { useState } from 'react';
import { useDesignState } from '../hooks/useDesignState';
import { formatDateTime } from '../lib/format';
import { FloorPreview } from '../design/FloorPreview';
import { HoldingSection } from '../design/HoldingSection';
import { ReactionsSection } from '../design/ReactionsSection';
import { ScreensSection } from '../design/ScreensSection';
import { LiveContentSection } from '../design/LiveContentSection';
import { SummaryDialog } from '../design/Summary';
import { ArrowIcon } from '../design/common';
import type { Booking, Phase } from '../types';

const SAVE_LABEL = {
  idle: 'Draft',
  saving: 'Saving…',
  saved: 'Draft saved',
  error: "Couldn't save. Check your connection.",
} as const;

export function DesignTab({ booking }: { booking: Booking }) {
  const { design, update, submit, saveStatus } = useDesignState(booking);
  const [phase, setPhase] = useState<Phase>('pre');
  const [showSummary, setShowSummary] = useState(false);

  if (!design) return <p className="muted">Loading your design…</p>;

  const submitted = design.status === 'submitted';

  return (
    <div className="design">
      {submitted && design.submittedAt ? (
        <div className="banner success">
          Submitted to Stomp on {formatDateTime(design.submittedAt)}. Any changes go back to draft until you submit
          again.
        </div>
      ) : design.submittedAt ? (
        <div className="banner">You've made changes since you submitted. Submit again so Stomp has the latest.</div>
      ) : null}

      <FloorPreview booking={booking} design={design} phase={phase} onPhaseChange={setPhase} />
      <HoldingSection booking={booking} design={design} update={update} phase={phase} onPhaseChange={setPhase} />
      <ReactionsSection design={design} update={update} />
      <ScreensSection booking={booking} design={design} update={update} />
      <LiveContentSection booking={booking} design={design} update={update} />

      <div className="submit-bar">
        <span className="muted small" aria-live="polite">
          {submitted ? 'Submitted' : SAVE_LABEL[saveStatus]}
        </span>
        <div className="row">
          <button type="button" className="secondary" onClick={() => setShowSummary(true)}>
            View summary
          </button>
          <button
            type="button"
            className="cta"
            disabled={submitted}
            onClick={() => {
              submit();
              setShowSummary(true);
            }}
          >
            {submitted ? 'Submitted' : 'Submit design to Stomp'}
            {!submitted && <ArrowIcon />}
          </button>
        </div>
      </div>

      {showSummary && <SummaryDialog booking={booking} design={design} onClose={() => setShowSummary(false)} />}
    </div>
  );
}
