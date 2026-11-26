import type { Booking, DesignState } from '../types';

export type HireKind = 'sign' | 'pay' | 'ready' | 'unknown';

export interface HireStepView {
  kind: HireKind;
  title: string;
  body: string;
  href: string | null;
  action: string | null;
}

/** https links only. Usernames, passwords, and other schemes are dropped. */
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
 * One next step for the booking.
 * Sign wins when hire terms are unsigned, then Pay when money is due, then All set.
 * Missing flags stay unknown so the page does not claim the hire is finished.
 */
export function hireStepView(
  booking: Pick<Booking, 'termsSigned' | 'signUrl' | 'paymentDue' | 'payUrl'>,
): HireStepView {
  if (booking.termsSigned === false) {
    const href = safeCustomerUrl(booking.signUrl);
    return {
      kind: 'sign',
      title: 'Sign',
      body: href
        ? 'Your hire terms are not signed yet.'
        : 'Your hire terms are not signed yet. Your signing link is not on this page yet. Check your email from Stomp Sphere.',
      href,
      action: href ? 'Sign hire terms' : null,
    };
  }
  if (booking.paymentDue === true) {
    const href = safeCustomerUrl(booking.payUrl);
    return {
      kind: 'pay',
      title: 'Pay',
      body: href
        ? 'A payment is still due.'
        : 'A payment is still due. Your pay link is not on this page yet. Check your email from Stomp Sphere.',
      href,
      action: href ? 'Pay now' : null,
    };
  }
  if (booking.termsSigned === true && booking.paymentDue === false) {
    return {
      kind: 'ready',
      title: 'All set',
      body: 'Your hire terms are signed and nothing is left to pay.',
      href: null,
      action: null,
    };
  }
  return {
    kind: 'unknown',
    title: 'Next step',
    body: 'We cannot see your hire terms or payment on this page yet. Those links stay in your emails from Stomp Sphere.',
    href: null,
    action: null,
  };
}

export interface PortalTask {
  id: string;
  label: string;
  done: boolean;
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
    { id: 'patterns', label: 'Choose effects and patterns', done: patterns },
    { id: 'files', label: 'Upload your photos and files', done: files },
    { id: 'send', label: 'Send your design to Stomp Sphere', done: design.status === 'submitted' },
  ];
}
