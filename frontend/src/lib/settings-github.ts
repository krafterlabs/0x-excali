import { isLinkGitHubQuery } from '@/lib/routes';
import type { AuthUser } from '@/types/github';

export function shouldShowLinkRepos(
  authUser: AuthUser | null,
  isLocalOnly: boolean,
  searchParams: URLSearchParams
): boolean {
  if (!authUser) {
    return false;
  }
  return isLinkGitHubQuery(searchParams) || isLocalOnly;
}

export function getLinkedGitHubMessage(isLocalOnly: boolean): string | null {
  if (isLocalOnly) {
    return 'Choose a repository below to sync your local diagrams to GitHub.';
  }
  return 'Your workspace is linked to GitHub. Use the repository switcher in the sidebar to change repos.';
}
