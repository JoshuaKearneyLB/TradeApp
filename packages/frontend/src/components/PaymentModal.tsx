import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { confirmPayment } from '../services/paymentService';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

const PLATFORM_FEE_PERCENT = 10;

interface PaymentFormProps {
  jobId: string;
  jobTitle: string;
  amountPence: number;
  onSuccess: () => void;
  onClose: () => void;
}

function PaymentForm({ jobId, jobTitle, amountPence, onSuccess, onClose }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const amountGbp = (amountPence / 100).toFixed(2);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed. Please try again.');
      setLoading(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      try {
        await confirmPayment(jobId, paymentIntent.id);
        onSuccess();
      } catch {
        setError('Payment processed but failed to save. Please contact support.');
      }
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>
          Paying for
        </div>
        <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 16 }}>
          {jobTitle}
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--color-bg)', borderRadius: 'var(--radius)',
          padding: '12px 16px', marginBottom: 20,
          border: '1px solid var(--color-border)',
        }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Total</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)' }}>
            £{amountGbp}
          </span>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 20 }}>
          Includes {PLATFORM_FEE_PERCENT}% platform service fee
        </p>
      </div>

      <PaymentElement />

      {error && (
        <div style={{
          marginTop: 16, padding: '10px 14px',
          background: '#fef2f2', border: '1px solid #fca5a5',
          borderRadius: 'var(--radius)', color: '#dc2626',
          fontSize: '0.85rem',
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="btn btn-outline btn-sm"
          style={{ flex: 1 }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !stripe}
          className="btn btn-primary btn-sm"
          style={{ flex: 2 }}
        >
          {loading ? 'Processing…' : `Pay £${amountGbp}`}
        </button>
      </div>
    </form>
  );
}

interface PaymentModalProps {
  jobId: string;
  jobTitle: string;
  clientSecret: string;
  amountPence: number;
  onSuccess: () => void;
  onClose: () => void;
}

export function PaymentModal({ jobId, jobTitle, clientSecret, amountPence, onSuccess, onClose }: PaymentModalProps) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
        padding: '32px 28px', width: '100%', maxWidth: 460,
        boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
        border: '1px solid var(--color-border)',
      }}>
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.2rem' }}>
            Complete payment
          </h3>
          <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Secure payment powered by Stripe
          </p>
        </div>

        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: 'flat',
              variables: {
                colorPrimary: '#22c55e',
                colorBackground: '#ffffff',
                colorText: '#1a2e1a',
                colorDanger: '#dc2626',
                borderRadius: '8px',
                fontFamily: 'system-ui, sans-serif',
              },
            },
          }}
        >
          <PaymentForm
            jobId={jobId}
            jobTitle={jobTitle}
            amountPence={amountPence}
            onSuccess={onSuccess}
            onClose={onClose}
          />
        </Elements>
      </div>
    </div>
  );
}
