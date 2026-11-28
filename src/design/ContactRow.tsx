export const STOMP_EMAIL = 'info@stompsphere.com.au';
export const STOMP_PHONE = '0412 427 633';
export const STOMP_PHONE_HREF = 'tel:+61412427633';

/** Email and phone. Used when the hire step cannot offer a link, and in the footer. */
export function ContactRow() {
  return (
    <p className="contact-row">
      <a href={`mailto:${STOMP_EMAIL}`}>{STOMP_EMAIL}</a>
      <a href={STOMP_PHONE_HREF}>{STOMP_PHONE}</a>
    </p>
  );
}
