import { useEffect, useRef, useState } from 'react';
import type { OtpStatus, OtpVerificationProps } from '../../types/device';
import { sendOtp, verifyOtp } from '../../api/trustedDevices';

// ── Constants ─────────────────────────────────────────────────────────────────

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds

// ── Small inline icons ────────────────────────────────────────────────────────

function IconShield() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6"  y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OtpVerificationModal({
  isOpen,
  onClose,
  onSuccess,
  email,
}: OtpVerificationProps) {
  // OTP digit array — each slot holds one character
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [trustDevice, setTrustDevice] = useState(false);
  const [status, setStatus] = useState<OtpStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [isSending, setIsSending] = useState(false);

  // One ref per input box for programmatic focus control
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Resend countdown timer ──────────────────────────────────
  useEffect(() => {
    if (!isOpen || countdown === 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [isOpen, countdown]);

  // ── Auto-send OTP when the modal opens ─────────────────────
  useEffect(() => {
    if (!isOpen) return;

    // Reset state when the modal opens fresh
    (() => {
      setDigits(Array(OTP_LENGTH).fill(''));
      setStatus('idle');
      setError(null);
      setAttemptsLeft(3);
      setCountdown(RESEND_COOLDOWN);
    })();

    sendOtp({ email }).catch(() => {
      // Non-fatal — user can click Resend if it didn't arrive
      console.warn('[OTP] Initial send failed, user can retry.');
    });

    // Focus the first box after the modal animates in
    const t = setTimeout(() => inputRefs.current[0]?.focus(), 150);
    return () => clearTimeout(t);
  }, [isOpen, email]);

  // ── Auto-navigate after success ─────────────────────────────
  useEffect(() => {
    if (status !== 'success') return;
    const t = setTimeout(onSuccess, 1800);
    return () => clearTimeout(t);
  }, [status, onSuccess]);

  // Don't render anything when closed
  if (!isOpen) return null;

  // ── OTP input handlers ──────────────────────────────────────

  const handleChange = (index: number, value: string) => {
    // Allow only single digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError(null);

    // Auto-advance focus to next box when a digit is entered
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      // Move back to previous box on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    const next = [...digits];
    pasted.split('').forEach((char, i) => { next[i] = char; });
    setDigits(next);
    // Focus on the box after the last pasted digit
    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  // ── Submit ──────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length !== OTP_LENGTH) return;

    setStatus('loading');
    setError(null);

    try {
      const result = await verifyOtp({ code, trustDevice });

      if (result.success) {
        setStatus('success');
      } else {
        setStatus('error');
        setError(result.message);
        setAttemptsLeft((prev) => prev - 1);
        // Clear the boxes so the user can type a fresh code
        setDigits(Array(OTP_LENGTH).fill(''));
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
      }
    } catch {
      setStatus('error');
      setError('Connection error. Please check your network and try again.');
    }
  };

  // ── Resend ──────────────────────────────────────────────────

  const handleResend = async () => {
    setIsSending(true);
    setError(null);
    setDigits(Array(OTP_LENGTH).fill(''));

    try {
      await sendOtp({ email });
    } finally {
      setIsSending(false);
      setCountdown(RESEND_COOLDOWN);
      setStatus('idle');
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  };

  const codeComplete = digits.every(Boolean);
  const hasError = status === 'error';
  const isLoading = status === 'loading';
  const isSuccess = status === 'success';
  const canResend = countdown === 0 && !isSending;

  // ── Success screen ──────────────────────────────────────────

  if (isSuccess) {
    return (
      <div className="mn-modal-bg" role="dialog" aria-modal="true">
        <div className="mn-modal" style={{ textAlign: 'center' }}>
          <div className="mn-success-icon" style={{ color: 'var(--mn-teal-400)' }}>
            <IconCheck />
          </div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--mn-text-100)', marginBottom: '0.4rem' }}>
            Identity verified
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--mn-text-400)', marginBottom: '1.5rem' }}>
            {trustDevice
              ? 'This device has been marked as trusted for future logins.'
              : 'Verification successful. Redirecting you now…'}
          </p>
          <div
            style={{
              height: 3,
              borderRadius: 2,
              background: 'var(--mn-border)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, var(--mn-teal-500), var(--mn-blue-500))',
                animation: 'mn-progress 1.8s linear forwards',
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Main OTP form ───────────────────────────────────────────

  return (
    <div className="mn-modal-bg" role="dialog" aria-modal="true" aria-labelledby="otp-title">
      <div className="mn-modal">

        {/* Header */}
        <div className="mn-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--mn-r-sm)',
                background: 'var(--mn-blue-glow)',
                border: '1px solid rgba(14,165,233,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--mn-blue-400)',
                flexShrink: 0,
              }}
            >
              <IconShield />
            </div>
            <h2 className="mn-modal-title" id="otp-title">
              Verify your identity
            </h2>
          </div>
          <button className="mn-modal-close" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>

        {/* Subtitle */}
        <p className="mn-modal-sub" style={{ marginTop: '0.6rem' }}>
          We sent a 6-digit code to{' '}
          <strong style={{ color: 'var(--mn-text-200)' }}>{email}</strong>.
          Enter it below to confirm this is you.
        </p>

        <form onSubmit={handleSubmit} noValidate>

          {/* Error alert */}
          {error && (
            <div className="mn-alert-error">
              {error}
              {attemptsLeft > 0 && (
                <span style={{ color: 'var(--mn-text-600)', marginLeft: '0.4rem' }}>
                  ({attemptsLeft} {attemptsLeft === 1 ? 'attempt' : 'attempts'} left)
                </span>
              )}
            </div>
          )}

          {/* 6 OTP input boxes */}
          <div className="mn-otp-grid" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                pattern="\d*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className={[
                  'mn-otp-box',
                  digit ? 'filled' : '',
                  hasError ? 'otp-error' : '',
                ].filter(Boolean).join(' ')}
                disabled={isLoading || attemptsLeft === 0}
                aria-label={`Digit ${i + 1}`}
                autoComplete="one-time-code"
              />
            ))}
          </div>

          {/* Trust this device */}
          <label className="mn-check-wrap">
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(e) => setTrustDevice(e.target.checked)}
              disabled={isLoading}
            />
            <span className="mn-check-label">
              <strong>Trust this device</strong> for 30 days — skip verification on future logins
            </span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            className="mn-btn-primary"
            disabled={!codeComplete || isLoading || attemptsLeft === 0}
          >
            {isLoading ? 'Verifying…' : 'Verify & Continue'}
          </button>
        </form>

        {/* Resend */}
        <div className="mn-resend-area">
          {canResend ? (
            <>
              Didn't receive it?{' '}
              <button
                type="button"
                className="mn-resend-btn"
                onClick={handleResend}
                disabled={isSending}
              >
                {isSending ? 'Sending…' : 'Resend code'}
              </button>
            </>
          ) : (
            <>
              Resend available in{' '}
              <span style={{ color: 'var(--mn-text-400)', fontWeight: 600 }}>
                {countdown}s
              </span>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
