import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/knex.js';
import { config } from '../config.js';
import { parse } from '../lib/validate.js';
import { forbidden, notFound } from '../lib/errors.js';
import { requireLogin } from '../middleware/auth.js';
import { confirmPayment, validChapaSignature } from '../services/checkout.js';

const router = Router();

/** The return page calls this after the customer comes back from the payment screen. */
router.get('/verify/:txRef', requireLogin, async (req, res) => {
  const payment = await db('payments').join('orders', 'orders.id', 'payments.order_id')
    .where('payments.tx_ref', req.params.txRef).select('orders.customer_id').first();
  if (!payment || (payment.customer_id !== req.user.id && req.user.role !== 'admin')) throw notFound('Payment not found.');
  res.json(await confirmPayment(req.params.txRef));
});

/** Chapa calls this when a payment finishes. We double-check with Chapa before trusting it. */
router.post('/chapa/webhook', async (req, res) => {
  if (!validChapaSignature(req.rawBody, req.headers)) return res.status(401).json({ ok: false });
  const txRef = req.body?.tx_ref || req.body?.trx_ref;
  if (txRef) {
    try {
      await confirmPayment(String(txRef));
    } catch (err) {
      if (err.status !== 404) throw err;
    }
  }
  res.json({ ok: true });
});

/** Fake payment screen (development only): mark the payment as paid or failed. */
router.post('/mock/complete', async (req, res) => {
  if (config.paymentProvider !== 'mock' || !config.devTools) throw forbidden('Mock payments are disabled.');
  const { tx_ref: txRef, outcome } = parse(z.object({ tx_ref: z.string(), outcome: z.enum(['success', 'failed']) }), req.body);
  const payment = await db('payments').where({ tx_ref: txRef }).first();
  if (!payment) throw notFound('Payment not found.');
  await db('payments').where({ id: payment.id }).update({ raw_response: { mock_status: outcome } });
  res.json({ ok: true, amount_santim: payment.amount_santim });
});

router.get('/mock/:txRef', async (req, res) => {
  if (config.paymentProvider !== 'mock' || !config.devTools) throw forbidden('Mock payments are disabled.');
  const payment = await db('payments').join('orders', 'orders.id', 'payments.order_id')
    .where('payments.tx_ref', req.params.txRef).select('payments.amount_santim', 'payments.status', 'orders.order_number').first();
  if (!payment) throw notFound('Payment not found.');
  res.json(payment);
});

export default router;
