// Invoices tab (?tab=invoices) — blueprint 09 §4.

import { useCallback, useEffect, useState } from 'react';
import { Plus, Eye, Download, Send, Ban } from 'lucide-react';
import { listInvoices, createInvoice, voidInvoice, sendInvoice, downloadInvoicePdf, triggerPdfDownload } from '../../services/financeApi';
import { FinanceApiError, INVOICE_STATUSES } from '../../types/finance';
import type { Invoice, InvoiceStatus } from '../../types/finance';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import {
  INPUT, FULL_INPUT, LABEL, ERR, BTN_PRIMARY, BTN_SECONDARY, Badge, TableShell, PaginationBar,
  Modal, ModalFooter, ErrorBanner, UserPicker, money, fmtDate,
} from './_shared';

const STATUS_COLORS: Record<InvoiceStatus, { bg: string; fg: string }> = {
  DRAFT:   { bg: '#f1f5f9', fg: '#64748b' },
  SENT:    { bg: '#dbeafe', fg: '#1d4ed8' },
  PAID:    { bg: '#dcfce7', fg: '#15803d' },
  VOID:    { bg: '#f1f5f9', fg: '#94a3b8' },
  OVERDUE: { bg: '#fee2e2', fg: '#b91c1c' },
};

interface Props { showToast: (type: 'success' | 'error', message: string) => void; refreshSignal: number; autoOpenCreate?: boolean; onAutoOpenHandled?: () => void }

interface LineItem { name: string; qty: string; unitPrice: string }

function GenerateInvoiceModal({ onClose, onSuccess, showToast }: { onClose: () => void; onSuccess: () => void; showToast: Props['showToast'] }) {
  const [user, setUser] = useState<{ id: string; label: string } | null>(null);
  const [items, setItems] = useState<LineItem[]>([{ name: '', qty: '1', unitPrice: '' }]);
  const [taxAmount, setTaxAmount] = useState('0');
  const [dueDate, setDueDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0);
  const total = subtotal + (Number(taxAmount) || 0);

  function updateItem(idx: number, patch: Partial<LineItem>) {
    setItems(list => list.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!user) next.user = 'Select a customer.';
    const cleanItems = items.filter(i => i.name.trim() && Number(i.qty) > 0 && Number(i.unitPrice) >= 0);
    if (cleanItems.length === 0) next.items = 'Add at least one line item.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const created = await createInvoice({
        userId: user!.id,
        items: cleanItems.map(i => ({ name: i.name.trim(), qty: Number(i.qty), unitPrice: Number(i.unitPrice) })),
        taxAmount: Number(taxAmount) || 0,
        ...(dueDate ? { dueDate: new Date(dueDate).toISOString() } : {}),
      });
      invalidateFor(appQueryClient, 'invoice.generate', { studentId: user!.id });
      showToast('success', `Invoice ${created.invoiceNumber} generated.`);
      onSuccess();
    } catch (err) {
      showToast('error', err instanceof FinanceApiError ? err.message : 'Failed to generate invoice.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Generate Invoice" onClose={onClose} submitting={submitting} maxWidth={620}>
      <form onSubmit={handleSubmit} style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <UserPicker value={user} onChange={setUser} label="Customer" />
          {errors.user && <div style={ERR}>{errors.user}</div>}
        </div>

        <div>
          <label style={LABEL}>Line Items</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((it, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 0.6fr 0.8fr auto', gap: 8 }}>
                <input style={INPUT} placeholder="Item name" value={it.name} onChange={e => updateItem(idx, { name: e.target.value })} />
                <input style={INPUT} type="number" min={1} placeholder="Qty" value={it.qty} onChange={e => updateItem(idx, { qty: e.target.value })} />
                <input style={INPUT} type="number" min={0} step={0.01} placeholder="Unit price" value={it.unitPrice} onChange={e => updateItem(idx, { unitPrice: e.target.value })} />
                <button type="button" onClick={() => setItems(list => list.filter((_, i) => i !== idx))} disabled={items.length === 1} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: items.length === 1 ? 'default' : 'pointer', opacity: items.length === 1 ? 0.3 : 1 }}>✕</button>
              </div>
            ))}
          </div>
          {errors.items && <div style={ERR}>{errors.items}</div>}
          <button type="button" onClick={() => setItems(list => [...list, { name: '', qty: '1', unitPrice: '' }])} style={{ marginTop: 8, ...BTN_SECONDARY, padding: '6px 12px', fontSize: 12 }}>
            <Plus size={13} /> Add Item
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={LABEL}>Tax Amount</label>
            <input style={FULL_INPUT} type="number" min={0} step={0.01} value={taxAmount} onChange={e => setTaxAmount(e.target.value)} />
          </div>
          <div>
            <label style={LABEL}>Due Date (optional)</label>
            <input style={FULL_INPUT} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
          <span style={{ color: '#64748b' }}>Subtotal</span><span style={{ fontWeight: 600 }}>{money(subtotal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700 }}>
          <span>Total</span><span>{money(total)}</span>
        </div>

        <ModalFooter onCancel={onClose} submitting={submitting} submitLabel="Generate" />
      </form>
    </Modal>
  );
}

function ViewInvoiceModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  return (
    <Modal title={`Invoice ${invoice.invoiceNumber}`} onClose={onClose} maxWidth={520}>
      <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, color: '#64748b' }}>Customer: <strong style={{ color: '#0f172a' }}>{invoice.userName ?? invoice.userId}</strong></div>
        <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '1px solid #f1f5f9' }}>
            <th style={{ textAlign: 'left', padding: '6px 4px', color: '#94a3b8' }}>Item</th>
            <th style={{ textAlign: 'center', padding: '6px 4px', color: '#94a3b8' }}>Qty</th>
            <th style={{ textAlign: 'right', padding: '6px 4px', color: '#94a3b8' }}>Unit Price</th>
            <th style={{ textAlign: 'right', padding: '6px 4px', color: '#94a3b8' }}>Total</th>
          </tr></thead>
          <tbody>
            {invoice.items.map((it, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                <td style={{ padding: '6px 4px' }}>{it.name}</td>
                <td style={{ padding: '6px 4px', textAlign: 'center' }}>{it.qty}</td>
                <td style={{ padding: '6px 4px', textAlign: 'right' }}>{money(it.unitPrice)}</td>
                <td style={{ padding: '6px 4px', textAlign: 'right' }}>{money(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Subtotal</span><span>{money(invoice.subtotal)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Tax</span><span>{money(invoice.taxAmount)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>Total</span><span>{money(invoice.total)}</span></div>
        </div>
      </div>
    </Modal>
  );
}

export default function InvoicesTab({ showToast, refreshSignal, autoOpenCreate, onAutoOpenHandled }: Props) {
  const [items, setItems] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<InvoiceStatus | ''>('');

  const [createOpen, setCreateOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<Invoice | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (autoOpenCreate) { setCreateOpen(true); onAutoOpenHandled?.(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenCreate]);

  const fetchList = useCallback(() => {
    setLoading(true);
    setError(null);
    listInvoices({ page, limit, status: status || undefined })
      .then(res => { setItems(res.items); setTotal(res.total); })
      .catch(err => setError(err instanceof FinanceApiError ? err.message : 'Failed to load invoices.'))
      .finally(() => setLoading(false));
  }, [page, status]);

  useEffect(() => { fetchList(); }, [fetchList, refreshSignal]);
  useEffect(() => { setPage(1); }, [status]);
  useEffect(() => {
    window.addEventListener('financeUpdated', fetchList);
    return () => window.removeEventListener('financeUpdated', fetchList);
  }, [fetchList]);

  async function handleSend(inv: Invoice) {
    setBusyId(inv.id);
    try {
      await sendInvoice(inv.id);
      invalidateFor(appQueryClient, 'invoice.send');
      showToast('success', 'Invoice sent.');
      fetchList();
    } catch (err) {
      showToast('error', err instanceof FinanceApiError ? err.message : 'Failed to send invoice.');
    } finally { setBusyId(null); }
  }

  async function handleVoid(inv: Invoice) {
    if (!window.confirm(`Void invoice ${inv.invoiceNumber}? This cannot be undone.`)) return;
    setBusyId(inv.id);
    try {
      await voidInvoice(inv.id);
      invalidateFor(appQueryClient, 'invoice.void', { studentId: inv.userId });
      showToast('success', 'Invoice voided.');
      fetchList();
    } catch (err) {
      showToast('error', err instanceof FinanceApiError ? err.message : 'Failed to void invoice.');
    } finally { setBusyId(null); }
  }

  async function handleDownload(inv: Invoice) {
    try {
      const blob = await downloadInvoicePdf(inv.id);
      triggerPdfDownload(blob, `invoice-${inv.invoiceNumber}.pdf`);
    } catch (err) {
      showToast('error', err instanceof FinanceApiError ? err.message : 'Failed to download invoice.');
    }
  }

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 16, borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
        <select style={INPUT} value={status} onChange={e => setStatus(e.target.value as InvoiceStatus | '')}>
          <option value="">All statuses</option>
          {INVOICE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="button" onClick={() => setCreateOpen(true)} style={{ ...BTN_PRIMARY, marginLeft: 'auto' }}>
          <Plus size={15} strokeWidth={2.5} /> Generate Invoice
        </button>
      </div>

      {error && <div style={{ margin: 16 }}><ErrorBanner message={error} onRetry={fetchList} /></div>}

      <TableShell
        colSpan={7} loading={loading} empty={items.length === 0}
        headers={[{ label: 'Invoice #' }, { label: 'Customer' }, { label: 'Items', align: 'center' }, { label: 'Total', align: 'right' }, { label: 'Status', align: 'center' }, { label: 'Date' }, { label: 'Actions', align: 'right' }]}
      >
        {items.map(inv => {
          const busy = busyId === inv.id;
          return (
            <tr key={inv.id} style={{ borderBottom: '1px solid #f8fafc', opacity: busy ? 0.5 : 1 }}>
              <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>{inv.invoiceNumber}</td>
              <td style={{ padding: '10px 12px', color: '#64748b' }}>{inv.userName ?? inv.userId}</td>
              <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{inv.items.length}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{money(inv.total)}</td>
              <td style={{ padding: '10px 12px', textAlign: 'center' }}><Badge text={inv.status} colors={STATUS_COLORS[inv.status]} /></td>
              <td style={{ padding: '10px 12px', color: '#64748b' }}>{fmtDate(inv.createdAt)}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button type="button" title="View" disabled={busy} onClick={() => setViewTarget(inv)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}><Eye size={14} /></button>
                <button type="button" title="Download PDF" disabled={busy} onClick={() => handleDownload(inv)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}><Download size={14} /></button>
                <button type="button" title="Send" disabled={busy || inv.status === 'VOID'} onClick={() => handleSend(inv)} style={{ background: 'none', border: 'none', cursor: inv.status === 'VOID' ? 'default' : 'pointer', color: inv.status === 'VOID' ? '#cbd5e1' : '#2563eb', padding: 4 }}><Send size={14} /></button>
                <button type="button" title="Void" disabled={busy || inv.status === 'VOID'} onClick={() => handleVoid(inv)} style={{ background: 'none', border: 'none', cursor: inv.status === 'VOID' ? 'default' : 'pointer', color: inv.status === 'VOID' ? '#cbd5e1' : '#dc2626', padding: 4 }}><Ban size={14} /></button>
              </td>
            </tr>
          );
        })}
      </TableShell>

      <PaginationBar page={page} pages={pages} onPage={setPage} />

      {createOpen && <GenerateInvoiceModal onClose={() => setCreateOpen(false)} showToast={showToast} onSuccess={() => { setCreateOpen(false); fetchList(); }} />}
      {viewTarget && <ViewInvoiceModal invoice={viewTarget} onClose={() => setViewTarget(null)} />}
    </div>
  );
}
