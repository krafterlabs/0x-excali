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

export interface ParsedReleaseNotes {
  heading?: string;
  items: string[];
}

export function parseReleaseNotes(body: string): ParsedReleaseNotes {
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let heading: string | undefined;
  const items: string[] = [];

  for (const line of lines) {
    if (line.startsWith('**Full Changelog**')) break;

    if (line.startsWith('##')) {
      heading = line.replace(/^#+\s*/, '').trim();
      continue;
    }

    if (/^[*\-]\s+/.test(line)) {
      items.push(
        line
          .replace(/^[*\-]\s+/, '')
          .replace(/\*([^*]+)\*/g, '$1')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .trim()
      );
    }
  }

  return { heading, items };
}

export function formatReleaseDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
