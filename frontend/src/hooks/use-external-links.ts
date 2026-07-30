import { useEffect } from 'react';

import { isExternalURL, openExternalURL } from '@/lib/open-external-url';

export function useExternalLinks() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest('a');
      if (!anchor?.href || !isExternalURL(anchor.href)) return;
      event.preventDefault();
      void openExternalURL(anchor.href);
    };

    const originalOpen = window.open.bind(window);
    window.open = ((url?: string | URL, ...args: unknown[]) => {
      const href = typeof url === 'string' ? url : url?.toString() ?? '';
      if (isExternalURL(href)) {
        void openExternalURL(href);
        return null;
      }
      return originalOpen(url as string, ...(args as []));
    }) as typeof window.open;

    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
      window.open = originalOpen;
    };
  }, []);
}
