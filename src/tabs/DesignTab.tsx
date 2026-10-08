import { useEffect, useMemo, useRef, useState } from 'react';
import { designSaveLabel } from '../hooks/designSync';
import { useDesignState, type UpdateDesign } from '../hooks/useDesignState';
import { screenCount } from '../lib/dimensions';
import { formatDateTime } from '../lib/format';
import { FloorPreview } from '../design/FloorPreview';
import { AfterEntranceStep, DancingStep, DetailsStep, HoldingScreenStep } from '../design/FloorSteps';
import { ReactionsPicker } from '../design/ReactionsPicker';
import { ScreenDesignStep, ScreenPartStep } from '../design/ScreenSteps';
import { ScreensPreview } from '../design/ScreensPreview';
import { LiveContentSection } from '../design/LiveContentSection';
import { DesignSummary, SummaryDialog } from '../design/Summary';
import { StepIndicator } from '../design/StepIndicator';
import { stepsFor, type StepDef, type StepId } from '../design/steps';
import { ArrowIcon, Section } from '../design/common';
import type { Booking, DesignState, Phase } from '../types';

const STEP_KEY = (bookingId: string) => `stomp-portal:design-step:${bookingId}`;

function storedStep(bookingId: string, steps: StepDef[]): StepId {
  try {
    const saved = sessionStorage.getItem(STEP_KEY(bookingId));
    if (saved && steps.some((s) => s.id === saved)) return saved as StepId;
  } catch {
    /* sessionStorage can be blocked */
  }
  return steps[0].id;
}

function timeReminder(stepId: StepId, design: DesignState): string | null {
  const missing = !design.entranceTime || !design.dancingStarts;
  if (!missing) return null;
  if (stepId === 'review') {
    return design.submittedWithoutTimes ? 'Submitted without times.' : "You haven't selected times.";
  }
  return "You haven't specified a time for this.";
}

