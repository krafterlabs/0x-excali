import { Search } from 'lucide-react';

import { RepositoryListItem, type RepositoryListVariant } from '@/components/github/repository-list-item';
import { RepositorySearchInput } from '@/components/github/repository-search-input';
import { ErrorBanner } from '@/components/shared/error-banner';
import { Skeleton } from '@/components/ui/skeleton';
import type { GitHubRepository } from '@/types/github';

interface RepositoryPickerProps {
  repos: GitHubRepository[];
  loading?: boolean;
  error?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelect: (repo: GitHubRepository) => void;
  variant?: RepositoryListVariant;
  activeRepoId?: number;
  pendingRepoIds?: Record<number, boolean>;
  processingRepoId?: number | null;
  disabled?: boolean;
  emptyMessage?: string;
  listClassName?: string;
  showSearch?: boolean;
}

export function RepositoryPicker({
  repos,
  loading = false,
  error = '',
  searchQuery,
  onSearchChange,
  onSelect,
  variant = 'compact',
  activeRepoId,
  pendingRepoIds = {},
  processingRepoId = null,
  disabled = false,
  emptyMessage,
  listClassName = '',
  showSearch = true,
}: RepositoryPickerProps) {
  const defaultEmpty =
    searchQuery.trim().length > 0
      ? 'No repositories match your search'
      : 'No repositories found';

  return (
    <div className="space-y-3">
      {showSearch && (
        <RepositorySearchInput value={searchQuery} onChange={onSearchChange} />
      )}

      <ErrorBanner message={error} />

      <div
        className={
          variant === 'card'
            ? `space-y-2 ${listClassName}`.trim()
            : `space-y-1 ${listClassName}`.trim()
        }
      >
        {loading ? (
          Array.from({ length: variant === 'card' ? 5 : 6 }).map((_, i) => (
            <div
              key={i}
              className={
                variant === 'card'
                  ? 'rounded-xl border border-border/50 p-4'
                  : 'flex items-center gap-3 rounded-lg px-3 py-3'
              }
            >
              <Skeleton className="h-4 w-4 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                {variant === 'card' && <Skeleton className="h-3 w-72" />}
              </div>
            </div>
          ))
        ) : repos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Search className="mb-3 h-8 w-8 opacity-40" />
            <p className="text-sm">{emptyMessage ?? defaultEmpty}</p>
          </div>
        ) : (
          repos.map((repo) => (
            <RepositoryListItem
              key={repo.id}
              repo={repo}
              variant={variant}
              isActive={repo.id === activeRepoId}
              isProcessing={processingRepoId === repo.id}
              hasPending={pendingRepoIds[repo.id]}
              disabled={disabled || processingRepoId !== null}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
