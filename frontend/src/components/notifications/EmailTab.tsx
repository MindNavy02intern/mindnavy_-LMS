import ChannelLogsTab from './ChannelLogsTab';

export default function EmailTab({ refreshSignal }: { refreshSignal: number }) {
  return <ChannelLogsTab channel="EMAIL" refreshSignal={refreshSignal} />;
}
