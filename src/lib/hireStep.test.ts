import { describe, expect, it } from 'vitest';
import {
  CONTRACT_SIGNED_CHOICE,
  DEPOSIT_PAID_CHOICE,
  deriveHireStep,
  hireStepFromFacts,
  type HireSources,
  httpsOnHost,
} from './hireStep';

const FILLOUT = 'https://forms.fillout.com/t/hire-terms';
const BOOKING_FORM = 'https://forms.fillout.com/t/booking-form';
const DEPOSIT = 'https://in.xero.com/invoice/deposit';
const FINAL = 'https://in.xero.com/invoice/final';
const STAFF = 'https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=staff';

function source(overrides: Partial<HireSources> = {}): HireSources {
  return {
    leadUnavailable: false,
    contractStatus: null,
    bookingFormUrlUsed: null,
    depositInvoiceLink: null,
    finalInvoiceLink: null,
    depositStatus: null,
    balanceStatus: null,
    termsAccepted: null,
    bookingFormLink: null,
    bookingFormStatus: null,
    ...overrides,
  };
}

describe('hire step rules', () => {
  it('treats terms accepted, a completed lead form, or a signed contract as signed', () => {
    expect(deriveHireStep(source({ termsAccepted: true, depositStatus: 'Paid', balanceStatus: 'Not due' })).kind).toBe(
      'ready',
    );
    expect(
      deriveHireStep(source({ bookingFormStatus: 'Completed', depositStatus: 'Paid', balanceStatus: 'Paid' })).kind,
    ).toBe('ready');
    expect(
      deriveHireStep(source({ contractStatus: 'Signed', depositStatus: { id: DEPOSIT_PAID_CHOICE }, balanceStatus: 'Waived' }))
        .kind,
    ).toBe('ready');
    expect(
      deriveHireStep(
        source({
          contractStatus: { id: CONTRACT_SIGNED_CHOICE, name: 'Something else' },
          depositStatus: 'Paid',
          balanceStatus: null,
        }),
      ).kind,
    ).toBe('ready');
  });

  it('does not treat a blank contract status as signed', () => {
    for (const contractStatus of [null, '', '   ', 'Sent', { id: 'selOther', name: 'Viewed' }]) {
      const step = deriveHireStep(source({ contractStatus, depositStatus: 'Paid', balanceStatus: 'Not due' }));
      expect(step.kind).toBe('sign');
      expect(step.title).toBe('Sign');
    }
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
    expect(step.title).toBe('Sign and pay');
    expect(step.actions).toEqual([
      { label: 'Sign hire terms', href: FILLOUT },
      { label: 'Pay now', href: DEPOSIT },
    ]);
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
    expect(unpaid.actions).toEqual([{ label: 'Pay now', href: FINAL }]);
    expect(JSON.stringify(unpaid)).not.toContain('go.xero.com');

    const onlyFinal = deriveHireStep(
      source({ termsAccepted: true, depositInvoiceLink: null, finalInvoiceLink: FINAL }),
    );
    expect(onlyFinal.actions).toEqual([{ label: 'Pay now', href: FINAL }]);

    const balance = deriveHireStep(
      source({
        contractStatus: 'Signed',
        depositStatus: 'Paid',
        balanceStatus: 'Requested',
        depositInvoiceLink: DEPOSIT,
        finalInvoiceLink: FINAL,
      }),
    );
    expect(balance.actions).toEqual([{ label: 'Pay now', href: FINAL }]);
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
    expect(step.body).toBe('A payment is still due. Your payment link is in the email from Stomp Sphere.');
    const json = JSON.stringify(step);
    expect(json).not.toContain('go.xero.com');
    expect(json).not.toContain('in.xero.com');
    expect(json).not.toMatch(/[—–]| - /);
  });

  it('is All set only when signed, the deposit is Paid, and no balance is Requested', () => {
    const ready = deriveHireStep(source({ termsAccepted: true, depositStatus: 'Paid', balanceStatus: 'Not due' }));
    expect(ready).toMatchObject({ kind: 'ready', title: 'All set', actions: [] });

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
