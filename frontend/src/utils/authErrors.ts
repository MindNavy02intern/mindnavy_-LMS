export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message;

    if (msg.includes('Invalid login credentials')) {
      return 'Incorrect email or password. Please try again.';
    }
    if (msg.includes('Email not confirmed')) {
      return 'Please check your email and click the confirmation link first.';
    }
    if (msg.includes('User already registered')) {
      return 'An account with this email already exists. Try signing in.';
    }
    if (msg.includes('Password should be at least')) {
      return 'Password must be at least 6 characters long.';
    }
    if (msg.includes('Unable to validate email address')) {
      return 'Please enter a valid email address.';
    }
    if (msg.includes('network') || msg.includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    }

    // ── Password reset specific errors ──────────────────────────
    if (
      msg.toLowerCase().includes('token has expired') ||
      msg.toLowerCase().includes('token expired') ||
      msg.toLowerCase().includes('link has expired')
    ) {
      return 'This reset link has expired. Please request a new one.';
    }
    if (
      (msg.toLowerCase().includes('invalid') && msg.toLowerCase().includes('token')) ||
      msg.toLowerCase().includes('invalid recovery')
    ) {
      return 'This reset link is invalid. Please request a new one from the forgot-password page.';
    }
    if (
      msg.toLowerCase().includes('rate limit') ||
      msg.toLowerCase().includes('too many requests') ||
      msg.toLowerCase().includes('email rate limit')
    ) {
      return 'Too many requests. Please wait a few minutes before trying again.';
    }
    if (msg.toLowerCase().includes('same password')) {
      return 'New password must be different from your current password.';
    }

    return msg;
  }

  return 'Something went wrong. Please try again.';
}
