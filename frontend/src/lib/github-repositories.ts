import type { GitHubRepository } from '@/types/github';

export function filterRepositories(
  repos: GitHubRepository[],
  searchQuery: string
): GitHubRepository[] {
  if (!searchQuery.trim()) return repos;

  const q = searchQuery.toLowerCase();
  return repos.filter(
    (repo) =>
      repo.name.toLowerCase().includes(q) ||
      repo.full_name.toLowerCase().includes(q) ||
      repo.default_branch.toLowerCase().includes(q) ||
      (repo.description && repo.description.toLowerCase().includes(q))
  );
}
