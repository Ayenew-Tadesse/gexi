// SMS wording. Add Amharic text under "am"; any missing Amharic message falls back to English.
// {{name}} placeholders are filled in when the message is sent. Keep messages short (SMS = 160 characters).

export const SMS_TEMPLATES = {
  en: {
    otp: 'Your Gexi login code is {{code}}. It expires in 5 minutes. Do not share it.',
    order_confirmed: 'Gexi: Payment received for order {{orderNumber}} ({{total}} ETB). We will text you when it is ready for pickup.',
    vendor_dropoff: 'Gexi: Please bring {{items}} (order {{orderNumber}}) to our warehouse by {{deadline}}.',
    ready_for_pickup: 'Gexi: Order {{orderNumber}} is ready! Pickup code: {{code}}. Collect at {{location}} by {{deadline}}.',
    pickup_reminder: 'Gexi reminder: collect order {{orderNumber}} by {{deadline}}. Pickup code: {{code}}.',
    item_refunded: 'Gexi: Sorry, {{item}} (order {{orderNumber}}) could not be delivered. {{amount}} ETB will be refunded.',
    order_cancelled: 'Gexi: Order {{orderNumber}} was cancelled. {{amount}} ETB will be refunded.',
    order_expired: 'Gexi: Order {{orderNumber}} was not collected in time and was cancelled. {{amount}} ETB will be refunded.',
  },
  am: {
    // Translations go here, e.g.  otp: 'የGexi መግቢያ ኮድዎ {{code}} ነው።',
  },
};

export function renderSms(template, vars = {}, lang = 'en') {
  const text = SMS_TEMPLATES[lang]?.[template] || SMS_TEMPLATES.en[template];
  if (!text) throw new Error(`Unknown SMS template: ${template}`);
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] ?? '').toString());
}
