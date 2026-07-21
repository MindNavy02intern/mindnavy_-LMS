// Certificates domain types — templates + issued certificates + public verify.
// No CERTIFICATES_CONTRACT.md exists in the repo (checked root/docs/git
// history) — shapes reverse-engineered from backend/src/{controllers,
// services,validators}/certificates.*.js and verified live against a
// running server, same process as Quizzes.
//
// studentName / courseTitle on Certificate are ISSUE-TIME SNAPSHOTS
// (Certificate.metadata in the DB) — render exactly as received, never
// re-fetch/join the live user or course record to "freshen" them.
// templateName is NOT a snapshot (read live off the template relation) —
// it changes if the template is renamed, and goes null if the template is
// deleted (SetNull; the certificate survives with a default-layout PDF).

export interface CertificateLayout {
  title:          string;
  body:           string;
  primaryColor:   string;       // "#RRGGBB" — backend 400s any other shape
  accentColor:    string;       // "#RRGGBB"
  signatureName:  string | null;
  signatureTitle: string | null;
}

export interface CertificateTemplate {
  id:               string;
  name:             string;
  layout:           CertificateLayout; // always fully populated — server fills defaults
  certificateCount: number;            // server-derived — never compute client-side
  createdAt:        string;            // ISO
  updatedAt:        string;            // ISO
}

export type CertificateStatus = 'active' | 'revoked';

export interface Certificate {
  id:               string;
  userId:           string;
  studentName:      string | null;  // issue-time snapshot
  courseId:         string;
  courseTitle:      string | null;  // issue-time snapshot
  templateId:        string | null;
  templateName:      string | null; // live, not a snapshot
  verificationCode: string;
  status:           CertificateStatus;
  issuedAt:         string; // ISO
  revokedAt:        string | null; // ISO
}

export interface CertificatesPage {
  items:  Certificate[];
  total:  number;  // server-derived — never compute client-side
  limit:  number;
  offset: number;
}

// ── API payloads ────────────────────────────────────────────────────────────────

export interface CreateTemplatePayload {
  name:   string;
  layout: CertificateLayout;
}

// PATCH semantics: layout, when present, REPLACES the whole object server-side
// (missing keys reset to defaults) — callers must always send the FULL current
// layout, never a partial diff. Enforced by shape here (no Partial<>).
export interface UpdateTemplatePayload {
  name?:   string;
  layout?: CertificateLayout;
}

export interface ListCertificatesParams {
  courseId?: string;
  userId?:   string;
  status?:   CertificateStatus;
  limit?:    number;
  offset?:   number;
}

export interface IssueCertificatePayload {
  userId:      string;
  courseId:    string;
  templateId?: string; // omitted = default layout
}

// undefined = keep current templateId, null = clear to default layout, string = set
export interface ReissueCertificatePayload {
  templateId?: string | null;
}

// ── Public verify ────────────────────────────────────────────────────────────────

export interface VerifiedCertificateInfo {
  studentName: string | null;
  courseTitle: string | null;
  issuedAt:    string; // ISO
}

export type VerifyResult =
  | { status: 'valid';     certificate: VerifiedCertificateInfo }
  | { status: 'revoked' }
  | { status: 'not_found' };
