import { useCallback, useState } from 'react';

import { GitBranch, Link2, User } from 'lucide-react';

import { GitHubDeviceFlow } from '@/components/github/github-device-flow';
import { RepositoryPicker } from '@/components/github/repository-picker';
import { WorkspacePanelLayout } from '@/components/layout/workspace-panel-layout';
import { ErrorBanner } from '@/components/shared/error-banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import { useGitHubRepositories } from '@/hooks/use-github-repositories';
import { getLinkedGitHubMessage } from '@/lib/settings-github';
import { TIMING } from '@/lib/timing';
import type { AuthUser, GitHubRepository } from '@/types/github';

interface WorkspaceSettingsPanelProps {
  authUser: AuthUser | null;
  isLocalMode: boolean;
  workspaceName?: string;
  onAuthUpdated: (user: AuthUser | null) => void;
  onLocalModeChanged: (localOnly: boolean) => void;
  onRepositoryLinked: () => Promise<void>;
  onOpenRepoSwitcher?: () => void;
}

export function WorkspaceSettingsPanel({
  authUser,
  isLocalMode,
  workspaceName,
  onAuthUpdated,
  onLocalModeChanged,
  onRepositoryLinked,
  onOpenRepoSwitcher,
}: WorkspaceSettingsPanelProps) {
  const [pageError, setPageError] = useState('');
  const [linking, setLinking] = useState<number | null>(null);
  const [showGitHubFlow, setShowGitHubFlow] = useState(false);

  const showLinkRepos = Boolean(authUser) && isLocalMode;

  const {
    filteredRepos,
    loading: reposLoading,
    error: reposError,
    searchQuery,
    setSearchQuery,
  } = useGitHubRepositories({ enabled: showLinkRepos });

  const refreshAuthState = useCallback(async () => {
    try {
      const { GetAuthStatus } = await import('../../../wailsjs/go/github/AuthService');
      const { IsLocalOnly } = await import('../../../wailsjs/go/settings/Service');

      const auth = await GetAuthStatus();
      onAuthUpdated(
        auth?.authenticated
          ? {
              username: auth.username,
              avatar_url: auth.avatar_url,
              email: auth.email,
            }
          : null
      );
      onLocalModeChanged(await IsLocalOnly());
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to refresh account state');
    }
  }, [onAuthUpdated, onLocalModeChanged]);

  const handleGitHubComplete = useCallback(async () => {
    setShowGitHubFlow(false);
    await refreshAuthState();
  }, [refreshAuthState]);

  const handleLinkRepo = async (repo: GitHubRepository) => {
    setLinking(repo.id);
    setPageError('');
    try {
      const { LinkGitHubRepository } = await import('../../../wailsjs/go/workspace/Service');
      const { DisableLocalMode } = await import('../../../wailsjs/go/settings/Service');
      await LinkGitHubRepository(repo);
      await DisableLocalMode();
      onLocalModeChanged(false);
      await onRepositoryLinked();
      setLinking(null);
      toast.add({
        title: 'GitHub linked',
        description: `Your local diagrams are syncing to ${repo.full_name}.`,
        type: 'success',
        timeout: TIMING.TOAST_DURATION_MS,
      });
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to link repository');
      setLinking(null);
    }
  };

  const linkedMessage = authUser ? getLinkedGitHubMessage(isLocalMode) : null;

  return (
    <WorkspacePanelLayout
      title="Settings"
      description="Manage your account, GitHub connection, and workspace preferences."
    >
      <ErrorBanner message={pageError} />

      <section className="space-y-3">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Account
            </CardTitle>
            <CardDescription>How you are signed in to this workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {isLocalMode && !authUser && (
              <p className="text-muted-foreground">
                You are using 0x-excali offline. Diagrams are saved on this device only.
              </p>
            )}
            {authUser && (
              <>
                <p className="font-medium">{authUser.username}</p>
                <p className="text-xs text-muted-foreground">
                  {authUser.email || 'GitHub account'}
                </p>
              </>
            )}
            {!authUser && !isLocalMode && (
              <p className="text-muted-foreground">Not signed in to GitHub.</p>
            )}
            {isLocalMode && (
              <p className="text-xs text-muted-foreground">Offline mode is active.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-4 w-4" />
              GitHub
            </CardTitle>
            <CardDescription>
              Connect your account and choose where diagrams are synced.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!authUser && !showGitHubFlow && (
              <>
                <p className="text-sm text-muted-foreground">
                  {isLocalMode
                    ? 'Connect GitHub to back up and sync your local diagrams.'
                    : 'Sign in with GitHub to use remote repositories.'}
                </p>
                <Button onClick={() => setShowGitHubFlow(true)} className="gap-2">
                  <Link2 className="h-4 w-4" />
                  Connect GitHub account
                </Button>
              </>
            )}

            {showGitHubFlow && !authUser && (
              <GitHubDeviceFlow
                embedded
                showPrivateReposOption
                onComplete={handleGitHubComplete}
                onCancel={() => setShowGitHubFlow(false)}
              />
            )}

            {authUser && (
              <div className="space-y-3">
                {linkedMessage && <p className="text-sm text-muted-foreground">{linkedMessage}</p>}
                {!isLocalMode && workspaceName && (
                  <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm">
                    <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{workspaceName}</span>
                  </div>
                )}
                {!isLocalMode && onOpenRepoSwitcher && (
                  <Button variant="outline" onClick={onOpenRepoSwitcher} className="gap-2">
                    <GitBranch className="h-4 w-4" />
                    Switch repository
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {showLinkRepos && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-foreground">Link repository</h2>
          <p className="text-xs text-muted-foreground">
            Pick a GitHub repository to sync your local diagrams.
          </p>
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
    </WorkspacePanelLayout>
  );
}
