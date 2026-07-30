import { useEffect, useState } from 'react';

import { GITHUB_RELEASES_API, type GitHubRelease } from '@/lib/github-project';

export function useGitHubReleases() {
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(GITHUB_RELEASES_API);
        if (!response.ok) {
          throw new Error('Could not load release notes');
        }
        const data = (await response.json()) as GitHubRelease[];
        if (!cancelled) setReleases(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load release notes');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { releases, loading, error };
}

function formatReleaseDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatReleaseSummary(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return 'No release notes.';
  const lines = trimmed.split('\n').filter((line) => line.trim());
  return lines.slice(0, 6).join('\n');
}

export { formatReleaseDate };
