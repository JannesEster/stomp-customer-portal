/** Fillout hosts the customer signing form. */
export const FILLOUT_HOST = 'forms.fillout.com';
/** Customer invoice pages. go.xero.com is staff only and is never accepted. */
export const XERO_INVOICE_HOST = 'in.xero.com';

/** Bookings Contract status choice for Signed. */
export const CONTRACT_SIGNED_CHOICE = 'sellBnkwOQCBMg6kO';
/** Bookings Deposit status choice for Paid. */
export const DEPOSIT_PAID_CHOICE = 'seli5VD6VKC88Z5ar';

export interface HireAction {
  label: string;
  href: string;
}

export interface HireStep {
  kind: 'sign' | 'pay' | 'both' | 'ready' | 'unknown';
  title: string;
  body: string;
  actions: HireAction[];
}

export interface HireSources {
  /** True when the linked Lead could not be read. The step stays neutral. */
  leadUnavailable: boolean;
  contractStatus: unknown;
  bookingFormUrlUsed: unknown;
  depositInvoiceLink: unknown;
  finalInvoiceLink: unknown;
  depositStatus: unknown;
  balanceStatus: unknown;
  termsAccepted: unknown;
  bookingFormLink: unknown;
  bookingFormStatus: unknown;
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

export function neutralHireStep(): HireStep {
  return {
    kind: 'unknown',
    title: 'Next step',
    body: 'We cannot see your hire terms or payment on this page yet. Those links stay in your emails from Stomp Sphere.',
    actions: [],
  };
}

/**
 * One hire step from booking and lead values.
 * A blank Contract status does not count as signed.
 * All set only when terms are signed, the deposit is Paid, and the balance is not Requested.
 */
export function deriveHireStep(source: HireSources): HireStep {
  if (source.leadUnavailable) return neutralHireStep();

  const signed =
    source.termsAccepted === true ||
    choiceIs(source.bookingFormStatus, 'Completed') ||
    choiceIs(source.contractStatus, 'Signed', CONTRACT_SIGNED_CHOICE);
  const depositPaid = choiceIs(source.depositStatus, 'Paid', DEPOSIT_PAID_CHOICE);
  const balanceOwed = choiceIs(source.balanceStatus, 'Requested');
  const signUrl = httpsOnHost(source.bookingFormLink, FILLOUT_HOST) ?? httpsOnHost(source.bookingFormUrlUsed, FILLOUT_HOST);
  const depositUrl = httpsOnHost(source.depositInvoiceLink, XERO_INVOICE_HOST);
  const finalUrl = httpsOnHost(source.finalInvoiceLink, XERO_INVOICE_HOST);
  const payUrl = !depositPaid ? (depositUrl ?? finalUrl) : balanceOwed ? finalUrl : null;

  return hireStepFromFacts({
    signed,
    signUrl,
    paymentOutstanding: !depositPaid || balanceOwed,
    payUrl,
  });
}

export function hireStepFromFacts(facts: {
  signed: boolean | null;
  signUrl: string | null;
  paymentOutstanding: boolean | null;
  payUrl: string | null;
}): HireStep {
  if (facts.signed == null || facts.paymentOutstanding == null) return neutralHireStep();

  if (!facts.signed) {
    const actions: HireAction[] = [];
    if (facts.signUrl) actions.push({ label: 'Sign hire terms', href: facts.signUrl });
    const showPay = facts.paymentOutstanding && !!facts.payUrl;
    if (showPay && facts.payUrl) actions.push({ label: 'Pay now', href: facts.payUrl });
    const signing = facts.signUrl ? '' : ' Your signing link is in the email from Stomp Sphere.';
    const paying = showPay ? ' A payment is still due.' : '';
    return {
      kind: showPay ? 'both' : 'sign',
      title: showPay ? 'Sign and pay' : 'Sign',
      body: `Your hire terms are not signed yet.${signing}${paying}`,
      actions,
    };
  }

  if (facts.paymentOutstanding) {
    return {
      kind: 'pay',
      title: 'Pay',
      body: facts.payUrl
        ? 'A payment is still due.'
        : 'A payment is still due. Your payment link is in the email from Stomp Sphere.',
      actions: facts.payUrl ? [{ label: 'Pay now', href: facts.payUrl }] : [],
    };
  }

  return {
    kind: 'ready',
    title: 'All set',
    body: 'Your hire terms are signed and nothing is left to pay.',
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
