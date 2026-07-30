import { useEffect } from 'react';

import { Route, Switch, useLocation } from 'wouter';

import { ROUTES, LEGACY_SETTINGS_PATH } from '@/lib/routes';
import { AuthScreen } from '@/pages/AuthScreen';
import { LoadingScreen } from '@/pages/LoadingScreen';
import { Workspace } from '@/pages/Workspace';
import { WorkspaceSetup } from '@/pages/WorkspaceSetup';

function RedirectToLoading() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(ROUTES.LOADING);
  }, [setLocation]);
  return null;
}

function RedirectLegacySettings() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(ROUTES.WORKSPACE_SETTINGS);
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
      <Route path={LEGACY_SETTINGS_PATH} component={RedirectLegacySettings} />

      <Route path={ROUTES.WORKSPACE_SETTINGS}>
        <Workspace panel="settings" />
      </Route>
      <Route path={ROUTES.WORKSPACE_ABOUT}>
        <Workspace panel="about" />
      </Route>
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
