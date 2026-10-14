// Sending SMS. Every provider has the same shape:  { name, send(toPhone, message) }.
// To plug in a real Ethiopian SMS gateway later, add a provider file and register it below.
import { config } from '../../config.js';
import { db } from '../../db/knex.js';
import { renderSms } from './templates.js';
import { consoleProvider } from './consoleProvider.js';

const providers = {
  console: consoleProvider,
  // afromessage: afroMessageProvider,   <- example of a future provider
};

function provider() {
  const p = providers[config.smsProvider];
  if (!p) throw new Error(`Unknown SMS_PROVIDER "${config.smsProvider}"`);
  return p;
}

/** Send a templated SMS. Never throws: SMS problems must not break orders. Every attempt is logged. */
export async function sendSms({ to, template, vars, lang = 'en' }) {
  const message = renderSms(template, vars, lang);
  const p = provider();
  let status = 'sent';
  let error = null;
  try {
    await p.send(to, message);
  } catch (err) {
    status = 'failed';
    error = String(err.message || err).slice(0, 255);
  }
  try {
    await db('sms_log').insert({ to_phone: to, template, message, provider: p.name, status, error });
  } catch (err) {
    console.error('Could not write SMS log', err);
  }
  return { status, message };
}
