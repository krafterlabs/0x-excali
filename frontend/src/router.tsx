import { useEffect } from 'react';

import { Route, Switch, useLocation } from 'wouter';

import { ROUTES } from '@/lib/routes';
import { AuthScreen } from '@/pages/AuthScreen';
import { LoadingScreen } from '@/pages/LoadingScreen';
import { Settings } from '@/pages/Settings';
import { Workspace } from '@/pages/Workspace';
import { WorkspaceSetup } from '@/pages/WorkspaceSetup';

function RedirectToLoading() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(ROUTES.LOADING);
  }, [setLocation]);
  return null;
}

export function AppRouter() {
  return (
    <Switch>
      <Route path={ROUTES.HOME} component={RedirectToLoading} />
      <Route path={ROUTES.LOADING} component={LoadingScreen} />
      <Route path={ROUTES.AUTH} component={AuthScreen} />
      <Route path={ROUTES.SETUP_WORKSPACE} component={WorkspaceSetup} />
      <Route path={ROUTES.SETTINGS} component={Settings} />

      <Route path={ROUTES.WORKSPACE}>
        <Workspace />
      </Route>
      <Route path={`${ROUTES.WORKSPACE}/:id`}>
        {(params) => <Workspace fileId={params.id} />}
      </Route>

      <Route>
        <RedirectToLoading />
      </Route>
    </Switch>
  );
}
