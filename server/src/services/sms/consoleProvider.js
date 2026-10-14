// Development SMS provider: prints the message in the terminal instead of sending it.
import { config } from '../../config.js';

export const consoleProvider = {
  name: 'console',
  async send(to, message) {
    if (!config.isTest && !process.env.SMS_CONSOLE_QUIET) console.log(`\n📱 SMS to ${to}:\n   ${message}\n`);
  },
};
