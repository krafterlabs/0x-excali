import { useCallback, useEffect, useMemo, useState } from 'react';

import { Link2 } from 'lucide-react';
import { useLocation } from 'wouter';

import { RepositoryPicker } from '@/components/github/repository-picker';
import { PageShell } from '@/components/layout/page-shell';
import { ErrorBanner } from '@/components/shared/error-banner';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import { useGitHubRepositories } from '@/hooks/use-github-repositories';
import { setLinkGitHubIntent, consumeLinkGitHubIntent } from '@/lib/auth-flow';
import { ROUTES } from '@/lib/routes';
import { getLinkedGitHubMessage, shouldShowLinkRepos } from '@/lib/settings-github';
import { TIMING } from '@/lib/timing';
import type { AuthUser, GitHubRepository } from '@/types/github';

function GitHubAccountSection({
  authUser,
  isLocalOnly,
  onConnect,
}: {
  authUser: AuthUser | null;
  isLocalOnly: boolean;
  onConnect: () => void;
}) {
  if (!authUser) {
    return (
      <>
        <p className="text-sm text-muted-foreground">
          You are using 0x-excali offline. Diagrams are saved on this device only.
        </p>
        <Button onClick={onConnect} className="w-full gap-2">
          <Link2 className="h-4 w-4" />
          Connect GitHub account
        </Button>
      </>
    );
  }

  const linkedMessage = getLinkedGitHubMessage(isLocalOnly);

  return (
    <>
      <div>
        <p className="text-sm font-medium">{authUser.username}</p>
        <p className="text-xs text-muted-foreground">{authUser.email || 'GitHub account'}</p>
      </div>
      {linkedMessage && <p className="text-xs text-muted-foreground">{linkedMessage}</p>}
    </>
  );
}

export function Settings() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<number | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isLocalOnly, setIsLocalOnly] = useState(true);
  const [pageError, setPageError] = useState('');

  const searchParams = useMemo(
    () => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''),
    []
  );

  const showLinkRepos = shouldShowLinkRepos(authUser, isLocalOnly, searchParams);

  const {
    filteredRepos,
    loading: reposLoading,
    error: reposError,
    searchQuery,
    setSearchQuery,
  } = useGitHubRepositories({ enabled: showLinkRepos });

  const loadState = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const { GetAuthStatus } = await import('../../wailsjs/go/github/AuthService');
      const { IsLocalOnly } = await import('../../wailsjs/go/settings/Service');

      const auth = await GetAuthStatus();
      setAuthUser(
        auth?.authenticated
          ? {
              username: auth.username,
              avatar_url: auth.avatar_url,
              email: auth.email,
            }
          : null
      );

      setIsLocalOnly(await IsLocalOnly());
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
    consumeLinkGitHubIntent();
  }, [loadState]);

  const handleConnectGitHub = () => {
    setLinkGitHubIntent();
    setLocation(ROUTES.AUTH);
  };

  const handleLinkRepo = async (repo: GitHubRepository) => {
    setLinking(repo.id);
    setPageError('');
    try {
      const { LinkGitHubRepository } = await import('../../wailsjs/go/workspace/Service');
      const { DisableLocalMode } = await import('../../wailsjs/go/settings/Service');
      await LinkGitHubRepository(repo);
      await DisableLocalMode();
      toast.add({
        title: 'GitHub linked',
        description: `Your local diagrams are syncing to ${repo.full_name}.`,
        type: 'success',
        timeout: TIMING.TOAST_DURATION_MS,
      });
      setLocation(ROUTES.WORKSPACE);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to link repository');
      setLinking(null);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <PageShell title="Settings" onBack={() => setLocation(ROUTES.WORKSPACE)}>
      <div className="space-y-6">
        <ErrorBanner message={pageError} />

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-foreground">GitHub</h2>
          <Card className="border-border/50">
            <CardContent className="space-y-4 p-4">
              <GitHubAccountSection
                authUser={authUser}
                isLocalOnly={isLocalOnly}
                onConnect={handleConnectGitHub}
              />
            </CardContent>
          </Card>
        </section>

        {showLinkRepos && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-foreground">Link repository</h2>
            <RepositoryPicker
              repos={filteredRepos}
              loading={reposLoading}
              error={reposError}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelect={handleLinkRepo}
              processingRepoId={linking}
              disabled={linking !== null}
              listClassName="max-h-[min(360px,40vh)] overflow-y-auto"
            />
          </section>
        )}
      </div>
    </PageShell>
  );
}
