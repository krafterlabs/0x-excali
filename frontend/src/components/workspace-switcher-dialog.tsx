import { useEffect, useMemo, useState } from 'react';

import { Check, GitBranch, Globe, Loader2, Lock, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: string;
  description: string;
  is_private: boolean;
  default_branch: string;
  updated_at: string;
}

interface RepoPendingStatus {
  repo_id: number;
  has_pending: boolean;
  dirty_count: number;
  pending_syncs: number;
}

interface WorkspaceSwitcherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeRepoId?: number;
  activeRepoName?: string;
  hasCurrentPendingChanges?: boolean;
  onSwitch: (repo: Repository) => Promise<void>;
}

export function WorkspaceSwitcherDialog({
  open,
  onOpenChange,
  activeRepoId,
  activeRepoName,
  hasCurrentPendingChanges = false,
  onSwitch,
}: WorkspaceSwitcherDialogProps) {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [pendingByRepo, setPendingByRepo] = useState<Record<number, RepoPendingStatus>>({});
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [confirmRepo, setConfirmRepo] = useState<Repository | null>(null);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setError('');
      setConfirmRepo(null);
      return;
    }

    let cancelled = false;

    async function loadRepos() {
      setLoading(true);
      setError('');
      try {
        const { ListGitHubRepositories, GetRepoPendingStatus } =
          await import('../../wailsjs/go/workspace/Service');
        const result = await ListGitHubRepositories();
        if (cancelled) return;

        const list = result || [];
        setRepos(list);

        const pendingEntries = await Promise.all(
          list.map(async (repo: Repository) => {
            const status = await GetRepoPendingStatus(repo.id);
            return [repo.id, status] as const;
          })
        );
        if (!cancelled) {
          setPendingByRepo(Object.fromEntries(pendingEntries));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load repositories');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRepos();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filteredRepos = useMemo(() => {
    if (!searchQuery) return repos;
    const q = searchQuery.toLowerCase();
    return repos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.full_name.toLowerCase().includes(q) ||
        r.default_branch.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }, [repos, searchQuery]);

  const handleSelectRepo = async (repo: Repository) => {
    if (repo.id === activeRepoId || switching !== null) return;

    if (hasCurrentPendingChanges) {
      setConfirmRepo(repo);
      return;
    }

    await performSwitch(repo);
  };

  const performSwitch = async (repo: Repository) => {
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
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base">Switch repository</DialogTitle>
          <DialogDescription>
            Choose a GitHub repository to work in. Unsynced changes stay saved locally per
            repository.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search repositories or branches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {error && (
          <div className="mx-5 mb-3 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <ScrollArea className="h-[min(420px,50vh)] border-y border-border/50">
          <div className="p-2 space-y-1">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-3">
                  <Skeleton className="h-4 w-4 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))
            ) : filteredRepos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Search className="h-8 w-8 mb-3 opacity-40" />
                <p className="text-sm">No repositories match your search</p>
              </div>
            ) : (
              filteredRepos.map((repo) => {
                const isActive = repo.id === activeRepoId;
                const pending = pendingByRepo[repo.id];
                const isSwitching = switching === repo.id;

                return (
                  <button
                    key={repo.id}
                    type="button"
                    disabled={isActive || switching !== null}
                    onClick={() => handleSelectRepo(repo)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors',
                      isActive
                        ? 'bg-primary/10 ring-1 ring-primary/20'
                        : 'hover:bg-accent/60 disabled:opacity-100'
                    )}
                  >
                    {repo.is_private ? (
                      <Lock className="h-4 w-4 shrink-0 text-amber-400/80" />
                    ) : (
                      <Globe className="h-4 w-4 shrink-0 text-emerald-400/80" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{repo.full_name}</span>
                        {pending?.has_pending && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-amber-400"
                            title="Unsynced local changes"
                          />
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-normal">
                          <GitBranch className="mr-1 h-2.5 w-2.5" />
                          {repo.default_branch || 'main'}
                        </Badge>
                        {repo.description && (
                          <span className="truncate text-xs text-muted-foreground">
                            {repo.description}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSwitching ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                    ) : isActive ? (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>

        {confirmRepo && (
          <div className="border-t border-border/50 bg-muted/30 px-5 py-4">
            <p className="text-sm text-foreground mb-3">
              You have unsaved changes in{' '}
              <span className="font-medium">{activeRepoName}</span>. They&apos;ll stay on this
              device until you sync.
            </p>
            <DialogFooter className="sm:justify-end gap-2">
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
