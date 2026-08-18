// User Details Drawer — More tab. Replaces the 6 inert "Coming Soon" tiles
// (DEFERRED_ITEMS.md Users item) with real lazy-loaded panels, one fetch per
// tile on first open — same shape as InstructorSidePanel's Documents/Reviews
// tabs (per competencies.routes.js's own comment on getUserSkills).
//
// Devices & Sessions deliberately does NOT reuse TrustedDevicesPage/
// TrustedDevice — that model is keyed to AdminUser (the admin console's own
// login devices), not AppUser. This shows AppUserSession instead, the real
// per-AppUser login-session log.

import { useEffect, useState } from 'react';
import { getStoredToken } from '../../api/adminAuth';
import {
  getUserSessions, revokeUserSession,
  getUserNotes, addUserNote, deleteUserNote,
  getUserDataExport, requestAccountDeletion,
} from '../../api/users';
import type { UserDetails, UserSession, UserNote } from '../../types/users';
import type { ToastType } from './Toast';
import ConfirmDialog from './ConfirmDialog';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// ── Shared bits ─────────────────────────────────────────────────────────────

function PanelLoading() {
  return <div style={{ textAlign: 'center', padding: '28px 0', color: '#9ca3af', fontSize: 13 }}>Loading…</div>;
}

function PanelError({ message }: { message: string }) {
  return <div style={{ textAlign: 'center', padding: '28px 0', color: '#b91c1c', fontSize: 13 }}>{message}</div>;
}

