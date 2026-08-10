import ChannelLogsTab from './ChannelLogsTab';

export default function PushTab({ refreshSignal }: { refreshSignal: number }) {
  return <ChannelLogsTab channel="PUSH" refreshSignal={refreshSignal} banner="Push notifications require FCM integration — coming soon. Sends are logged as Pending." />;
}
