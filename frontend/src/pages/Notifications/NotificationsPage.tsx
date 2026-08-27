import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { useTabParam } from '../../hooks/useTabParam';
import { useToast, ToastContainer } from '../../components/users/Toast';
import NotificationsPageHeader from '../../components/notifications/NotificationsPageHeader';
import NotificationsStatsCards from '../../components/notifications/NotificationsStatsCards';
import DashboardTab from '../../components/notifications/DashboardTab';
import InAppTab from '../../components/notifications/InAppTab';
import EmailTab from '../../components/notifications/EmailTab';
import PushTab from '../../components/notifications/PushTab';
import SmsTab from '../../components/notifications/SmsTab';
import AnnouncementsTab from '../../components/notifications/AnnouncementsTab';
import TemplatesTab from '../../components/notifications/TemplatesTab';
import AutomationsTab from '../../components/notifications/AutomationsTab';
import ScheduledTab from '../../components/notifications/ScheduledTab';
import PreferencesTab from '../../components/notifications/PreferencesTab';
import DeliveryLogsTab from '../../components/notifications/DeliveryLogsTab';
import AnalyticsTab from '../../components/notifications/AnalyticsTab';
import EmergencyAlertsTab from '../../components/notifications/EmergencyAlertsTab';
import SendNotificationModal from '../../components/notifications/SendNotificationModal';
import CreateEditAnnouncementModal from '../../components/notifications/CreateEditAnnouncementModal';
import CreateEditTemplateModal from '../../components/notifications/CreateEditTemplateModal';
import CreateEditAutomationModal from '../../components/notifications/CreateEditAutomationModal';

// Tab slugs mirror docs/blueprint/pages/10-notifications.md exactly (?tab=)
// — the canonical contract other surfaces (nav, quick actions) link into.
type PageTab =
  | 'dashboard' | 'inapp' | 'email' | 'push' | 'sms' | 'announcements'
  | 'templates' | 'automation' | 'scheduled' | 'preferences' | 'logs'
  | 'analytics' | 'emergency';

const TABS: { key: PageTab; label: string }[] = [
  { key: 'dashboard',     label: 'Dashboard' },
  { key: 'inapp',         label: 'In-App' },
  { key: 'email',         label: 'Email' },
  { key: 'push',          label: 'Push' },
  { key: 'sms',           label: 'SMS' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'templates',     label: 'Templates' },
  { key: 'automation',    label: 'Automations' },
  { key: 'scheduled',     label: 'Scheduled' },
  { key: 'preferences',   label: 'Preferences' },
  { key: 'logs',          label: 'Delivery Logs' },
  { key: 'analytics',     label: 'Analytics' },
  { key: 'emergency',     label: 'Emergency Alerts' },
];

export default function NotificationsPage() {
  const [tabKey, setTabKey] = useTabParam('dashboard');
  const tab = (TABS.some(t => t.key === tabKey) ? tabKey : 'dashboard') as PageTab;

  const { toasts, showToast, dismiss } = useToast();

  const [sendOpen, setSendOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);

  // Deep link from Quick Actions (?modal=send) — same query-param-opens-modal
  // convention as /users?modal=addUser. Only 'modal' is cleared so the
  // ?tab= this page's own tab state lives in is left untouched.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('modal') === 'send') {
      setSendOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('modal');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [refreshSignal, setRefreshSignal] = useState(0);
  function bumpRefresh() { setRefreshSignal(s => s + 1); }

  function setTab(t: PageTab) { setTabKey(t); }

  return (
    <AdminLayout pageTitle="Notifications">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1440, margin: '0 auto' }}>
        <NotificationsPageHeader
          onSendNotification={() => setSendOpen(true)}
          onCreateAnnouncement={() => setAnnouncementOpen(true)}
          onCreateTemplate={() => setTemplateOpen(true)}
          onCreateAutomation={() => setAutomationOpen(true)}
          onEmergencyAlert={() => setTab('emergency')}
          onViewLogs={() => setTab('logs')}
        />

        <NotificationsStatsCards refreshSignal={refreshSignal} />

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
            <DashboardTab refreshSignal={refreshSignal} onNavigate={setTab} />
          ) : tab === 'inapp' ? (
            <InAppTab showToast={showToast} refreshSignal={refreshSignal} onBumpRefresh={bumpRefresh} onSend={() => setSendOpen(true)} />
          ) : tab === 'email' ? (
            <EmailTab refreshSignal={refreshSignal} />
          ) : tab === 'push' ? (
            <PushTab refreshSignal={refreshSignal} />
          ) : tab === 'sms' ? (
            <SmsTab refreshSignal={refreshSignal} />
          ) : tab === 'announcements' ? (
            <AnnouncementsTab
              showToast={showToast}
              refreshSignal={refreshSignal}
              onBumpRefresh={bumpRefresh}
              onCreate={() => setAnnouncementOpen(true)}
            />
          ) : tab === 'templates' ? (
            <TemplatesTab showToast={showToast} refreshSignal={refreshSignal} onBumpRefresh={bumpRefresh} onCreate={() => setTemplateOpen(true)} />
          ) : tab === 'automation' ? (
            <AutomationsTab showToast={showToast} refreshSignal={refreshSignal} onBumpRefresh={bumpRefresh} onCreate={() => setAutomationOpen(true)} />
          ) : tab === 'scheduled' ? (
            <ScheduledTab showToast={showToast} refreshSignal={refreshSignal} onBumpRefresh={bumpRefresh} />
          ) : tab === 'preferences' ? (
            <PreferencesTab showToast={showToast} />
          ) : tab === 'logs' ? (
            <DeliveryLogsTab showToast={showToast} refreshSignal={refreshSignal} onBumpRefresh={bumpRefresh} />
          ) : tab === 'analytics' ? (
            <AnalyticsTab refreshSignal={refreshSignal} />
          ) : (
            <EmergencyAlertsTab showToast={showToast} refreshSignal={refreshSignal} onBumpRefresh={bumpRefresh} />
          )}
        </div>
      </div>

      {sendOpen && (
        <SendNotificationModal
          onClose={() => setSendOpen(false)}
          onSuccess={() => { setSendOpen(false); bumpRefresh(); }}
          showToast={showToast}
        />
      )}

      {announcementOpen && (
        <CreateEditAnnouncementModal
          mode="create"
          onClose={() => setAnnouncementOpen(false)}
          onSuccess={() => { setAnnouncementOpen(false); bumpRefresh(); }}
          showToast={showToast}
        />
      )}

      {templateOpen && (
        <CreateEditTemplateModal
          mode="create"
          onClose={() => setTemplateOpen(false)}
          onSuccess={() => { setTemplateOpen(false); bumpRefresh(); }}
          showToast={showToast}
        />
      )}

      {automationOpen && (
        <CreateEditAutomationModal
          mode="create"
          onClose={() => setAutomationOpen(false)}
          onSuccess={() => { setAutomationOpen(false); bumpRefresh(); }}
          showToast={showToast}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </AdminLayout>
  );
}
