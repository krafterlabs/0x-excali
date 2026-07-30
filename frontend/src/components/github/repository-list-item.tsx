import { ReactNode } from 'react';

import { ArrowRight, Check, GitBranch, Globe, Loader2, Lock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { GitHubRepository } from '@/types/github';

export type RepositoryListVariant = 'compact' | 'card';

interface RepositoryListItemProps {
  repo: GitHubRepository;
  variant?: RepositoryListVariant;
  isActive?: boolean;
  isProcessing?: boolean;
  hasPending?: boolean;
  disabled?: boolean;
  onSelect: (repo: GitHubRepository) => void;
  trailing?: ReactNode;
}

export function RepositoryListItem({
  repo,
  variant = 'compact',
  isActive = false,
  isProcessing = false,
  hasPending = false,
  disabled = false,
  onSelect,
  trailing,
}: RepositoryListItemProps) {
  const privacyIcon = repo.is_private ? (
    <Lock className="h-4 w-4 shrink-0 text-amber-400/80" />
  ) : (
    <Globe className="h-4 w-4 shrink-0 text-emerald-400/80" />
  );

  const content = (
    <>
      {privacyIcon}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'truncate font-medium',
              variant === 'compact' ? 'text-sm' : 'text-sm text-foreground'
            )}
          >
            {repo.full_name}
          </span>
          {hasPending && (
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-amber-400"
              title="Unsynced local changes"
            />
          )}
        </div>
        <div className={cn('flex items-center gap-2', variant === 'compact' ? 'mt-1' : 'mt-0.5')}>
          <Badge variant="outline" className="text-[10px] font-normal shrink-0">
            <GitBranch className="mr-1 h-2.5 w-2.5" />
            {repo.default_branch || 'main'}
          </Badge>
          {repo.description && (
            <span className="truncate text-xs text-muted-foreground">{repo.description}</span>
          )}
        </div>
      </div>
      {trailing ??
        (isProcessing ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
        ) : isActive ? (
          <Check className="h-4 w-4 shrink-0 text-primary" />
        ) : variant === 'card' ? (
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        ) : null)}
    </>
  );

  if (variant === 'card') {
    return (
      <Card
        className={cn(
          'group border-border/50 bg-card/30 transition-all duration-200',
          !disabled && 'cursor-pointer hover:border-primary/30 hover:bg-card/60',
          disabled && 'opacity-60 pointer-events-none'
        )}
        onClick={() => !disabled && onSelect(repo)}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">{content}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || isActive}
      onClick={() => onSelect(repo)}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors',
        isActive ? 'bg-primary/10 ring-1 ring-primary/20' : 'hover:bg-accent/60',
        disabled && 'opacity-60'
      )}
    >
      {content}
    </button>
  );
}
