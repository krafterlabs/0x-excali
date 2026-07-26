import { useEffect, useMemo, useState } from 'react';

import { ArrowRight, GitBranch, Globe, Layers, Loader2, Lock, Plus, Search } from 'lucide-react';
import { useLocation } from 'wouter';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

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

export function WorkspaceSetup() {
  const [, setLocation] = useLocation();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selecting, setSelecting] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function fetchRepos() {
      try {
        const { ListGitHubRepositories } = await import('../../wailsjs/go/workspace/Service');
        const result = await ListGitHubRepositories();
        if (!cancelled) {
          setRepos(result || []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load repositories');
          setLoading(false);
        }
      }
    }

    fetchRepos();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRepos = useMemo(() => {
    if (!searchQuery) return repos;
    const q = searchQuery.toLowerCase();
    return repos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.full_name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }, [repos, searchQuery]);

  async function handleSelectRepo(repo: Repository) {
    setSelecting(repo.id);
    try {
      const { SelectWorkspace, SyncFileTree } = await import('../../wailsjs/go/workspace/Service');
      await SelectWorkspace(repo);

      SyncFileTree().catch(console.error);

      setLocation('/workspace');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select workspace');
      setSelecting(null);
    }
  }

  async function handleCreateRepo() {
    if (!newRepoName.trim()) return;
    setCreating(true);

    try {
      const { CreateGitHubRepository } = await import('../../wailsjs/go/workspace/Service');
      const newRepo = await CreateGitHubRepository(
        newRepoName.trim(),
        newRepoDesc.trim(),
        newRepoPrivate
      );

      setShowCreateDialog(false);

      await handleSelectRepo(newRepo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create repository');
      setCreating(false);
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-background">
      <div className="border-b border-border/50 px-8 py-6">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-3 mb-2">
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
        <div className="mx-auto max-w-2xl h-full flex flex-col">
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search repositories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card/50 border-border/50"
              />
            </div>
            <Button
              variant="outline"
              className="gap-2 shrink-0"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="h-4 w-4" />
              New Repository
            </Button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex-1 -mx-1 px-1 overflow-y-auto">
            <div className="space-y-2 pb-4">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Card key={i} className="border-border/50 bg-card/30">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-5 w-5 rounded" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-72" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : filteredRepos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Search className="h-8 w-8 mb-3 opacity-40" />
                  <p className="text-sm">
                    {searchQuery ? 'No repositories match your search' : 'No repositories found'}
                  </p>
                </div>
              ) : (
                filteredRepos.map((repo) => (
                  <Card
                    key={repo.id}
                    className="group border-border/50 bg-card/30 transition-all duration-200 hover:border-primary/30 hover:bg-card/60 cursor-pointer"
                    onClick={() => handleSelectRepo(repo)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        {repo.is_private ? (
                          <Lock className="h-4 w-4 shrink-0 text-amber-400/70" />
                        ) : (
                          <Globe className="h-4 w-4 shrink-0 text-emerald-400/70" />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-foreground truncate">
                              {repo.full_name}
                            </span>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              <GitBranch className="mr-1 h-2.5 w-2.5" />
                              {repo.default_branch}
                            </Badge>
                          </div>
                          {repo.description && (
                            <p className="mt-0.5 text-xs text-muted-foreground truncate">
                              {repo.description}
                            </p>
                          )}
                        </div>

                        {selecting === repo.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : (
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Repository</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Repository name
              </label>
              <Input
                placeholder="my-excalidraw-workspace"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                placeholder="My Excalidraw diagrams workspace"
                value={newRepoDesc}
                onChange={(e) => setNewRepoDesc(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant={newRepoPrivate ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
                onClick={() => setNewRepoPrivate(true)}
              >
                <Lock className="h-3.5 w-3.5" />
                Private
              </Button>
              <Button
                variant={!newRepoPrivate ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
                onClick={() => setNewRepoPrivate(false)}
              >
                <Globe className="h-3.5 w-3.5" />
                Public
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateRepo}
              disabled={!newRepoName.trim() || creating}
              className="gap-2"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create & Select
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
