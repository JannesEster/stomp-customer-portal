/** Fillout hosts the customer signing form. */
export const FILLOUT_HOST = 'forms.fillout.com';
/** Customer invoice pages. go.xero.com is staff only and is never accepted. */
export const XERO_INVOICE_HOST = 'in.xero.com';

/** Bookings Deposit status choice for Paid. */
export const DEPOSIT_PAID_CHOICE = 'seli5VD6VKC88Z5ar';

/** Shown when the lead is Lost. No sign link, no pay link, and not All set. */
export const LOST_HIRE_NOTE = 'Please contact Stomp Sphere about this booking.';

/** Tick line when Terms accepted is ticked. Not a link. */
export const HIRE_TERMS_SIGNED = 'Hire terms signed';

export const PAY_DEPOSIT = 'Pay your deposit';
export const PAY_BALANCE = 'Pay the balance';
export const SIGN_NEXT = 'After you sign, come back to this page.';
export const PAY_NEXT = 'After you pay, come back to this page.';
export const SIGN_OR_PAY_NEXT = 'After you sign or pay, come back to this page.';
export const SEND_TITLE = 'Send your design';
export const SEND_BODY = 'Your hire is sorted. Choose a look and send it to Stomp Sphere.';
export const SEND_NEXT = 'Choose your look, upload your files, then send the design.';
export const ALL_SET_NEXT =
  'Stomp Sphere will set your floor and screens from this design. You can still change it here.';
export const LOST_TITLE = 'Please get in touch';
export const LOST_BODY = 'We need to talk about this booking before you plan the floor.';

/** Built when the lead's Booking form link is missing or not on forms.fillout.com. */
export const FILLOUT_TERMS_FORM = 'https://forms.fillout.com/t/jYwCSWM41Eus';

const LEAD_RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

export interface HireAction {
  label: string;
  href: string;
}

export interface HireStep {
  kind: 'sign' | 'pay' | 'both' | 'ready' | 'send' | 'unknown' | 'lost';
  title: string;
  body: string;
  /** Set when terms are accepted and the lead is not Lost. */
  signedNote: string | null;
  /** Shown under What happens next. */
  next: string;
  actions: HireAction[];
}

export interface HireSources {
  /** True when there is no linked Lead, or the Lead could not be read. The step stays neutral. */
  leadUnavailable: boolean;
  /** Leads Status. Lost hides Sign and Pay. */
  leadStatus: unknown;
  bookingFormUrlUsed: unknown;
  depositInvoiceLink: unknown;
  finalInvoiceLink: unknown;
  depositStatus: unknown;
  balanceStatus: unknown;
  termsAccepted: unknown;
  /** Linked Lead record id, used only to build the signing URL. */
  leadId: unknown;
  bookingFormLink: unknown;
  /**
   * Ignored. Booking form status and Contract status do not decide whether terms are signed.
   * Kept so a caller can pass them and the step still follows Terms accepted only.
   */
  contractStatus?: unknown;
  bookingFormStatus?: unknown;
}

/** https URL on one exact host. Other hosts, including go.xero.com, are dropped. */
export function httpsOnHost(value: unknown, host: string): string | null {
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
  if (url.hostname !== host) return null;
  return url.toString();
}

/**
 * Lead Booking form link, then a link built from the lead id, then Booking form URL used.
 * Each step is kept only when it is https on forms.fillout.com.
 */
export function signLink(bookingFormLink: unknown, leadId: unknown, bookingFormUrlUsed: unknown): string | null {
  const direct = httpsOnHost(bookingFormLink, FILLOUT_HOST);
  if (direct) return direct;
  if (typeof leadId === 'string' && LEAD_RECORD_ID.test(leadId)) {
    return `${FILLOUT_TERMS_FORM}?id=${leadId}`;
  }
  return httpsOnHost(bookingFormUrlUsed, FILLOUT_HOST);
}

export function neutralHireStep(): HireStep {
  return {
    kind: 'unknown',
    title: 'Next step',
    body: 'We cannot see your hire terms or payment on this page yet. Those links stay in your emails from Stomp Sphere.',
    signedNote: null,
    next: 'Email or call Stomp Sphere if you need a signing or pay link.',
    actions: [],
  };
}

export function lostHireStep(): HireStep {
  return {
    kind: 'lost',
    title: LOST_TITLE,
    body: LOST_BODY,
    signedNote: null,
    next: 'Email or call and we will help with this booking.',
    actions: [],
  };
}

/**
 * One hire step from booking and lead values.
 * Signed means Lead Terms accepted is ticked. A completed form or a signed contract does not count.
 * A Lost lead shows neither Sign nor Pay, and is not All set.
 * All set only when terms are accepted, the deposit is Paid, and the balance is not Requested.
 */
