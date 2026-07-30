import { useState } from 'react';

import { Layers, Plus } from 'lucide-react';
import { useLocation } from 'wouter';

import { CreateRepositoryDialog } from '@/components/github/create-repository-dialog';
import { RepositoryPicker } from '@/components/github/repository-picker';
import { RepositorySearchInput } from '@/components/github/repository-search-input';
import { ErrorBanner } from '@/components/shared/error-banner';
import { Button } from '@/components/ui/button';
import { useGitHubRepositories } from '@/hooks/use-github-repositories';
import { ROUTES } from '@/lib/routes';
import type { GitHubRepository } from '@/types/github';

export function WorkspaceSetup() {
  const [, setLocation] = useLocation();
  const [selecting, setSelecting] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [actionError, setActionError] = useState('');

  const {
    filteredRepos,
    loading,
    error: fetchError,
    searchQuery,
    setSearchQuery,
  } = useGitHubRepositories({ enabled: true });

  const error = actionError || fetchError;

  async function handleSelectRepo(repo: GitHubRepository) {
    setSelecting(repo.id);
    setActionError('');
    try {
      const { SelectWorkspace, PullFileTree } = await import('../../wailsjs/go/workspace/Service');
      await SelectWorkspace(repo);
      PullFileTree().catch(console.error);
      setLocation(ROUTES.WORKSPACE);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to select workspace');
      setSelecting(null);
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-background">
      <div className="border-b border-border/50 px-8 py-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-card/80">
              <Layers className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Choose a Workspace
              </h1>
              <p className="text-sm text-muted-foreground">
                Select a GitHub repository to store your diagrams
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-8 py-6">
        <div className="mx-auto flex h-full max-w-2xl flex-col">
          <div className="mb-4 flex gap-3">
            <RepositorySearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              className="flex-1"
            />
            <Button
              variant="outline"
              className="shrink-0 gap-2 self-start"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="h-4 w-4" />
              New Repository
            </Button>
          </div>

          <ErrorBanner message={error} className="mb-4" />

          <div className="flex-1 overflow-y-auto px-1">
            <RepositoryPicker
              repos={filteredRepos}
              loading={loading}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelect={handleSelectRepo}
              variant="card"
              processingRepoId={selecting}
              disabled={selecting !== null}
              showSearch={false}
              listClassName="pb-2"
            />
          </div>
        </div>
      </div>

      <CreateRepositoryDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={handleSelectRepo}
      />
    </div>
  );
}
