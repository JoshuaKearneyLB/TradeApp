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
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.create({
    amount: amountPence,
    currency: 'gbp',
    receipt_email: customerEmail,
    application_fee_amount: platformFeePence,
    transfer_data: { destination: connectedAccountId },
  });
}

export function constructWebhookEvent(
  payload: Buffer,
  sig: string,
  secret: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, sig, secret);
}
