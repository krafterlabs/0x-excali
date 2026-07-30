import { useEffect, useMemo, useState } from 'react';

import { Loader2 } from 'lucide-react';

import { RepositoryPicker } from '@/components/github/repository-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useGitHubRepositories } from '@/hooks/use-github-repositories';
import type { GitHubRepository } from '@/types/github';

interface WorkspaceSwitcherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeRepoId?: number;
  activeRepoName?: string;
  hasCurrentPendingChanges?: boolean;
  onSwitch: (repo: GitHubRepository) => Promise<void>;
}

export function WorkspaceSwitcherDialog({
  open,
  onOpenChange,
  activeRepoId,
  activeRepoName,
  hasCurrentPendingChanges = false,
  onSwitch,
}: WorkspaceSwitcherDialogProps) {
  const [switching, setSwitching] = useState<number | null>(null);
  const [confirmRepo, setConfirmRepo] = useState<GitHubRepository | null>(null);

  const {
    filteredRepos,
    pendingByRepo,
    loading,
    error,
    setError,
    searchQuery,
    setSearchQuery,
  } = useGitHubRepositories({ enabled: open, loadPendingStatus: true });

  const pendingRepoIds = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(pendingByRepo).map(([id, status]) => [Number(id), status.has_pending])
      ),
    [pendingByRepo]
  );

  useEffect(() => {
    if (!open) {
      setConfirmRepo(null);
      setError('');
    }
  }, [open, setError]);

  const handleSelectRepo = async (repo: GitHubRepository) => {
    if (repo.id === activeRepoId || switching !== null) return;

    if (hasCurrentPendingChanges) {
      setConfirmRepo(repo);
      return;
    }

    await performSwitch(repo);
  };

  const performSwitch = async (repo: GitHubRepository) => {
    setSwitching(repo.id);
    setError('');
    try {
      await onSwitch(repo);
      setConfirmRepo(null);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch repository');
    } finally {
      setSwitching(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !switching && onOpenChange(next)}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="px-5 pb-3 pt-5">
          <DialogTitle className="text-base">Switch repository</DialogTitle>
          <DialogDescription>
            Choose a GitHub repository to work in. Unsynced changes stay saved locally per
            repository.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-3">
          <RepositoryPicker
            repos={filteredRepos}
            loading={loading}
            error={error}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelect={handleSelectRepo}
            activeRepoId={activeRepoId}
            pendingRepoIds={pendingRepoIds}
            processingRepoId={switching}
            disabled={switching !== null}
            listClassName="max-h-[min(420px,50vh)] overflow-y-auto border-y border-border/50 py-2"
          />
        </div>

        {confirmRepo && (
          <div className="border-t border-border/50 bg-muted/30 px-5 py-4">
            <p className="mb-3 text-sm text-foreground">
              You have unsaved changes in{' '}
              <span className="font-medium">{activeRepoName}</span>. They&apos;ll stay on this
              device until you sync.
            </p>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => setConfirmRepo(null)} disabled={!!switching}>
                Cancel
              </Button>
              <Button onClick={() => performSwitch(confirmRepo)} disabled={!!switching}>
                {switching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Switch anyway
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
