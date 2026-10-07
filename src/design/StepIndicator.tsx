import { useEffect, useRef, type CSSProperties } from 'react';
import { STEP_GROUPS, type StepDef, type StepId } from './steps';

export function StepIndicator({
  steps,
  current,
  onSelect,
}: {
  steps: StepDef[];
  current: StepId;
  onSelect: (id: StepId) => void;
}) {
  const list = useRef<HTMLOListElement>(null);
  const index = steps.findIndex((s) => s.id === current);

  // scrollIntoView would move the page too, so only the list scrolls to centre the current step.
  useEffect(() => {
    const el = list.current;
    const active = el?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!el || !active) return;
    const box = el.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    el.scrollTo({ left: el.scrollLeft + item.left - box.left - (box.width - item.width) / 2 });
  }, [current]);

  return (
    <nav className="steps" aria-label="Design steps">
      <p className="steps-count">
        Step {index + 1} of {steps.length}
        <span className="steps-bar" aria-hidden="true">
          <span style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
        </span>
      </p>
      <ol ref={list} className="steps-list">
        {STEP_GROUPS.map((g) => {
          const group = steps.filter((s) => s.group === g.id);
          if (!group.length) return null;
          return (
            <li key={g.id} className="steps-group" style={{ '--steps': group.length } as CSSProperties}>
              <span className="steps-group-name">{g.label}</span>
              <ol>
                {group.map((s) => {
                  const n = steps.indexOf(s);
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        className={n < index ? 'step done' : 'step'}
                        aria-current={s.id === current ? 'step' : undefined}
                        onClick={() => onSelect(s.id)}
                      >
                        <span className="step-label">
                          <span className="step-num">{n + 1}</span> {s.short}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