function PanelEmpty({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', padding: '28px 0', color: '#9ca3af', fontSize: 13 }}>{text}</div>;
}

// ── Competencies ───────────────────────────────────────────────────────────

interface UserSkillRow {
  skillId: string;
  skillName: string;
  category: string | null;
  currentLevel: string | null;
  proficiencyPercent: number | null;
  assessedAt: string | null;
  missing: boolean;
}

function CompetenciesPanel({ userId }: { userId: string }) {
  const [rows, setRows] = useState<UserSkillRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE_URL}/competencies/users/${encodeURIComponent(userId)}/skills`, { headers: authHeaders() })
      .then(res => res.json())
      .then(body => {
        if (!body.success) throw new Error(body.message ?? 'Failed to load competencies.');
        setRows((body.data as UserSkillRow[]).filter(r => !r.missing));
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load competencies.'));
  }, [userId]);

  if (error) return <PanelError message={error} />;
  if (rows === null) return <PanelLoading />;
  if (rows.length === 0) return <PanelEmpty text="No competencies assessed yet" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(r => (
        <div key={r.skillId} style={{ padding: '10px 12px', background: '#f9fafb', border: '1px solid #f0f0f0', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{r.skillName}</span>
            <span style={{ fontSize: 11, color: '#6b7280' }}>{r.currentLevel ?? '—'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 5, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${r.proficiencyPercent ?? 0}%`, background: '#7c3aed', borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 10, color: '#9ca3af', minWidth: 60, textAlign: 'right' }}>Assessed {formatDate(r.assessedAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Security Logs ────────────────────────────────────────────────────────────

interface AuditLogRow {
  id: string;
  action: string;
  userName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

function SecurityLogsPanel({ userId }: { userId: string }) {
  const [rows, setRows] = useState<AuditLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE_URL}/reports/audit?userId=${encodeURIComponent(userId)}&limit=20`, { headers: authHeaders() })
      .then(res => res.json())
      .then(body => {
        if (!body.success) throw new Error(body.message ?? 'Failed to load security logs.');
        setRows(body.data.logs as AuditLogRow[]);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load security logs.'));
  }, [userId]);

  if (error) return <PanelError message={error} />;
  if (rows === null) return <PanelLoading />;
  if (rows.length === 0) return <PanelEmpty text="No security events" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map(r => {
        const ip = typeof r.metadata?.ipAddress === 'string' ? r.metadata.ipAddress : null;
        return (
          <div key={r.id} style={{ padding: '9px 0', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{r.action.replace(/_/g, ' ')}</span>
              <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{formatDateTime(r.createdAt)}</span>
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
              {r.userName ? `By ${r.userName}` : 'System'}{ip ? ` · ${ip}` : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Devices & Sessions ────────────────────────────────────────────────────────

function DevicesPanel({ userId, showToast }: { userId: string; showToast: (t: ToastType, m: string) => void }) {
  const [rows, setRows] = useState<UserSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    getUserSessions(userId)
      .then(setRows)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load sessions.'));
  };
  useEffect(load, [userId]);

  const handleRevoke = async (sessionId: string) => {
    setBusyId(sessionId);
    try {
      await revokeUserSession(userId, sessionId);
      showToast('success', 'Session revoked.');
      load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Failed to revoke session.');
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <PanelError message={error} />;
  if (rows === null) return <PanelLoading />;
  if (rows.length === 0) return <PanelEmpty text="No login sessions found" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(s => (
        <div key={s.id} style={{ padding: '10px 12px', background: '#f9fafb', border: '1px solid #f0f0f0', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.userAgent ?? 'Unknown device'}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                {s.ipAddress ?? '—'} · Last used {formatDateTime(s.lastUsedAt)}
              </div>
            </div>
            {s.revoked ? (
              <span style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', flexShrink: 0 }}>Revoked</span>
            ) : (
              <button
                onClick={() => handleRevoke(s.id)}
                disabled={busyId === s.id}
                style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', background: 'none', border: 'none', cursor: busyId === s.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
              >
                {busyId === s.id ? 'Revoking…' : 'Revoke'}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Notes ─────────────────────────────────────────────────────────────────────

function NotesPanel({ userId, showToast }: { userId: string; showToast: (t: ToastType, m: string) => void }) {
  const [notes, setNotes] = useState<UserNote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    getUserNotes(userId)
      .then(setNotes)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load notes.'));
  };
  useEffect(load, [userId]);

  const handleSave = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await addUserNote(userId, draft.trim());
      setDraft('');
      showToast('success', 'Note added.');
      load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Failed to add note.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      await deleteUserNote(userId, noteId);
      showToast('success', 'Note deleted.');
      load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Failed to delete note.');
    }
  };

  return (
    <div>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        placeholder="Add an internal note about this user…"
        rows={3}
        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6, marginBottom: 14 }}>
        <button
          onClick={handleSave}
          disabled={saving || !draft.trim()}
          style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: saving || !draft.trim() ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: saving || !draft.trim() ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Saving…' : 'Add Note'}
        </button>
      </div>

      {error && <PanelError message={error} />}
      {!error && notes === null && <PanelLoading />}
      {!error && notes !== null && notes.length === 0 && <PanelEmpty text="No notes yet" />}
      {!error && notes !== null && notes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.map(n => (
            <div key={n.id} style={{ padding: '10px 12px', background: '#f9fafb', border: '1px solid #f0f0f0', borderRadius: 8 }}>
              <div style={{ fontSize: 13, color: '#111827', marginBottom: 6, whiteSpace: 'pre-wrap' }}>{n.content}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{n.createdByName} · {formatDateTime(n.createdAt)}</span>
                <button
                  onClick={() => handleDelete(n.id)}
                  style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Preferences ───────────────────────────────────────────────────────────────

interface Prefs {
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  marketingEnabled: boolean;
  learningAlertsEnabled: boolean;
  securityEnabled: boolean;
}

const PREF_LABELS: Array<{ key: keyof Prefs; label: string }> = [
  { key: 'emailEnabled', label: 'Email' },
  { key: 'pushEnabled', label: 'Push' },
  { key: 'smsEnabled', label: 'SMS' },
  { key: 'marketingEnabled', label: 'Marketing' },
  { key: 'learningAlertsEnabled', label: 'Learning Alerts' },
  { key: 'securityEnabled', label: 'Security' },
];

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      aria-label={label}
      style={{
        width: 36, height: 20, borderRadius: 100, border: 'none', cursor: 'pointer', flexShrink: 0,
        background: on ? '#2563eb' : '#d1d5db', position: 'relative', transition: 'background 0.15s ease',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: '50%',
        background: '#fff', transition: 'left 0.15s ease',
      }} />
    </button>
  );
}

function PreferencesPanel({ userId, showToast }: { userId: string; showToast: (t: ToastType, m: string) => void }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${BASE_URL}/notifications/preferences/${encodeURIComponent(userId)}`, { headers: authHeaders() })
      .then(res => res.json())
      .then(body => {
        if (!body.success) throw new Error(body.message ?? 'Failed to load preferences.');
        setPrefs(body.data as Prefs);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load preferences.'));
  }, [userId]);

  const handleSave = async () => {
    if (!prefs) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/notifications/preferences/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(prefs),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message ?? 'Failed to save preferences.');
      showToast('success', 'Preferences updated.');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  if (error) return <PanelError message={error} />;
  if (prefs === null) return <PanelLoading />;

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
        {PREF_LABELS.map(({ key, label }) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
            <span style={{ fontSize: 13, color: '#374151' }}>{label}</span>
            <Toggle on={prefs[key]} onClick={() => setPrefs({ ...prefs, [key]: !prefs[key] })} label={label} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '7px 16px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 7, cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ── Consent & Privacy ──────────────────────────────────────────────────────────

function ConsentPanel({ user, showToast }: { user: UserDetails; showToast: (t: ToastType, m: string) => void }) {
  const [exporting, setExporting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await getUserDataExport(user.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user-${user.id}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('success', 'Data export downloaded.');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Failed to export data.');
    } finally {
      setExporting(false);
    }
  };

  const handleRequestDeletion = async () => {
    setRequesting(true);
    try {
      const res = await requestAccountDeletion(user.id);
      showToast('success', res.message ?? 'Deletion request sent.');
      setDeleteConfirmOpen(false);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Failed to send deletion request.');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f3f4f6' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Account Created</span>
          <span style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>{formatDate(user.createdAt)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f3f4f6' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Last Login</span>
          <span style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>{formatDate(user.lastActivityAt)}</span>
        </div>
      </div>

      <button
        onClick={handleExport}
        disabled={exporting}
        style={{ width: '100%', padding: '9px 0', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: exporting ? 'not-allowed' : 'pointer', color: '#374151', marginBottom: 8 }}
      >
        {exporting ? 'Preparing export…' : 'Export User Data (JSON)'}
      </button>

      <button
        onClick={() => setDeleteConfirmOpen(true)}
        style={{ width: '100%', padding: '9px 0', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, cursor: 'pointer', color: '#dc2626' }}
      >
        Request Account Deletion
      </button>

      {deleteConfirmOpen && (
        <ConfirmDialog
          title="Request Account Deletion"
          body={`This sends a deletion request for ${user.fullName} to every active admin. No data is deleted automatically — an admin must action it manually.`}
          confirmLabel="Send Request"
          confirmColor="#dc2626"
          onConfirm={handleRequestDeletion}
          onCancel={() => setDeleteConfirmOpen(false)}
          loading={requesting}
        />
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type MoreTile = 'competencies' | 'security' | 'devices' | 'notes' | 'preferences' | 'consent' | null;

const TILES: Array<{ key: Exclude<MoreTile, null>; label: string; icon: string }> = [
  { key: 'competencies', label: 'Competencies',      icon: '🎯' },
  { key: 'security',     label: 'Security Logs',      icon: '🔒' },
  { key: 'devices',      label: 'Devices & Sessions', icon: '💻' },
  { key: 'notes',        label: 'Notes',              icon: '📝' },
  { key: 'preferences',  label: 'Preferences',        icon: '⚙️' },
  { key: 'consent',      label: 'Consent & Privacy',  icon: '🛡️' },
];

interface Props {
  user:      UserDetails;
  showToast: (type: ToastType, message: string) => void;
}

export default function UserMoreTab({ user, showToast }: Props) {
  const [active, setActive] = useState<MoreTile>(null);

  if (!active) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
        {TILES.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            style={{
              padding: '18px 14px', background: '#f9fafb',
              border: '1px solid #e5e7eb', borderRadius: 8, fontFamily: 'inherit',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 24 }}>{icon}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{label}</span>
          </button>
        ))}
      </div>
    );
  }

  const tile = TILES.find(t => t.key === active)!;

  return (
    <div>
      <button
        onClick={() => setActive(null)}
        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 12, fontFamily: 'inherit', padding: 0, marginBottom: 14 }}
      >
        ← {tile.label}
      </button>
      {active === 'competencies' && <CompetenciesPanel userId={user.id} />}
      {active === 'security'     && <SecurityLogsPanel userId={user.id} />}
      {active === 'devices'      && <DevicesPanel userId={user.id} showToast={showToast} />}
      {active === 'notes'        && <NotesPanel userId={user.id} showToast={showToast} />}
      {active === 'preferences'  && <PreferencesPanel userId={user.id} showToast={showToast} />}
      {active === 'consent'      && <ConsentPanel user={user} showToast={showToast} />}
    </div>
  );
}
