import { describe, expect, it } from 'vitest';
import {
  DEPOSIT_PAID_CHOICE,
  deriveHireStep,
  hireStepFromFacts,
  type HireSources,
  httpsOnHost,
  withDesignProgress,
} from './hireStep';

const FILLOUT = 'https://forms.fillout.com/t/hire-terms';
const BOOKING_FORM = 'https://forms.fillout.com/t/booking-form';
const DEPOSIT = 'https://in.xero.com/invoice/deposit';
const FINAL = 'https://in.xero.com/invoice/final';
const STAFF = 'https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=staff';

function source(overrides: Partial<HireSources> = {}): HireSources {
  return {
    leadUnavailable: false,
    leadStatus: 'Booked',
    contractStatus: null,
    bookingFormUrlUsed: null,
    depositInvoiceLink: null,
    finalInvoiceLink: null,
    depositStatus: null,
    balanceStatus: null,
    termsAccepted: null,
    leadId: null,
    bookingFormLink: null,
    bookingFormStatus: null,
    ...overrides,
  };
}

describe('hire step rules', () => {
  it('shows Sign when a booked lead has not accepted the terms', () => {
    const step = deriveHireStep(
      source({
        leadStatus: 'Booked',
        termsAccepted: false,
        bookingFormLink: FILLOUT,
        depositStatus: 'Paid',
        balanceStatus: 'Not due',
      }),
    );
    expect(step.kind).toBe('sign');
    expect(step.title).toBe('Sign');
    expect(step.actions).toEqual([{ label: 'Sign hire terms', href: FILLOUT }]);
  });

  it('shows All set when a booked lead has accepted the terms, the deposit is Paid, and no balance is Requested', () => {
    const step = deriveHireStep(
      source({ leadStatus: 'Booked', termsAccepted: true, depositStatus: 'Paid', balanceStatus: 'Not due' }),
    );
    expect(step).toMatchObject({
      kind: 'ready',
      title: 'All set',
      signedNote: 'Hire terms signed',
      actions: [],
    });
    expect(step.actions.map((action) => action.label)).not.toContain('Sign hire terms');
  });

  it('shows the signed line and Pay when terms are accepted and a payment is due', () => {
    const step = deriveHireStep(
      source({
        leadStatus: 'Booked',
        termsAccepted: true,
        depositStatus: 'Paid',
        balanceStatus: 'Requested',
        finalInvoiceLink: FINAL,
      }),
    );
    expect(step.kind).toBe('pay');
    expect(step.title).toBe('Pay the balance');
    expect(step.signedNote).toBe('Hire terms signed');
    expect(step.actions).toEqual([{ label: 'Pay the balance', href: FINAL }]);
    expect(step.next).toBe('After you pay, come back to this page.');
    expect(step.actions.map((action) => action.label)).not.toContain('Sign hire terms');
    expect(`${step.signedNote} ${step.body}`).not.toMatch(/[—–]/);
  });

  it('builds the signing URL from the lead id when the form link is missing', () => {
    const leadId = 'recFAKELEAD000001';
    const step = deriveHireStep(
      source({
        termsAccepted: false,
        leadId,
        bookingFormLink: null,
        bookingFormUrlUsed: BOOKING_FORM,
        depositStatus: 'Paid',
        balanceStatus: 'Not due',
      }),
    );
    expect(step.actions).toEqual([
      { label: 'Sign hire terms', href: `https://forms.fillout.com/t/jYwCSWM41Eus?id=${leadId}` },
    ]);
    expect(step.signedNote).toBeNull();
  });

  it('builds no signing link from a bad lead id', () => {
    const step = deriveHireStep(
      source({
        termsAccepted: false,
        leadId: 'not-a-record',
        bookingFormLink: null,
        bookingFormUrlUsed: null,
        depositStatus: 'Paid',
        balanceStatus: 'Not due',
      }),
    );
    expect(step.kind).toBe('sign');
    expect(step.actions).toEqual([]);
    expect(step.body).toContain('signing link is in the email from Stomp Sphere');

    const fallback = deriveHireStep(
      source({
        termsAccepted: false,
        leadId: 'recTOO_SHORT',
        bookingFormLink: 'https://go.xero.com/staff-form',
        bookingFormUrlUsed: BOOKING_FORM,
        depositStatus: 'Paid',
        balanceStatus: 'Not due',
      }),
    );
    expect(fallback.actions).toEqual([{ label: 'Sign hire terms', href: BOOKING_FORM }]);
  });

  it('shows no Sign or Pay button when the lead is Lost', () => {
    const step = deriveHireStep(
      source({
        leadStatus: 'Lost',
        termsAccepted: true,
        bookingFormLink: FILLOUT,
        depositStatus: 'Requested',
        depositInvoiceLink: DEPOSIT,
        finalInvoiceLink: FINAL,
      }),
    );
    expect(step.kind).toBe('lost');
    expect(step.title).toBe('Please get in touch');
    expect(step.body).toBe('We need to talk about this booking before you plan the floor.');
    expect(step.actions).toEqual([]);
    expect(step.signedNote).toBeNull();
    expect(JSON.stringify(step)).not.toContain('forms.fillout.com');
    expect(JSON.stringify(step)).not.toContain('in.xero.com');
    expect(step.body).not.toMatch(/[—–]/);
  });

  it('still shows Sign when the form is Completed but Terms accepted is unticked', () => {
    const step = deriveHireStep(
      source({
        leadStatus: 'Booked',
        termsAccepted: false,
        bookingFormStatus: 'Completed',
        contractStatus: 'Signed',
        bookingFormLink: FILLOUT,
        depositStatus: { id: DEPOSIT_PAID_CHOICE },
        balanceStatus: 'Paid',
      }),
    );
    expect(step.kind).toBe('sign');
    expect(step.actions.map((action) => action.label)).toEqual(['Sign hire terms']);
  });

  it('uses the lead form link, then the booking form URL, and only on forms.fillout.com', () => {
    const preferred = deriveHireStep(
      source({ bookingFormLink: FILLOUT, bookingFormUrlUsed: BOOKING_FORM, depositStatus: 'Paid', balanceStatus: 'Not due' }),
    );
    expect(preferred.actions).toEqual([{ label: 'Sign hire terms', href: FILLOUT }]);

    const fallback = deriveHireStep(
      source({
        bookingFormLink: STAFF,
        bookingFormUrlUsed: `  ${BOOKING_FORM}  `,
        depositStatus: 'Paid',
        balanceStatus: 'Not due',
      }),
    );
    expect(fallback.actions).toEqual([{ label: 'Sign hire terms', href: BOOKING_FORM }]);

    const rejected = deriveHireStep(
      source({
        bookingFormLink: 'http://forms.fillout.com/t/nope',
        bookingFormUrlUsed: 'https://user:secret@forms.fillout.com/t/nope',
        depositStatus: 'Paid',
        balanceStatus: 'Not due',
      }),
    );
    expect(rejected.actions).toEqual([]);
    expect(rejected.body).toContain('signing link is in the email from Stomp Sphere');
    expect(JSON.stringify(rejected)).not.toContain('secret');
  });

  it('shows Sign and Pay when terms are unsigned and a safe pay link exists', () => {
    const step = deriveHireStep(
      source({
        bookingFormLink: FILLOUT,
        depositStatus: 'Requested',
        balanceStatus: 'Not due',
        depositInvoiceLink: DEPOSIT,
        finalInvoiceLink: FINAL,
      }),
    );
    expect(step.kind).toBe('both');
    expect(step.title).toBe('Sign');
    expect(step.actions).toEqual([
      { label: 'Sign hire terms', href: FILLOUT },
      { label: 'Pay your deposit', href: DEPOSIT },
    ]);
    expect(step.next).toBe('After you sign or pay, come back to this page.');
    expect(step.body).not.toMatch(/[—–]| - /);
  });

  it('uses the deposit invoice until it is paid, then the final invoice when a balance is requested', () => {
    const unpaid = deriveHireStep(
      source({
        termsAccepted: true,
        depositStatus: 'Requested',
        depositInvoiceLink: STAFF,
        finalInvoiceLink: FINAL,
      }),
    );
    expect(unpaid.kind).toBe('pay');
    expect(unpaid.actions).toEqual([{ label: 'Pay your deposit', href: FINAL }]);
    expect(JSON.stringify(unpaid)).not.toContain('go.xero.com');

    const onlyFinal = deriveHireStep(
      source({ termsAccepted: true, depositInvoiceLink: null, finalInvoiceLink: FINAL }),
    );
    expect(onlyFinal.actions).toEqual([{ label: 'Pay your deposit', href: FINAL }]);

    const balance = deriveHireStep(
      source({
        termsAccepted: true,
        depositStatus: 'Paid',
        balanceStatus: 'Requested',
        depositInvoiceLink: DEPOSIT,
        finalInvoiceLink: FINAL,
      }),
    );
    expect(balance.actions).toEqual([{ label: 'Pay the balance', href: FINAL }]);
    expect(JSON.stringify(balance)).not.toContain(DEPOSIT);
  });

  it('rejects go.xero.com and says the payment link is in the email when nothing safe remains', () => {
    expect(httpsOnHost(STAFF, 'in.xero.com')).toBeNull();
    expect(httpsOnHost('https://in.xero.com.evil.com/invoice', 'in.xero.com')).toBeNull();
    const step = deriveHireStep(
      source({
        termsAccepted: true,
        depositStatus: 'Paid',
        balanceStatus: 'Requested',
        depositInvoiceLink: DEPOSIT,
        finalInvoiceLink: STAFF,
        bookingFormUrlUsed: 'https://go.xero.com/app/!staff',
      }),
    );
    expect(step.kind).toBe('pay');
    expect(step.actions).toEqual([]);
    expect(step.body).toBe('Pay the balance. Your payment link is in the email from Stomp Sphere.');
    expect(step.signedNote).toBe('Hire terms signed');
    const json = JSON.stringify(step);
    expect(json).not.toContain('go.xero.com');
    expect(json).not.toContain('in.xero.com');
    expect(json).not.toMatch(/[—–]| - /);
  });

  it('is All set only when signed, the deposit is Paid, and no balance is Requested', () => {
    const ready = deriveHireStep(source({ termsAccepted: true, depositStatus: 'Paid', balanceStatus: 'Not due' }));
    expect(ready).toMatchObject({ kind: 'ready', title: 'All set', signedNote: 'Hire terms signed', actions: [] });
    expect(withDesignProgress(ready, false)).toMatchObject({
      kind: 'send',
      title: 'Send your design',
      signedNote: 'Hire terms signed',
    });
    expect(withDesignProgress(ready, true).title).toBe('All set');

    const owed = deriveHireStep(
      source({ termsAccepted: true, depositStatus: 'Paid', balanceStatus: 'Requested', finalInvoiceLink: FINAL }),
    );
    expect(owed.kind).toBe('pay');

    const unpaid = deriveHireStep(source({ termsAccepted: true, depositStatus: null, balanceStatus: 'Not due' }));
    expect(unpaid.kind).toBe('pay');
    expect(unpaid.actions).toEqual([]);
  });

  it('stays on the neutral copy when the lead cannot be read, and does not leak staff links', () => {
    const step = deriveHireStep(
      source({
        leadUnavailable: true,
        termsAccepted: true,
        contractStatus: 'Signed',
        depositStatus: 'Paid',
        bookingFormLink: FILLOUT,
        depositInvoiceLink: STAFF,
        finalInvoiceLink: FINAL,
        bookingFormUrlUsed: 'https://go.xero.com/staff-only',
      }),
    );
    expect(step.kind).toBe('unknown');
    expect(step.actions).toEqual([]);
    const json = JSON.stringify(step);
    expect(json).not.toContain('go.xero.com');
    expect(json).not.toContain('forms.fillout.com');
    expect(json).not.toContain('in.xero.com');
    expect(json).not.toContain('Signed');
  });
});

describe('unsigned with a payment due and no safe pay link', () => {
  it('asks to sign and points to the email for payment', () => {
    const step = hireStepFromFacts({
      signed: false,
      signUrl: 'https://forms.fillout.com/t/abc',
      paymentOutstanding: true,
      payUrl: null,
    });
    expect(step.kind).toBe('sign');
    expect(step.actions.map((a) => a.label)).toEqual(['Sign hire terms']);
    expect(step.body).toContain('Your payment link is in the email from Stomp Sphere.');
  });
});
