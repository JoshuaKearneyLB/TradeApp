import { Request, Response } from 'express';
import { query } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { getIO } from '../socket/index.js';
import { NotificationType } from '@tradeapp/shared';
import { sendPaymentReceivedEmail } from '../services/email.service.js';
import {
  createConnectedAccount,
  createOnboardingLink,
  getAccount,
  createPaymentIntent as stripeCreatePaymentIntent,
  constructWebhookEvent,
} from '../services/stripe.service.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT ?? 10);
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

export async function onboardProfessional(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    const profileResult = await query(
      'SELECT stripe_account_id FROM professional_profiles WHERE user_id = $1',
      [userId],
    );

    let accountId: string;
    if (profileResult.rows[0]?.stripe_account_id) {
      accountId = profileResult.rows[0].stripe_account_id;
    } else {
      accountId = await createConnectedAccount();
      await query(
        'UPDATE professional_profiles SET stripe_account_id = $1 WHERE user_id = $2',
        [accountId, userId],
      );
    }

    const returnUrl = `${FRONTEND_URL}/edit-profile?stripe=success`;
    const refreshUrl = `${FRONTEND_URL}/edit-profile?stripe=refresh`;
    const url = await createOnboardingLink(accountId, returnUrl, refreshUrl);

    res.json({ url });
  } catch (error) {
    console.error('Onboard professional error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getOnboardingStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    const profileResult = await query(
      'SELECT stripe_account_id FROM professional_profiles WHERE user_id = $1',
      [userId],
    );

    const accountId = profileResult.rows[0]?.stripe_account_id;
    if (!accountId) {
      res.json({ complete: false });
      return;
    }

    const account = await getAccount(accountId);
    const complete = account.details_submitted === true;

    await query(
      'UPDATE professional_profiles SET stripe_onboarding_complete = $1 WHERE user_id = $2',
      [complete, userId],
    );

    res.json({ complete });
  } catch (error) {
    console.error('Get onboarding status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createPaymentIntent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { id: jobId } = req.params;

    if (!UUID_RE.test(jobId)) {
      res.status(400).json({ error: 'Invalid job ID' });
      return;
    }

    const jobResult = await query(
      `SELECT j.*, u.email AS customer_email,
              pp.stripe_account_id, pp.stripe_onboarding_complete
       FROM jobs j
       JOIN users u ON u.id = j.customer_id
       JOIN professional_profiles pp ON pp.user_id = j.professional_id
       WHERE j.id = $1`,
      [jobId],
    );

    if (jobResult.rows.length === 0) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const job = jobResult.rows[0];

    if (job.customer_id !== userId) {
      res.status(403).json({ error: 'Only the job owner can initiate payment' });
      return;
    }

    if (job.status !== 'completed') {
      res.status(400).json({ error: 'Job must be completed before payment' });
      return;
    }

    if (!job.estimated_budget) {
      res.status(400).json({ error: 'Job has no budget set' });
      return;
    }

    if (!job.stripe_account_id || !job.stripe_onboarding_complete) {
      res.status(400).json({ error: 'Professional has not connected their bank account yet' });
      return;
    }

    // Check not already paid
    const existingPayment = await query(
      `SELECT id, status FROM payments WHERE job_id = $1`,
      [jobId],
    );
    if (existingPayment.rows.length > 0 && existingPayment.rows[0].status === 'succeeded') {
      res.status(400).json({ error: 'Job has already been paid' });
      return;
    }

    const amountPence = Math.round(Number(job.estimated_budget) * 100);
    const platformFeePence = Math.round(amountPence * (PLATFORM_FEE_PERCENT / 100));

    const intent = await stripeCreatePaymentIntent(
      amountPence,
      job.customer_email,
      job.stripe_account_id,
      platformFeePence,
    );

    res.json({ clientSecret: intent.client_secret, amount: amountPence });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function confirmPayment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { id: jobId } = req.params;
    const { paymentIntentId } = req.body;

    if (!UUID_RE.test(jobId)) {
      res.status(400).json({ error: 'Invalid job ID' });
      return;
    }

    const jobResult = await query(
      `SELECT j.*, pp.stripe_account_id
       FROM jobs j
       LEFT JOIN professional_profiles pp ON pp.user_id = j.professional_id
       WHERE j.id = $1`,
      [jobId],
    );

    if (jobResult.rows.length === 0) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const job = jobResult.rows[0];

    if (job.customer_id !== userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const amountPence = Math.round(Number(job.estimated_budget) * 100);
    const platformFeePence = Math.round(amountPence * (PLATFORM_FEE_PERCENT / 100));
    const payoutPence = amountPence - platformFeePence;

    await query(
      `INSERT INTO payments (job_id, customer_id, professional_id, amount, platform_fee, professional_payout, stripe_payment_intent_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'succeeded')
       ON CONFLICT (stripe_payment_intent_id) DO UPDATE SET status = 'succeeded', updated_at = NOW()`,
      [
        jobId,
        job.customer_id,
        job.professional_id,
        Number(job.estimated_budget),
        +(platformFeePence / 100).toFixed(2),
        +(payoutPence / 100).toFixed(2),
        paymentIntentId,
      ],
    );

    // Notify the professional
    const notifResult = await query(
      `INSERT INTO notifications (user_id, type, title, content, related_job_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [
        job.professional_id,
        NotificationType.PAYMENT_RECEIVED,
        'Payment received',
        `You have been paid £${Number(job.estimated_budget).toFixed(2)} for: ${job.title}`,
        jobId,
      ],
    );

    const notif = notifResult.rows[0];
    getIO().to(`user:${job.professional_id}`).emit('new_notification', {
      notificationId: notif.id,
      type: NotificationType.PAYMENT_RECEIVED,
      title: 'Payment received',
      content: `You have been paid £${Number(job.estimated_budget).toFixed(2)} for: ${job.title}`,
      relatedJobId: jobId,
      createdAt: notif.created_at.toISOString(),
    });

    // Email the professional
    const proUserResult = await query('SELECT email, first_name, last_name FROM users WHERE id = $1', [job.professional_id]);
    if (proUserResult.rows.length > 0) {
      const proUser = proUserResult.rows[0];
      sendPaymentReceivedEmail(
        proUser.email,
        `${proUser.first_name} ${proUser.last_name}`,
        job.title,
        Number(job.estimated_budget),
        jobId,
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getJobPayment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { id: jobId } = req.params;

    if (!UUID_RE.test(jobId)) {
      res.status(400).json({ error: 'Invalid job ID' });
      return;
    }

    // Verify requester is a participant
    const jobResult = await query(
      'SELECT customer_id, professional_id FROM jobs WHERE id = $1',
      [jobId],
    );

    if (jobResult.rows.length === 0) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const job = jobResult.rows[0];
    if (job.customer_id !== userId && job.professional_id !== userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const paymentResult = await query(
      'SELECT * FROM payments WHERE job_id = $1',
      [jobId],
    );

    if (paymentResult.rows.length === 0) {
      res.json(null);
      return;
    }

    const p = paymentResult.rows[0];
    res.json({
      id: p.id,
      jobId: p.job_id,
      amount: p.amount,
      platformFee: p.platform_fee,
      professionalPayout: p.professional_payout,
      status: p.status,
      createdAt: p.created_at,
    });
  } catch (error) {
    console.error('Get job payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'] as string;
  const secret = process.env.STRIPE_WEBHOOK_SECRET as string;

  let event;
  try {
    event = constructWebhookEvent(req.body as Buffer, sig, secret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as { id: string };
      await query(
        `UPDATE payments SET status = 'succeeded', updated_at = NOW()
         WHERE stripe_payment_intent_id = $1`,
        [intent.id],
      );
    } else if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as { id: string };
      await query(
        `UPDATE payments SET status = 'failed', updated_at = NOW()
         WHERE stripe_payment_intent_id = $1`,
        [intent.id],
      );
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
