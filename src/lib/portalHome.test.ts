import { describe, expect, it } from 'vitest';
import { createDefaultDesign } from './design';
import { hireStepView, portalTaskList, safeCustomerUrl } from './portalHome';

const SIGN = 'https://example.com/stomp-hire-terms';
const PAY = 'https://example.com/stomp-pay';

describe('hire next step', () => {
  it('shows Sign, with the signing link, when hire terms are unsigned', () => {
    expect(
      hireStepView({ termsSigned: false, signUrl: SIGN, paymentDue: true, payUrl: PAY }),
    ).toEqual({
      kind: 'sign',
      title: 'Sign',
      body: 'Your hire terms are not signed yet.',
      href: SIGN,
      action: 'Sign hire terms',
    });
  });

  it('shows Pay when terms are signed and a payment is due', () => {
    expect(hireStepView({ termsSigned: true, paymentDue: true, payUrl: `  ${PAY}  ` })).toMatchObject({
      kind: 'pay',
      title: 'Pay',
      href: PAY,
      action: 'Pay now',
    });
  });

  it('shows All set only when terms are signed and nothing is due', () => {
    const step = hireStepView({ termsSigned: true, paymentDue: false, signUrl: SIGN, payUrl: PAY });
    expect(step.kind).toBe('ready');
    expect(step.title).toBe('All set');
    expect(step.href).toBeNull();
    expect(step.body).not.toMatch(/[—–]| - /);
  });

  it('does not claim All set when the booking does not say', () => {
    expect(hireStepView({}).kind).toBe('unknown');
    expect(hireStepView({ termsSigned: true }).kind).toBe('unknown');
    expect(hireStepView({ paymentDue: false }).kind).toBe('unknown');
  });

  it('drops links that are not plain https', () => {
    expect(safeCustomerUrl('http://example.com/pay')).toBeNull();
    expect(safeCustomerUrl('javascript:alert(1)')).toBeNull();
    expect(safeCustomerUrl('https://user:secret@example.com/pay')).toBeNull();
    const step = hireStepView({ termsSigned: false, signUrl: 'http://example.com/sign' });
    expect(step.kind).toBe('sign');
    expect(step.href).toBeNull();
    expect(step.action).toBeNull();
    expect(step.body).toContain('signing link is not on this page');
  });

  it('keeps the hire copy free of dash punctuation', () => {
    for (const step of [
      hireStepView({ termsSigned: false, signUrl: SIGN }),
      hireStepView({ termsSigned: true, paymentDue: true, payUrl: PAY }),
      hireStepView({ termsSigned: true, paymentDue: false }),
      hireStepView({}),
    ]) {
      expect(`${step.title} ${step.body} ${step.action ?? ''}`).not.toMatch(/[—–]| - /);
    }
  });
});

describe('portal task list', () => {
  it('starts with nothing done and marks a real choice, a file, and a submit', () => {
    const design = createDefaultDesign({ coupleNames: 'Sam & Alex' });
    expect(portalTaskList(design).map((task) => task.done)).toEqual([false, false, false]);
    design.designs.holding.styleId = 'classic';
    expect(portalTaskList(design)[0].done).toBe(true);
    design.invite = { id: 'file-1', name: 'invite.png', type: 'image/png', size: 12 };
    expect(portalTaskList(design)[1].done).toBe(true);
    design.status = 'submitted';
    expect(portalTaskList(design)[2].done).toBe(true);
  });
});