export function deriveHireStep(source: HireSources): HireStep {
  if (source.leadUnavailable) return neutralHireStep();
  if (choiceIs(source.leadStatus, 'Lost')) return lostHireStep();

  const signed = source.termsAccepted === true;
  const depositPaid = choiceIs(source.depositStatus, 'Paid', DEPOSIT_PAID_CHOICE);
  const balanceOwed = choiceIs(source.balanceStatus, 'Requested');
  const signUrl = signLink(source.bookingFormLink, source.leadId, source.bookingFormUrlUsed);
  const depositUrl = httpsOnHost(source.depositInvoiceLink, XERO_INVOICE_HOST);
  const finalUrl = httpsOnHost(source.finalInvoiceLink, XERO_INVOICE_HOST);
  const payKind: 'deposit' | 'balance' | null = !depositPaid ? 'deposit' : balanceOwed ? 'balance' : null;
  const payUrl = payKind === 'deposit' ? (depositUrl ?? finalUrl) : payKind === 'balance' ? finalUrl : null;

  return hireStepFromFacts({
    signed,
    signUrl,
    paymentOutstanding: payKind != null,
    payKind,
    payUrl,
  });
}

export function hireStepFromFacts(facts: {
  signed: boolean | null;
  signUrl: string | null;
  paymentOutstanding: boolean | null;
  payKind?: 'deposit' | 'balance' | null;
  payUrl: string | null;
}): HireStep {
  if (facts.signed == null || facts.paymentOutstanding == null) return neutralHireStep();
  const payKind = facts.payKind ?? (facts.paymentOutstanding ? 'deposit' : null);
  const payText = payKind === 'balance' ? PAY_BALANCE : PAY_DEPOSIT;

  if (!facts.signed) {
    const actions: HireAction[] = [];
    if (facts.signUrl) actions.push({ label: 'Sign hire terms', href: facts.signUrl });
    const showPay = facts.paymentOutstanding && !!facts.payUrl;
    if (showPay && facts.payUrl) actions.push({ label: payText, href: facts.payUrl });
    const signing = facts.signUrl ? '' : ' Your signing link is in the email from Stomp Sphere.';
    const paying = !facts.paymentOutstanding
      ? ''
      : showPay
        ? ` ${payText}.`
        : ` ${payText}. Your payment link is in the email from Stomp Sphere.`;
    return {
      kind: showPay ? 'both' : 'sign',
      title: 'Sign',
      body: `Your hire terms are not signed yet.${signing}${paying}`,
      signedNote: null,
      next: showPay ? SIGN_OR_PAY_NEXT : SIGN_NEXT,
      actions,
    };
  }

  if (facts.paymentOutstanding) {
    const body = facts.payUrl
      ? `${payText}.`
      : `${payText}. Your payment link is in the email from Stomp Sphere.`;
    return {
      kind: 'pay',
      title: payText,
      body,
      signedNote: HIRE_TERMS_SIGNED,
      next: PAY_NEXT,
      actions: facts.payUrl ? [{ label: payText, href: facts.payUrl }] : [],
    };
  }

  return {
    kind: 'ready',
    title: 'All set',
    body: 'Your hire terms are signed and nothing is left to pay.',
    signedNote: HIRE_TERMS_SIGNED,
    next: ALL_SET_NEXT,
    actions: [],
  };
}

/** All set only when hire is finished and the design has been sent. */
export function withDesignProgress(step: HireStep, designSent: boolean): HireStep {
  if (step.kind !== 'ready') return step;
  if (designSent) return step;
  return {
    ...step,
    kind: 'send',
    title: SEND_TITLE,
    body: SEND_BODY,
    next: SEND_NEXT,
    signedNote: HIRE_TERMS_SIGNED,
    actions: [],
  };
}

/** Drop any action whose URL is not a customer Fillout or Xero invoice link. */
export function customerHireActions(actions: HireAction[]): HireAction[] {
  return actions.flatMap((action) => {
    const href = httpsOnHost(action.href, FILLOUT_HOST) ?? httpsOnHost(action.href, XERO_INVOICE_HOST);
    return href ? [{ label: action.label, href }] : [];
  });
}

function choiceIs(value: unknown, name: string, id?: string): boolean {
  if (typeof value === 'string') return value.trim() === name;
  if (!value || typeof value !== 'object') return false;
  const choice = value as { id?: unknown; name?: unknown };
  if (id && choice.id === id) return true;
  return typeof choice.name === 'string' && choice.name.trim() === name;
}
