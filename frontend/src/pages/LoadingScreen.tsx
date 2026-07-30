import { useEffect, useState } from 'react';

import { useLocation } from 'wouter';

import { resolveStartupNavigation } from '@/lib/startup-navigation';
import { TIMING } from '@/lib/timing';

export function LoadingScreen() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    let cancelled = false;

    const scheduleRoute = (route: string, delayMs: number) => {
      setTimeout(() => {
        if (!cancelled) {
          setLocation(route);
        }
      }, delayMs);
    };

    async function checkAuth() {
      try {
        setStatus('Connecting to backend...');

        const { GetAuthStatus } = await import('../../wailsjs/go/github/AuthService');
        const { GetActiveWorkspace, SelectLocalWorkspace } =
          await import('../../wailsjs/go/workspace/Service');
        const { IsLocalOnly } = await import('../../wailsjs/go/settings/Service');

        const auth = await GetAuthStatus();
        const localOnly = await IsLocalOnly();

        if (cancelled) return;

        let hasWorkspace = Boolean(await GetActiveWorkspace());

        if (!auth.authenticated && localOnly && !hasWorkspace) {
          await SelectLocalWorkspace();
          hasWorkspace = Boolean(await GetActiveWorkspace());
        }

        if (cancelled) return;

        const navigation = resolveStartupNavigation({
          authenticated: auth.authenticated,
          localOnly,
          hasWorkspace,
          username: auth.username,
        });

        setStatus(navigation.status);
        scheduleRoute(navigation.route, navigation.delayMs);
      } catch {
        if (cancelled) return;

        setStatus('Starting up...');
        setTimeout(() => {
          if (!cancelled) {
            void checkAuth();
          }
        }, TIMING.STARTUP_RETRY_MS);
      }
    }

    const timer = setTimeout(checkAuth, TIMING.STARTUP_INITIAL_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [setLocation]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background">
      <div className="relative mb-8">
        <div className="absolute inset-0 animate-pulse-slow rounded-2xl bg-gradient-to-r from-violet-500/20 via-transparent to-cyan-500/20 blur-xl" />

        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden shadow-xl">
          <img src="/logo.png" alt="0x" className="h-full w-full object-cover" />
        </div>
      </div>

      <h1 className="mb-2 text-xl font-semibold tracking-tight text-foreground">0x-excali</h1>
      <p className="text-sm text-muted-foreground">{status}</p>

      <div className="mt-6 h-0.5 w-48 overflow-hidden rounded-full bg-border/30">
        <div className="h-full animate-loading-bar rounded-full bg-gradient-to-r from-violet-500 to-cyan-500" />
      </div>
    </div>
  );
}
