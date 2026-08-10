// Transactions tab (?tab=transactions) — blueprint 09 §5. Read-only ledger.

import { useCallback, useEffect, useState } from 'react';
import { listTransactions } from '../../services/financeApi';
import { FinanceApiError, TRANSACTION_TYPES } from '../../types/finance';
import type { Transaction, TransactionType } from '../../types/finance';
import { INPUT, Badge, TableShell, PaginationBar, ErrorBanner, money } from './_shared';

const TYPE_COLORS: Record<TransactionType, { bg: string; fg: string }> = {
  PAYMENT:       { bg: '#dcfce7', fg: '#15803d' },
  REFUND:        { bg: '#fee2e2', fg: '#b91c1c' },
  PAYOUT:        { bg: '#dbeafe', fg: '#1d4ed8' },
  TRANSFER:      { bg: '#f1f5f9', fg: '#64748b' },
  TAX_DEDUCTION: { bg: '#fef3c7', fg: '#b45309' },
};

export default function TransactionsTab({ refreshSignal }: { refreshSignal: number }) {
  const [items, setItems] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 15;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<TransactionType | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchList = useCallback(() => {
    setLoading(true);
    setError(null);
    listTransactions({ page, limit, type: type || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined })
      .then(res => { setItems(res.items); setTotal(res.total); })
      .catch(err => setError(err instanceof FinanceApiError ? err.message : 'Failed to load transactions.'))
      .finally(() => setLoading(false));
  }, [page, type, dateFrom, dateTo]);

  useEffect(() => { fetchList(); }, [fetchList, refreshSignal]);
  useEffect(() => { setPage(1); }, [type, dateFrom, dateTo]);
  useEffect(() => {
    window.addEventListener('analyticsUpdated', fetchList);
    return () => window.removeEventListener('analyticsUpdated', fetchList);
  }, [fetchList]);

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 16, borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
        <select style={INPUT} value={type} onChange={e => setType(e.target.value as TransactionType | '')}>
          <option value="">All types</option>
          {TRANSACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="date" style={INPUT} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span style={{ color: '#9ca3af', fontSize: 12 }}>to</span>
        <input type="date" style={INPUT} value={dateTo} onChange={e => setDateTo(e.target.value)} />
      </div>

      {error && <div style={{ margin: 16 }}><ErrorBanner message={error} onRetry={fetchList} /></div>}

      <TableShell
        colSpan={5} loading={loading} empty={items.length === 0}
        headers={[{ label: 'ID' }, { label: 'Type', align: 'center' }, { label: 'Amount', align: 'right' }, { label: 'Payment' }, { label: 'Date' }]}
      >
        {items.map(t => (
          <tr key={t.id} style={{ borderBottom: '1px solid #f8fafc' }}>
            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11.5, color: '#64748b' }}>{t.id.slice(0, 8)}…</td>
            <td style={{ padding: '10px 12px', textAlign: 'center' }}><Badge text={t.type} colors={TYPE_COLORS[t.type]} /></td>
            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{money(t.amount, t.currency)}</td>
            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11.5, color: '#64748b' }}>{t.paymentId.slice(0, 8)}…</td>
            <td style={{ padding: '10px 12px', color: '#64748b' }}>{new Date(t.createdAt).toLocaleString()}</td>
          </tr>
        ))}
      </TableShell>

      <PaginationBar page={page} pages={pages} onPage={setPage} />
    </div>
  );
}
