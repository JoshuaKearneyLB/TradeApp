import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function createConnectedAccount(): Promise<string> {
  const account = await stripe.accounts.create({ type: 'express' });
  return account.id;
}

export async function createOnboardingLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string,
): Promise<string> {
  const link = await stripe.accountLinks.create({
    account: accountId,
    return_url: returnUrl,
    refresh_url: refreshUrl,
    type: 'account_onboarding',
  });
  return link.url;
}

export async function getAccount(accountId: string): Promise<Stripe.Account> {
  return stripe.accounts.retrieve(accountId);
}

export async function createPaymentIntent(
  amountPence: number,
  customerEmail: string,
  connectedAccountId: string,
  platformFeePence: number,
  jobId: string,
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.create(
    {
      amount: amountPence,
      currency: 'gbp',
      receipt_email: customerEmail,
      application_fee_amount: platformFeePence,
      transfer_data: { destination: connectedAccountId },
      // PAY-NEW-02: bind the intent to the job so confirmPayment/webhook can
      // authoritatively reconcile a charge back to the job that created it.
      metadata: { jobId },
    },
    {
      // PAY-NEW-03: idempotency key prevents duplicate intents/charges if the
      // client retries the create call (network blip, double-click, etc.).
      idempotencyKey: `pi_job_${jobId}`,
    },
  );
}

/**
 * PAY-NEW-01: Authoritatively fetch a PaymentIntent from Stripe so the server
 * can verify status/amount/metadata before recording a payment as succeeded.
 * Never trust a client-supplied paymentIntentId without this check.
 */
export async function retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

export function constructWebhookEvent(
  payload: Buffer,
  sig: string,
  secret: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, sig, secret);
}
