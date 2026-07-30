import { ROUTES } from '@/lib/routes';
import { TIMING } from '@/lib/timing';

export type StartupRoute =
  | typeof ROUTES.WORKSPACE
  | typeof ROUTES.SETUP_WORKSPACE
  | typeof ROUTES.AUTH;

export interface StartupNavigation {
  status: string;
  route: StartupRoute;
  delayMs: number;
}

interface ResolveStartupNavigationInput {
  authenticated: boolean;
  localOnly: boolean;
  hasWorkspace: boolean;
  username?: string;
}

export function resolveStartupNavigation({
  authenticated,
  localOnly,
  hasWorkspace,
  username = '',
}: ResolveStartupNavigationInput): StartupNavigation {
  if (authenticated) {
    return {
      status: username ? `Welcome back, ${username}` : 'Welcome back',
      route: hasWorkspace ? ROUTES.WORKSPACE : ROUTES.SETUP_WORKSPACE,
      delayMs: TIMING.ROUTE_TRANSITION_MS,
    };
  }

  if (localOnly) {
    return {
      status: 'Loading local workspace...',
      route: hasWorkspace ? ROUTES.WORKSPACE : ROUTES.AUTH,
      delayMs: TIMING.ROUTE_TRANSITION_MS,
    };
  }

  return {
    status: 'Authentication required',
    route: ROUTES.AUTH,
    delayMs: TIMING.AUTH_ROUTE_DELAY_MS,
  };
}
