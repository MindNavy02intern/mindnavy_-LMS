import ChannelLogsTab from './ChannelLogsTab';

export default function SmsTab({ refreshSignal }: { refreshSignal: number }) {
  return <ChannelLogsTab channel="SMS" refreshSignal={refreshSignal} banner="SMS requires Twilio integration — coming soon. Sends are logged as Pending." />;
}
