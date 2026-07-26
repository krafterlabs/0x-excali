import { useEffect } from 'react';

import { Route, Switch, useLocation } from 'wouter';

import { AuthScreen } from '@/pages/AuthScreen';
import { LoadingScreen } from '@/pages/LoadingScreen';
import { Workspace } from '@/pages/Workspace';
import { WorkspaceSetup } from '@/pages/WorkspaceSetup';

function RedirectToLoading() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation('/loading');
  }, [setLocation]);
  return null;
}

export function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={RedirectToLoading} />
      <Route path="/loading" component={LoadingScreen} />
      <Route path="/auth" component={AuthScreen} />
      <Route path="/setup-workspace" component={WorkspaceSetup} />

      <Route path="/workspace">
        <Workspace />
      </Route>
      <Route path="/workspace/:id">{(params) => <Workspace fileId={params.id} />}</Route>

      <Route>
        <RedirectToLoading />
      </Route>
    </Switch>
  );
}