export function DesignTab({ booking }: { booking: Booking }) {
  const { design, update, submit, saveStatus, savedAt, serverSync } = useDesignState(booking);
  const showAfterReactions = !design || design.reactions.length === 0;
  const steps = useMemo(
    () => stepsFor(screenCount(booking.screensBooked), showAfterReactions),
    [booking.screensBooked, showAfterReactions],
  );
  const [stepId, setStepId] = useState<StepId>(() => storedStep(booking.id, steps));
  const [previewPhase, setPreviewPhase] = useState<Phase>(
    () => steps.find((s) => s.id === storedStep(booking.id, steps))?.phase ?? steps[0].phase,
  );
  const [showSummary, setShowSummary] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(STEP_KEY(booking.id), stepId);
    } catch {
      /* sessionStorage can be blocked */
    }
  }, [booking.id, stepId]);

  useEffect(() => {
    if (steps.some((s) => s.id === stepId)) return;
    const fallback = steps.find((s) => s.id === 'floor-dancing') ?? steps[0];
    setStepId(fallback.id);
    setPreviewPhase(fallback.phase);
  }, [steps, stepId]);

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    const el = top.current;
    if (el && el.getBoundingClientRect().top < parseFloat(getComputedStyle(el).scrollMarginTop)) {
      el.scrollIntoView();
    }
    heading.current?.focus({ preventScroll: true });
  }, [stepId]);

  if (!design) return <p className="muted">Loading your design…</p>;

  const found = steps.findIndex((s) => s.id === stepId);
  const index = found === -1 ? steps.findIndex((s) => s.id === 'floor-dancing') : found;
  const step = steps[index];
  const prev = steps[index - 1];
  const next = steps[index + 1];
  const submitted = design.status === 'submitted';

  const goTo = (id: StepId) => {
    const target = steps.find((s) => s.id === id);
    if (!target) return;
    moved.current = true;
    setStepId(target.id);
    setPreviewPhase(target.phase);
  };

  return (
    <div className="design" ref={top}>
      <StepIndicator steps={steps} current={step.id} onSelect={goTo} />

      {submitted && design.submittedAt ? (
        <div className={design.submittedWithoutTimes ? 'banner times-missing' : 'banner success'}>
          Submitted to Stomp on {formatDateTime(design.submittedAt)}.
          {design.submittedWithoutTimes && <TimesTag />} Any changes go back to draft until you submit again.
        </div>
      ) : design.submittedAt ? (
        <div className="banner">
          You've made changes since you submitted.
          {design.submittedWithoutTimes && <TimesTag />} Submit again so Stomp has the latest.
        </div>
      ) : null}

      {booking.screensBooked == null && (
        <div className="banner">
          Portrait screens are not listed on your booking yet, so the screen steps are hidden. If you have screens, get
          in touch with Stomp.
        </div>
      )}

      <Section
        key={step.id}
        eyebrow={`Step ${index + 1} of ${steps.length}`}
        title={step.title}
        intro={step.intro}
        headingRef={heading}
        notice={
          timeReminder(step.id, design) && (
            <div className="time-alert" role="alert">
              <p>{timeReminder(step.id, design)}</p>
              <button type="button" onClick={() => { window.location.hash = 'notes'; }}>
                Insert times here
              </button>
            </div>
          )
        }
      >
        <StepBody
          step={step}
          booking={booking}
          design={design}
          update={update}
          onPickScreenDesign={() => goTo('screens-design')}
        />
      </Section>

      {step.id === 'details' && (
        <p className="preview-lead">
          Below is a preview of your floor right now, but nothing has been set. Click Next to make it better.
        </p>
      )}
      {step.preview === 'floor' && (
        <FloorPreview booking={booking} design={design} phase={previewPhase} onPhaseChange={setPreviewPhase} />
      )}
      {step.preview === 'screens' && (
        <ScreensPreview booking={booking} design={design} phase={previewPhase} onPhaseChange={setPreviewPhase} />
      )}

      <div className="submit-bar">
        <span className="muted small" aria-live="polite">
          {designSaveLabel({
            submitted,
            submittedWithoutTimes: design.submittedWithoutTimes,
            saveStatus,
            savedAt,
            serverSync,
          })}
        </span>
        <div className="row">
          {prev && (
            <button type="button" className="secondary" onClick={() => goTo(prev.id)}>
              Back
            </button>
          )}
          {next ? (
            <button type="button" className="cta" onClick={() => goTo(next.id)}>
              <span className="next-label">
                Next: <span className="next-name">{next.name}</span>
                <span className="next-short">{next.short}</span>
              </span>
              <ArrowIcon />
            </button>
          ) : (
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
          )}
        </div>
      </div>

      {showSummary && <SummaryDialog booking={booking} design={design} onClose={() => setShowSummary(false)} />}
    </div>
  );
}

function TimesTag() {
  return <span className="time-tag">Times not included</span>;
}

function StepBody({
  step,
  booking,
  design,
  update,
  onPickScreenDesign,
}: {
  step: StepDef;
  booking: Booking;
  design: DesignState;
  update: UpdateDesign;
  onPickScreenDesign: () => void;
}) {
  const props = { design, update, eventDate: booking.eventDate };
  switch (step.id) {
    case 'details':
      return <DetailsStep booking={booking} design={design} update={update} />;
    case 'floor-design':
      return <HoldingScreenStep {...props} />;
    case 'floor-reactions':
      return <ReactionsPicker design={design} update={update} />;
    case 'floor-after-reactions':
      return <ReactionsPicker design={design} update={update} field="afterReactions" />;
    case 'floor-after':
      return <AfterEntranceStep {...props} />;
    case 'floor-dancing':
      return <DancingStep {...props} />;
    case 'screens-design':
      return <ScreenDesignStep design={design} update={update} />;
    case 'screens-holding':
    case 'screens-after':
    case 'screens-dancing':
      return <ScreenPartStep design={design} update={update} phase={step.phase} onPickDesign={onPickScreenDesign} />;
    case 'review':
      return (
        <>
          <LiveContentSection booking={booking} design={design} update={update} />
          <DesignSummary booking={booking} design={design} />
        </>
      );
  }
}
