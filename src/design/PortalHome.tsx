import { hireForBooking, portalTaskList } from '../lib/portalHome';
import type { Booking, DesignState } from '../types';

/** First thing on the design page: the hire step from the server, then what this page is for. */
export function PortalHome({ booking, design }: { booking: Booking; design: DesignState | null }) {
  const step = hireForBooking(booking);
  const tasks = design ? portalTaskList(design) : [];

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
          {step.actions.map((action) => (
            <a key={action.href} className="home-action" href={action.href} target="_blank" rel="noopener noreferrer">
              {action.label}
            </a>
          ))}
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
