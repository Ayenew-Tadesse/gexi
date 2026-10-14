// All settings that come from the environment (.env file) live here.
const env = process.env;
const isTest = env.NODE_ENV === 'test';
// DEMO_MODE=true: an online demo site with the fake payment page, test tools and on-screen SMS codes.
// A banner tells visitors it is a demo. Never use it for the real shop.
const demoMode = env.DEMO_MODE === 'true';

export const config = {
  isProduction: env.NODE_ENV === 'production',
  isTest,
  port: Number(env.PORT || 4000),
  databaseUrl: isTest
    ? env.DATABASE_URL_TEST || 'postgres://gexi:gexi@localhost:5432/gexi_test'
    : env.DATABASE_URL || 'postgres://gexi:gexi@localhost:5432/gexi',
  // Render sets RENDER_EXTERNAL_URL automatically to the site's public address.
  appUrl: env.APP_URL || env.RENDER_EXTERNAL_URL || 'http://localhost:5173',
  apiPublicUrl: env.API_PUBLIC_URL || '',
  jwtSecret: env.JWT_SECRET || (isTest ? 'test-secret' : ''),
  paymentProvider: isTest ? 'mock' : env.PAYMENT_PROVIDER || (env.CHAPA_SECRET_KEY ? 'chapa' : 'mock'),
  chapaSecretKey: env.CHAPA_SECRET_KEY || '',
  chapaWebhookSecret: env.CHAPA_WEBHOOK_SECRET || '',
  smsProvider: env.SMS_PROVIDER || 'console',
  demoMode,
  devTools: demoMode || (env.NODE_ENV !== 'production' && (isTest || env.ENABLE_DEV_TOOLS === 'true')),
};

if (!config.jwtSecret) {
  throw new Error('JWT_SECRET is missing. Copy .env.example to .env and set it.');
}
if (config.isProduction && config.jwtSecret.startsWith('change-me')) {
  throw new Error('JWT_SECRET still has the example value. Set a long random value in production.');
}
if (config.isProduction && !config.demoMode && config.paymentProvider !== 'chapa') {
  throw new Error('In production PAYMENT_PROVIDER must be "chapa" (the mock payment page is only for development or DEMO_MODE=true).');
}
if (config.paymentProvider === 'chapa' && !config.chapaSecretKey) {
  throw new Error('PAYMENT_PROVIDER is "chapa" but CHAPA_SECRET_KEY is empty. Add your Chapa test key to .env.');
}
