import { useSearchParams } from 'react-router-dom';

export function useTabParam(defaultTab: string): [string, (tab: string) => void] {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? defaultTab;
  const setTab = (t: string) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', t);
      return next;
    });
  };
  return [tab, setTab];
}
