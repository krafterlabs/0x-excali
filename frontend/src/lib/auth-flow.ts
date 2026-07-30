export const LINK_GITHUB_SESSION_KEY = 'linkGitHub';
export const LINK_GITHUB_INTENT_VALUE = '1';

export function setLinkGitHubIntent(): void {
  sessionStorage.setItem(LINK_GITHUB_SESSION_KEY, LINK_GITHUB_INTENT_VALUE);
}

export function consumeLinkGitHubIntent(): boolean {
  const value = sessionStorage.getItem(LINK_GITHUB_SESSION_KEY);
  if (!value) {
    return false;
  }
  sessionStorage.removeItem(LINK_GITHUB_SESSION_KEY);
  return true;
}

export function hasLinkGitHubIntent(): boolean {
  return sessionStorage.getItem(LINK_GITHUB_SESSION_KEY) === LINK_GITHUB_INTENT_VALUE;
}
