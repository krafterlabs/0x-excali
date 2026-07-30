import { useEffect, useState } from 'react';

const FALLBACK_VERSION = 'dev';

export function useAppVersion() {
  const [version, setVersion] = useState(FALLBACK_VERSION);

  useEffect(() => {
    let cancelled = false;

    async function loadVersion() {
      try {
        const { GetAppVersion } = await import('../../wailsjs/go/main/App');
        const value = await GetAppVersion();
        if (!cancelled && value) {
          setVersion(value);
        }
      } catch {
        if (!cancelled) {
          setVersion(FALLBACK_VERSION);
        }
      }
    }

    void loadVersion();
    return () => {
      cancelled = true;
    };
  }, []);

  return version;
}
