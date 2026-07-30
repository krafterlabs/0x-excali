export const GITHUB_REPO_URL = 'https://github.com/krafterlabs/0x-excali';
export const GITHUB_RELEASES_URL = 'https://github.com/krafterlabs/0x-excali/releases';
export const GITHUB_RELEASES_API =
  'https://api.github.com/repos/krafterlabs/0x-excali/releases?per_page=5';

export interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  body: string;
}
