import { hireStepView, portalTaskList } from '../lib/portalHome';
import type { Booking, DesignState } from '../types';

/** First thing on the design page: one hire step, then what this page is for. */
export function PortalHome({ booking, design }: { booking: Booking; design: DesignState | null }) {
  const step = hireStepView(booking);
  const tasks = design ? portalTaskList(design) : [];

  return (
    <section className="home-card" aria-label="Next step">
      <span className="eyebrow">Next step</span>
      <h2>{step.title}</h2>
      <p>{step.body}</p>
      {step.href && step.action ? (
        <p className="home-action-row">
          <a className="home-action" href={step.href} target="_blank" rel="noopener noreferrer">
            {step.action}
          </a>
        </p>
      ) : null}
      {tasks.length > 0 && (
        <>
          <h3>On this page</h3>
          <ul className="home-tasks">
            {tasks.map((task) => (
              <li key={task.id}>
                <span className={task.done ? 'task-done' : 'task-todo'}>{task.done ? 'Done' : 'To do'}</span>
                {task.label}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
