// All settings that come from the environment (.env file) live here.
import { fileURLToPath } from 'node:url';
const env = process.env;
const isTest = env.NODE_ENV === 'test';

export const config = {
  isProduction: env.NODE_ENV === 'production',
  isTest,
  port: Number(env.PORT || 4000),
  databaseUrl: isTest
    ? env.DATABASE_URL_TEST || 'postgres://gexi:gexi@localhost:5432/gexi_test'
    : env.DATABASE_URL || 'postgres://gexi:gexi@localhost:5432/gexi',
  appUrl: env.APP_URL || 'http://localhost:5173',
  apiPublicUrl: env.API_PUBLIC_URL || '',
  jwtSecret: env.JWT_SECRET || (isTest ? 'test-secret' : ''),
  paymentProvider: isTest ? 'mock' : env.PAYMENT_PROVIDER || (env.CHAPA_SECRET_KEY ? 'chapa' : 'mock'),
  chapaSecretKey: env.CHAPA_SECRET_KEY || '',
  chapaWebhookSecret: env.CHAPA_WEBHOOK_SECRET || '',
  smsProvider: env.SMS_PROVIDER || 'console',
  devTools: env.NODE_ENV !== 'production' && (isTest || env.ENABLE_DEV_TOOLS === 'true'),
  uploadDir: env.UPLOAD_DIR || fileURLToPath(new URL('../uploads/', import.meta.url)),
};

if (!config.jwtSecret) {
  throw new Error('JWT_SECRET is missing. Copy .env.example to .env and set it.');
}
if (config.isProduction && config.jwtSecret.startsWith('change-me')) {
  throw new Error('JWT_SECRET still has the example value. Set a long random value in production.');
}
if (config.isProduction && config.paymentProvider !== 'chapa') {
  throw new Error('In production PAYMENT_PROVIDER must be "chapa" (the mock payment page is for development only).');
}
if (config.paymentProvider === 'chapa' && !config.chapaSecretKey) {
  throw new Error('PAYMENT_PROVIDER is "chapa" but CHAPA_SECRET_KEY is empty. Add your Chapa test key to .env.');
}
