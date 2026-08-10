import { useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { useTabParam } from '../../hooks/useTabParam';
import { useToast, ToastContainer } from '../../components/users/Toast';
import FinancePageHeader from '../../components/finance/FinancePageHeader';
import DashboardTab from '../../components/finance/DashboardTab';
import PaymentsTab from '../../components/finance/PaymentsTab';
import SubscriptionsTab from '../../components/finance/SubscriptionsTab';
import InvoicesTab from '../../components/finance/InvoicesTab';
import TransactionsTab from '../../components/finance/TransactionsTab';
import RefundsTab from '../../components/finance/RefundsTab';
import PayoutsTab from '../../components/finance/PayoutsTab';
import RevenueAnalyticsTab from '../../components/finance/RevenueAnalyticsTab';
import CouponsTab from '../../components/finance/CouponsTab';
import TaxManagementTab from '../../components/finance/TaxManagementTab';
import BillingSettingsTab from '../../components/finance/BillingSettingsTab';
import PaymentGatewaysTab from '../../components/finance/PaymentGatewaysTab';
import FinancialReportsTab from '../../components/finance/FinancialReportsTab';

type PageTab =
  | 'dashboard' | 'payments' | 'subscriptions' | 'invoices' | 'transactions'
  | 'refunds' | 'payouts' | 'analytics' | 'coupons' | 'tax' | 'settings' | 'gateways' | 'reports';

const TABS: { key: PageTab; label: string }[] = [
  { key: 'dashboard',     label: 'Dashboard' },
  { key: 'payments',      label: 'Payments' },
  { key: 'subscriptions', label: 'Subscriptions' },
  { key: 'invoices',      label: 'Invoices' },
  { key: 'transactions',  label: 'Transactions' },
  { key: 'refunds',       label: 'Refunds' },
  { key: 'payouts',       label: 'Payouts' },
  { key: 'analytics',     label: 'Revenue Analytics' },
  { key: 'coupons',       label: 'Coupons' },
  { key: 'tax',           label: 'Tax Management' },
  { key: 'settings',      label: 'Billing Settings' },
  { key: 'gateways',      label: 'Payment Gateways' },
  { key: 'reports',       label: 'Financial Reports' },
];

export default function FinancePage() {
  const [tabKey, setTabKey] = useTabParam('dashboard');
  const tab = (TABS.some(t => t.key === tabKey) ? tabKey : 'dashboard') as PageTab;

  const { toasts, showToast, dismiss } = useToast();
  // Passed to every tab so each mounts fresh when the page itself remounts;
  // per-tab mutations refetch themselves directly (see each tab's fetchList).
  const [refreshSignal] = useState(0);

  const [autoOpenInvoice, setAutoOpenInvoice] = useState(false);
  const [autoOpenPayouts, setAutoOpenPayouts] = useState(false);
  const [autoOpenCoupons, setAutoOpenCoupons] = useState(false);
  const [autoOpenTax, setAutoOpenTax] = useState(false);

  function setTab(t: PageTab) { setTabKey(t); }

  async function handleExportFinancialData() {
    setTab('reports');
  }

  return (
    <AdminLayout pageTitle="Finance">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1440, margin: '0 auto' }}>
        <FinancePageHeader
          onExport={handleExportFinancialData}
          onGenerateInvoice={() => { setTab('invoices'); setAutoOpenInvoice(true); }}
          onCalculatePayouts={() => { setTab('payouts'); setAutoOpenPayouts(true); }}
          onManageCoupons={() => { setTab('coupons'); setAutoOpenCoupons(true); }}
          onTaxSettings={() => { setTab('tax'); setAutoOpenTax(true); }}
        />

        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}>
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <button
                key={t.key} type="button" onClick={() => setTab(t.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', fontSize: 13, fontWeight: 600,
                  fontFamily: 'inherit', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                  border: 'none', borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                  color: active ? '#2563eb' : '#64748b', marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'dashboard' ? (
          <DashboardTab refreshSignal={refreshSignal} />
        ) : tab === 'payments' ? (
          <PaymentsTab showToast={showToast} refreshSignal={refreshSignal} />
        ) : tab === 'subscriptions' ? (
          <SubscriptionsTab showToast={showToast} refreshSignal={refreshSignal} />
        ) : tab === 'invoices' ? (
          <InvoicesTab showToast={showToast} refreshSignal={refreshSignal} autoOpenCreate={autoOpenInvoice} onAutoOpenHandled={() => setAutoOpenInvoice(false)} />
        ) : tab === 'transactions' ? (
          <TransactionsTab refreshSignal={refreshSignal} />
        ) : tab === 'refunds' ? (
          <RefundsTab showToast={showToast} refreshSignal={refreshSignal} />
        ) : tab === 'payouts' ? (
          <PayoutsTab showToast={showToast} refreshSignal={refreshSignal} autoOpenCalculate={autoOpenPayouts} onAutoOpenHandled={() => setAutoOpenPayouts(false)} />
        ) : tab === 'analytics' ? (
          <RevenueAnalyticsTab refreshSignal={refreshSignal} />
        ) : tab === 'coupons' ? (
          <CouponsTab showToast={showToast} refreshSignal={refreshSignal} autoOpenCreate={autoOpenCoupons} onAutoOpenHandled={() => setAutoOpenCoupons(false)} />
        ) : tab === 'tax' ? (
          <TaxManagementTab showToast={showToast} refreshSignal={refreshSignal} autoOpenCreate={autoOpenTax} onAutoOpenHandled={() => setAutoOpenTax(false)} />
        ) : tab === 'settings' ? (
          <BillingSettingsTab showToast={showToast} refreshSignal={refreshSignal} />
        ) : tab === 'gateways' ? (
          <PaymentGatewaysTab />
        ) : (
          <FinancialReportsTab showToast={showToast} />
        )}
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </AdminLayout>
  );
}
