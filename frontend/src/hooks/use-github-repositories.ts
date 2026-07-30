import { useCallback, useEffect, useMemo, useState } from 'react';

import { filterRepositories } from '@/lib/github-repositories';
import type { GitHubRepository, RepoPendingStatus } from '@/types/github';

interface UseGitHubRepositoriesOptions {
  enabled?: boolean;
  loadPendingStatus?: boolean;
}

export function useGitHubRepositories({
  enabled = true,
  loadPendingStatus = false,
}: UseGitHubRepositoriesOptions = {}) {
  const [repos, setRepos] = useState<GitHubRepository[]>([]);
  const [pendingByRepo, setPendingByRepo] = useState<Record<number, RepoPendingStatus>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError('');
    try {
      const { ListGitHubRepositories, GetRepoPendingStatus } =
        await import('../../wailsjs/go/workspace/Service');
      const result = await ListGitHubRepositories();
      const list = result || [];
      setRepos(list);

      if (loadPendingStatus) {
        const pendingEntries = await Promise.all(
          list.map(async (repo: GitHubRepository) => {
            const status = await GetRepoPendingStatus(repo.id);
            return [repo.id, status] as const;
          })
        );
        setPendingByRepo(Object.fromEntries(pendingEntries));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load repositories');
    } finally {
      setLoading(false);
    }
  }, [enabled, loadPendingStatus]);

  useEffect(() => {
    if (!enabled) {
      setSearchQuery('');
      setError('');
      return;
    }
    load();
  }, [enabled, load]);

  const filteredRepos = useMemo(
    () => filterRepositories(repos, searchQuery),
    [repos, searchQuery]
  );

  return {
    repos,
    filteredRepos,
    pendingByRepo,
    loading,
    error,
    setError,
    searchQuery,
    setSearchQuery,
    reload: load,
  };
}
