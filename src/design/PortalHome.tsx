import { ContactRow } from './ContactRow';
import { hireForBooking, portalTaskList } from '../lib/portalHome';
import type { Booking, DesignState } from '../types';

/** First thing on the design page: one hire step, then what this page is for. */
export function PortalHome({
  booking,
  design,
  onOpenStep,
}: {
  booking: Booking;
  design: DesignState | null;
  onOpenStep?: (step: 'floor-design' | 'review') => void;
}) {
  const step = hireForBooking(booking, design?.status === 'submitted');
  const tasks = design && step.kind !== 'lost' ? portalTaskList(design) : [];
  const primary = tasks.find((task) => !task.done)?.id;
  const showContact = step.kind === 'lost' || step.kind === 'unknown';

  return (
    <section className="home-card" aria-label="Next step">
      <span className="eyebrow">Next step</span>
      <h2>{step.title}</h2>
      {step.signedNote ? (
        <p className="hire-signed">
          <span className="task-done">Done</span>
          {step.signedNote}
        </p>
      ) : null}
      <p>{step.body}</p>
      {step.actions.length > 0 ? (
        <p className="home-action-row">
          {step.actions.map((action, index) => (
            <a
              key={action.href}
              className={index === 0 ? 'home-action' : 'home-action secondary'}
              href={action.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {action.label}
            </a>
          ))}
        </p>
      ) : null}
      {step.kind === 'send' && onOpenStep ? (
        <p className="home-action-row">
          <button type="button" className="home-action" onClick={() => onOpenStep('floor-design')}>
            Choose a look
          </button>
        </p>
      ) : null}
      {step.next ? (
        <>
          <h3>What happens next</h3>
          <p>{step.next}</p>
        </>
      ) : null}
      {showContact ? <ContactRow /> : null}
      {tasks.length > 0 && (
        <>
          <h3>On this page</h3>
          <ul className="home-tasks">
            {tasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  className={task.id === primary ? 'home-action' : 'secondary'}
                  onClick={() => onOpenStep?.(task.step)}
                >
                  <span className={task.done ? 'task-done' : 'task-todo'}>{task.done ? 'Done' : 'To do'}</span>
                  {task.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
