import { customerHireActions, hireStepFromFacts, withDesignProgress, type HireStep } from './hireStep';
import type { Booking, DesignState } from '../types';

/** https links for the seeded demo. Live links are filtered to Fillout and Xero invoice hosts on the server. */
export function safeCustomerUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  return url.toString();
}

/**
 * Seeded demo step. A live /p/<token> booking already carries `hire` from the server.
 * Missing flags stay unknown so the page does not claim the hire is finished.
 */
export function hireStepView(booking: Pick<Booking, 'termsSigned' | 'signUrl' | 'paymentDue' | 'payUrl'>): HireStep {
  const signed = booking.termsSigned === true ? true : booking.termsSigned === false ? false : null;
  const paymentOutstanding = booking.paymentDue === true ? true : booking.paymentDue === false ? false : null;
  return hireStepFromFacts({
    signed,
    signUrl: safeCustomerUrl(booking.signUrl),
    paymentOutstanding,
    payUrl: safeCustomerUrl(booking.payUrl),
  });
}

/** Prefer the server step. Drop any action that is not a customer Fillout or Xero invoice link. */
export function hireForBooking(
  booking: Pick<Booking, 'hire' | 'termsSigned' | 'signUrl' | 'paymentDue' | 'payUrl'>,
  designSent = false,
): HireStep {
  const step =
    booking.hire && Array.isArray(booking.hire.actions)
      ? { ...booking.hire, actions: customerHireActions(booking.hire.actions) }
      : hireStepView(booking);
  return withDesignProgress(step, designSent);
}

export interface PortalTask {
  id: string;
  label: string;
  done: boolean;
  step: 'floor-design' | 'review';
}

/** Short list of what this page is for. Separate from hire terms and payment. */
export function portalTaskList(design: DesignState): PortalTask[] {
  const holding = design.designs.holding;
  const patterns =
    holding.styleId != null ||
    design.reactions.length > 0 ||
    design.screens.styleId != null ||
    design.inviteStyle != null;
  const files = holding.media != null || design.invite != null || design.media.length > 0;
  return [
    { id: 'patterns', label: 'Choose effects and patterns', done: patterns, step: 'floor-design' },
    { id: 'files', label: 'Upload your photos and files', done: files, step: 'floor-design' },
    { id: 'send', label: 'Send your design to Stomp Sphere', done: design.status === 'submitted', step: 'review' },
  ];
}
