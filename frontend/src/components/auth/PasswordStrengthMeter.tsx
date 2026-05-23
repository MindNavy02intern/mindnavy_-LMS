import type {
  PasswordChecks,
  PasswordStrengthMeterProps,
  PasswordStrengthResult,
  PasswordStrengthScore,
} from '../../types/passwordRecovery';

// ── Strength analyser ─────────────────────────────────────────────────────────

export function getPasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return {
      score: 0,
      label: '',
      color: '',
      checks: {
        minLength: false,
        hasUpper: false,
        hasLower: false,
        hasDigit: false,
        hasSpecial: false,
      },
    };
  }

  const checks: PasswordChecks = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasDigit: /\d/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };

  // A short password is always score 1 regardless of character variety
  if (!checks.minLength) {
    return { score: 1, label: 'Too short', color: '#ef4444', checks };
  }

  // Count how many extra criteria are met beyond minimum length
  const extras = [
    checks.hasUpper && checks.hasLower, // mixed case counts as one bonus
    checks.hasDigit,
    checks.hasSpecial,
  ].filter(Boolean).length;

  const levels: Array<[PasswordStrengthScore, string, string]> = [
    [2, 'Weak', '#ef4444'],
    [3, 'Fair', '#f97316'],
    [4, 'Good', '#eab308'],
    [5, 'Strong', '#22c55e'],
  ];

  const [score, label, color] = levels[extras] ?? levels[levels.length - 1];
  return { score, label, color, checks };
}

// ── Component ─────────────────────────────────────────────────────────────────

const REQUIREMENTS: Array<{ key: keyof PasswordChecks; text: string }> = [
  { key: 'minLength', text: '8+ characters'        },
  { key: 'hasUpper',  text: 'Uppercase letter'      },
  { key: 'hasLower',  text: 'Lowercase letter'      },
  { key: 'hasDigit',  text: 'Number (0–9)'          },
  { key: 'hasSpecial',text: 'Special character'     },
];

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2 6 5 9 10 3" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="3" x2="9" y2="9" />
      <line x1="9" y1="3" x2="3" y2="9" />
    </svg>
  );
}

export default function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const { score, label, color, checks } = getPasswordStrength(password);

  // Don't render anything until the user starts typing
  if (!password) return null;

  const NUM_BARS = 5;

  return (
    <div className="mn-strength-wrap" aria-live="polite" aria-label={`Password strength: ${label}`}>
      {/* ── Strength bars ── */}
      <div className="mn-strength-bars">
        {Array.from({ length: NUM_BARS }, (_, i) => (
          <div
            key={i}
            className={`mn-strength-bar${i < score ? ` score-${score}` : ''}`}
          />
        ))}
      </div>

      {/* ── Score label ── */}
      <div className="mn-strength-header">
        <span style={{ fontSize: '0.7rem', color: 'var(--mn-text-800)' }}>
          Password strength
        </span>
        {label && (
          <span className="mn-strength-label" style={{ color }}>
            {label}
          </span>
        )}
      </div>

      {/* ── Requirements checklist ── */}
      <div className="mn-strength-reqs">
        {REQUIREMENTS.map(({ key, text }) => (
          <span
            key={key}
            className={`mn-strength-req ${checks[key] ? 'met' : 'unmet'}`}
          >
            {checks[key] ? <CheckIcon /> : <CrossIcon />}
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
