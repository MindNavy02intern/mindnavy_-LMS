import { useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { useTabParam } from '../../hooks/useTabParam';
import { useToast, ToastContainer } from '../../components/users/Toast';
import IntegrationsPageHeader from '../../components/integrations/IntegrationsPageHeader';
import IntegrationsStatsCards from '../../components/integrations/IntegrationsStatsCards';
import DashboardTab from '../../components/integrations/DashboardTab';
import AllIntegrationsTab from '../../components/integrations/AllIntegrationsTab';
import PaymentTab from '../../components/integrations/PaymentTab';
import VideoTab from '../../components/integrations/VideoTab';
import EmailSmsTab from '../../components/integrations/EmailSmsTab';
import HrErpTab from '../../components/integrations/HrErpTab';
import CrmTab from '../../components/integrations/CrmTab';
import StorageTab from '../../components/integrations/StorageTab';
import AuthSsoTab from '../../components/integrations/AuthSsoTab';
import ApiKeysTab from '../../components/integrations/ApiKeysTab';
import WebhooksTab from '../../components/integrations/WebhooksTab';
import DataSyncTab from '../../components/integrations/DataSyncTab';
import LogsTab from '../../components/integrations/LogsTab';
import MarketplaceTab from '../../components/integrations/MarketplaceTab';
import GenerateApiKeyModal from '../../components/integrations/GenerateApiKeyModal';
import CreateWebhookModal from '../../components/integrations/CreateWebhookModal';

// Tab slugs mirror docs/blueprint/pages/11-integrations.md (?tab=).
type PageTab =
  | 'dashboard' | 'all' | 'payment' | 'video' | 'email' | 'hr' | 'crm'
  | 'storage' | 'auth' | 'api' | 'webhooks' | 'sync' | 'logs' | 'marketplace';

const TABS: { key: PageTab; label: string }[] = [
  { key: 'dashboard',    label: 'Dashboard' },
  { key: 'all',          label: 'All Integrations' },
  { key: 'payment',      label: 'Payment' },
  { key: 'video',        label: 'Video' },
  { key: 'email',        label: 'Email & SMS' },
  { key: 'hr',           label: 'HR & ERP' },
  { key: 'crm',          label: 'CRM' },
  { key: 'storage',      label: 'Storage' },
  { key: 'auth',         label: 'Auth & SSO' },
  { key: 'api',          label: 'API Keys' },
  { key: 'webhooks',     label: 'Webhooks' },
  { key: 'sync',         label: 'Data Sync' },
  { key: 'logs',         label: 'Logs' },
  { key: 'marketplace',  label: 'Marketplace' },
];

export default function IntegrationsPage() {
  const [tabKey, setTabKey] = useTabParam('dashboard');
  const tab = (TABS.some(t => t.key === tabKey) ? tabKey : 'dashboard') as PageTab;

  const { toasts, showToast, dismiss } = useToast();

  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);

  const [refreshSignal, setRefreshSignal] = useState(0);
  function bumpRefresh() { setRefreshSignal(s => s + 1); }

  function setTab(t: PageTab) { setTabKey(t); }

  return (
    <AdminLayout pageTitle="Integrations">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1440, margin: '0 auto' }}>
        <IntegrationsPageHeader
          onAddIntegration={() => setTab('all')}
          onGenerateApiKey={() => setApiKeyModalOpen(true)}
          onCreateWebhook={() => setWebhookModalOpen(true)}
          onViewLogs={() => setTab('logs')}
          onDataSync={() => setTab('sync')}
          onMarketplace={() => setTab('marketplace')}
        />

        <IntegrationsStatsCards refreshSignal={refreshSignal} />

        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}>
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
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

        <div>
          {tab === 'dashboard' ? (
            <DashboardTab showToast={showToast} refreshSignal={refreshSignal} onBumpRefresh={bumpRefresh} />
          ) : tab === 'all' ? (
            <AllIntegrationsTab showToast={showToast} refreshSignal={refreshSignal} onBumpRefresh={bumpRefresh} />
          ) : tab === 'payment' ? (
            <PaymentTab showToast={showToast} refreshSignal={refreshSignal} />
          ) : tab === 'video' ? (
            <VideoTab showToast={showToast} refreshSignal={refreshSignal} onBumpRefresh={bumpRefresh} />
          ) : tab === 'email' ? (
            <EmailSmsTab showToast={showToast} refreshSignal={refreshSignal} onBumpRefresh={bumpRefresh} />
          ) : tab === 'hr' ? (
            <HrErpTab showToast={showToast} refreshSignal={refreshSignal} />
          ) : tab === 'crm' ? (
            <CrmTab showToast={showToast} refreshSignal={refreshSignal} />
          ) : tab === 'storage' ? (
            <StorageTab showToast={showToast} refreshSignal={refreshSignal} onBumpRefresh={bumpRefresh} />
          ) : tab === 'auth' ? (
            <AuthSsoTab showToast={showToast} refreshSignal={refreshSignal} />
          ) : tab === 'api' ? (
            <ApiKeysTab showToast={showToast} refreshSignal={refreshSignal} onBumpRefresh={bumpRefresh} onGenerate={() => setApiKeyModalOpen(true)} />
          ) : tab === 'webhooks' ? (
            <WebhooksTab showToast={showToast} refreshSignal={refreshSignal} onBumpRefresh={bumpRefresh} onCreate={() => setWebhookModalOpen(true)} />
          ) : tab === 'sync' ? (
            <DataSyncTab showToast={showToast} refreshSignal={refreshSignal} onBumpRefresh={bumpRefresh} />
          ) : tab === 'logs' ? (
            <LogsTab refreshSignal={refreshSignal} />
          ) : (
            <MarketplaceTab showToast={showToast} refreshSignal={refreshSignal} onNavigate={(t) => setTab(t as PageTab)} />
          )}
        </div>
      </div>

      {apiKeyModalOpen && (
        <GenerateApiKeyModal
          onClose={() => setApiKeyModalOpen(false)}
          onSuccess={() => { setApiKeyModalOpen(false); bumpRefresh(); }}
          showToast={showToast}
        />
      )}

      {webhookModalOpen && (
        <CreateWebhookModal
          mode="create"
          onClose={() => setWebhookModalOpen(false)}
          onSuccess={() => { setWebhookModalOpen(false); bumpRefresh(); }}
          showToast={showToast}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </AdminLayout>
  );
}
