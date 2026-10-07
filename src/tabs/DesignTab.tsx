import { useEffect, useRef, useState } from 'react';
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

const SAVE_LABEL = {
  idle: 'Draft',
  saving: 'Saving…',
  saved: 'Draft saved',
  error: "Couldn't save. Check your connection.",
} as const;

export function DesignTab({ booking }: { booking: Booking }) {
  const { design, update, submit, saveStatus } = useDesignState(booking);
  const steps = stepsFor(screenCount(booking.screensBooked));
  const [stepId, setStepId] = useState<StepId>(steps[0].id);
  const [previewPhase, setPreviewPhase] = useState<Phase>(steps[0].phase);
  const [showSummary, setShowSummary] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

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

  const index = steps.findIndex((s) => s.id === stepId);
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
        <div className="banner success">
          Submitted to Stomp on {formatDateTime(design.submittedAt)}. Any changes go back to draft until you submit
          again.
        </div>
      ) : design.submittedAt ? (
        <div className="banner">You've made changes since you submitted. Submit again so Stomp has the latest.</div>
      ) : null}

      <Section
        key={step.id}
        eyebrow={`Step ${index + 1} of ${steps.length}`}
        title={step.title}
        intro={step.intro}
        headingRef={heading}
      >
        <StepBody
          step={step}
          booking={booking}
          design={design}
          update={update}
          onPickScreenDesign={() => goTo('screens-design')}
        />
      </Section>

      {step.preview === 'floor' && (
        <FloorPreview booking={booking} design={design} phase={previewPhase} onPhaseChange={setPreviewPhase} />
      )}
      {step.preview === 'screens' && (
        <ScreensPreview booking={booking} design={design} phase={previewPhase} onPhaseChange={setPreviewPhase} />
      )}

      <div className="submit-bar">
        <span className="muted small" aria-live="polite">
          {submitted ? 'Submitted' : SAVE_LABEL[saveStatus]}
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
